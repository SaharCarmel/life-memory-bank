import { BrowserWindow, Rectangle } from 'electron';

export interface WindowState extends Rectangle {
  isMaximized?: boolean;
  isFullScreen?: boolean;
}

export interface WindowOptions extends Electron.BrowserWindowConstructorOptions {
  persistState?: boolean;
}

export interface IWindowManager {
  createWindow(id: string, options: WindowOptions): BrowserWindow;
  getWindow(id: string): BrowserWindow | undefined;
  closeWindow(id: string): void;
  closeAllWindows(): void;
  saveWindowState(id: string): void;
  restoreWindowState(id: string, window: BrowserWindow): void;
}

export type WindowId = string;
