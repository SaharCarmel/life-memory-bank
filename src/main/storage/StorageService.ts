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
}

export interface ActiveRecording {
  id: string;
  metadata: RecordingMetadata;
  writeStream: fs.WriteStream;
  chunks: Buffer[];
  isFinalized: boolean;
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
    // TODO: Implement listing of saved recordings
    // This would scan the recordings directory and build metadata
    return [];
  }

  public async deleteRecording(filepath: string): Promise<void> {
    try {
      await fs.promises.unlink(filepath);
      console.log(`Recording deleted: ${filepath}`);
    } catch (error) {
      throw new Error(`Failed to delete recording: ${error}`);
    }
  }
}
