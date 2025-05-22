import { ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { IpcChannels } from '@shared/types';
import { StorageService } from '../storage/StorageService';

interface RecordingSession {
  id: string;
  recordingId: string;
  storageService: StorageService;
}

const recordingSessions = new Map<string, RecordingSession>();

export function setupAudioHandlers(): void {
  // Handle recording start
  ipcMain.handle(IpcChannels.RECORDING_START, async (event: IpcMainInvokeEvent) => {
    try {
      const sessionId = Date.now().toString();
      const storageService = new StorageService();
      const recordingId = storageService.startRecording();
      
      const session: RecordingSession = {
        id: sessionId,
        recordingId,
        storageService
      };
      
      recordingSessions.set(sessionId, session);
      
      console.log(`Recording session started: ${sessionId}, recording ID: ${recordingId}`);
      return { success: true, sessionId };
    } catch (error) {
      console.error('Failed to start recording:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handle recording stop
  ipcMain.handle(IpcChannels.RECORDING_STOP, async (event: IpcMainInvokeEvent) => {
    try {
      // Find the most recent session (for now, we'll use the first one)
      const sessionId = Array.from(recordingSessions.keys())[0];
      if (!sessionId) {
        throw new Error('No active recording session');
      }
      
      const session = recordingSessions.get(sessionId);
      if (!session) {
        throw new Error('Recording session not found');
      }
      
      const metadata = await session.storageService.finalizeRecording(session.recordingId);
      recordingSessions.delete(sessionId);
      
      console.log(`Recording stopped and saved: ${metadata.filepath}`);
      return { success: true, metadata };
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handle audio data chunks
  ipcMain.on(IpcChannels.AUDIO_DATA_CHUNK, (event: IpcMainEvent, chunk: any) => {
    try {
      // Find the active session
      const sessionId = Array.from(recordingSessions.keys())[0];
      if (!sessionId) {
        console.warn('Received audio chunk but no active recording session');
        return;
      }
      
      const session = recordingSessions.get(sessionId);
      if (!session) {
        console.warn('Recording session not found');
        return;
      }
      
      if (chunk && chunk.data) {
        const buffer = Buffer.from(chunk.data);
        session.storageService.writeChunk(session.recordingId, buffer);
      }
    } catch (error) {
      console.error('Failed to process audio chunk:', error);
    }
  });

  console.log('Audio handlers set up');
}
