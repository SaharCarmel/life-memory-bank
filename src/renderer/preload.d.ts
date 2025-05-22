export interface RecordingMetadata {
  id: string;
  filename: string;
  filepath: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  size?: number;
  format: string;
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
  onRecordingStatus: (callback: (status: string) => void) => () => void;
  onAudioLevelUpdate: (callback: (data: { level: number; peak: number; timestamp: number }) => void) => () => void;
  onRecordingCompleted: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
