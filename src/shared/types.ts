/**
 * Core types for the VoiceMCP application
 */

// IPC Channel definitions
export enum IpcChannels {
  // Recording channels
  RECORDING_START = 'recording:start',
  RECORDING_STOP = 'recording:stop',
  RECORDING_PAUSE = 'recording:pause',
  RECORDING_RESUME = 'recording:resume',
  RECORDING_STATUS = 'recording:status',
  RECORDING_COMPLETED = 'recording:completed',
  AUDIO_LEVEL_UPDATE = 'audio:levelUpdate',
  AUDIO_DATA_CHUNK = 'audio:dataChunk',
  
  // App channels
  GET_APP_VERSION = 'app:getVersion',
  QUIT_APP = 'app:quit',

  // Window channels
  WINDOW_MINIMIZE = 'window:minimize',
  WINDOW_MAXIMIZE = 'window:maximize',
  WINDOW_UNMAXIMIZE = 'window:unmaximize',
  WINDOW_CLOSE = 'window:close',
}

// Window related types
export interface WindowState {
  isMaximized: boolean;
  isMinimized: boolean;
  isVisible: boolean;
  isFocused: boolean;
}

// Electron API type definition
export interface ElectronAPI {
  recording: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
  };
  app: {
    getVersion: () => Promise<string>;
    quit: () => Promise<void>;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  onRecordingStatus: (callback: (status: string) => void) => () => void;
  onAudioLevelUpdate: (callback: (data: { level: number; peak: number; timestamp: number }) => void) => () => void;
}

// Recording related types
export interface AudioRecording {
  id: string;
  filename: string;
  duration: number;
  createdAt: Date;
  transcribed: boolean;
  path: string;
}

export interface RecordingMetadata {
  id: string;
  title?: string;
  notes?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Transcription related types
export interface TranscriptionResult {
  recordingId: string;
  text: string;
  language: string;
  confidence: number;
  segments: TranscriptionSegment[];
  createdAt: Date;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  confidence: number;
}

// MCP related types
export interface MCPTool {
  name: string;
  description: string;
  parameters: MCPToolParameter[];
}

export interface MCPToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

export interface MCPResource {
  uri: string;
  type: string;
  description: string;
}

// Application state types
export interface AppSettings {
  audioInputDevice: string;
  audioFormat: AudioFormat;
  whisperModel: string;
  autoTranscribe: boolean;
  saveLocation: string;
  theme: 'light' | 'dark' | 'system';
}

export interface AudioFormat {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  codec: string;
}

// Database types
export interface DBRecord {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchQuery {
  text?: string;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  transcribed?: boolean;
  limit?: number;
  offset?: number;
}

// Error types
export interface AppError extends Error {
  code: string;
  details?: any;
  timestamp: Date;
}

export enum ErrorCode {
  RECORDING_FAILED = 'RECORDING_FAILED',
  TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',
  STORAGE_ERROR = 'STORAGE_ERROR',
  MCP_ERROR = 'MCP_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Event types
export type AppEvent = 
  | { type: 'RECORDING_STARTED'; payload: { id: string } }
  | { type: 'RECORDING_STOPPED'; payload: AudioRecording }
  | { type: 'TRANSCRIPTION_STARTED'; payload: { recordingId: string } }
  | { type: 'TRANSCRIPTION_COMPLETED'; payload: TranscriptionResult }
  | { type: 'TRANSCRIPTION_FAILED'; payload: AppError }
  | { type: 'SETTINGS_UPDATED'; payload: Partial<AppSettings> };
