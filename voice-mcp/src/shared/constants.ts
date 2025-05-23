import { AudioFormat, AppSettings } from './types';

/**
 * Application-wide constants for VoiceMCP
 */

// Audio Recording Constants
export const DEFAULT_AUDIO_FORMAT: AudioFormat = {
  sampleRate: 44100,
  channels: 2,
  bitDepth: 16,
  codec: 'wav'
};

export const SUPPORTED_AUDIO_FORMATS = ['wav', 'mp3', 'ogg'];

export const RECORDING_BUFFER_SIZE = 4096;
export const MAX_RECORDING_DURATION = 7200; // 2 hours in seconds
export const MIN_RECORDING_DURATION = 1; // 1 second

// Whisper Constants
export const WHISPER_MODELS = {
  TINY: 'tiny',
  BASE: 'base',
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large'
} as const;

export const DEFAULT_WHISPER_MODEL = WHISPER_MODELS.SMALL;
export const WHISPER_LANGUAGES = ['auto', 'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'zh', 'ja', 'ko', 'ar'];

// Storage Constants
export const DB_VERSION = 1;
export const DB_NAME = 'voicemcp';
export const STORAGE_TABLES = {
  RECORDINGS: 'recordings',
  TRANSCRIPTIONS: 'transcriptions',
  METADATA: 'metadata',
  SETTINGS: 'settings'
} as const;

export const DEFAULT_SAVE_LOCATION = 'recordings';
export const MAX_FILE_SIZE = 1024 * 1024 * 500; // 500MB

// UI Constants
export const WINDOW_DIMENSIONS = {
  MIN_WIDTH: 800,
  MIN_HEIGHT: 600,
  DEFAULT_WIDTH: 1024,
  DEFAULT_HEIGHT: 768
} as const;

export const UI_THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
} as const;

// Application Settings
export const DEFAULT_SETTINGS: AppSettings = {
  audioInputDevice: 'default',
  audioFormat: DEFAULT_AUDIO_FORMAT,
  whisperModel: DEFAULT_WHISPER_MODEL,
  autoTranscribe: true,
  saveLocation: DEFAULT_SAVE_LOCATION,
  theme: UI_THEMES.SYSTEM
};

// MCP Constants
export const MCP_SERVER_PORT = 3000;
export const MCP_SERVER_HOST = 'localhost';
export const MCP_TOOLS = {
  TRANSCRIBE: 'transcribe',
  SEARCH: 'search',
  SUMMARIZE: 'summarize',
  ANALYZE: 'analyze'
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  RECORDING_INIT: 'Failed to initialize recording',
  RECORDING_START: 'Failed to start recording',
  RECORDING_STOP: 'Failed to stop recording',
  TRANSCRIPTION_FAILED: 'Failed to transcribe audio',
  STORAGE_ERROR: 'Failed to access storage',
  INVALID_FORMAT: 'Invalid audio format',
  MCP_CONNECTION: 'Failed to connect to MCP server',
  UNKNOWN_ERROR: 'An unknown error occurred'
} as const;

// Timeouts and Intervals
export const TIMEOUTS = {
  RECORDING_START: 1000,
  TRANSCRIPTION: 30000,
  MCP_CONNECTION: 5000,
  SAVE_DEBOUNCE: 500,
  UI_UPDATE: 100
} as const;

// File Extensions
export const FILE_EXTENSIONS = {
  AUDIO: ['.wav', '.mp3', '.ogg'],
  TRANSCRIPTION: '.txt',
  METADATA: '.json'
} as const;

// Event Names
export const EVENTS = {
  RECORDING_START: 'recording-start',
  RECORDING_STOP: 'recording-stop',
  TRANSCRIPTION_START: 'transcription-start',
  TRANSCRIPTION_COMPLETE: 'transcription-complete',
  SETTINGS_UPDATE: 'settings-update',
  ERROR: 'error'
} as const;

// Regular Expressions
export const REGEX = {
  FILENAME: /^[a-zA-Z0-9-_]+$/,
  TIMESTAMP: /^\d{2}:\d{2}:\d{2}$/,
  DURATION: /^\d+:\d{2}$/
} as const;
