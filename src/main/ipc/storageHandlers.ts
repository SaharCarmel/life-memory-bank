import { ipcMain } from 'electron';
import { StorageService, RecordingMetadata } from '../storage/StorageService';

export function registerStorageHandlers(storageService: StorageService): void {
  // List all recordings
  ipcMain.handle('storage:list-recordings', async (): Promise<RecordingMetadata[]> => {
    try {
      const recordings = await storageService.listRecordings();
      console.log(`Listed ${recordings.length} recordings`);
      return recordings;
    } catch (error) {
      console.error('Failed to list recordings:', error);
      throw error;
    }
  });

  // Delete a recording
  ipcMain.handle('storage:delete-recording', async (_, filepath: string): Promise<void> => {
    try {
      await storageService.deleteRecording(filepath);
      console.log(`Deleted recording: ${filepath}`);
    } catch (error) {
      console.error('Failed to delete recording:', error);
      throw error;
    }
  });

  // Get recording info
  ipcMain.handle('storage:get-recording-info', async (_, recordingId: string): Promise<RecordingMetadata | undefined> => {
    try {
      const metadata = storageService.getRecordingMetadata(recordingId);
      return metadata;
    } catch (error) {
      console.error('Failed to get recording info:', error);
      throw error;
    }
  });
}
