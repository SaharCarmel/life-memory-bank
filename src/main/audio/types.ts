import { RecordingOptions, RecordingResult, RecordingState, AudioDevice, AudioLevelData } from '@shared/types/audio';

// Main audio service interface
export interface IAudioService {
  // State
  getState(): RecordingState;
  
  // Recording controls
  startRecording(options?: RecordingOptions): Promise<void>;
  stopRecording(): Promise<RecordingResult>;
  pauseRecording(): Promise<void>;
  resumeRecording(): Promise<void>;
  
  // Device management
  getAudioDevices(): Promise<AudioDevice[]>;
  setInputDevice(deviceId: string): Promise<void>;
  getDefaultDevice(): Promise<AudioDevice | null>;
  
  // Monitoring
  getAudioLevel(): AudioLevelData;
  isRecording(): boolean;
  getDuration(): number;
  
  // Cleanup
  dispose(): void;
}

// Audio recorder interface
export interface IAudioRecorder {
  start(options: RecordingOptions): Promise<void>;
  stop(): Promise<Blob>;
  pause(): void;
  resume(): void;
  getState(): RecordingState;
  onDataAvailable(callback: (chunk: Blob) => void): void;
  dispose(): void;
}

// Audio processor interface
export interface IAudioProcessor {
  initialize(stream: MediaStream): Promise<void>;
  getAudioLevel(): number;
  getPeakLevel(): number;
  getFrequencyData(): Float32Array;
  getWaveformData(): Float32Array;
  dispose(): void;
}

// Service options
export interface AudioServiceOptions {
  defaultOptions?: RecordingOptions;
  storageBasePath?: string;
  maxRecordingDuration?: number;
}

// Error types
export class AudioServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AudioServiceError';
  }
}

export class RecordingError extends AudioServiceError {
  constructor(message: string) {
    super(message, 'RECORDING_ERROR');
  }
}

export class DeviceError extends AudioServiceError {
  constructor(message: string) {
    super(message, 'DEVICE_ERROR');
  }
}

export class PermissionError extends AudioServiceError {
  constructor(message: string) {
    super(message, 'PERMISSION_ERROR');
  }
}
