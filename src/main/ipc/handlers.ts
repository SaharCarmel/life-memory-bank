import { ipcMain, app, BrowserWindow } from 'electron';
import { IpcChannels, ErrorCode, createError } from '../../shared';

let isRecording = false;

export function setupIpcHandlers(): void {
  // App handlers
  ipcMain.handle(IpcChannels.GET_APP_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.handle(IpcChannels.QUIT_APP, () => {
    app.quit();
  });

  // Recording handlers
  ipcMain.handle(IpcChannels.RECORDING_START, async () => {
    try {
      if (isRecording) {
        throw createError(
          ErrorCode.RECORDING_FAILED,
          'Recording is already in progress'
        );
      }
      
      // TODO: Implement actual recording logic
      isRecording = true;
      // Send status update to renderer
      BrowserWindow.getAllWindows().forEach((window: BrowserWindow) => {
        window.webContents.send(IpcChannels.RECORDING_STATUS, 'Recording in progress...');
      });
      return { success: true };
    } catch (error) {
      throw createError(
        ErrorCode.RECORDING_FAILED,
        'Failed to start recording',
        error
      );
    }
  });

  ipcMain.handle(IpcChannels.RECORDING_STOP, async () => {
    try {
      if (!isRecording) {
        throw createError(
          ErrorCode.RECORDING_FAILED,
          'No recording in progress'
        );
      }
      
      // TODO: Implement actual stop logic
      isRecording = false;
      // Send status update to renderer
      BrowserWindow.getAllWindows().forEach((window: BrowserWindow) => {
        window.webContents.send(IpcChannels.RECORDING_STATUS, 'Recording stopped');
      });
      return { success: true };
    } catch (error) {
      throw createError(
        ErrorCode.RECORDING_FAILED,
        'Failed to stop recording',
        error
      );
    }
  });

  ipcMain.handle(IpcChannels.RECORDING_PAUSE, async () => {
    try {
      if (!isRecording) {
        throw createError(
          ErrorCode.RECORDING_FAILED,
          'No recording in progress'
        );
      }
      
      // TODO: Implement actual pause logic
      return { success: true };
    } catch (error) {
      throw createError(
        ErrorCode.RECORDING_FAILED,
        'Failed to pause recording',
        error
      );
    }
  });

  ipcMain.handle(IpcChannels.RECORDING_RESUME, async () => {
    try {
      if (!isRecording) {
        throw createError(
          ErrorCode.RECORDING_FAILED,
          'No recording in progress'
        );
      }
      
      // TODO: Implement actual resume logic
      return { success: true };
    } catch (error) {
      throw createError(
        ErrorCode.RECORDING_FAILED,
        'Failed to resume recording',
        error
      );
    }
  });
}
