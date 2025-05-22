import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

export interface StorageOptions {
  basePath?: string;
  maxFileSize?: number;
}

export interface RecordingMetadata {
  id: string;
  filename: string;
  filepath: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  size?: number;
  format: string;
  transcriptStatus?: 'none' | 'processing' | 'completed' | 'failed';
  transcriptPath?: string;
  transcriptError?: string;
  transcriptProgress?: number; // 0-100 for progress tracking
}

export interface ActiveRecording {
  id: string;
  metadata: RecordingMetadata;
  writeStream: fs.WriteStream;
  chunks: Buffer[];
  isFinalized: boolean;
}

// Import TranscriptionResult from whisper types
export interface TranscriptStorage {
  recordingId: string;
  transcribedAt: Date;
  result: {
    text: string;
    language: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };
  version: string;
}

export class StorageService {
  private basePath: string;
  private activeRecordings: Map<string, ActiveRecording> = new Map();

  constructor(options: StorageOptions = {}) {
    this.basePath = options.basePath || path.join(os.homedir(), 'Documents', 'VoiceMCP');
    this.ensureBaseDirectory();
  }

  private ensureBaseDirectory(): void {
    try {
      fs.mkdirSync(this.basePath, { recursive: true });
      fs.mkdirSync(path.join(this.basePath, 'recordings'), { recursive: true });
    } catch (error) {
      console.error('Failed to create base directory:', error);
      throw new Error(`Failed to create storage directory: ${error}`);
    }
  }

  private getRecordingPath(date: Date = new Date()): string {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const monthName = date.toLocaleString('en-US', { month: 'long' });
    const monthFolder = `${month}-${monthName}`;
    
    const recordingPath = path.join(this.basePath, 'recordings', year, monthFolder);
    
    // Ensure directory exists
    fs.mkdirSync(recordingPath, { recursive: true });
    
    return recordingPath;
  }

  private generateFilename(date: Date = new Date()): string {
    const dateStr = date.toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '-')
      .replace(/\..+/, '');
    const uuid = uuidv4().substring(0, 8);
    return `${dateStr}_${uuid}.webm`;
  }

  public startRecording(recordingId?: string): string {
    const id = recordingId || uuidv4();
    const startTime = new Date();
    const recordingPath = this.getRecordingPath(startTime);
    const filename = this.generateFilename(startTime);
    const filepath = path.join(recordingPath, filename);

    const metadata: RecordingMetadata = {
      id,
      filename,
      filepath,
      startTime,
      format: 'webm'
    };

    try {
      const writeStream = fs.createWriteStream(filepath);
      
      const activeRecording: ActiveRecording = {
        id,
        metadata,
        writeStream,
        chunks: [],
        isFinalized: false
      };

      this.activeRecordings.set(id, activeRecording);

      writeStream.on('error', (error) => {
        console.error(`Write stream error for recording ${id}:`, error);
      });

      writeStream.on('finish', () => {
        console.log(`Recording ${id} write stream finished`);
        console.log(`Recording saved to: ${metadata.filepath}`);
      });

      console.log(`Recording started: ${id}`);
      console.log(`Recording path: ${metadata.filepath}`);
      
      return id;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error(`Failed to start recording: ${error}`);
    }
  }

  public writeChunk(recordingId: string, chunk: ArrayBuffer | Buffer): void {
    const recording = this.activeRecordings.get(recordingId);
    if (!recording) {
      console.error(`No active recording found for ID: ${recordingId}`);
      return;
    }

    if (recording.isFinalized) {
      console.warn(`Attempted to write to finalized recording: ${recordingId}`);
      return;
    }

    try {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      recording.writeStream.write(buffer);
      
      // Update metadata
      recording.metadata.size = (recording.metadata.size || 0) + buffer.length;
      
      // Log chunk write for debugging
      if (recording.metadata.size && recording.metadata.size % 100000 < buffer.length) {
        // Log every ~100KB
        console.log(`Recording ${recordingId}: ${Math.round(recording.metadata.size / 1024)}KB written`);
      }
    } catch (error) {
      console.error(`Failed to write chunk for recording ${recordingId}:`, error);
    }
  }

  public async finalizeRecording(recordingId: string): Promise<RecordingMetadata> {
    const recording = this.activeRecordings.get(recordingId);
    if (!recording) {
      throw new Error(`No active recording found for ID: ${recordingId}`);
    }

    if (recording.isFinalized) {
      return recording.metadata;
    }

    return new Promise((resolve, reject) => {
      recording.isFinalized = true;
      recording.metadata.endTime = new Date();
      recording.metadata.duration = 
        (recording.metadata.endTime.getTime() - recording.metadata.startTime.getTime()) / 1000;

      recording.writeStream.end(() => {
        try {
          // Verify file exists and get final size
          const stats = fs.statSync(recording.metadata.filepath);
          recording.metadata.size = stats.size;

          this.activeRecordings.delete(recordingId);
          
          console.log(`Recording finalized: ${recordingId}`);
          console.log(`Duration: ${recording.metadata.duration}s`);
          console.log(`Size: ${Math.round(recording.metadata.size! / 1024)}KB`);
          console.log(`Saved to: ${recording.metadata.filepath}`);

          resolve(recording.metadata);
        } catch (error) {
          reject(new Error(`Failed to finalize recording: ${error}`));
        }
      });
    });
  }

  public cancelRecording(recordingId: string): void {
    const recording = this.activeRecordings.get(recordingId);
    if (!recording) {
      console.warn(`No active recording found to cancel: ${recordingId}`);
      return;
    }

    recording.isFinalized = true;
    recording.writeStream.destroy();
    
    // Delete the incomplete file
    try {
      fs.unlinkSync(recording.metadata.filepath);
      console.log(`Deleted incomplete recording file: ${recording.metadata.filepath}`);
    } catch (error) {
      console.error(`Failed to delete incomplete file: ${error}`);
    }

    this.activeRecordings.delete(recordingId);
    
    console.log(`Recording cancelled: ${recordingId}`);
  }

  public getActiveRecordings(): string[] {
    return Array.from(this.activeRecordings.keys());
  }

  public getRecordingMetadata(recordingId: string): RecordingMetadata | undefined {
    const recording = this.activeRecordings.get(recordingId);
    return recording?.metadata;
  }

  public async listRecordings(): Promise<RecordingMetadata[]> {
    const recordings: RecordingMetadata[] = [];
    const recordingsPath = path.join(this.basePath, 'recordings');

    try {
      // Check if recordings directory exists
      if (!fs.existsSync(recordingsPath)) {
        return recordings;
      }

      // Recursively scan the recordings directory
      const scanDirectory = async (dirPath: string): Promise<void> => {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            // Recursively scan subdirectories
            await scanDirectory(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.webm')) {
            try {
              // Extract metadata from filename
              const metadata = await this.extractMetadataFromFile(fullPath);
              if (metadata) {
                recordings.push(metadata);
              }
            } catch (error) {
              console.error(`Failed to extract metadata from ${fullPath}:`, error);
            }
          }
        }
      };

      await scanDirectory(recordingsPath);

      // Sort recordings by date (newest first)
      recordings.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

      return recordings;
    } catch (error) {
      console.error('Failed to list recordings:', error);
      return recordings;
    }
  }

  private async extractMetadataFromFile(filepath: string): Promise<RecordingMetadata | null> {
    try {
      const stats = await fs.promises.stat(filepath);
      const filename = path.basename(filepath);
      
      // Parse datetime from filename (format: YYYY-MM-DD_HH-MM-SS_uuid.webm)
      const match = filename.match(/^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_([a-f0-9-]+)\.webm$/);
      if (!match) {
        console.warn(`Filename doesn't match expected pattern: ${filename}`);
        return null;
      }

      const [, dateStr, timeStr, uuid] = match;
      const startTime = new Date(`${dateStr}T${timeStr.replace(/-/g, ':')}`);
      
      // Generate a unique ID based on the filename
      const id = `${dateStr}_${timeStr}_${uuid}`;

      // Check for transcript file
      const transcriptPath = this.getTranscriptPath(filepath);
      const hasTranscript = await this.hasTranscript(filepath);

      return {
        id,
        filename,
        filepath,
        startTime,
        endTime: new Date(stats.mtime), // Use file modification time as end time
        duration: (stats.mtime.getTime() - startTime.getTime()) / 1000,
        size: stats.size,
        format: 'webm',
        transcriptStatus: hasTranscript ? 'completed' : 'none',
        transcriptPath: hasTranscript ? transcriptPath : undefined
      };
    } catch (error) {
      console.error(`Failed to extract metadata from ${filepath}:`, error);
      return null;
    }
  }

  public async deleteRecording(filepath: string): Promise<void> {
    try {
      await fs.promises.unlink(filepath);
      
      // Also delete transcript if it exists
      const transcriptPath = this.getTranscriptPath(filepath);
      if (await this.hasTranscript(filepath)) {
        await fs.promises.unlink(transcriptPath);
        console.log(`Transcript deleted: ${transcriptPath}`);
      }
      
      console.log(`Recording deleted: ${filepath}`);
    } catch (error) {
      throw new Error(`Failed to delete recording: ${error}`);
    }
  }

  // Transcript-related methods
  public getTranscriptPath(recordingFilepath: string): string {
    const dir = path.dirname(recordingFilepath);
    const basename = path.basename(recordingFilepath, '.webm');
    return path.join(dir, `${basename}.transcript.json`);
  }

  public async hasTranscript(recordingFilepath: string): Promise<boolean> {
    const transcriptPath = this.getTranscriptPath(recordingFilepath);
    try {
      await fs.promises.access(transcriptPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  public async saveTranscript(recordingId: string, transcript: TranscriptStorage['result']): Promise<string> {
    try {
      // Find the recording metadata to get the filepath
      const recordings = await this.listRecordings();
      const recording = recordings.find(r => r.id === recordingId);
      
      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      const transcriptPath = this.getTranscriptPath(recording.filepath);
      
      const transcriptData: TranscriptStorage = {
        recordingId,
        transcribedAt: new Date(),
        result: transcript,
        version: '1.0'
      };

      await fs.promises.writeFile(transcriptPath, JSON.stringify(transcriptData, null, 2), 'utf8');
      
      console.log(`Transcript saved: ${transcriptPath}`);
      return transcriptPath;
    } catch (error) {
      console.error(`Failed to save transcript for recording ${recordingId}:`, error);
      throw new Error(`Failed to save transcript: ${error}`);
    }
  }

  public async loadTranscript(recordingId: string): Promise<TranscriptStorage['result'] | null> {
    try {
      // Find the recording metadata to get the filepath
      const recordings = await this.listRecordings();
      const recording = recordings.find(r => r.id === recordingId);
      
      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      const transcriptPath = this.getTranscriptPath(recording.filepath);
      
      if (!(await this.hasTranscript(recording.filepath))) {
        return null;
      }

      const transcriptData = await fs.promises.readFile(transcriptPath, 'utf8');
      const parsed: TranscriptStorage = JSON.parse(transcriptData);
      
      return parsed.result;
    } catch (error) {
      console.error(`Failed to load transcript for recording ${recordingId}:`, error);
      return null;
    }
  }

  public async updateTranscriptStatus(recordingId: string, status: RecordingMetadata['transcriptStatus'], progress?: number, error?: string): Promise<void> {
    // This method would typically update a database record
    // For now, we'll just log the status change
    // In a full implementation, you might want to store metadata in SQLite
    console.log(`Transcript status updated for ${recordingId}: ${status}${progress !== undefined ? ` (${progress}%)` : ''}${error ? ` - ${error}` : ''}`);
  }
}
