import { EventEmitter } from 'events';

export interface RecorderOptions {
  deviceId?: string;
  mimeType?: string;
  audioBitsPerSecond?: number;
  enableRealTimeTranscription?: boolean;
}

export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
  duration?: number;
}

export interface ProcessingChunk {
  id: string;
  data: ArrayBuffer;
  startTime: number;
  endTime: number;
  recordingOffset: number;
  isProcessing: boolean;
}

export interface ChunkBufferOptions {
  chunkDuration: number; // in milliseconds
  overlapDuration: number; // in milliseconds
  maxBufferSize: number; // maximum chunks to keep in memory
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

  // Real-time processing properties
  private realTimeEnabled: boolean = false;
  private chunkBuffer: ProcessingChunk[] = [];
  private chunkBufferOptions: ChunkBufferOptions = {
    chunkDuration: 5000, // 5 seconds
    overlapDuration: 1000, // 1 second
    maxBufferSize: 20 // Keep last 20 chunks (100 seconds of audio)
  };
  private lastChunkTime: number = 0;
  private chunkCounter: number = 0;
  private audioDataBuffer: Blob[] = [];

  constructor() {
    super();
  }

  async start(options: RecorderOptions = {}): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    this.realTimeEnabled = options.enableRealTimeTranscription || false;
    
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
          
          // Handle real-time processing
          if (this.realTimeEnabled) {
            this.handleRealtimeChunk(event.data);
          }
          
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
        this.lastChunkTime = this.startTime;
        this.pausedDuration = 0;
        this.chunkCounter = 0;
        this.isRecording = true;
        this.isPaused = false;
        this.chunkBuffer = [];
        this.audioDataBuffer = [];
        this.emit('start');
        
        if (this.realTimeEnabled) {
          this.emit('realtime-started');
        }
      };

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        this.isPaused = false;
        this.emit('stop', this.chunks);
        
        if (this.realTimeEnabled) {
          this.emit('realtime-stopped');
        }
        
        this.cleanup();
      };

      this.mediaRecorder.onerror = (event: any) => {
        this.emit('error', event.error);
        this.cleanup();
      };

      // Start recording with smaller timeslice for real-time processing
      const timeslice = this.realTimeEnabled ? 500 : 1000; // 500ms for real-time, 1s for normal
      this.mediaRecorder.start(timeslice);

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

  // Real-time transcription methods
  isRealTimeEnabled(): boolean {
    return this.realTimeEnabled;
  }

  setChunkBufferOptions(options: Partial<ChunkBufferOptions>): void {
    this.chunkBufferOptions = {
      ...this.chunkBufferOptions,
      ...options
    };
  }

  getChunkBuffer(): ProcessingChunk[] {
    return [...this.chunkBuffer];
  }

  getProcessingChunk(chunkId: string): ProcessingChunk | undefined {
    return this.chunkBuffer.find(chunk => chunk.id === chunkId);
  }

  private async handleRealtimeChunk(blob: Blob): Promise<void> {
    try {
      console.log(`[RecorderService] Handling real-time chunk, blob size: ${blob.size} bytes`);
      
      // Add to audio data buffer
      this.audioDataBuffer.push(blob);
      console.log(`[RecorderService] Audio buffer now has ${this.audioDataBuffer.length} chunks`);
      
      const now = Date.now();
      const timeSinceLastChunk = now - this.lastChunkTime;
      
      console.log(`[RecorderService] Time since last chunk: ${timeSinceLastChunk}ms, threshold: ${this.chunkBufferOptions.chunkDuration}ms`);
      
      // Check if we should create a processing chunk
      if (timeSinceLastChunk >= this.chunkBufferOptions.chunkDuration) {
        console.log(`[RecorderService] Creating processing chunk after ${timeSinceLastChunk}ms`);
        await this.createProcessingChunk();
        this.lastChunkTime = now;
      }
    } catch (error) {
      console.error('[RecorderService] Error handling real-time chunk:', error);
      this.emit('realtime-error', error);
    }
  }

  private async createProcessingChunk(): Promise<void> {
    if (this.audioDataBuffer.length === 0) {
      return;
    }

    const chunkId = `chunk_${this.chunkCounter++}_${Date.now()}`;
    const now = Date.now();
    const recordingOffset = now - this.startTime - this.pausedDuration;
    
    // Calculate overlap
    const overlapStartTime = Math.max(0, recordingOffset - this.chunkBufferOptions.overlapDuration);
    
    // Create blob from ALL chunks accumulated so far (including previous chunks)
    // This ensures we have a valid WebM file with proper headers
    const chunkBlob = new Blob(this.chunks.concat(this.audioDataBuffer), { 
      type: this.mediaRecorder?.mimeType || 'audio/webm' 
    });
    
    // Convert to ArrayBuffer
    const arrayBuffer = await chunkBlob.arrayBuffer();
    
    // Create processing chunk
    const processingChunk: ProcessingChunk = {
      id: chunkId,
      data: arrayBuffer,
      startTime: overlapStartTime,
      endTime: recordingOffset,
      recordingOffset,
      isProcessing: false
    };
    
    // Add to buffer and manage size
    this.chunkBuffer.push(processingChunk);
    if (this.chunkBuffer.length > this.chunkBufferOptions.maxBufferSize) {
      this.chunkBuffer.shift(); // Remove oldest chunk
    }
    
    // Clear audio data buffer (we've processed it)
    this.audioDataBuffer = [];
    
    // Emit chunk for processing
    this.emit('processing-chunk', processingChunk);
    
    console.log(`Created processing chunk: ${chunkId}, duration: ${processingChunk.endTime - processingChunk.startTime}ms`);
  }

  markChunkProcessing(chunkId: string, isProcessing: boolean): void {
    const chunk = this.chunkBuffer.find(c => c.id === chunkId);
    if (chunk) {
      chunk.isProcessing = isProcessing;
      this.emit('chunk-processing-status', { chunkId, isProcessing });
    }
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
    this.chunkBuffer = [];
    this.audioDataBuffer = [];
    this.isRecording = false;
    this.isPaused = false;
    this.realTimeEnabled = false;
    this.chunkCounter = 0;
    this.lastChunkTime = 0;
  }

  dispose(): void {
    if (this.isRecording) {
      this.stop();
    }
    this.cleanup();
    this.removeAllListeners();
  }
}
