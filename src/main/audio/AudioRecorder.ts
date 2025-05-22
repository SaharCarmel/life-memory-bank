import { IAudioRecorder, RecordingError } from './types';
import { RecordingState, RecordingOptions, AudioFormat } from '@shared/types/audio';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export class AudioRecorder implements IAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private state: RecordingState = RecordingState.IDLE;
  private audioChunks: Blob[] = [];
  private fileStream: fs.WriteStream | null = null;
  private outputPath: string | null = null;
  private onDataCallback: ((chunk: Blob) => void) | null = null;
  private pauseStartTime: number = 0;

  constructor() {}

  async start(options: RecordingOptions): Promise<void> {
    if (this.state !== RecordingState.IDLE) {
      throw new RecordingError(`Cannot start recording in ${this.state} state`);
    }

    try {
      // Get media stream
      this.stream = await this.getMediaStream(options);

      // Set up output file
      this.outputPath = await this.setupOutputFile(options);
      this.fileStream = fs.createWriteStream(this.outputPath);

      // Configure MediaRecorder
      const mimeType = this.getMimeType(options.format);
      const recorderOptions: MediaRecorderOptions = {
        mimeType,
        audioBitsPerSecond: 128000 // Default 128kbps
      };

      this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);

      // Set up event handlers
      this.setupMediaRecorderHandlers();

      // Start recording
      const timeslice = 1000; // Request data every second
      this.mediaRecorder.start(timeslice);
      
      this.state = RecordingState.RECORDING;

    } catch (error) {
      this.cleanup();
      const message = error instanceof Error ? error.message : String(error);
      throw new RecordingError(`Failed to start recording: ${message}`);
    }
  }

  async stop(): Promise<Blob> {
    if (this.state !== RecordingState.RECORDING && this.state !== RecordingState.PAUSED) {
      throw new RecordingError(`Cannot stop recording in ${this.state} state`);
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new RecordingError('MediaRecorder not initialized'));
        return;
      }

      // Handle the final data
      const handleStop = () => {
        try {
          // Create final blob from chunks
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm;codecs=opus';
          const finalBlob = new Blob(this.audioChunks, { type: mimeType });

          // Ensure file stream is closed
          if (this.fileStream) {
            this.fileStream.end();
          }

          // Cleanup
          this.cleanup();
          
          resolve(finalBlob);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          reject(new RecordingError(`Failed to finalize recording: ${message}`));
        }
      };

      // Set up stop handler
      this.mediaRecorder.addEventListener('stop', handleStop, { once: true });

      // Stop the recorder
      this.mediaRecorder.stop();
    });
  }

  pause(): void {
    if (this.state !== RecordingState.RECORDING) {
      throw new RecordingError(`Cannot pause recording in ${this.state} state`);
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.pauseStartTime = Date.now();
      this.state = RecordingState.PAUSED;
    }
  }

  resume(): void {
    if (this.state !== RecordingState.PAUSED) {
      throw new RecordingError(`Cannot resume recording in ${this.state} state`);
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      // Reset pause start time
      this.pauseStartTime = 0;
      this.state = RecordingState.RECORDING;
    }
  }

  getState(): RecordingState {
    return this.state;
  }

  getPauseDuration(): number {
    if (this.state === RecordingState.PAUSED && this.pauseStartTime > 0) {
      return Date.now() - this.pauseStartTime;
    }
    return 0;
  }

  onDataAvailable(callback: (chunk: Blob) => void): void {
    this.onDataCallback = callback;
  }

  dispose(): void {
    this.cleanup();
  }

  // Private methods
  private async getMediaStream(options: RecordingOptions): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: options.deviceId ? { exact: options.deviceId } : undefined,
        sampleRate: options.sampleRate,
        channelCount: options.channels,
        autoGainControl: options.autoGainControl ?? true,
        noiseSuppression: options.noiseSuppression ?? true,
        echoCancellation: options.echoCancellation ?? true
      },
      video: false
    };

    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          throw new RecordingError('Microphone permission denied. Please allow microphone access to record audio.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          throw new RecordingError('No microphone found. Please connect a microphone and try again.');
        } else {
          throw new RecordingError(`Failed to access microphone: ${error.message}`);
        }
      } else {
        throw new RecordingError(`Failed to access microphone: ${String(error)}`);
      }
    }
  }

  private async setupOutputFile(options: RecordingOptions): Promise<string> {
    // Create base directory structure
    const documentsPath = app.getPath('documents');
    const basePath = path.join(documentsPath, 'VoiceMCP', 'recordings');
    
    // Create year/month structure
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthName = now.toLocaleDateString('en-US', { month: 'long' });
    const monthFolder = `${month}-${monthName}`;
    
    const recordingPath = path.join(basePath, year, monthFolder);
    
    // Ensure directory exists
    await fs.promises.mkdir(recordingPath, { recursive: true });
    
    // Generate filename
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const uuid = this.generateShortId();
    const extension = this.getFileExtension(options.format);
    const filename = `${timestamp}_${uuid}${extension}`;
    
    return path.join(recordingPath, filename);
  }

  private setupMediaRecorderHandlers(): void {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) {
        // Store chunk for final blob
        this.audioChunks.push(event.data);

        // Write to file stream
        if (this.fileStream && this.fileStream.writable) {
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
              const buffer = Buffer.from(reader.result);
              this.fileStream!.write(buffer);
            }
          };
          reader.readAsArrayBuffer(event.data);
        }

        // Notify callback
        if (this.onDataCallback) {
          this.onDataCallback(event.data);
        }
      }
    });

    this.mediaRecorder.addEventListener('error', (event) => {
      console.error('MediaRecorder error:', event);
      // For now, just log the error since we need to define proper event types
      // this.eventEmitter?.emit('recording:error', {
      //   error: new RecordingError(`MediaRecorder error: ${event.toString()}`)
      // });
      this.cleanup();
    });
  }

  private getMimeType(format?: AudioFormat): string {
    switch (format) {
      case AudioFormat.WEBM_OPUS:
        return 'audio/webm;codecs=opus';
      case AudioFormat.MP3:
        // Note: MP3 might not be supported in all browsers
        return 'audio/mp3';
      case AudioFormat.WAV:
        // Note: WAV might not be supported by MediaRecorder
        return 'audio/wav';
      default:
        return 'audio/webm;codecs=opus';
    }
  }

  private getFileExtension(format?: AudioFormat): string {
    switch (format) {
      case AudioFormat.WEBM_OPUS:
        return '.webm';
      case AudioFormat.MP3:
        return '.mp3';
      case AudioFormat.WAV:
        return '.wav';
      default:
        return '.webm';
    }
  }

  private generateShortId(): string {
    return Math.random().toString(36).substring(2, 8);
  }

  private cleanup(): void {
    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Close file stream
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }

    // Reset MediaRecorder
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop();
        } catch (error) {
          // Ignore errors during cleanup
        }
      }
      this.mediaRecorder = null;
    }

    // Reset state
    this.state = RecordingState.IDLE;
    this.audioChunks = [];
    this.outputPath = null;
    this.onDataCallback = null;
  }
}
