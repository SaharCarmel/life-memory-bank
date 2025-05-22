import { BrowserWindowConstructorOptions } from 'electron';

export type WindowId = string;

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
}

export interface WindowOptions extends BrowserWindowConstructorOptions {
  persistState?: boolean;
  frame?: boolean;
  titleBarStyle?: 'default' | 'hidden' | 'hiddenInset' | 'customButtonsOnHover';
}

export interface IWindowManager {
  createWindow(id: WindowId, options: WindowOptions): Electron.BrowserWindow;
  getWindow(id: WindowId): Electron.BrowserWindow | undefined;
  closeWindow(id: WindowId): void;
  closeAllWindows(): void;
  saveWindowState(id: WindowId): void;
  restoreWindowState(id: WindowId, window: Electron.BrowserWindow): void;
}
