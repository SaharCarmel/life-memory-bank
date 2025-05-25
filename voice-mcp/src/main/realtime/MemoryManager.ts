import { MemoryUsageStats } from './types';
import { JobManager } from './JobManager';
import { TranscriptManager } from './TranscriptManager';
import { TranscriptionProcessor } from './TranscriptionProcessor';

export class MemoryManager {
  private jobManager: JobManager;
  private transcriptManager: TranscriptManager;
  private transcriptionProcessor: TranscriptionProcessor;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private lastCleanupTime: number = 0;
  private memoryUsageStats: MemoryUsageStats = {
    peakJobs: 0,
    peakSegments: 0,
    peakTempFiles: 0,
    totalCleanups: 0,
    lastCleanupDuration: 0,
    bytesFreed: 0,
    tempFilesDeleted: 0
  };

  // Configuration
  private readonly maxJobsInMemory: number;
  private readonly maxDeadLetterQueueSize: number;
  private readonly cleanupInterval: number;
  private readonly maxTempFileAge: number;

  constructor(
    jobManager: JobManager,
    transcriptManager: TranscriptManager,
    transcriptionProcessor: TranscriptionProcessor,
    maxJobsInMemory: number = 500,
    maxDeadLetterQueueSize: number = 100,
    cleanupInterval: number = 5 * 60 * 1000, // 5 minutes
    maxTempFileAge: number = 60 * 60 * 1000 // 1 hour
  ) {
    this.jobManager = jobManager;
    this.transcriptManager = transcriptManager;
    this.transcriptionProcessor = transcriptionProcessor;
    this.maxJobsInMemory = maxJobsInMemory;
    this.maxDeadLetterQueueSize = maxDeadLetterQueueSize;
    this.cleanupInterval = cleanupInterval;
    this.maxTempFileAge = maxTempFileAge;
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        await this.performComprehensiveCleanup();
      } catch (error) {
        console.error('Error in periodic cleanup:', error);
      }
    }, this.cleanupInterval);

    console.log(`Started periodic cleanup with ${this.cleanupInterval / 1000}s interval`);
  }

  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Check memory limits and trigger cleanup if necessary
   */
  async checkMemoryLimits(): Promise<void> {
    const jobStats = this.jobManager.getStats();
    const needsCleanup = jobStats.total > this.maxJobsInMemory ||
                        jobStats.deadLetter > this.maxDeadLetterQueueSize ||
                        this.shouldPerformAggressiveCleanup();

    if (needsCleanup) {
      console.log('Memory limits reached, performing cleanup...');
      await this.performComprehensiveCleanup();
    }
  }

  /**
   * Check if aggressive cleanup is needed
   */
  shouldPerformAggressiveCleanup(): boolean {
    // Check if transcript manager needs cleanup
    if (this.transcriptManager.shouldPerformAggressiveCleanup()) {
      return true;
    }

    // Check if temp directory might be getting large
    return Date.now() - this.lastCleanupTime > this.cleanupInterval;
  }

  /**
   * Update memory usage statistics
   */
  updateMemoryStats(): void {
    const jobStats = this.jobManager.getStats();
    const transcriptStats = this.transcriptManager.getStats();

    this.memoryUsageStats.peakJobs = Math.max(this.memoryUsageStats.peakJobs, jobStats.total);
    this.memoryUsageStats.peakSegments = Math.max(this.memoryUsageStats.peakSegments, transcriptStats.totalSegments);
  }

  /**
   * Perform comprehensive cleanup
   */
  async performComprehensiveCleanup(): Promise<void> {
    const startTime = Date.now();
    let totalBytesFreed = 0;
    let totalFilesDeleted = 0;

    try {
      console.log('Starting comprehensive cleanup...');

      // Clean up old jobs
      const jobsRemoved = this.jobManager.cleanupOldJobs();
      console.log(`Cleaned up ${jobsRemoved} old jobs`);

      // Clean up old transcript builders
      const transcriptBuildersRemoved = await this.transcriptManager.cleanupOldTranscriptBuilders();
      console.log(`Cleaned up ${transcriptBuildersRemoved} transcript builders`);

      // Clean up old temp files
      const tempFilesRemoved = await this.transcriptionProcessor.cleanupOldTempFiles(this.maxTempFileAge);
      totalFilesDeleted += tempFilesRemoved;
      console.log(`Cleaned up ${tempFilesRemoved} old temp files`);

      // Update statistics
      this.memoryUsageStats.totalCleanups++;
      this.memoryUsageStats.lastCleanupDuration = Date.now() - startTime;
      this.memoryUsageStats.bytesFreed += totalBytesFreed;
      this.memoryUsageStats.tempFilesDeleted += totalFilesDeleted;
      this.lastCleanupTime = Date.now();

      console.log(`Comprehensive cleanup completed in ${this.memoryUsageStats.lastCleanupDuration}ms`);
      console.log(`Total items cleaned: ${jobsRemoved + transcriptBuildersRemoved + tempFilesRemoved}`);

    } catch (error) {
      console.error('Error during comprehensive cleanup:', error);
      throw error;
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): MemoryUsageStats {
    return { ...this.memoryUsageStats };
  }

  /**
   * Get detailed memory information
   */
  getDetailedMemoryInfo() {
    const jobStats = this.jobManager.getStats();
    const transcriptStats = this.transcriptManager.getStats();

    return {
      jobs: jobStats,
      transcripts: transcriptStats,
      memory: this.memoryUsageStats,
      limits: {
        maxJobsInMemory: this.maxJobsInMemory,
        maxDeadLetterQueueSize: this.maxDeadLetterQueueSize,
        maxTempFileAge: this.maxTempFileAge,
        cleanupInterval: this.cleanupInterval
      },
      lastCleanupTime: this.lastCleanupTime,
      nextCleanupIn: Math.max(0, this.cleanupInterval - (Date.now() - this.lastCleanupTime))
    };
  }

  /**
   * Force immediate cleanup
   */
  async forceCleanup(): Promise<void> {
    console.log('Forcing immediate cleanup...');
    await this.performComprehensiveCleanup();
  }

  /**
   * Reset memory statistics
   */
  resetStats(): void {
    this.memoryUsageStats = {
      peakJobs: 0,
      peakSegments: 0,
      peakTempFiles: 0,
      totalCleanups: 0,
      lastCleanupDuration: 0,
      bytesFreed: 0,
      tempFilesDeleted: 0
    };
    console.log('Memory statistics reset');
  }

  /**
   * Check if memory usage is within acceptable limits
   */
  isMemoryUsageHealthy(): boolean {
    const jobStats = this.jobManager.getStats();
    const transcriptStats = this.transcriptManager.getStats();

    return jobStats.total <= this.maxJobsInMemory &&
           jobStats.deadLetter <= this.maxDeadLetterQueueSize &&
           !this.transcriptManager.shouldPerformAggressiveCleanup();
  }

  /**
   * Get memory health report
   */
  getMemoryHealthReport() {
    const jobStats = this.jobManager.getStats();
    const transcriptStats = this.transcriptManager.getStats();
    const isHealthy = this.isMemoryUsageHealthy();

    return {
      isHealthy,
      issues: [
        ...(jobStats.total > this.maxJobsInMemory ? [`Too many jobs in memory: ${jobStats.total}/${this.maxJobsInMemory}`] : []),
        ...(jobStats.deadLetter > this.maxDeadLetterQueueSize ? [`Dead letter queue too large: ${jobStats.deadLetter}/${this.maxDeadLetterQueueSize}`] : []),
        ...(this.transcriptManager.shouldPerformAggressiveCleanup() ? ['Transcript builders need cleanup'] : [])
      ],
      recommendations: [
        ...(jobStats.total > this.maxJobsInMemory * 0.8 ? ['Consider increasing cleanup frequency'] : []),
        ...(transcriptStats.totalSegments > 5000 ? ['High segment count detected, consider finalizing transcripts'] : []),
        ...(Date.now() - this.lastCleanupTime > this.cleanupInterval * 2 ? ['Cleanup overdue'] : [])
      ]
    };
  }

  /**
   * Dispose and clean up
   */
  async dispose(): Promise<void> {
    console.log('Disposing MemoryManager...');

    // Stop periodic cleanup
    this.stopPeriodicCleanup();

    // Perform final cleanup
    await this.performComprehensiveCleanup();

    console.log('MemoryManager disposed');
  }
}
