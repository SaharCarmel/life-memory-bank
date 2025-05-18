import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from './shared/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    recording: {
      start: () => ipcRenderer.invoke(IpcChannels.RECORDING_START),
      stop: () => ipcRenderer.invoke(IpcChannels.RECORDING_STOP),
      pause: () => ipcRenderer.invoke(IpcChannels.RECORDING_PAUSE),
      resume: () => ipcRenderer.invoke(IpcChannels.RECORDING_RESUME),
    },
    app: {
      getVersion: () => ipcRenderer.invoke(IpcChannels.GET_APP_VERSION),
      quit: () => ipcRenderer.invoke(IpcChannels.QUIT_APP),
    },
    onRecordingStatus: (callback: (status: string) => void) => {
      ipcRenderer.on(IpcChannels.RECORDING_STATUS, (_, status) => callback(status));
      return () => {
        ipcRenderer.removeAllListeners(IpcChannels.RECORDING_STATUS);
      };
    },
  }
);
