import { app } from 'electron';
import { windowManager } from './window/index';
import { setupWindowHandlers } from './window/handlers';
import { setupIpcHandlers } from './ipc/handlers';

// Handle squirrel events for Windows
if (process.platform === 'win32') {
  const squirrelStartup = require('electron-squirrel-startup');
  if (squirrelStartup) {
    app.quit();
  }
}

// Declare the webpack entry constant
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

app.on('ready', () => {
  // Set up IPC handlers
  setupIpcHandlers();
  
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
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
    }
  });

  // Set up window control handlers
  setupWindowHandlers(mainWindow);

  // Load the index.html of the app
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

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
        preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
      }
    });
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
    setupWindowHandlers(mainWindow);
  }
});
