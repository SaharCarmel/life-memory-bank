import { ipcMain, IpcMainEvent, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { IpcChannels } from '@shared/types';
import { StorageService } from '../storage/StorageService';
import * as fs from 'fs';
import * as path from 'path';

interface RecordingSession {
  id: string;
  recordingId: string;
  storageService: StorageService;
}

const recordingSessions = new Map<string, RecordingSession>();

// Extremely aggressive settings for maximum reliability
const RECORDING_COMPLETION_DELAY = 3000; // Increased to 3000ms 
const MAX_FILE_VERIFICATION_ATTEMPTS = 15; // Many more attempts
const FILE_VERIFICATION_INTERVAL = 200;

async function verifyFileExists(filepath: string, minSize = 1024): Promise<boolean> {
  console.log(`[AudioHandlers] 🔍 Verifying file exists: ${filepath}`);
  
  for (let attempt = 1; attempt <= MAX_FILE_VERIFICATION_ATTEMPTS; attempt++) {
    try {
      const stats = await fs.promises.stat(filepath);
      console.log(`[AudioHandlers] 📏 File verification attempt ${attempt}: size=${stats.size} bytes, exists=${stats.isFile()}`);
      
      if (stats.isFile() && stats.size >= minSize) {
        console.log(`[AudioHandlers] ✅ File verification successful after ${attempt} attempts`);
        return true;
      }
      
      console.log(`[AudioHandlers] ⏳ File too small (${stats.size} bytes), retrying...`);
    } catch (error) {
      console.log(`[AudioHandlers] ❌ File verification attempt ${attempt} failed:`, error instanceof Error ? error.message : String(error));
    }
    
    if (attempt < MAX_FILE_VERIFICATION_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, FILE_VERIFICATION_INTERVAL));
    }
  }
  
  console.log(`[AudioHandlers] 💥 File verification failed after ${MAX_FILE_VERIFICATION_ATTEMPTS} attempts`);
  return false;
}

async function sendMultipleNotifications(metadata: any): Promise<void> {
  console.log(`[AudioHandlers] 📢 Sending multiple notifications for recording: ${metadata.id}`);
  
  // Get all browser windows
  const windows = BrowserWindow.getAllWindows();
  console.log(`[AudioHandlers] 🖥️ Found ${windows.length} browser windows to notify`);
  
  if (windows.length === 0) {
    console.warn(`[AudioHandlers] ⚠️ No browser windows found to notify`);
    return;
  }
  
  // Send multiple events at different intervals to ensure at least one gets through
  const sendEvent = (delay: number, attempt: number) => {
    setTimeout(() => {
      console.log(`[AudioHandlers] 📡 Sending RECORDING_COMPLETED event (attempt ${attempt}) after ${delay}ms`);
      windows.forEach((window, index) => {
        try {
          window.webContents.send(IpcChannels.RECORDING_COMPLETED);
          console.log(`[AudioHandlers] ✅ Event attempt ${attempt} sent to window ${index}`);
        } catch (error) {
          console.error(`[AudioHandlers] ❌ Failed to send event attempt ${attempt} to window ${index}:`, error);
        }
      });
    }, delay);
  };

  // Send events at different times: immediately, 1s, 2s, 3s, 5s
  sendEvent(0, 1);
  sendEvent(1000, 2);
  sendEvent(2000, 3);
  sendEvent(3000, 4);
  sendEvent(5000, 5);
}

async function notifyRecordingCompleted(metadata: any): Promise<void> {
  console.log(`[AudioHandlers] 🚀 Starting EXTREME recording completion notification process`);
  console.log(`[AudioHandlers] 📁 File path: ${metadata.filepath}`);
  console.log(`[AudioHandlers] 🆔 Recording ID: ${metadata.id}`);
  
  // Initial delay to allow file system operations to complete
  console.log(`[AudioHandlers] ⏰ Waiting ${RECORDING_COMPLETION_DELAY}ms for file system operations...`);
  await new Promise(resolve => setTimeout(resolve, RECORDING_COMPLETION_DELAY));
  
  // Verify file exists and has reasonable size
  const fileExists = await verifyFileExists(metadata.filepath);
  if (!fileExists) {
    console.error(`[AudioHandlers] 💥 File verification failed, but proceeding with event emission anyway`);
  } else {
    console.log(`[AudioHandlers] ✅ File verification successful`);
  }
  
  // Send multiple notifications to ensure delivery
  await sendMultipleNotifications(metadata);
  
  console.log(`[AudioHandlers] 🏁 Recording completion notification process complete`);
  
  // Additional verification: check if storage service can list the recording
  try {
    console.log(`[AudioHandlers] 🔍 Performing storage verification...`);
    const storageService = new StorageService();
    const recordings = await storageService.listRecordings();
    const newRecording = recordings.find(r => r.id === metadata.id);
    console.log(`[AudioHandlers] 📊 Storage verification: new recording ${newRecording ? 'FOUND ✅' : 'NOT FOUND ❌'} in list`);
    if (newRecording) {
      console.log(`[AudioHandlers] 📝 Storage verification details:`, {
        id: newRecording.id,
        filepath: newRecording.filepath,
        duration: newRecording.duration,
        size: newRecording.size
      });
    } else {
      console.error(`[AudioHandlers] 💥 CRITICAL: Recording not found in storage list! This might be why UI isn't refreshing.`);
    }
  } catch (error) {
    console.error(`[AudioHandlers] ❌ Storage verification failed:`, error);
  }
}

export function setupAudioHandlers(): void {
  // Handle recording start
  ipcMain.handle(IpcChannels.RECORDING_START, async (_event: IpcMainInvokeEvent) => {
    try {
      console.log(`[AudioHandlers] 🎬 Recording start requested`);
      const sessionId = Date.now().toString();
      const storageService = new StorageService();
      const recordingId = storageService.startRecording();
      
      const session: RecordingSession = {
        id: sessionId,
        recordingId,
        storageService
      };
      
      recordingSessions.set(sessionId, session);
      
      console.log(`[AudioHandlers] 🎯 Recording session started: ${sessionId}, recording ID: ${recordingId}`);
      return { success: true, sessionId, recordingId };
    } catch (error) {
      console.error('[AudioHandlers] ❌ Failed to start recording:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handle recording stop
  ipcMain.handle(IpcChannels.RECORDING_STOP, async (_event: IpcMainInvokeEvent) => {
    try {
      console.log(`[AudioHandlers] 🛑 Recording stop requested`);
      
      // Find the most recent session (for now, we'll use the first one)
      const sessionId = Array.from(recordingSessions.keys())[0];
      if (!sessionId) {
        throw new Error('No active recording session');
      }
      
      const session = recordingSessions.get(sessionId);
      if (!session) {
        throw new Error('Recording session not found');
      }
      
      console.log(`[AudioHandlers] 🔄 Finalizing recording for session ${sessionId}, recording ID: ${session.recordingId}`);
      const metadata = await session.storageService.finalizeRecording(session.recordingId);
      recordingSessions.delete(sessionId);
      
      console.log(`[AudioHandlers] ✅ Recording finalized successfully:`, {
        id: metadata.id,
        filepath: metadata.filepath,
        duration: metadata.duration,
        size: metadata.size,
        startTime: metadata.startTime,
        endTime: metadata.endTime
      });
      
      // IMMEDIATELY notify about recording completion (don't wait)
      console.log(`[AudioHandlers] 🚨 IMMEDIATELY triggering notification process...`);
      notifyRecordingCompleted(metadata).catch(error => {
        console.error(`[AudioHandlers] ❌ Failed to notify recording completion:`, error);
      });
      
      return { success: true, metadata };
    } catch (error) {
      console.error('[AudioHandlers] ❌ Failed to stop recording:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handle audio data chunks
  ipcMain.on(IpcChannels.AUDIO_DATA_CHUNK, (_event: IpcMainEvent, chunk: any) => {
    try {
      // Find the active session
      const sessionId = Array.from(recordingSessions.keys())[0];
      if (!sessionId) {
        console.warn('[AudioHandlers] ⚠️ Received audio chunk but no active recording session');
        return;
      }
      
      const session = recordingSessions.get(sessionId);
      if (!session) {
        console.warn('[AudioHandlers] ⚠️ Recording session not found');
        return;
      }
      
      if (chunk && chunk.data) {
        const buffer = Buffer.from(chunk.data);
        session.storageService.writeChunk(session.recordingId, buffer);
      }
    } catch (error) {
      console.error('[AudioHandlers] ❌ Failed to process audio chunk:', error);
    }
  });

  console.log('[AudioHandlers] 🔧 Audio handlers set up with EXTREME debugging and multi-event emission');
}
