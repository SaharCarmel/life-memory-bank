import * as os from 'os';
import * as path from 'path';
import { 
  StorageOptions, 
  RecordingMetadata, 
  TranscriptStorage, 
  AIContentStorage,
  TranscriptSegment 
} from './types';
import { DatabaseService } from './DatabaseService';
import { RecordingStorageService } from './RecordingStorageService';
import { TranscriptStorageService } from './TranscriptStorageService';
import { AIContentStorageService } from './AIContentStorageService';

export class StorageService {
  private databaseService: DatabaseService;
  private recordingStorageService: RecordingStorageService;
  private transcriptStorageService: TranscriptStorageService;
  private aiContentStorageService: AIContentStorageService;
  private basePath: string;

  constructor(options: StorageOptions = {}) {
    this.basePath = options.basePath || path.join(os.homedir(), 'Documents', 'VoiceMCP');
    
    // Initialize all services
    this.databaseService = new DatabaseService(this.basePath);
    this.recordingStorageService = new RecordingStorageService(options);
    this.transcriptStorageService = new TranscriptStorageService(this.basePath);
    this.aiContentStorageService = new AIContentStorageService(this.basePath);
    
    // Initialize database
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await this.databaseService.initialize();
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }

  // Database methods - delegate to DatabaseService
  public async saveTranscriptSegment(segment: TranscriptSegment): Promise<void> {
    return this.databaseService.saveTranscriptSegment(segment);
  }

  public async saveTranscriptSegments(segments: TranscriptSegment[]): Promise<void> {
    return this.databaseService.saveTranscriptSegments(segments);
  }

  public async getTranscriptSegments(recordingId: string): Promise<TranscriptSegment[]> {
    return this.databaseService.getTranscriptSegments(recordingId);
  }

  public async getMergedTranscriptText(recordingId: string): Promise<string> {
    return this.databaseService.getMergedTranscriptText(recordingId);
  }

  public async finalizeTranscriptSegments(recordingId: string): Promise<void> {
    return this.databaseService.finalizeTranscriptSegments(recordingId);
  }

  public async updateTranscriptSegmentsRecordingId(oldRecordingId: string, newRecordingId: string): Promise<void> {
    return this.databaseService.updateTranscriptSegmentsRecordingId(oldRecordingId, newRecordingId);
  }

  public async deleteTranscriptSegments(recordingId: string): Promise<void> {
    return this.databaseService.deleteTranscriptSegments(recordingId);
  }

  public async getTranscriptSegmentsStats(): Promise<{
    totalSegments: number;
    totalRecordings: number;
    avgSegmentsPerRecording: number;
  }> {
    return this.databaseService.getTranscriptSegmentsStats();
  }

  public async closeDatabase(): Promise<void> {
    return this.databaseService.close();
  }

  // Recording methods - delegate to RecordingStorageService
  public startRecording(recordingId?: string): string {
    return this.recordingStorageService.startRecording(recordingId);
  }

  public writeChunk(recordingId: string, chunk: ArrayBuffer | Buffer): void {
    return this.recordingStorageService.writeChunk(recordingId, chunk);
  }

  public async finalizeRecording(recordingId: string): Promise<RecordingMetadata> {
    const metadata = await this.recordingStorageService.finalizeRecording(recordingId);
    
    // Extract the filename-based ID from the metadata
    const filename = path.basename(metadata.filepath);
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_([a-f0-9-]+)\.webm$/);
    
    if (match) {
      const [, dateStr, timeStr, uuid] = match;
      const filenameBasedId = `${dateStr}_${timeStr}_${uuid}`;
      
      // Update transcript segments to use the filename-based ID
      console.log(`[StorageService] Updating transcript segments from ${recordingId} to ${filenameBasedId}`);
      await this.updateTranscriptSegmentsRecordingId(recordingId, filenameBasedId);
      
      // Finalize transcript segments using the new ID
      await this.finalizeTranscriptSegments(filenameBasedId);
    } else {
      // Fallback: finalize with original ID
      await this.finalizeTranscriptSegments(recordingId);
    }
    
    return metadata;
  }

  public async cancelRecording(recordingId: string): Promise<void> {
    await this.recordingStorageService.cancelRecording(recordingId);
    
    // Delete any transcript segments for this recording
    await this.deleteTranscriptSegments(recordingId);
  }

  public getActiveRecordings(): string[] {
    return this.recordingStorageService.getActiveRecordings();
  }

  public getRecordingMetadata(recordingId: string): RecordingMetadata | undefined {
    return this.recordingStorageService.getRecordingMetadata(recordingId);
  }

  public async listRecordings(): Promise<RecordingMetadata[]> {
    const recordings = await this.recordingStorageService.listRecordings();
    
    // Enhance recordings with transcript and AI status
    const enhancedRecordings = await Promise.all(
      recordings.map(async (recording) => {
        // Check for transcript file or database segments
        const hasTranscriptFile = await this.transcriptStorageService.hasTranscript(recording.filepath);
        const dbSegments = await this.getTranscriptSegments(recording.id);
        const hasDbSegments = dbSegments.length > 0;
        const hasTranscript = hasTranscriptFile || hasDbSegments;
        
        // Debug logging
        console.log(`[StorageService] Recording ${recording.id}: hasTranscriptFile=${hasTranscriptFile}, dbSegments=${dbSegments.length}, hasTranscript=${hasTranscript}`);

        // Check for AI content
        const hasAI = await this.aiContentStorageService.hasAIContent(recording.filepath);
        let aiContent: { title?: string; summary?: string } | null = null;
        
        if (hasAI) {
          aiContent = await this.aiContentStorageService.getAIContent(recording.filepath);
        }

        return {
          ...recording,
          transcriptStatus: hasTranscript ? 'completed' as const : 'none' as const,
          transcriptPath: hasTranscriptFile ? this.transcriptStorageService.getTranscriptPath(recording.filepath) : undefined,
          aiStatus: hasAI ? 'completed' as const : 'none' as const,
          aiTitle: aiContent?.title,
          aiSummary: aiContent?.summary,
          aiGeneratedAt: hasAI ? new Date() : undefined
        };
      })
    );

    return enhancedRecordings;
  }

  public async getRecordingInfo(recordingId: string): Promise<RecordingMetadata | null> {
    return this.recordingStorageService.getRecordingInfo(recordingId);
  }

  public async deleteRecording(filepath: string): Promise<void> {
    // Extract recording ID from filepath for database cleanup
    const filename = path.basename(filepath);
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_([a-f0-9-]+)\.webm$/);
    
    if (match) {
      const [, dateStr, timeStr, uuid] = match;
      const recordingId = `${dateStr}_${timeStr}_${uuid}`;
      
      // Delete transcript segments from database
      await this.deleteTranscriptSegments(recordingId);
    }

    // Delete the recording file
    await this.recordingStorageService.deleteRecording(filepath);
    
    // Delete transcript file if it exists
    await this.transcriptStorageService.deleteTranscript(filepath);
    
    // Delete AI content if it exists
    await this.aiContentStorageService.deleteAIContent(filepath);
  }

  // Transcript methods - delegate to TranscriptStorageService
  public getTranscriptPath(recordingFilepath: string): string {
    return this.transcriptStorageService.getTranscriptPath(recordingFilepath);
  }

  public async hasTranscript(recordingFilepath: string): Promise<boolean> {
    return this.transcriptStorageService.hasTranscript(recordingFilepath);
  }

  public async saveTranscript(recordingId: string, transcript: TranscriptStorage['result']): Promise<string> {
    // Find the recording metadata to get the filepath
    const recordings = await this.listRecordings();
    const recording = recordings.find(r => r.id === recordingId);
    
    if (!recording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    return this.transcriptStorageService.saveTranscript(recordingId, recording.filepath, transcript);
  }

  public async loadTranscript(recordingId: string): Promise<TranscriptStorage['result'] | null> {
    // First try to load from database segments
    const segments = await this.getTranscriptSegments(recordingId);
    if (segments.length > 0) {
      // Convert segments to transcript format
      const text = segments
        .filter(s => !s.isOverlap)
        .sort((a, b) => a.startTime - b.startTime)
        .map(s => s.text)
        .join(' ')
        .trim();
      
      const transcriptSegments = segments
        .filter(s => !s.isOverlap)
        .sort((a, b) => a.startTime - b.startTime)
        .map(s => ({
          start: s.startTime,
          end: s.endTime,
          text: s.text
        }));

      return {
        text,
        language: segments[0]?.language || 'en',
        segments: transcriptSegments
      };
    }

    // Fallback to file-based transcript
    const recordings = await this.listRecordings();
    const recording = recordings.find(r => r.id === recordingId);
    
    if (!recording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    return this.transcriptStorageService.loadTranscript(recording.filepath);
  }

  public async updateTranscriptStatus(recordingId: string, status: 'none' | 'processing' | 'completed' | 'failed', error?: string, progress?: number): Promise<void> {
    return this.transcriptStorageService.updateTranscriptStatus(recordingId, status, error, progress);
  }

  // AI Content methods - delegate to AIContentStorageService
  public getAIContentPath(recordingFilepath: string): string {
    return this.aiContentStorageService.getAIContentPath(recordingFilepath);
  }

  public async hasAIContent(recordingFilepath: string): Promise<boolean> {
    return this.aiContentStorageService.hasAIContent(recordingFilepath);
  }

  public async saveAIContent(recordingId: string, title: string, summary: string): Promise<string> {
    // Find the recording metadata to get the filepath
    const recordings = await this.listRecordings();
    const recording = recordings.find(r => r.id === recordingId);
    
    if (!recording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    return this.aiContentStorageService.saveAIContent(recordingId, recording.filepath, title, summary);
  }

  public async getAIContent(recordingId: string): Promise<{ title: string; summary: string } | null> {
    // Find the recording metadata to get the filepath
    const recordings = await this.listRecordings();
    const recording = recordings.find(r => r.id === recordingId);
    
    if (!recording) {
      return null;
    }

    return this.aiContentStorageService.getAIContent(recording.filepath);
  }

  public async updateAIStatus(recordingId: string, status: 'none' | 'processing' | 'completed' | 'failed', error?: string, progress?: number): Promise<void> {
    return this.aiContentStorageService.updateAIStatus(recordingId, status, error, progress);
  }

  // Generate transcript file from database segments for AI processing
  public async generateTranscriptFileFromSegments(recordingId: string): Promise<string | null> {
    try {
      // Get segments from database
      const segments = await this.getTranscriptSegments(recordingId);
      if (segments.length === 0) {
        return null;
      }

      // Find the recording to get filepath
      const recordings = await this.listRecordings();
      const recording = recordings.find(r => r.id === recordingId);
      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      // Convert segments to transcript format
      const text = segments
        .filter(s => !s.isOverlap)
        .sort((a, b) => a.startTime - b.startTime)
        .map(s => s.text)
        .join(' ')
        .trim();
      
      const transcriptSegments = segments
        .filter(s => !s.isOverlap)
        .sort((a, b) => a.startTime - b.startTime)
        .map(s => ({
          start: s.startTime,
          end: s.endTime,
          text: s.text
        }));

      const transcriptData: TranscriptStorage = {
        recordingId,
        transcribedAt: new Date(),
        result: {
          text,
          language: segments[0]?.language || 'en',
          segments: transcriptSegments
        },
        version: '1.0'
      };

      // Save to temporary transcript file
      const transcriptPath = await this.transcriptStorageService.saveTranscript(recordingId, recording.filepath, transcriptData.result);
      
      console.log(`Generated transcript file from segments for recording ${recordingId}: ${transcriptPath}`);
      return transcriptPath;
    } catch (error) {
      console.error(`Failed to generate transcript file from segments for recording ${recordingId}:`, error);
      return null;
    }
  }

  // Utility methods
  public getBasePath(): string {
    return this.basePath;
  }
}

// Export types for backward compatibility
export * from './types';
