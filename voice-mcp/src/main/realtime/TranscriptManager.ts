import { EventEmitter } from '@shared/events';
import { StorageService, TranscriptSegment } from '../storage/StorageService';
import { TranscriptBuilder } from './types';

export class TranscriptManager {
  private transcriptBuilders: Map<string, TranscriptBuilder> = new Map();
  private eventEmitter: EventEmitter;
  private storageService: StorageService;
  private readonly maxSegmentsPerRecording: number;
  private readonly maxTranscriptBuilderAge: number;

  constructor(
    eventEmitter: EventEmitter,
    storageService: StorageService,
    maxSegmentsPerRecording: number = 1000,
    maxTranscriptBuilderAge: number = 24 * 60 * 60 * 1000 // 24 hours
  ) {
    this.eventEmitter = eventEmitter;
    this.storageService = storageService;
    this.maxSegmentsPerRecording = maxSegmentsPerRecording;
    this.maxTranscriptBuilderAge = maxTranscriptBuilderAge;
  }

  /**
   * Create a transcript builder for a recording
   */
  createTranscriptBuilder(recordingId: string): void {
    const transcriptBuilder: TranscriptBuilder = {
      recordingId,
      segments: new Map(),
      mergedText: '',
      lastUpdateTime: Date.now()
    };
    
    this.transcriptBuilders.set(recordingId, transcriptBuilder);
    console.log(`Created transcript builder for recording: ${recordingId}`);
  }

  /**
   * Add a segment to the transcript builder
   */
  async addSegment(recordingId: string, segment: TranscriptSegment): Promise<void> {
    const transcriptBuilder = this.transcriptBuilders.get(recordingId);
    if (!transcriptBuilder) {
      console.warn(`No transcript builder found for recording: ${recordingId}`);
      return;
    }

    // Add segment to builder
    transcriptBuilder.segments.set(segment.id, segment);
    transcriptBuilder.lastUpdateTime = Date.now();

    // Update merged text
    this.updateMergedText(transcriptBuilder);

    // Emit event for real-time updates
    this.eventEmitter.emit({
      type: 'realtime-transcription:segment-added',
      timestamp: Date.now(),
      recordingId,
      segment
    });

    // Also emit text-updated event for UI
    this.eventEmitter.emit({
      type: 'realtime-transcription:text-updated',
      timestamp: Date.now(),
      recordingId,
      text: transcriptBuilder.mergedText
    });

    console.log(`Added segment to transcript for recording ${recordingId}: "${segment.text}"`);
  }

  /**
   * Get current transcript for a recording
   */
  getTranscript(recordingId: string): TranscriptSegment[] {
    const transcriptBuilder = this.transcriptBuilders.get(recordingId);
    if (!transcriptBuilder) {
      return [];
    }

    return Array.from(transcriptBuilder.segments.values())
      .sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Get merged text for a recording
   */
  getMergedText(recordingId: string): string {
    const transcriptBuilder = this.transcriptBuilders.get(recordingId);
    return transcriptBuilder?.mergedText || '';
  }

  /**
   * Finalize transcript and save to storage
   */
  async finalizeTranscript(recordingId: string): Promise<void> {
    const transcriptBuilder = this.transcriptBuilders.get(recordingId);
    if (!transcriptBuilder) {
      console.warn(`No transcript builder found for recording: ${recordingId}`);
      return;
    }

    try {
      // Get all segments sorted by time
      const segments = this.getTranscript(recordingId);
      
      if (segments.length === 0) {
        console.log(`No segments to finalize for recording: ${recordingId}`);
        return;
      }

      // Mark all segments as final
      const finalSegments = segments.map(segment => ({
        ...segment,
        isFinal: true
      }));

      // Save to storage
      for (const segment of finalSegments) {
        await this.storageService.saveTranscriptSegment(segment);
      }

      // Update merged text one final time
      this.updateMergedText(transcriptBuilder);

      // Update recording metadata to mark transcript as completed
      await this.storageService.updateTranscriptStatus(recordingId, 'completed');

      this.eventEmitter.emit({
        type: 'realtime-transcription:finalized',
        timestamp: Date.now(),
        recordingId,
        segments: finalSegments,
        text: transcriptBuilder.mergedText
      });

      console.log(`Finalized transcript for recording ${recordingId} with ${finalSegments.length} segments`);
    } catch (error) {
      console.error(`Failed to finalize transcript for recording ${recordingId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up transcript builder for a recording
   */
  async cleanupTranscriptBuilder(recordingId: string): Promise<void> {
    const transcriptBuilder = this.transcriptBuilders.get(recordingId);
    if (!transcriptBuilder) {
      return;
    }

    // Clear segments map to free memory
    transcriptBuilder.segments.clear();
    
    // Remove from builders map
    this.transcriptBuilders.delete(recordingId);
    
    console.log(`Cleaned up transcript builder for recording: ${recordingId}`);
  }

  /**
   * Get transcript builder statistics
   */
  getStats() {
    const totalSegments = Array.from(this.transcriptBuilders.values())
      .reduce((total, builder) => total + builder.segments.size, 0);

    return {
      count: this.transcriptBuilders.size,
      totalSegments
    };
  }

  /**
   * Check if any transcript builder needs cleanup due to age or size
   */
  shouldPerformAggressiveCleanup(): boolean {
    const now = Date.now();
    
    for (const builder of this.transcriptBuilders.values()) {
      // Check if builder is too old
      if (now - builder.lastUpdateTime > this.maxTranscriptBuilderAge) {
        return true;
      }
      
      // Check if builder has too many segments
      if (builder.segments.size > this.maxSegmentsPerRecording) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Clean up old or oversized transcript builders
   */
  async cleanupOldTranscriptBuilders(): Promise<number> {
    const now = Date.now();
    let cleanedCount = 0;
    
    const buildersToCleanup: string[] = [];
    
    for (const [recordingId, builder] of this.transcriptBuilders.entries()) {
      // Mark for cleanup if too old or too large
      if (now - builder.lastUpdateTime > this.maxTranscriptBuilderAge ||
          builder.segments.size > this.maxSegmentsPerRecording) {
        buildersToCleanup.push(recordingId);
      }
    }
    
    // Finalize and cleanup marked builders
    for (const recordingId of buildersToCleanup) {
      try {
        await this.finalizeTranscript(recordingId);
        await this.cleanupTranscriptBuilder(recordingId);
        cleanedCount++;
      } catch (error) {
        console.error(`Failed to cleanup transcript builder for ${recordingId}:`, error);
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} transcript builders`);
    }
    
    return cleanedCount;
  }

  /**
   * Update merged text for a transcript builder
   */
  private updateMergedText(transcriptBuilder: TranscriptBuilder): void {
    const segments = Array.from(transcriptBuilder.segments.values())
      .sort((a, b) => a.startTime - b.startTime);
    
    transcriptBuilder.mergedText = segments
      .map(segment => segment.text)
      .join(' ')
      .trim();
  }

  /**
   * Dispose and clean up all transcript builders
   */
  async dispose(): Promise<void> {
    const recordingIds = Array.from(this.transcriptBuilders.keys());
    
    for (const recordingId of recordingIds) {
      try {
        await this.finalizeTranscript(recordingId);
        await this.cleanupTranscriptBuilder(recordingId);
      } catch (error) {
        console.error(`Failed to dispose transcript builder for ${recordingId}:`, error);
      }
    }
    
    console.log(`Disposed ${recordingIds.length} transcript builders`);
  }
}
