import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { StorageOptions, RecordingMetadata, ActiveRecording } from './types';

export class RecordingStorageService {
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
    // Format date in local timezone: YYYY-MM-DD_HH-MM-SS
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    const dateStr = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
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

      recording.writeStream.end(async () => {
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

  public async cancelRecording(recordingId: string): Promise<void> {
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

      return {
        id,
        filename,
        filepath,
        startTime,
        endTime: new Date(stats.mtime), // Use file modification time as end time
        duration: (stats.mtime.getTime() - startTime.getTime()) / 1000,
        size: stats.size,
        format: 'webm',
        transcriptStatus: 'none', // Will be updated by other services
        aiStatus: 'none' // Will be updated by other services
      };
    } catch (error) {
      console.error(`Failed to extract metadata from ${filepath}:`, error);
      return null;
    }
  }

  public async getRecordingInfo(recordingId: string): Promise<RecordingMetadata | null> {
    try {
      const recordings = await this.listRecordings();
      return recordings.find(r => r.id === recordingId) || null;
    } catch (error) {
      console.error(`Failed to get recording info for ${recordingId}:`, error);
      return null;
    }
  }

  public async deleteRecording(filepath: string): Promise<void> {
    try {
      await fs.promises.unlink(filepath);
      console.log(`Recording deleted: ${filepath}`);
    } catch (error) {
      throw new Error(`Failed to delete recording: ${error}`);
    }
  }

  public async addImportedRecording(metadata: RecordingMetadata): Promise<void> {
    // This method is called when an audio file has been successfully imported
    // The file should already exist at the specified filepath
    // We just need to verify it exists since the file scanning will pick it up automatically
    
    console.log(`[RecordingStorageService] Adding imported recording: ${metadata.id}`);
    console.log(`[RecordingStorageService] File path: ${metadata.filepath}`);
    
    try {
      // Verify the file exists
      await fs.promises.access(metadata.filepath);
      console.log(`[RecordingStorageService] Imported recording file verified: ${metadata.filepath}`);
    } catch (error) {
      throw new Error(`Imported recording file not found: ${metadata.filepath}`);
    }
    
    // The file will be automatically picked up by listRecordings() when it scans the directory
    // No additional storage needed since we use filesystem-based storage
  }

  public getBasePath(): string {
    return this.basePath;
  }
}
