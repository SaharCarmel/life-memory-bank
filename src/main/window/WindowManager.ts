import { app, BrowserWindow } from 'electron';
import { IWindowManager, WindowOptions, WindowState, WindowId } from './types';
import path from 'path';

export class WindowManager implements IWindowManager {
  private windows: Map<WindowId, BrowserWindow>;
  private windowStates: Map<WindowId, WindowState>;

  constructor() {
    this.windows = new Map();
    this.windowStates = new Map();

    // Clean up windows on app quit
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Restore windows on app activate (macOS)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        // Create main window if no windows are open
        this.createWindow('main', {
          width: 1200,
          height: 800,
          persistState: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        });
      }
    });
  }

  createWindow(id: WindowId, options: WindowOptions): BrowserWindow {
    const existingWindow = this.windows.get(id);
    if (existingWindow) {
      if (!existingWindow.isDestroyed()) {
        existingWindow.focus();
        return existingWindow;
      }
      this.windows.delete(id);
    }

    const window = new BrowserWindow({
      ...options,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../../preload.js'),
        ...options.webPreferences,
      },
    });

    this.windows.set(id, window);

    // Restore window state if it exists and persistence is enabled
    if (options.persistState) {
      this.restoreWindowState(id, window);
    }

    // Save window state on close if persistence is enabled
    window.on('close', () => {
      if (options.persistState) {
        this.saveWindowState(id);
      }
    });

    // Clean up reference when window is closed
    window.on('closed', () => {
      this.windows.delete(id);
    });

    return window;
  }

  getWindow(id: WindowId): BrowserWindow | undefined {
    return this.windows.get(id);
  }

  closeWindow(id: WindowId): void {
    const window = this.windows.get(id);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  closeAllWindows(): void {
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
  }

  saveWindowState(id: WindowId): void {
    const window = this.windows.get(id);
    if (!window || window.isDestroyed()) return;

    const bounds = window.getBounds();
    const state: WindowState = {
      ...bounds,
      isMaximized: window.isMaximized(),
      isFullScreen: window.isFullScreen(),
    };

    this.windowStates.set(id, state);
  }

  restoreWindowState(id: WindowId, window: BrowserWindow): void {
    const state = this.windowStates.get(id);
    if (!state) return;

    if (state.isMaximized) {
      window.maximize();
    } else if (state.isFullScreen) {
      window.setFullScreen(true);
    } else {
      window.setBounds(state);
    }
  }
}

// Export a singleton instance
export const windowManager = new WindowManager();
