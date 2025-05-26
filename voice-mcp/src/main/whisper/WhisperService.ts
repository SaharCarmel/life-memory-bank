import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { EventEmitter } from '@shared/events';
import { PythonEnvironment } from '../python/PythonEnvironment';
import { ConfigService } from '../config/ConfigService';
import {
  TranscriptionJob,
  TranscriptionRequest,
  WhisperServiceOptions,
  WhisperWorkerMessage,
  TranscriptionProvider
} from './types';

// Model processing speed factors (real-time multipliers)
const MODEL_SPEED_FACTORS = {
  'tiny': 5.0,    // 5x real-time (fastest)
  'base': 3.0,    // 3x real-time
  'small': 2.0,   // 2x real-time
  'medium': 1.5,  // 1.5x real-time
  'large': 1.0,   // 1x real-time (slowest)
  'turbo': 2.5    // 2.5x real-time (optimized)
};

// Fallback model hierarchy for retries
const MODEL_FALLBACK_CHAIN = {
  'large': 'medium',
  'medium': 'small', 
  'small': 'base',
  'base': 'tiny',
  'turbo': 'base',
  'tiny': null // No fallback for tiny
};

export class WhisperService {
  private pythonEnv: PythonEnvironment;
  private eventEmitter: EventEmitter;
  private configService: ConfigService;
  private jobs: Map<string, TranscriptionJob> = new Map();
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private options: WhisperServiceOptions;
  private isInitialized: boolean = false;

  constructor(
    pythonEnv: PythonEnvironment,
    eventEmitter: EventEmitter,
    configService: ConfigService,
    options: WhisperServiceOptions = {}
  ) {
    this.pythonEnv = pythonEnv;
    this.eventEmitter = eventEmitter;
    this.configService = configService;
    this.options = {
      modelName: 'turbo',
      maxConcurrentJobs: 1,
      timeout: 300000, // 5 minutes (fallback)
      timeoutMultiplier: 3.0, // 3x estimated processing time
      minTimeout: 60000, // 1 minute minimum
      maxTimeout: 1800000, // 30 minutes maximum
      enableRetry: true,
      maxRetries: 2,
      retryWithFasterModel: true,
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

    // Get transcription configuration
    const transcriptionConfig = await this.configService.getTranscriptionConfig();
    const provider = transcriptionConfig.provider;

    // For OpenAI provider, check if API key is available
    if (provider === 'openai') {
      const hasOpenAIConfig = await this.configService.hasOpenAIConfig();
      if (!hasOpenAIConfig) {
        throw new Error('OpenAI API key not configured. Please configure OpenAI settings first.');
      }
    }

    // Check concurrent job limit
    const activeJobs = Array.from(this.jobs.values()).filter(
      job => job.status === 'processing' || job.status === 'queued'
    );

    if (activeJobs.length >= this.options.maxConcurrentJobs!) {
      throw new Error('Maximum concurrent transcription jobs reached');
    }

    // Calculate estimated cost for OpenAI
    let estimatedCost: number | undefined;
    if (provider === 'openai') {
      try {
        // Rough cost estimation: $0.006 per minute
        const stats = fs.statSync(request.filepath);
        const fileSizeBytes = stats.size;
        const estimatedDurationMinutes = (fileSizeBytes / (16 * 1024)) / 60; // Rough estimate
        estimatedCost = estimatedDurationMinutes * 0.006;
      } catch (error) {
        console.warn('Could not estimate cost:', error);
      }
    }

    // Create job
    const jobId = uuidv4();
    const job: TranscriptionJob = {
      id: jobId,
      recordingId: request.recordingId,
      filepath: request.filepath,
      status: 'queued',
      progress: 0,
      provider,
      estimatedCost,
      createdAt: new Date()
    };

    this.jobs.set(jobId, job);

    // Emit job created event
    this.eventEmitter.emit({
      type: 'transcription:job-created',
      timestamp: Date.now(),
      jobId,
      recordingId: request.recordingId,
      provider,
      estimatedCost
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
   * Calculate dynamic timeout based on audio file duration and model
   */
  private calculateTimeout(filepath: string, modelName: string): number {
    try {
      // Get audio duration estimate from file size
      const stats = fs.statSync(filepath);
      const fileSizeBytes = stats.size;
      
      // Rough estimate: WebM/Opus at 128kbps = ~16KB/s
      const estimatedDurationSeconds = fileSizeBytes / (16 * 1024);
      
      // Get model speed factor
      const speedFactor = MODEL_SPEED_FACTORS[modelName as keyof typeof MODEL_SPEED_FACTORS] || 2.0;
      
      // Calculate estimated processing time
      const estimatedProcessingTime = estimatedDurationSeconds / speedFactor;
      
      // Apply timeout multiplier for safety margin
      const dynamicTimeout = estimatedProcessingTime * 1000 * (this.options.timeoutMultiplier || 3.0);
      
      // Apply min/max bounds
      const minTimeout = this.options.minTimeout || 60000; // 1 minute
      const maxTimeout = this.options.maxTimeout || 1800000; // 30 minutes
      
      const finalTimeout = Math.max(minTimeout, Math.min(maxTimeout, dynamicTimeout));
      
      console.log(`Dynamic timeout calculation for ${filepath}:`, {
        fileSizeBytes,
        estimatedDurationSeconds: Math.round(estimatedDurationSeconds),
        modelName,
        speedFactor,
        estimatedProcessingTime: Math.round(estimatedProcessingTime),
        dynamicTimeout: Math.round(dynamicTimeout / 1000),
        finalTimeout: Math.round(finalTimeout / 1000),
        bounds: { min: Math.round(minTimeout / 1000), max: Math.round(maxTimeout / 1000) }
      });
      
      return finalTimeout;
    } catch (error) {
      console.warn(`Failed to calculate dynamic timeout for ${filepath}:`, error);
      return this.options.timeout || 300000; // Fallback to default
    }
  }

  /**
   * Get fallback model for retry
   */
  private getFallbackModel(currentModel: string): string | null {
    return MODEL_FALLBACK_CHAIN[currentModel as keyof typeof MODEL_FALLBACK_CHAIN] || null;
  }

  /**
   * Retry transcription with fallback model
   */
  private async retryWithFallbackModel(jobId: string, originalError: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || !this.options.enableRetry || !this.options.retryWithFasterModel) {
      return;
    }

    const fallbackModel = this.getFallbackModel(this.options.modelName!);
    if (!fallbackModel) {
      console.log(`No fallback model available for ${this.options.modelName}, cannot retry`);
      return;
    }

    console.log(`Retrying transcription ${jobId} with fallback model: ${fallbackModel}`);
    
    // Create new job with fallback model
    const retryJobId = uuidv4();
    const retryJob: TranscriptionJob = {
      id: retryJobId,
      recordingId: job.recordingId,
      filepath: job.filepath,
      status: 'queued',
      progress: 0,
      createdAt: new Date()
    };

    this.jobs.set(retryJobId, retryJob);

    // Emit retry event
    this.eventEmitter.emit({
      type: 'transcription:retry-started',
      timestamp: Date.now(),
      originalJobId: jobId,
      retryJobId,
      recordingId: job.recordingId,
      fallbackModel,
      originalError
    });

    // Process with fallback model
    const originalModel = this.options.modelName;
    this.options.modelName = fallbackModel;
    
    try {
      await this.processJob(retryJobId);
    } finally {
      // Restore original model
      this.options.modelName = originalModel;
    }
  }

  /**
   * Attempt fallback to local processing when OpenAI fails
   */
  private async attemptLocalFallback(jobId: string, originalError: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    console.log(`Attempting local fallback for OpenAI job ${jobId} due to: ${originalError}`);
    
    // Create new job with local provider
    const fallbackJobId = uuidv4();
    const transcriptionConfig = await this.configService.getTranscriptionConfig();
    
    const fallbackJob: TranscriptionJob = {
      id: fallbackJobId,
      recordingId: job.recordingId,
      filepath: job.filepath,
      status: 'queued',
      progress: 0,
      provider: 'local', // Force local processing
      createdAt: new Date()
    };

    this.jobs.set(fallbackJobId, fallbackJob);

    // Emit fallback event
    this.eventEmitter.emit({
      type: 'transcription:fallback-started',
      timestamp: Date.now(),
      originalJobId: jobId,
      fallbackJobId,
      recordingId: job.recordingId,
      fallbackProvider: 'local',
      originalError
    });

    // Process with local provider
    try {
      await this.processJob(fallbackJobId);
    } catch (error) {
      console.error(`Local fallback also failed for job ${jobId}:`, error);
      this.handleJobError(fallbackJobId, `Local fallback failed: ${error}`);
    }
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

      // Get transcription configuration
      const transcriptionConfig = await this.configService.getTranscriptionConfig();
      const provider = job.provider || transcriptionConfig.provider;

      let workerScript: string;
      let args: string[];

      if (provider === 'openai') {
        // Use OpenAI transcription worker
        workerScript = this.pythonEnv.getOpenAIWorkerScriptPath();
        const openaiConfig = await this.configService.getOpenAIConfig();
        const apiKey = openaiConfig?.apiKey;

        if (!apiKey) {
          throw new Error('OpenAI API key not available');
        }

        args = [
          workerScript,
          job.filepath,
          '--model', transcriptionConfig.openaiModel,
          '--api-key', apiKey
        ];

        // Add language if specified
        if (transcriptionConfig.language) {
          args.push('--language', transcriptionConfig.language);
        }
      } else {
        // Use local Whisper worker
        workerScript = this.pythonEnv.getWorkerScriptPath();
        args = [
          workerScript,
          job.filepath,
          '--model', transcriptionConfig.localModel
        ];
      }

      if (outputPath) {
        args.push('--output', outputPath);
      }

      console.log(`Starting ${provider} transcription worker for job ${jobId}:`, { workerScript, provider });

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
        console.error(`${provider} worker stderr [${jobId}]:`, data.toString());
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

      // Calculate dynamic timeout based on provider and file
      let dynamicTimeout: number;
      
      if (provider === 'openai') {
        // OpenAI API calls are typically faster but depend on network and file upload
        // Use a simpler timeout calculation: 2 minutes base + 30 seconds per MB
        const stats = fs.statSync(job.filepath);
        const fileSizeMB = stats.size / (1024 * 1024);
        dynamicTimeout = Math.max(120000, 120000 + (fileSizeMB * 30000)); // 2 min + 30s per MB
      } else {
        // Use existing local processing timeout calculation
        dynamicTimeout = this.calculateTimeout(job.filepath, transcriptionConfig.localModel);
      }
      
      console.log(`Setting ${provider} timeout for job ${jobId}: ${Math.round(dynamicTimeout / 1000)}s`);
      
      // Set dynamic timeout
      setTimeout(() => {
        if (this.activeProcesses.has(jobId)) {
          const proc = this.activeProcesses.get(jobId);
          proc?.kill('SIGTERM');
          this.activeProcesses.delete(jobId);
          
          // For OpenAI, try fallback to local if auto-fallback is enabled
          if (provider === 'openai' && transcriptionConfig.autoFallbackToLocal) {
            console.log(`OpenAI transcription timed out for job ${jobId}, attempting local fallback`);
            this.attemptLocalFallback(jobId, 'OpenAI transcription timed out');
          } else if (provider === 'local' && this.options.enableRetry && this.options.retryWithFasterModel) {
            this.retryWithFallbackModel(jobId, 'Transcription timed out');
          } else {
            this.handleJobError(jobId, 'Transcription timed out');
          }
        }
      }, dynamicTimeout);

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
