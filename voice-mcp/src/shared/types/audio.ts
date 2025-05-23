// Recording states
export enum RecordingState {
  IDLE = 'idle',
  RECORDING = 'recording',
  PAUSED = 'paused',
  PROCESSING = 'processing',
  ERROR = 'error'
}

// Audio formats
export enum AudioFormat {
  WEBM_OPUS = 'webm/opus',
  MP3 = 'mp3',
  WAV = 'wav'
}

// Recording options
export interface RecordingOptions {
  format?: AudioFormat;
  sampleRate?: number;
  channels?: number;
  deviceId?: string;
  maxDuration?: number; // in seconds
  autoGainControl?: boolean;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
}

// Recording result
export interface RecordingResult {
  id: string;
  filename: string;
  duration: number;
  size: number;
  format: AudioFormat;
  createdAt: Date;
  audioBlob?: Blob;
}

// Audio device info
export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput';
  isDefault: boolean;
}

// Audio level data for visualization
export interface AudioLevelData {
  level: number; // 0-1
  peak: number;  // 0-1
  timestamp: number;
}

// Recording events
export interface RecordingEvents {
  'recording:started': { options: RecordingOptions };
  'recording:stopped': { result: RecordingResult };
  'recording:paused': { timestamp: number };
  'recording:resumed': { timestamp: number };
  'recording:error': { error: Error };
  'audio:level': AudioLevelData;
  'audio:chunk': { data: ArrayBuffer; timestamp: number };
}
