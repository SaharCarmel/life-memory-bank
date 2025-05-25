import * as path from 'path';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

export interface ConversionOptions {
  inputPath: string;
  outputPath?: string;
  format: 'wav' | 'mp3' | 'flac';
  sampleRate?: number;
  channels?: number;
  bitRate?: string;
}

export interface ConversionResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  duration?: number;
  fileSize?: number;
}

export class AudioConverter {
  /**
   * Convert audio file to specified format
   */
  static async convertAudio(options: ConversionOptions): Promise<ConversionResult> {
    const { inputPath, format, sampleRate = 16000, channels = 1, bitRate } = options;
    
    try {
      // Check if input file exists
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file does not exist: ${inputPath}`);
      }

      // Generate output path if not provided
      const outputPath = options.outputPath || 
        path.join(
          path.dirname(inputPath),
          `${path.basename(inputPath, path.extname(inputPath))}.${format}`
        );

      // Set up ffmpeg command
      const command = ffmpeg(inputPath)
        .audioFrequency(sampleRate)
        .audioChannels(channels)
        .format(format);

      // Set bit rate if specified
      if (bitRate) {
        command.audioBitrate(bitRate);
      }

      // For WAV, use PCM encoding for Whisper compatibility
      if (format === 'wav') {
        command.audioCodec('pcm_s16le');
      }

      // Execute conversion
      await new Promise<void>((resolve, reject) => {
        command
          .output(outputPath)
          .on('start', (commandLine: string) => {
            console.log(`Starting audio conversion: ${commandLine}`);
          })
          .on('progress', (progress: any) => {
            console.log(`Conversion progress: ${progress.percent}%`);
          })
          .on('end', () => {
            console.log(`Audio conversion completed: ${outputPath}`);
            resolve();
          })
          .on('error', (error: Error) => {
            console.error(`Audio conversion failed:`, error);
            reject(error);
          })
          .run();
      });

      // Get file stats
      const stats = fs.statSync(outputPath);
      
      return {
        success: true,
        outputPath,
        fileSize: stats.size
      };

    } catch (error) {
      console.error('Audio conversion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Convert WebM chunk to WAV for Whisper processing
   */
  static async webmToWav(webmPath: string, wavPath?: string): Promise<ConversionResult> {
    return this.convertAudio({
      inputPath: webmPath,
      outputPath: wavPath,
      format: 'wav',
      sampleRate: 16000, // Whisper optimal sample rate
      channels: 1, // Mono for Whisper
    });
  }

  /**
   * Get audio file metadata
   */
  static async getAudioMetadata(filePath: string): Promise<{
    duration?: number;
    format?: string;
    sampleRate?: number;
    channels?: number;
    bitRate?: number;
  }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (error, metadata) => {
        if (error) {
          reject(error);
          return;
        }

        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        
        resolve({
          duration: metadata.format.duration,
          format: metadata.format.format_name,
          sampleRate: audioStream?.sample_rate,
          channels: audioStream?.channels,
          bitRate: audioStream?.bit_rate ? parseInt(audioStream.bit_rate) : undefined
        });
      });
    });
  }

  /**
   * Validate if file is a supported audio format
   */
  static isAudioFile(filePath: string): boolean {
    const audioExtensions = ['.mp3', '.wav', '.webm', '.ogg', '.m4a', '.aac', '.flac'];
    const extension = path.extname(filePath).toLowerCase();
    return audioExtensions.includes(extension);
  }

  /**
   * Clean up temporary files
   */
  static async cleanupFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        console.log(`Cleaned up file: ${filePath}`);
      }
    } catch (error) {
      console.warn(`Failed to cleanup file ${filePath}:`, error);
    }
  }
}
