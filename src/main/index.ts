import { app } from 'electron';
import { windowManager } from './window/index';
import { setupWindowHandlers } from './window/handlers';
import path from 'path';

// Handle squirrel events for Windows
if (process.platform === 'win32') {
  const squirrelStartup = require('electron-squirrel-startup');
  if (squirrelStartup) {
    app.quit();
  }
}

app.on('ready', () => {
  // Create main window
  const mainWindow = windowManager.createWindow('main', {
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: 'hidden',
    persistState: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js')
    }
  });

  // Set up window control handlers
  setupWindowHandlers(mainWindow);

  // Load the index.html of the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000/main_window');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/main_window/index.html'));
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS, re-create a window when dock icon is clicked
app.on('activate', () => {
  if (windowManager.getWindow('main') === undefined) {
    const mainWindow = windowManager.createWindow('main', {
      width: 1200,
      height: 800,
      frame: false,
      titleBarStyle: 'hidden',
      persistState: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js')
      }
    });
    if (process.env.NODE_ENV === 'development') {
      mainWindow.loadURL('http://localhost:3000/main_window');
    } else {
      mainWindow.loadFile(path.join(__dirname, '../renderer/main_window/index.html'));
    }
    setupWindowHandlers(mainWindow);
  }
});
