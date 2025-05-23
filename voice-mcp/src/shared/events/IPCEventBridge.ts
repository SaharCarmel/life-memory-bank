import { ipcMain, ipcRenderer, BrowserWindow } from 'electron';
import { BaseEvent, IEventEmitter } from './types';

/**
 * Bridge for IPC events between main and renderer processes
 */
export class IPCEventBridge {
  private eventEmitter: IEventEmitter;
  private isRenderer: boolean;

  constructor(eventEmitter: IEventEmitter) {
    this.eventEmitter = eventEmitter;
    this.isRenderer = process.type === 'renderer';
    this.setupEventBridge();
  }

  private setupEventBridge() {
    if (this.isRenderer) {
      // Renderer process: Listen for events from main and forward to event emitter
      ipcRenderer.on('ipc-event', (_, event: BaseEvent) => {
        this.eventEmitter.emit(event);
      });
    } else {
      // Main process: Listen for events from renderer and forward to event emitter
      ipcMain.on('ipc-event', (_, event: BaseEvent) => {
        this.eventEmitter.emit(event);
      });
    }

    // Forward local events to other process
    this.eventEmitter.on<BaseEvent>('*', (event) => {
      if (this.isRenderer) {
        ipcRenderer.send('ipc-event', event);
      } else {
        // Send to all renderer windows
        const windows = BrowserWindow.getAllWindows();
        windows.forEach((window: BrowserWindow) => {
          window.webContents.send('ipc-event', event);
        });
      }
    });
  }
}
