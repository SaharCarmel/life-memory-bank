import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from '@shared/events';
import { RealTimeJob } from './types';
import { ProcessingChunk } from '../../renderer/services/RecorderService';
import { TranscriptionProcessor } from './TranscriptionProcessor';

export class JobManager {
  private jobs: Map<string, RealTimeJob> = new Map();
  private jobQueue: RealTimeJob[] = [];
  private activeJobs: Set<string> = new Set();
  private deadLetterQueue: RealTimeJob[] = [];
  private retryQueue: RealTimeJob[] = [];
  private eventEmitter: EventEmitter;
  private transcriptionProcessor: TranscriptionProcessor;
  
  // Configuration
  private readonly maxJobsInMemory: number;
  private readonly maxDeadLetterQueueSize: number;
  private readonly retryDelays: number[] = [1000, 2000, 5000]; // Exponential backoff

  constructor(
    eventEmitter: EventEmitter,
    transcriptionProcessor: TranscriptionProcessor,
    maxJobsInMemory: number = 500,
    maxDeadLetterQueueSize: number = 100
  ) {
    this.eventEmitter = eventEmitter;
    this.transcriptionProcessor = transcriptionProcessor;
    this.maxJobsInMemory = maxJobsInMemory;
    this.maxDeadLetterQueueSize = maxDeadLetterQueueSize;
  }

  /**
   * Create and queue a new job
   */
  createJob(recordingId: string, chunk: ProcessingChunk): string {
    const jobId = uuidv4();
    const job: RealTimeJob = {
      id: jobId,
      recordingId,
      chunkId: chunk.id,
      status: 'queued',
      priority: Date.now(), // FIFO priority
      chunk,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date()
    };

    this.jobs.set(jobId, job);
    this.jobQueue.push(job);
    this.jobQueue.sort((a, b) => a.priority - b.priority); // Sort by priority

    this.eventEmitter.emit({
      type: 'realtime-transcription:chunk-queued',
      timestamp: Date.now(),
      recordingId,
      chunkId: chunk.id,
      jobId
    });

    console.log(`Queued chunk ${chunk.id} for transcription, job: ${jobId}`);
    
    return jobId;
  }

  /**
   * Get a job by ID
   */
  getJob(jobId: string): RealTimeJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get the next job to process
   */
  getNextJob(): RealTimeJob | undefined {
    // Prioritize retry queue
    if (this.retryQueue.length > 0) {
      const job = this.retryQueue.shift();
      if (job) {
        console.log(`Processing retry job: ${job.id} (attempt ${job.retryCount})`);
        return job;
      }
    }
    
    // Otherwise get from main queue
    return this.jobQueue.shift();
  }

  /**
   * Mark a job as active
   */
  markJobActive(jobId: string): void {
    this.activeJobs.add(jobId);
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'processing';
      job.startedAt = new Date();
    }
  }

  /**
   * Mark a job as completed
   */
  markJobCompleted(jobId: string): void {
    this.activeJobs.delete(jobId);
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.completedAt = new Date();
    }
  }

  /**
   * Mark a job as failed
   */
  markJobFailed(jobId: string, error: string, errorType: 'recoverable' | 'non-recoverable' | 'resource' | 'config'): void {
    this.activeJobs.delete(jobId);
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error;
      job.errorType = errorType;
      job.completedAt = new Date();
      
      // Move to dead letter queue if non-recoverable
      if (errorType === 'non-recoverable') {
        this.addToDeadLetterQueue(job);
      }
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return false;
    }

    // Remove from queue if queued
    if (job.status === 'queued') {
      const queueIndex = this.jobQueue.findIndex(j => j.id === jobId);
      if (queueIndex >= 0) {
        this.jobQueue.splice(queueIndex, 1);
      }
    }

    // Mark as cancelled
    job.status = 'cancelled';
    job.completedAt = new Date();
    
    // Remove from active jobs
    this.activeJobs.delete(jobId);
    
    // Clean up temp file
    if (job.tempFilePath) {
      await this.transcriptionProcessor.cleanupTempFile(job.tempFilePath);
    }

    this.eventEmitter.emit({
      type: 'realtime-transcription:job-cancelled',
      timestamp: Date.now(),
      recordingId: job.recordingId,
      chunkId: job.chunkId,
      jobId
    });

    return true;
  }

  /**
   * Schedule a job for retry
   */
  async scheduleRetry(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.retryCount++;
    job.status = 'retrying';
    job.lastRetryAt = new Date();
    
    // Calculate delay with exponential backoff
    const delayIndex = Math.min(job.retryCount - 1, this.retryDelays.length - 1);
    const baseDelay = this.retryDelays[delayIndex];
    const jitteredDelay = baseDelay + Math.random() * 1000; // Add jitter
    
    console.log(`Scheduling retry ${job.retryCount}/${job.maxRetries} for job ${job.id} in ${jitteredDelay}ms`);
    
    // Clean up temp file before retry
    if (job.tempFilePath) {
      await this.transcriptionProcessor.cleanupTempFile(job.tempFilePath);
      job.tempFilePath = undefined;
    }
    
    // Schedule retry
    setTimeout(() => {
      job.status = 'queued';
      this.retryQueue.push(job);
      console.log(`Job ${job.id} added to retry queue (attempt ${job.retryCount})`);
    }, jitteredDelay);

    this.eventEmitter.emit({
      type: 'realtime-transcription:job-retry-scheduled',
      timestamp: Date.now(),
      recordingId: job.recordingId,
      chunkId: job.chunkId,
      jobId: job.id,
      retryCount: job.retryCount,
      delay: jitteredDelay
    });
  }

  /**
   * Cancel all jobs for a recording
   */
  async cancelJobsForRecording(recordingId: string): Promise<void> {
    const recordingJobs = Array.from(this.jobs.values())
      .filter(job => job.recordingId === recordingId && 
                    (job.status === 'queued' || job.status === 'processing'));
    
    for (const job of recordingJobs) {
      await this.cancelJob(job.id);
    }
  }

  /**
   * Get job statistics
   */
  getStats() {
    return {
      total: this.jobs.size,
      active: this.activeJobs.size,
      queued: this.jobQueue.length,
      retrying: this.retryQueue.length,
      deadLetter: this.deadLetterQueue.length
    };
  }

  /**
   * Check if we can process more jobs
   */
  canProcessMoreJobs(maxConcurrentJobs: number): boolean {
    return this.activeJobs.size < maxConcurrentJobs;
  }

  /**
   * Clean up old completed jobs
   */
  cleanupOldJobs(): number {
    const completedJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));

    if (completedJobs.length <= this.maxJobsInMemory) {
      return 0;
    }

    const jobsToRemove = completedJobs.slice(this.maxJobsInMemory);
    let removedCount = 0;

    for (const job of jobsToRemove) {
      this.jobs.delete(job.id);
      removedCount++;
    }

    console.log(`Cleaned up ${removedCount} old jobs`);
    return removedCount;
  }

  /**
   * Add job to dead letter queue with size management
   */
  private addToDeadLetterQueue(job: RealTimeJob): void {
    this.deadLetterQueue.push(job);
    
    // Maintain dead letter queue size limit
    if (this.deadLetterQueue.length > this.maxDeadLetterQueueSize) {
      const removed = this.deadLetterQueue.splice(0, this.deadLetterQueue.length - this.maxDeadLetterQueueSize);
      console.log(`Removed ${removed.length} old jobs from dead letter queue`);
    }
    
    console.warn(`Job ${job.id} moved to dead letter queue: ${job.error}`);
  }

  /**
   * Dispose and clean up all jobs
   */
  async dispose(): Promise<void> {
    // Cancel all active jobs
    const activeJobIds = Array.from(this.activeJobs);
    for (const jobId of activeJobIds) {
      await this.cancelJob(jobId);
    }

    // Cancel all queued jobs
    const queuedJobs = [...this.jobQueue];
    for (const job of queuedJobs) {
      await this.cancelJob(job.id);
    }

    // Clear all collections
    this.jobs.clear();
    this.jobQueue.length = 0;
    this.activeJobs.clear();
    this.deadLetterQueue.length = 0;
    this.retryQueue.length = 0;
  }
}
