import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AudioConverter } from './AudioConverter';

export interface ImportFile {
  path: string;
  originalName: string;
  size: number;
}

export interface ValidationResult {
  file: ImportFile;
  isValid: boolean;
  error?: string;
  metadata?: {
    duration: number;
    format: string;
    sampleRate?: number;
    channels?: number;
    bitRate?: number;
  };
}

export interface DuplicateResult {
  file: ImportFile;
  isDuplicate: boolean;
  existingRecording?: {
    id: string;
    filepath: string;
    originalName?: string;
  };
}

export interface ImportOptions {
  overwriteDuplicates?: boolean;
  skipDuplicates?: boolean;
}

export interface ImportProgress {
  file: ImportFile;
  stage: 'validating' | 'converting' | 'copying' | 'completed' | 'failed';
  progress: number; // 0-100
  error?: string;
}

export interface ImportResult {
  file: ImportFile;
  success: boolean;
  recordingId?: string;
  filepath?: string;
  error?: string;
  metadata?: {
    duration: number;
    originalFormat: string;
    originalSize: number;
    convertedSize?: number;
  };
}

export class AudioImportService {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Validate audio files for import
   */
  async validateAudioFiles(filePaths: string[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const filePath of filePaths) {
      const file: ImportFile = {
        path: filePath,
        originalName: path.basename(filePath),
        size: 0
      };

      try {
        // Check if file exists and get size
        const stats = await fs.promises.stat(filePath);
        file.size = stats.size;

        // Check if it's an audio file by extension
        if (!AudioConverter.isAudioFile(filePath)) {
          results.push({
            file,
            isValid: false,
            error: 'Unsupported file format'
          });
          continue;
        }

        // Get audio metadata
        const metadata = await AudioConverter.getAudioMetadata(filePath);
        
        // Validate metadata
        if (!metadata.duration || metadata.duration <= 0) {
          results.push({
            file,
            isValid: false,
            error: 'Invalid audio file or zero duration'
          });
          continue;
        }

        results.push({
          file,
          isValid: true,
          metadata: {
            duration: metadata.duration,
            format: metadata.format || 'unknown',
            sampleRate: metadata.sampleRate,
            channels: metadata.channels,
            bitRate: metadata.bitRate
          }
        });

      } catch (error) {
        results.push({
          file,
          isValid: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Check for duplicate files based on name and duration
   */
  async checkForDuplicates(
    validFiles: ValidationResult[], 
    existingRecordings: any[]
  ): Promise<DuplicateResult[]> {
    const results: DuplicateResult[] = [];

    for (const validFile of validFiles) {
      const { file, metadata } = validFile;
      
      // Look for duplicates by filename and approximate duration (within 1 second)
      const duplicate = existingRecordings.find(recording => {
        const existingName = recording.originalName || path.basename(recording.filepath);
        const nameMatch = existingName === file.originalName;
        
        if (!nameMatch || !metadata?.duration) return false;
        
        // Check duration match (within 1 second tolerance)
        const durationMatch = Math.abs(recording.duration - metadata.duration) <= 1;
        
        return nameMatch && durationMatch;
      });

      results.push({
        file,
        isDuplicate: !!duplicate,
        existingRecording: duplicate ? {
          id: duplicate.id,
          filepath: duplicate.filepath,
          originalName: duplicate.originalName
        } : undefined
      });
    }

    return results;
  }

  /**
   * Convert audio file to WebM format
   */
  private async convertToWebM(inputPath: string, outputPath: string): Promise<boolean> {
    try {
      // Use AudioConverter to convert to WebM
      // Since the current AudioConverter doesn't support WebM, we'll convert to a temp WAV first
      // and then use a different approach for WebM
      
      // For now, let's convert to WebM using FFmpeg directly
      const ffmpeg = require('fluent-ffmpeg');
      
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .audioCodec('libopus') // Use Opus codec for WebM
          .format('webm')
          .output(outputPath)
          .on('start', (commandLine: string) => {
            console.log(`Converting to WebM: ${commandLine}`);
          })
          .on('progress', (progress: any) => {
            console.log(`Conversion progress: ${progress.percent}%`);
          })
          .on('end', () => {
            console.log(`WebM conversion completed: ${outputPath}`);
            resolve();
          })
          .on('error', (error: Error) => {
            console.error(`WebM conversion failed:`, error);
            reject(error);
          })
          .run();
      });

      return true;
    } catch (error) {
      console.error('WebM conversion error:', error);
      return false;
    }
  }

  /**
   * Generate recording ID and file path for imported file
   */
  private generateImportPaths(_originalName: string): {
    recordingId: string;
    filepath: string;
    directory: string;
  } {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const uuid = uuidv4();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const recordingId = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}_${uuid}`;
    const directory = path.join(this.basePath, 'recordings', String(year), `${month}-${monthNames[parseInt(month) - 1]}`);
    const filepath = path.join(directory, `${recordingId}.webm`);
    
    return { recordingId, filepath, directory };
  }

  /**
   * Import a single audio file
   */
  async importAudioFile(
    validationResult: ValidationResult,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const { file, metadata } = validationResult;
    
    if (!validationResult.isValid || !metadata) {
      return {
        file,
        success: false,
        error: validationResult.error || 'Invalid file'
      };
    }

    try {
      // Generate paths
      const { recordingId, filepath, directory } = this.generateImportPaths(file.originalName);

      // Ensure directory exists
      await fs.promises.mkdir(directory, { recursive: true });

      // Update progress - converting
      onProgress?.({
        file,
        stage: 'converting',
        progress: 25
      });

      // Convert to WebM
      const conversionSuccess = await this.convertToWebM(file.path, filepath);
      if (!conversionSuccess) {
        throw new Error('Failed to convert audio to WebM format');
      }

      // Update progress - copying completed
      onProgress?.({
        file,
        stage: 'copying',
        progress: 75
      });

      // Get final file size
      const finalStats = await fs.promises.stat(filepath);

      // Update progress - completed
      onProgress?.({
        file,
        stage: 'completed',
        progress: 100
      });

      return {
        file,
        success: true,
        recordingId,
        filepath,
        metadata: {
          duration: metadata.duration,
          originalFormat: metadata.format,
          originalSize: file.size,
          convertedSize: finalStats.size
        }
      };

    } catch (error) {
      onProgress?.({
        file,
        stage: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        file,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Import multiple audio files with progress tracking
   */
  async importAudioFiles(
    validationResults: ValidationResult[],
    _options: ImportOptions = {},
    onProgress?: (fileIndex: number, progress: ImportProgress) => void
  ): Promise<ImportResult[]> {
    const results: ImportResult[] = [];

    for (let i = 0; i < validationResults.length; i++) {
      const validationResult = validationResults[i];
      
      const result = await this.importAudioFile(
        validationResult,
        (progress) => onProgress?.(i, progress)
      );
      
      results.push(result);
    }

    return results;
  }

  /**
   * Get supported audio file extensions for file picker
   */
  static getSupportedExtensions(): string[] {
    return ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.webm'];
  }

  /**
   * Get file picker filters for Electron dialog
   */
  static getFilePickerFilters(): Electron.FileFilter[] {
    return [
      {
        name: 'Audio Files',
        extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'webm']
      },
      {
        name: 'MP3 Files',
        extensions: ['mp3']
      },
      {
        name: 'WAV Files',
        extensions: ['wav']
      },
      {
        name: 'M4A Files',
        extensions: ['m4a']
      },
      {
        name: 'All Files',
        extensions: ['*']
      }
    ];
  }
}
