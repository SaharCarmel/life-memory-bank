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
  onRecordingStatus: (callback: (status: string) => void) => () => void;
  onAudioLevelUpdate: (callback: (data: { level: number; peak: number; timestamp: number }) => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
