import { ipcMain, app, BrowserWindow } from 'electron';
import { IpcChannels, ErrorCode, createError } from '../../shared';
import { AudioService } from '../audio';
import { RecordingState } from '../../shared/types/audio';
import { ServiceContainer } from '../../shared/services';
import { StorageService, RecordingMetadata } from '../storage/StorageService';
import { setupConfigHandlers } from './configHandlers';
import { setupAIHandlers } from './aiHandlers';
import { initializeImportHandlers } from './importHandlers';

let audioService: AudioService;
let audioLevelInterval: NodeJS.Timeout | null = null;
let storageService: StorageService | null = null;
let currentRecordingId: string | null = null;

export function setupIpcHandlers(serviceContainer: ServiceContainer): void {
  // Initialize AudioService with the service container
  audioService = new AudioService({}, serviceContainer);
  
  // Storage handlers
  const persistentStorageService = new StorageService();
  
  // Set up config, AI, and import handlers (pass storage service to handlers)
  setupConfigHandlers();
  setupAIHandlers(persistentStorageService);
  initializeImportHandlers(persistentStorageService);
  
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
      if (audioService.getState() !== RecordingState.IDLE) {
        throw createError(
          ErrorCode.RECORDING_FAILED,
          'Recording is already in progress'
        );
      }
      
      await audioService.startRecording();
      
      // Initialize storage service and start recording
      storageService = new StorageService();
      currentRecordingId = storageService.startRecording();
      console.log(`Started recording with ID: ${currentRecordingId}`);
      
      // Start streaming audio levels to renderer
      if (audioLevelInterval) {
        clearInterval(audioLevelInterval);
      }
      
      audioLevelInterval = setInterval(() => {
        const levelData = audioService.getAudioLevel();
        BrowserWindow.getAllWindows().forEach((window: BrowserWindow) => {
          window.webContents.send(IpcChannels.AUDIO_LEVEL_UPDATE, levelData);
        });
      }, 50);
      
      // Send status update to renderer
      BrowserWindow.getAllWindows().forEach((window: BrowserWindow) => {
        window.webContents.send(IpcChannels.RECORDING_STATUS, 'Recording in progress...');
      });
      
      return { success: true, recordingId: currentRecordingId };
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
      const state = audioService.getState();
      if (state !== RecordingState.RECORDING && state !== RecordingState.PAUSED) {
        throw createError(
          ErrorCode.RECORDING_FAILED,
          'No recording in progress'
        );
      }
      
      const result = await audioService.stopRecording();
      
      // Finalize the recording in storage
      let metadata = null;
      if (storageService && currentRecordingId) {
        metadata = await storageService.finalizeRecording(currentRecordingId);
        console.log(`Recording saved to: ${metadata.filepath}`);
        storageService = null;
        currentRecordingId = null;
      }
      
      // Stop audio level streaming
      if (audioLevelInterval) {
        clearInterval(audioLevelInterval);
        audioLevelInterval = null;
      }
      
      // Send status update to renderer
      BrowserWindow.getAllWindows().forEach((window: BrowserWindow) => {
        window.webContents.send(IpcChannels.RECORDING_STATUS, 'Recording stopped');
      });
      
      return { 
        success: true,
        result: {
          filename: result.filename,
          duration: result.duration,
          size: result.size
        }
      };
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
      if (audioService.getState() !== RecordingState.RECORDING) {
        throw createError(
          ErrorCode.RECORDING_FAILED,
          'No recording in progress'
        );
      }
      
      await audioService.pauseRecording();
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
      if (audioService.getState() !== RecordingState.PAUSED) {
        throw createError(
          ErrorCode.RECORDING_FAILED,
          'Recording is not paused'
        );
      }
      
      await audioService.resumeRecording();
      return { success: true };
    } catch (error) {
      throw createError(
        ErrorCode.RECORDING_FAILED,
        'Failed to resume recording',
        error
      );
    }
  });
  
  // Handle audio data chunks
  ipcMain.on(IpcChannels.AUDIO_DATA_CHUNK, (_event, chunk: any) => {
    try {
      if (storageService && currentRecordingId && chunk && chunk.data) {
        const buffer = Buffer.from(chunk.data);
        storageService.writeChunk(currentRecordingId, buffer);
      }
    } catch (error) {
      console.error('Failed to process audio chunk:', error);
    }
  });
  
  ipcMain.handle('storage:list-recordings', async (): Promise<RecordingMetadata[]> => {
    try {
      const recordings = await persistentStorageService.listRecordings();
      console.log(`Listed ${recordings.length} recordings`);
      return recordings;
    } catch (error) {
      console.error('Failed to list recordings:', error);
      throw error;
    }
  });

  ipcMain.handle('storage:delete-recording', async (_, filepath: string): Promise<void> => {
    try {
      await persistentStorageService.deleteRecording(filepath);
      console.log(`Deleted recording: ${filepath}`);
    } catch (error) {
      console.error('Failed to delete recording:', error);
      throw error;
    }
  });

  ipcMain.handle('storage:get-recording-info', async (_, recordingId: string): Promise<RecordingMetadata | null> => {
    try {
      const metadata = await persistentStorageService.getRecordingInfo(recordingId);
      return metadata;
    } catch (error) {
      console.error('Failed to get recording info:', error);
      throw error;
    }
  });
  
  // Clean up on app quit
  app.on('before-quit', () => {
    if (audioLevelInterval) {
      clearInterval(audioLevelInterval);
    }
    audioService.dispose();
  });
}
