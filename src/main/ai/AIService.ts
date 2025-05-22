import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { configService } from '../config/ConfigService';
import { PythonEnvironment } from '../python/PythonEnvironment';

export interface AIJob {
  id: string;
  recordingId: string;
  transcriptPath: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  result?: AIResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AIResult {
  title: string;
  summary: string;
}

export interface AIWorkerMessage {
  type: 'progress' | 'result' | 'error';
  progress?: number;
  message?: string;
  title?: string;
  summary?: string;
  error?: string;
  details?: string;
}

export interface AIServiceOptions {
  maxConcurrentJobs?: number;
  timeout?: number;
}

export class AIService {
  private jobs: Map<string, AIJob> = new Map();
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private pythonEnv: PythonEnvironment;
  private maxConcurrentJobs: number;
  private timeout: number;

  constructor(options: AIServiceOptions = {}) {
    this.pythonEnv = new PythonEnvironment();
    this.maxConcurrentJobs = options.maxConcurrentJobs || 2;
    this.timeout = options.timeout || 300000; // 5 minutes
  }

  async initialize(): Promise<void> {
    // Set up Python environment if needed
    const isReady = await this.pythonEnv.isEnvironmentReady();
    if (!isReady) {
      await this.pythonEnv.setup();
    }
  }

  async processTranscript(recordingId: string, transcriptPath: string): Promise<string> {
    const jobId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: AIJob = {
      id: jobId,
      recordingId,
      transcriptPath,
      status: 'queued',
      progress: 0,
      createdAt: new Date()
    };

    this.jobs.set(jobId, job);

    try {
      // Check if we have OpenAI configuration
      const hasConfig = await configService.hasOpenAIConfig();
      if (!hasConfig) {
        throw new Error('OpenAI API key not configured');
      }

      // Start processing
      await this.startJob(jobId);
      return jobId;
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  private async startJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Check concurrent job limit
    const activeJobs = Array.from(this.jobs.values()).filter(j => j.status === 'processing');
    if (activeJobs.length >= this.maxConcurrentJobs) {
      // Job stays queued
      return;
    }

    job.status = 'processing';
    job.startedAt = new Date();

    try {
      const apiKey = await configService.getOpenAIApiKey();
      if (!apiKey) {
        throw new Error('OpenAI API key not available');
      }

      const config = await configService.getOpenAIConfig();
      const model = config?.model || 'gpt-4o';

      // Spawn Python AI worker
      const pythonPath = this.pythonEnv.getPythonPath();
      const workerPath = path.join(__dirname, '../../python/ai_worker.py');

      const args = [
        workerPath,
        job.transcriptPath,
        '--api-key', apiKey,
        '--model', model
      ];

      const childProcess = spawn(pythonPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONPATH: path.join(__dirname, '../../python'),
          PYTHONUNBUFFERED: '1'
        }
      });

      this.activeProcesses.set(jobId, childProcess);

      // Set timeout
      const timeoutId = setTimeout(() => {
        this.cancelJob(jobId, 'Timeout');
      }, this.timeout);

      // Handle stdout (progress and results)
      childProcess.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter((line: string) => line.trim());
        
        for (const line of lines) {
          try {
            const message: AIWorkerMessage = JSON.parse(line);
            this.handleWorkerMessage(jobId, message);
          } catch (error) {
            console.warn('Failed to parse AI worker message:', line);
          }
        }
      });

      // Handle stderr (errors and warnings)
      childProcess.stderr?.on('data', (data: Buffer) => {
        console.warn(`AI worker stderr (${jobId}):`, data.toString());
      });

      // Handle process completion
      childProcess.on('close', (code: number | null) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(jobId);

        const currentJob = this.jobs.get(jobId);
        if (currentJob && currentJob.status === 'processing') {
          if (code === 0) {
            // Success should have been handled by result message
            if (currentJob.status === 'processing') {
              currentJob.status = 'failed';
              currentJob.error = 'Process completed without result';
            }
          } else {
            currentJob.status = 'failed';
            currentJob.error = `Process exited with code ${code}`;
          }
          currentJob.completedAt = new Date();
        }

        // Start next queued job
        this.processNextQueuedJob();
      });

      // Handle process errors
      childProcess.on('error', (error: Error) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(jobId);
        
        const currentJob = this.jobs.get(jobId);
        if (currentJob) {
          currentJob.status = 'failed';
          currentJob.error = `Process error: ${error.message}`;
          currentJob.completedAt = new Date();
        }

        this.processNextQueuedJob();
      });

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();
      this.processNextQueuedJob();
    }
  }

  private handleWorkerMessage(jobId: string, message: AIWorkerMessage): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    switch (message.type) {
      case 'progress':
        job.progress = message.progress || 0;
        // Emit progress event
        this.emitJobProgress(jobId, job.progress, message.message || '');
        break;

      case 'result':
        if (message.title && message.summary) {
          job.result = {
            title: message.title,
            summary: message.summary
          };
          job.status = 'completed';
          job.progress = 100;
          job.completedAt = new Date();
          
          // Emit completion event
          this.emitJobCompleted(jobId, job.result);
        }
        break;

      case 'error':
        job.status = 'failed';
        job.error = message.error || 'Unknown error';
        job.completedAt = new Date();
        
        // Emit error event
        this.emitJobFailed(jobId, job.error);
        break;
    }
  }

  private processNextQueuedJob(): void {
    const queuedJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'queued')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (queuedJobs.length > 0) {
      this.startJob(queuedJobs[0].id).catch(console.error);
    }
  }

  async cancelJob(jobId: string, reason: string = 'Cancelled'): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const childProcess = this.activeProcesses.get(jobId);
    if (childProcess) {
      childProcess.kill('SIGTERM');
      this.activeProcesses.delete(jobId);
    }

    job.status = 'cancelled';
    job.error = reason;
    job.completedAt = new Date();

    this.processNextQueuedJob();
  }

  async getJobStatus(jobId: string): Promise<AIJob | null> {
    return this.jobs.get(jobId) || null;
  }

  async getActiveJobs(): Promise<AIJob[]> {
    return Array.from(this.jobs.values()).filter(job => 
      job.status === 'processing' || job.status === 'queued'
    );
  }

  // Event emission methods (to be connected to IPC)
  private emitJobProgress(jobId: string, progress: number, message: string): void {
    // This will be connected to IPC events
    console.log(`AI Job ${jobId} progress: ${progress}% - ${message}`);
  }

  private emitJobCompleted(jobId: string, result: AIResult): void {
    // This will be connected to IPC events
    console.log(`AI Job ${jobId} completed:`, result);
  }

  private emitJobFailed(jobId: string, error: string): void {
    // This will be connected to IPC events
    console.log(`AI Job ${jobId} failed:`, error);
  }

  // Cleanup old jobs
  async cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = new Date(Date.now() - maxAge);
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.completedAt && job.completedAt < cutoff) {
        this.jobs.delete(jobId);
      }
    }
  }
}

// Singleton instance
export const aiService = new AIService();
