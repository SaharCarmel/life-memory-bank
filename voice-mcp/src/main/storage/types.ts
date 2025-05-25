export interface StorageOptions {
  basePath?: string;
  maxFileSize?: number;
}

export interface RecordingMetadata {
  id: string;
  filename: string;
  filepath: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  size?: number;
  format: string;
  transcriptStatus?: 'none' | 'processing' | 'completed' | 'failed';
  transcriptPath?: string;
  transcriptError?: string;
  transcriptProgress?: number; // 0-100 for progress tracking
  // AI-generated content
  aiTitle?: string;
  aiSummary?: string;
  aiStatus?: 'none' | 'processing' | 'completed' | 'failed';
  aiError?: string;
  aiProgress?: number; // 0-100 for AI processing progress
  aiGeneratedAt?: Date;
}

export interface ActiveRecording {
  id: string;
  metadata: RecordingMetadata;
  writeStream: import('fs').WriteStream;
  chunks: Buffer[];
  isFinalized: boolean;
}

// Import TranscriptionResult from whisper types
export interface TranscriptStorage {
  recordingId: string;
  transcribedAt: Date;
  result: {
    text: string;
    language: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };
  version: string;
}

// AI Content Storage interface
export interface AIContentStorage {
  recordingId: string;
  generatedAt: Date;
  title: string;
  summary: string;
  version: string;
}

// Real-time transcript segment interface (from RealTimeTranscriptionService)
export interface TranscriptSegment {
  id: string;
  chunkId: string;
  recordingId: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence?: number;
  language?: string;
  isFinal: boolean;
  isOverlap: boolean;
  createdAt: Date;
}

// Database interfaces
export interface DatabaseOptions {
  enabled: boolean;
  dbPath?: string;
}
