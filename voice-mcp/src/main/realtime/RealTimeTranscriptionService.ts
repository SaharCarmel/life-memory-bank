import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from '@shared/events';
import { PythonEnvironment } from '../python/PythonEnvironment';
import { ProcessingChunk } from '../../renderer/services/RecorderService';
import { StorageService, TranscriptSegment } from '../storage/StorageService';
import { RealTimeTranscriptionConfig } from '../config/ConfigService';

// Import our new components
import { RealTimeJob } from './types';
import { JobManager } from './JobManager';
import { TranscriptManager } from './TranscriptManager';
import { CircuitBreaker } from './CircuitBreaker';
import { MemoryManager } from './MemoryManager';
import { TranscriptionProcessor } from './TranscriptionProcessor';
import { ErrorClassifier } from './ErrorClassifier';

export class RealTimeTranscriptionService {
  private pythonEnv: PythonEnvironment;
  private eventEmitter: EventEmitter;
  private config: RealTimeTranscriptionConfig;
  private storageService: StorageService;
  
  // Component instances
  private jobManager: JobManager;
  private transcriptManager: TranscriptManager;
  private circuitBreaker: CircuitBreaker;
  private memoryManager: MemoryManager;
  private transcriptionProcessor: TranscriptionProcessor;
  
  // File management
  private tempDir: string;
  private isInitialized: boolean = false;

  constructor(
    pythonEnv: PythonEnvironment,
    eventEmitter: EventEmitter,
    storageService: StorageService,
    config: Partial<RealTimeTranscriptionConfig> = {}
  ) {
    this.pythonEnv = pythonEnv;
    this.eventEmitter = eventEmitter;
    this.storageService = storageService;
    this.config = {
      enabled: true,
      whisperModel: 'tiny',
      chunkDuration: 5,
      chunkOverlap: 1,
      maxConcurrentJobs: 2,
      enableSegmentMerging: true,
      autoStartForRecordings: false,
      language: undefined,
      ...config
    };
    
    this.tempDir = path.join(os.tmpdir(), 'voicemcp-realtime');
    
    // Initialize components
    this.transcriptionProcessor = new TranscriptionProcessor(this.pythonEnv, this.tempDir);
    this.jobManager = new JobManager(this.eventEmitter, this.transcriptionProcessor);
    this.transcriptManager = new TranscriptManager(this.eventEmitter, this.storageService);
    this.circuitBreaker = new CircuitBreaker(5, 60000, this.eventEmitter);
    this.memoryManager = new MemoryManager(
      this.jobManager,
      this.transcriptManager,
      this.transcriptionProcessor
    );
  }

  /**
   * Initialize the real-time transcription service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing RealTimeTranscriptionService...');

    // Ensure Python environment is ready
    const isReady = await this.pythonEnv.isEnvironmentReady();
    if (!isReady) {
      const setupResult = await this.pythonEnv.setup();
      if (!setupResult.success) {
        throw new Error(`Failed to setup Python environment: ${setupResult.error}`);
      }
    }

    // Create temp directory
    await this.transcriptionProcessor.ensureTempDirectory();
    
    // Start job processor
    this.startJobProcessor();

    // Start periodic cleanup
    this.memoryManager.startPeriodicCleanup();

    // Perform initial cleanup
    await this.memoryManager.performComprehensiveCleanup();

    this.isInitialized = true;
    console.log('RealTimeTranscriptionService initialized successfully');
  }

  /**
   * Start real-time transcription for a recording
   */
  async startTranscription(recordingId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.config.enabled) {
      console.log('Real-time transcription is disabled');
      return;
    }

    // Perform memory check before starting
    await this.memoryManager.checkMemoryLimits();

    // Create transcript builder for this recording
    this.transcriptManager.createTranscriptBuilder(recordingId);
    
    this.eventEmitter.emit({
      type: 'realtime-transcription:started',
      timestamp: Date.now(),
      recordingId
    });

    console.log(`Started real-time transcription for recording: ${recordingId}`);
  }

  /**
   * Stop real-time transcription for a recording
   */
  async stopTranscription(recordingId: string): Promise<void> {
    // Cancel all pending jobs for this recording
    await this.jobManager.cancelJobsForRecording(recordingId);

    // Finalize transcript
    await this.transcriptManager.finalizeTranscript(recordingId);

    // Clean up transcript builder
    await this.transcriptManager.cleanupTranscriptBuilder(recordingId);

    this.eventEmitter.emit({
      type: 'realtime-transcription:stopped',
      timestamp: Date.now(),
      recordingId
    });

    console.log(`Stopped real-time transcription for recording: ${recordingId}`);
  }

  /**
   * Process a new audio chunk
   */
  async processChunk(recordingId: string, chunk: ProcessingChunk): Promise<string> {
    if (!this.isInitialized || !this.config.enabled) {
      throw new Error('Real-time transcription service not initialized or disabled');
    }

    // Check memory limits before processing
    await this.memoryManager.checkMemoryLimits();

    // Create and queue job
    const jobId = this.jobManager.createJob(recordingId, chunk);

    // Update memory statistics
    this.memoryManager.updateMemoryStats();

    return jobId;
  }

  /**
   * Get current transcript for a recording
   */
  getTranscript(recordingId: string): TranscriptSegment[] {
    return this.transcriptManager.getTranscript(recordingId);
  }

  /**
   * Get merged text for a recording
   */
  getMergedText(recordingId: string): string {
    return this.transcriptManager.getMergedText(recordingId);
  }

  /**
   * Get job status
   */
  getJob(jobId: string): RealTimeJob | undefined {
    return this.jobManager.getJob(jobId);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    return this.jobManager.cancelJob(jobId);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RealTimeTranscriptionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Updated real-time transcription config:', this.config);
  }

  /**
   * Get service statistics
   */
  getStats() {
    const jobStats = this.jobManager.getStats();
    const transcriptStats = this.transcriptManager.getStats();
    const memoryStats = this.memoryManager.getMemoryStats();

    return {
      jobs: jobStats,
      transcriptBuilders: transcriptStats,
      circuitBreaker: {
        failureCount: this.circuitBreaker.getFailureCount(),
        isOpen: this.circuitBreaker.isOpen(),
        lastFailureTime: this.circuitBreaker.getLastFailureTime()
      },
      memory: memoryStats,
      config: this.config
    };
  }

  /**
   * Get detailed memory information
   */
  getDetailedMemoryInfo() {
    return this.memoryManager.getDetailedMemoryInfo();
  }

  /**
   * Get memory health report
   */
  getMemoryHealthReport() {
    return this.memoryManager.getMemoryHealthReport();
  }

  /**
   * Force immediate cleanup
   */
  async forceCleanup(): Promise<void> {
    await this.memoryManager.forceCleanup();
  }

  /**
   * Dispose of the service and clean up resources
   */
  async dispose(): Promise<void> {
    console.log('Disposing RealTimeTranscriptionService...');

    // Dispose all components
    await this.jobManager.dispose();
    await this.transcriptManager.dispose();
    await this.memoryManager.dispose();

    this.isInitialized = false;
    console.log('RealTimeTranscriptionService disposed');
  }

  /**
   * Start the job processor
   */
  private startJobProcessor(): void {
    const processJobs = async () => {
      try {
        await this.processNextJob();
      } catch (error) {
        console.error('Error in job processor:', error);
      }
      
      // Schedule next processing cycle
      setTimeout(processJobs, 100); // Check every 100ms
    };

    processJobs();
  }

  /**
   * Process the next job in the queue
   */
  private async processNextJob(): Promise<void> {
    // Check if we can process more jobs
    if (!this.jobManager.canProcessMoreJobs(this.config.maxConcurrentJobs)) {
      return;
    }

    // Don't process if circuit breaker is open
    if (this.circuitBreaker.isOpen()) {
      return;
    }

    const job = this.jobManager.getNextJob();
    if (!job || job.status !== 'queued') {
      return;
    }

    try {
      await this.executeJob(job);
    } catch (error) {
      console.error(`Failed to execute job ${job.id}:`, error);
      await this.handleJobError(job, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Execute a transcription job
   */
  private async executeJob(job: RealTimeJob): Promise<void> {
    this.jobManager.markJobActive(job.id);

    this.eventEmitter.emit({
      type: 'realtime-transcription:job-started',
      timestamp: Date.now(),
      recordingId: job.recordingId,
      chunkId: job.chunkId,
      jobId: job.id
    });

    try {
      // Convert chunk to temporary file
      const tempFilePath = await this.transcriptionProcessor.createTempFile(job.chunk);
      job.tempFilePath = tempFilePath;

      // Process with Whisper
      const result = await this.transcriptionProcessor.transcribeChunk(job, tempFilePath, this.config.whisperModel);
      
      // Create transcript segment
      const segment: TranscriptSegment = {
        id: uuidv4(),
        chunkId: job.chunkId,
        recordingId: job.recordingId,
        text: result.text,
        startTime: job.chunk.startTime,
        endTime: job.chunk.endTime,
        confidence: result.confidence,
        language: result.language,
        isFinal: false,
        isOverlap: false,
        createdAt: new Date()
      };

      job.result = segment;
      this.jobManager.markJobCompleted(job.id);

      // Add to transcript builder
      await this.transcriptManager.addSegment(job.recordingId, segment);

      // Record success in circuit breaker
      this.circuitBreaker.recordSuccess();

      this.eventEmitter.emit({
        type: 'realtime-transcription:job-completed',
        timestamp: Date.now(),
        recordingId: job.recordingId,
        chunkId: job.chunkId,
        jobId: job.id,
        segment
      });

    } finally {
      // Clean up temp file immediately
      if (job.tempFilePath) {
        await this.transcriptionProcessor.cleanupTempFile(job.tempFilePath);
      }
    }
  }

  /**
   * Handle job errors with classification and retry logic
   */
  private async handleJobError(job: RealTimeJob, error: string): Promise<void> {
    console.error(`Job ${job.id} failed:`, error);
    
    // Classify error type
    const errorType = ErrorClassifier.classifyError(error);
    
    // Record failure in circuit breaker
    this.circuitBreaker.recordFailure();

    // Determine if job should be retried
    const shouldRetry = ErrorClassifier.shouldRetry(
      errorType,
      job.retryCount,
      job.maxRetries,
      this.circuitBreaker.isOpen()
    );
    
    if (shouldRetry) {
      await this.jobManager.scheduleRetry(job.id);
    } else {
      // Job cannot be retried - mark as failed
      this.jobManager.markJobFailed(job.id, error, errorType);

      this.eventEmitter.emit({
        type: 'realtime-transcription:job-failed',
        timestamp: Date.now(),
        recordingId: job.recordingId,
        chunkId: job.chunkId,
        jobId: job.id,
        error,
        errorType,
        retryCount: job.retryCount
      });
    }
  }
}
