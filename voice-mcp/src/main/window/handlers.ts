import { ipcMain, BrowserWindow } from 'electron';
import { IpcChannels } from '../../shared/types';

/**
 * Set up window control handlers for the main process
 * @param mainWindow The main application window
 */
export function setupWindowHandlers(mainWindow: BrowserWindow) {
  ipcMain.on(IpcChannels.WINDOW_MINIMIZE, () => {
    if (!mainWindow.isMinimized()) {
      mainWindow.minimize();
    }
  });

  ipcMain.on(IpcChannels.WINDOW_MAXIMIZE, () => {
    if (!mainWindow.isMaximized()) {
      mainWindow.maximize();
    } else {
      mainWindow.unmaximize();
    }
  });

  ipcMain.on(IpcChannels.WINDOW_CLOSE, () => {
    mainWindow.close();
  });

  // Clean up handlers when window is closed
  mainWindow.on('closed', () => {
    ipcMain.removeAllListeners(IpcChannels.WINDOW_MINIMIZE);
    ipcMain.removeAllListeners(IpcChannels.WINDOW_MAXIMIZE);
    ipcMain.removeAllListeners(IpcChannels.WINDOW_CLOSE);
  });
}
