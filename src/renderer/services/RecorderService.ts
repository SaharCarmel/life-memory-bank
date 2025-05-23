import { EventEmitter } from 'events';

export interface RecorderOptions {
  deviceId?: string;
  mimeType?: string;
  audioBitsPerSecond?: number;
}

export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
  duration?: number;
}

export class RecorderService extends EventEmitter {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private pauseStartTime: number = 0;
  private isRecording: boolean = false;
  private isPaused: boolean = false;

  constructor() {
    super();
  }

  async start(options: RecorderOptions = {}): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: options.deviceId ? { exact: options.deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Determine the best supported MIME type
      const mimeType = this.getSupportedMimeType(options.mimeType);
      
      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: options.audioBitsPerSecond || 128000
      });

      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
          // Convert to ArrayBuffer and emit for streaming to main process
          event.data.arrayBuffer().then(buffer => {
            this.emit('data', {
              data: buffer,
              timestamp: Date.now()
            } as AudioChunk);
          });
        }
      };

      this.mediaRecorder.onstart = () => {
        this.startTime = Date.now();
        this.pausedDuration = 0;
        this.isRecording = true;
        this.isPaused = false;
        this.emit('start');
      };

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        this.isPaused = false;
        this.emit('stop', this.chunks);
        this.cleanup();
      };

      this.mediaRecorder.onerror = (event: any) => {
        this.emit('error', event.error);
        this.cleanup();
      };

      // Start recording with timeslice for streaming
      this.mediaRecorder.start(1000); // Get data every second

    } catch (error) {
      this.cleanup();
      throw this.handlePermissionError(error);
    }
  }

  async stop(): Promise<Blob> {
    if (!this.mediaRecorder || !this.isRecording) {
      throw new Error('Not recording');
    }

    return new Promise((resolve) => {
      const handleStop = () => {
        const blob = new Blob(this.chunks, { 
          type: this.mediaRecorder?.mimeType || 'audio/webm' 
        });
        resolve(blob);
      };

      this.once('stop', handleStop);
      this.mediaRecorder!.stop();
    });
  }

  pause(): void {
    if (!this.mediaRecorder || !this.isRecording || this.isPaused) {
      throw new Error('Cannot pause in current state');
    }

    this.pauseStartTime = Date.now();
    this.mediaRecorder.pause();
    this.isPaused = true;
    this.emit('pause');
  }

  resume(): void {
    if (!this.mediaRecorder || !this.isRecording || !this.isPaused) {
      throw new Error('Cannot resume in current state');
    }

    this.pausedDuration += Date.now() - this.pauseStartTime;
    this.mediaRecorder.resume();
    this.isPaused = false;
    this.emit('resume');
  }

  getDuration(): number {
    if (!this.isRecording) {
      return 0;
    }

    const now = Date.now();
    const totalTime = now - this.startTime;
    const recordingTime = totalTime - this.pausedDuration;

    if (this.isPaused) {
      return recordingTime - (now - this.pauseStartTime);
    }

    return recordingTime;
  }

  getState(): 'idle' | 'recording' | 'paused' {
    if (!this.isRecording) return 'idle';
    if (this.isPaused) return 'paused';
    return 'recording';
  }

  async getDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audioinput');
  }

  private getSupportedMimeType(preferred?: string): string {
    const types = [
      preferred,
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4'
    ].filter(Boolean) as string[];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    // Fallback to default
    return '';
  }

  private handlePermissionError(error: any): Error {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return new Error('Microphone access denied. Please allow microphone access to record audio.');
    } else if (error.name === 'NotFoundError') {
      return new Error('No microphone found. Please connect a microphone and try again.');
    } else if (error.name === 'NotReadableError') {
      return new Error('Microphone is already in use by another application.');
    }
    return error;
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
    this.isRecording = false;
    this.isPaused = false;
  }

  dispose(): void {
    if (this.isRecording) {
      this.stop();
    }
    this.cleanup();
    this.removeAllListeners();
  }
}
