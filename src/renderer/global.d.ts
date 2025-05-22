/// <reference path="./preload.d.ts" />

declare global {
  interface Window {
    electron: import('./preload').ElectronAPI;
  }
}

export {};
