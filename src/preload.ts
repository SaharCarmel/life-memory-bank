import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from './shared/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    recording: {
      start: () => ipcRenderer.invoke(IpcChannels.RECORDING_START) as Promise<{ success: boolean }>,
      stop: () => ipcRenderer.invoke(IpcChannels.RECORDING_STOP) as Promise<{ success: boolean }>,
      pause: () => ipcRenderer.invoke(IpcChannels.RECORDING_PAUSE) as Promise<{ success: boolean }>,
      resume: () => ipcRenderer.invoke(IpcChannels.RECORDING_RESUME) as Promise<{ success: boolean }>,
    },
    app: {
      getVersion: () => ipcRenderer.invoke(IpcChannels.GET_APP_VERSION),
      quit: () => ipcRenderer.invoke(IpcChannels.QUIT_APP),
    },
    window: {
      minimize: () => ipcRenderer.send(IpcChannels.WINDOW_MINIMIZE),
      maximize: () => ipcRenderer.send(IpcChannels.WINDOW_MAXIMIZE),
      close: () => ipcRenderer.send(IpcChannels.WINDOW_CLOSE),
    },
    onRecordingStatus: (callback: (status: string) => void) => {
      ipcRenderer.on(IpcChannels.RECORDING_STATUS, (_, status) => callback(status));
      return () => {
        ipcRenderer.removeAllListeners(IpcChannels.RECORDING_STATUS);
      };
    },
  }
);
