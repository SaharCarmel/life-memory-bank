import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from '@shared/events';
import { PythonEnvironment } from '../python/PythonEnvironment';
import {
  TranscriptionJob,
  TranscriptionResult,
  TranscriptionRequest,
  WhisperServiceOptions,
  WhisperWorkerMessage
} from './types';

export class WhisperService {
  private pythonEnv: PythonEnvironment;
  private eventEmitter: EventEmitter;
  private jobs: Map<string, TranscriptionJob> = new Map();
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private options: WhisperServiceOptions;
  private isInitialized: boolean = false;

  constructor(
    pythonEnv: PythonEnvironment,
    eventEmitter: EventEmitter,
    options: WhisperServiceOptions = {}
  ) {
    this.pythonEnv = pythonEnv;
    this.eventEmitter = eventEmitter;
    this.options = {
      modelName: 'turbo',
      maxConcurrentJobs: 1,
      timeout: 300000, // 5 minutes
      ...options
    };
  }

  /**
   * Initialize the Whisper service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing Whisper service...');

    // Check if Python environment is ready
    const isReady = await this.pythonEnv.isEnvironmentReady();
    if (!isReady) {
      console.log('Python environment not ready, setting up...');
      const setupResult = await this.pythonEnv.setup();
      if (!setupResult.success) {
        throw new Error(`Failed to setup Python environment: ${setupResult.error}`);
      }
    }

    this.isInitialized = true;
    console.log('Whisper service initialized successfully');
  }

  /**
   * Start a transcription job
   */
  async transcribe(request: TranscriptionRequest): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check if file exists
    if (!fs.existsSync(request.filepath)) {
      throw new Error(`Audio file not found: ${request.filepath}`);
    }

    // Check concurrent job limit
    const activeJobs = Array.from(this.jobs.values()).filter(
      job => job.status === 'processing' || job.status === 'queued'
    );

    if (activeJobs.length >= this.options.maxConcurrentJobs!) {
      throw new Error('Maximum concurrent transcription jobs reached');
    }

    // Create job
    const jobId = uuidv4();
    const job: TranscriptionJob = {
      id: jobId,
      recordingId: request.recordingId,
      filepath: request.filepath,
      status: 'queued',
      progress: 0,
      createdAt: new Date()
    };

    this.jobs.set(jobId, job);

    // Emit job created event
    this.eventEmitter.emit({
      type: 'transcription:job-created',
      timestamp: Date.now(),
      jobId,
      recordingId: request.recordingId
    });

    // Start processing
    this.processJob(jobId, request.outputPath);

    return jobId;
  }

  /**
   * Get job status
   */
  getJob(jobId: string): TranscriptionJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs for a recording
   */
  getJobsForRecording(recordingId: string): TranscriptionJob[] {
    return Array.from(this.jobs.values()).filter(
      job => job.recordingId === recordingId
    );
  }

  /**
   * Cancel a transcription job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    // Kill the process if it's running
    const childProcess = this.activeProcesses.get(jobId);
    if (childProcess) {
      childProcess.kill('SIGTERM');
      this.activeProcesses.delete(jobId);
    }

    // Update job status
    job.status = 'cancelled';
    job.completedAt = new Date();

    // Emit event
    this.eventEmitter.emit({
      type: 'transcription:job-cancelled',
      timestamp: Date.now(),
      jobId,
      recordingId: job.recordingId
    });

    return true;
  }

  /**
   * Process a transcription job
   */
  private async processJob(jobId: string, outputPath?: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    try {
      // Update job status
      job.status = 'processing';
      job.startedAt = new Date();

      // Emit job started event
      this.eventEmitter.emit({
        type: 'transcription:job-started',
        timestamp: Date.now(),
        jobId,
        recordingId: job.recordingId
      });

      // Prepare arguments for Python worker
      const args = [
        this.pythonEnv.getWorkerScriptPath(),
        job.filepath,
        '--model', this.options.modelName!
      ];

      if (outputPath) {
        args.push('--output', outputPath);
      }

      // Spawn Python process
      const pythonPath = this.pythonEnv.getPythonPath();
      const childProcess = spawn(pythonPath, args, {
        stdio: 'pipe',
        env: { ...process.env }
      });

      this.activeProcesses.set(jobId, childProcess);

      // Handle stdout (JSON messages)
      let stdoutBuffer = '';
      childProcess.stdout?.on('data', (data: Buffer) => {
        stdoutBuffer += data.toString();
        
        // Process complete JSON messages
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message: WhisperWorkerMessage = JSON.parse(line.trim());
              this.handleWorkerMessage(jobId, message);
            } catch (error) {
              console.error('Failed to parse worker message:', line, error);
            }
          }
        }
      });

      // Handle stderr
      childProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`Whisper worker stderr [${jobId}]:`, data.toString());
      });

      // Handle process completion
      childProcess.on('close', (code: number | null) => {
        this.activeProcesses.delete(jobId);
        
        const currentJob = this.jobs.get(jobId);
        if (currentJob && currentJob.status === 'processing') {
          if (code === 0) {
            // Success case should have been handled by result message
            if (!currentJob.result) {
              this.handleJobError(jobId, 'Process completed but no result received');
            }
          } else {
            this.handleJobError(jobId, `Process exited with code ${code}`);
          }
        }
      });

      // Handle process errors
      childProcess.on('error', (error: Error) => {
        this.activeProcesses.delete(jobId);
        this.handleJobError(jobId, `Process error: ${error.message}`);
      });

      // Set timeout
      setTimeout(() => {
        if (this.activeProcesses.has(jobId)) {
          const proc = this.activeProcesses.get(jobId);
          proc?.kill('SIGTERM');
          this.activeProcesses.delete(jobId);
          this.handleJobError(jobId, 'Transcription timed out');
        }
      }, this.options.timeout!);

    } catch (error) {
      this.handleJobError(jobId, `Failed to start transcription: ${error}`);
    }
  }

  /**
   * Handle messages from Python worker
   */
  private handleWorkerMessage(jobId: string, message: WhisperWorkerMessage): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    switch (message.type) {
      case 'progress':
        if (typeof message.progress === 'number') {
          job.progress = Math.max(0, Math.min(100, message.progress));
          
          // Emit progress event
          this.eventEmitter.emit({
            type: 'transcription:progress',
            timestamp: Date.now(),
            jobId,
            recordingId: job.recordingId,
            progress: job.progress,
            message: message.message
          });
        }
        break;

      case 'result':
        if (message.text && message.language && message.segments) {
          job.result = {
            text: message.text,
            language: message.language,
            segments: message.segments
          };
          job.status = 'completed';
          job.progress = 100;
          job.completedAt = new Date();

          // Emit completion event
          this.eventEmitter.emit({
            type: 'transcription:completed',
            timestamp: Date.now(),
            jobId,
            recordingId: job.recordingId,
            result: job.result
          });
        }
        break;

      case 'error':
        this.handleJobError(jobId, message.error || 'Unknown error', message.details);
        break;
    }
  }

  /**
   * Handle job errors
   */
  private handleJobError(jobId: string, error: string, details?: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.status = 'failed';
    job.error = error;
    job.completedAt = new Date();

    console.error(`Transcription job ${jobId} failed:`, error);
    if (details) {
      console.error('Error details:', details);
    }

    // Emit error event
    this.eventEmitter.emit({
      type: 'transcription:failed',
      timestamp: Date.now(),
      jobId,
      recordingId: job.recordingId,
      error,
      details
    });
  }

  /**
   * Clean up completed jobs older than specified time
   */
  cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): void { // 24 hours default
    const now = Date.now();
    const jobsToDelete: string[] = [];

    for (const [jobId, job] of this.jobs) {
      if (job.status === 'completed' || job.status === 'failed') {
        const completedTime = job.completedAt?.getTime() || job.createdAt.getTime();
        if (now - completedTime > maxAge) {
          jobsToDelete.push(jobId);
        }
      }
    }

    for (const jobId of jobsToDelete) {
      this.jobs.delete(jobId);
    }

    if (jobsToDelete.length > 0) {
      console.log(`Cleaned up ${jobsToDelete.length} old transcription jobs`);
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
  } {
    const jobs = Array.from(this.jobs.values());
    return {
      totalJobs: jobs.length,
      activeJobs: jobs.filter(j => j.status === 'processing' || j.status === 'queued').length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length
    };
  }

  /**
   * Dispose of the service
   */
  dispose(): void {
    // Cancel all active jobs
    for (const [jobId] of this.activeProcesses) {
      this.cancelJob(jobId);
    }

    this.jobs.clear();
    this.activeProcesses.clear();
    this.isInitialized = false;
  }
}
