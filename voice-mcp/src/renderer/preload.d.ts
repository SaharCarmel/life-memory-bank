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
  transcriptProgress?: number;
  aiStatus?: 'none' | 'processing' | 'completed' | 'failed';
  aiProgress?: number;
  aiTitle?: string;
  aiSummary?: string;
  aiError?: string;
  aiGeneratedAt?: Date;
}

export interface RealTimeTranscriptionConfig {
  enabled: boolean;
  whisperModel: 'tiny' | 'base' | 'small';
  chunkDuration: number; // in seconds
  chunkOverlap: number; // in seconds
  maxConcurrentJobs: number;
  enableSegmentMerging: boolean;
  autoStartForRecordings: boolean;
  language?: string; // optional language hint for Whisper
}

export interface ElectronAPI {
    recording: {
      start: () => Promise<{ success: boolean; recordingId?: string; sessionId?: string; error?: string }>;
      stop: () => Promise<{ success: boolean; metadata?: any; error?: string }>;
      pause: () => Promise<{ success: boolean; error?: string }>;
      resume: () => Promise<{ success: boolean; error?: string }>;
      sendAudioData: (chunk: any) => void;
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
  storage: {
    listRecordings: () => Promise<RecordingMetadata[]>;
    deleteRecording: (filepath: string) => Promise<void>;
    getRecordingInfo: (recordingId: string) => Promise<RecordingMetadata | undefined>;
  };
  transcription: {
    transcribeRecording: (recordingId: string) => Promise<string>;
    transcribeMultiple: (recordingIds: string[]) => Promise<string[]>;
    getStatus: (jobId: string) => Promise<any>;
    cancel: (jobId: string) => Promise<void>;
    loadTranscript: (recordingId: string) => Promise<any>;
  };
  config: {
    getOpenAIConfig: () => Promise<{ model: string; temperature: number; hasApiKey: boolean } | null>;
    setOpenAIConfig: (config: { apiKey?: string; model: string; temperature: number }) => Promise<{ success: boolean }>;
    hasOpenAIConfig: () => Promise<boolean>;
    testOpenAIConfig: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
    clearConfig: () => Promise<{ success: boolean }>;
    getRealTimeTranscriptionConfig: () => Promise<RealTimeTranscriptionConfig>;
    setRealTimeTranscriptionConfig: (config: RealTimeTranscriptionConfig) => Promise<{ success: boolean }>;
    updateRealTimeTranscriptionConfig: (updates: Partial<RealTimeTranscriptionConfig>) => Promise<{ success: boolean }>;
    isRealTimeTranscriptionEnabled: () => Promise<boolean>;
    getDefaultRealTimeTranscriptionConfig: () => Promise<RealTimeTranscriptionConfig>;
  };
  onRecordingStatus: (callback: (status: string) => void) => () => void;
  onAudioLevelUpdate: (callback: (data: { level: number; peak: number; timestamp: number }) => void) => () => void;
  onRecordingCompleted: (callback: () => void) => () => void;
  onTranscriptionProgress: (callback: (data: { jobId: string; recordingId: string; progress: number; message: string }) => void) => () => void;
  onTranscriptionCompleted: (callback: (data: { jobId: string; recordingId: string; result: any }) => void) => () => void;
  onTranscriptionFailed: (callback: (data: { jobId: string; recordingId: string; error: string }) => void) => () => void;
  ai: {
    processTranscript: (recordingId: string, transcriptPath?: string) => Promise<{ success: boolean; jobId: string }>;
    getJobStatus: (jobId: string) => Promise<any>;
    cancelJob: (jobId: string) => Promise<{ success: boolean }>;
    getActiveJobs: () => Promise<any[]>;
  };
  onAIProgress: (callback: (data: { jobId: string; progress: number; message: string }) => void) => () => void;
  onAICompleted: (callback: (data: { jobId: string; result: any }) => void) => () => void;
  onAIFailed: (callback: (data: { jobId: string; error: string }) => void) => () => void;
  realtimeTranscription: {
    start: (recordingId: string) => Promise<any>;
    stop: (recordingId: string) => Promise<any>;
    processChunk: (recordingId: string, chunk: any) => Promise<any>;
    getTranscript: (recordingId: string) => Promise<any>;
    getText: (recordingId: string) => Promise<any>;
    getJob: (jobId: string) => Promise<any>;
    cancelJob: (jobId: string) => Promise<any>;
    updateConfig: (config: any) => Promise<any>;
    getStats: () => Promise<any>;
  };
  onRealtimeTranscriptionStarted: (callback: (data: { recordingId: string; timestamp: number }) => void) => () => void;
  onRealtimeTranscriptionStopped: (callback: (data: { recordingId: string; timestamp: number }) => void) => () => void;
  onRealtimeChunkQueued: (callback: (data: { recordingId: string; chunkId: string; jobId: string; timestamp: number }) => void) => () => void;
  onRealtimeJobStarted: (callback: (data: { recordingId: string; chunkId: string; jobId: string; timestamp: number }) => void) => () => void;
  onRealtimeJobCompleted: (callback: (data: { recordingId: string; chunkId: string; jobId: string; segment: any; timestamp: number }) => void) => () => void;
  onRealtimeJobFailed: (callback: (data: { recordingId: string; chunkId: string; jobId: string; error: string; timestamp: number }) => void) => () => void;
  onRealtimeJobCancelled: (callback: (data: { recordingId: string; chunkId: string; jobId: string; timestamp: number }) => void) => () => void;
  onRealtimeSegmentAdded: (callback: (data: { recordingId: string; segment: any; timestamp: number }) => void) => () => void;
  onRealtimeTextUpdated: (callback: (data: { recordingId: string; text: string; timestamp: number }) => void) => () => void;
  onRealtimeTranscriptionFinalized: (callback: (data: { recordingId: string; segments: any[]; text: string; timestamp: number }) => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
