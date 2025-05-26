import { app, globalShortcut } from 'electron';
import { windowManager } from './window/index';
import { setupWindowHandlers } from './window/handlers';
import { setupIpcHandlers } from './ipc/handlers';
import { registerTranscriptionHandlers } from './ipc/transcriptionHandlers';
import { setupRealtimeTranscriptionHandlers } from './ipc/realtimeTranscriptionHandlers';
import { ServiceContainer } from '../shared/services';
import { EventEmitter } from '../shared/events';
import { PythonEnvironment } from './python/PythonEnvironment';
import { WhisperService } from './whisper/WhisperService';
import { StorageService } from './storage/StorageService';
import { configService } from './config/ConfigService';
import { aiService } from './ai/AIService';
import { RealTimeTranscriptionService } from './realtime/RealTimeTranscriptionService';

// Initialize service container
const serviceContainer = new ServiceContainer();
const eventEmitter = new EventEmitter();
serviceContainer.register('EventEmitter', () => eventEmitter, { singleton: true });

// Initialize transcription services
const pythonEnv = new PythonEnvironment();
const whisperService = new WhisperService(pythonEnv, eventEmitter, configService);
const storageService = new StorageService();
const realTimeTranscriptionService = new RealTimeTranscriptionService(pythonEnv, eventEmitter, storageService);

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

app.on('ready', async () => {
  // Initialize configuration service
  try {
    await configService.initialize();
    console.log('ConfigService initialized successfully');
  } catch (error) {
    console.error('Failed to initialize ConfigService:', error);
  }

  // Initialize AI service
  try {
    await aiService.initialize();
    console.log('AIService initialized successfully');
  } catch (error) {
    console.error('Failed to initialize AIService:', error);
  }

  // Set up IPC handlers
  setupIpcHandlers(serviceContainer);
  
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

  // Set up transcription handlers
  registerTranscriptionHandlers(whisperService, storageService, mainWindow, eventEmitter);
  
  // Set up real-time transcription handlers
  setupRealtimeTranscriptionHandlers(realTimeTranscriptionService);

  // Set up window control handlers
  setupWindowHandlers(mainWindow);

  // Load the index.html of the app
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Register keyboard shortcut for DevTools (works in production too)
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Add error logging for the renderer process
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`Renderer Console [${level}]: ${message}`);
    if (sourceId) {
      console.log(`  Source: ${sourceId}:${line}`);
    }
  });

  // Log when the renderer process crashes
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details);
  });

  // Initialize WhisperService in the background
  try {
    await whisperService.initialize();
    console.log('WhisperService initialized successfully');
  } catch (error) {
    console.error('Failed to initialize WhisperService:', error);
  }

  // Initialize RealTimeTranscriptionService in the background
  try {
    await realTimeTranscriptionService.initialize();
    console.log('RealTimeTranscriptionService initialized successfully');
  } catch (error) {
    console.error('Failed to initialize RealTimeTranscriptionService:', error);
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
    
    // Re-register transcription handlers for new window
    registerTranscriptionHandlers(whisperService, storageService, mainWindow, eventEmitter);
    setupRealtimeTranscriptionHandlers(realTimeTranscriptionService);
  }
});

// Clean up on app quit
app.on('before-quit', () => {
  whisperService.dispose();
  realTimeTranscriptionService.dispose();
});
