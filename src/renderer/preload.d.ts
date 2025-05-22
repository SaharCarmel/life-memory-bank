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
}

export interface ElectronAPI {
    recording: {
      start: () => Promise<{ success: boolean }>;
      stop: () => Promise<{ success: boolean }>;
      pause: () => Promise<{ success: boolean }>;
      resume: () => Promise<{ success: boolean }>;
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
  onRecordingStatus: (callback: (status: string) => void) => () => void;
  onAudioLevelUpdate: (callback: (data: { level: number; peak: number; timestamp: number }) => void) => () => void;
  onRecordingCompleted: (callback: () => void) => () => void;
  onTranscriptionProgress: (callback: (data: { jobId: string; recordingId: string; progress: number; message: string }) => void) => () => void;
  onTranscriptionCompleted: (callback: (data: { jobId: string; recordingId: string; result: any }) => void) => () => void;
  onTranscriptionFailed: (callback: (data: { jobId: string; recordingId: string; error: string }) => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
