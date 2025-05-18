export interface ElectronAPI {
  recording: {
    start: () => Promise<{ success: boolean }>;
    stop: () => Promise<{ success: boolean }>;
    pause: () => Promise<{ success: boolean }>;
    resume: () => Promise<{ success: boolean }>;
  };
  app: {
    getVersion: () => Promise<string>;
    quit: () => Promise<void>;
  };
  onRecordingStatus: (callback: (status: string) => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
