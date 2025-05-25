import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { RealTimeTranscriptionService } from '../realtime/RealTimeTranscriptionService';
import { ProcessingChunk } from '../../renderer/services/RecorderService';

let realtimeTranscriptionService: RealTimeTranscriptionService | null = null;

export function setupRealtimeTranscriptionHandlers(service: RealTimeTranscriptionService): void {
  realtimeTranscriptionService = service;

  // Start real-time transcription for a recording
  ipcMain.handle('realtime-transcription:start', async (_event: IpcMainInvokeEvent, recordingId: string) => {
    try {
      if (!realtimeTranscriptionService) {
        throw new Error('Real-time transcription service not available');
      }

      await realtimeTranscriptionService.startTranscription(recordingId);
      console.log(`Started real-time transcription for recording: ${recordingId}`);
      
      return { success: true };
    } catch (error) {
      console.error('Failed to start real-time transcription:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  // Stop real-time transcription for a recording
  ipcMain.handle('realtime-transcription:stop', async (_event: IpcMainInvokeEvent, recordingId: string) => {
    try {
      if (!realtimeTranscriptionService) {
        throw new Error('Real-time transcription service not available');
      }

      await realtimeTranscriptionService.stopTranscription(recordingId);
      console.log(`Stopped real-time transcription for recording: ${recordingId}`);
      
      return { success: true };
    } catch (error) {
      console.error('Failed to stop real-time transcription:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  // Process a chunk for real-time transcription
  ipcMain.handle('realtime-transcription:process-chunk', async (
    _event: IpcMainInvokeEvent, 
    recordingId: string, 
    chunk: ProcessingChunk
  ) => {
    try {
      if (!realtimeTranscriptionService) {
        throw new Error('Real-time transcription service not available');
      }

      console.log(`[RealtimeTranscriptionHandlers] Processing chunk ${chunk.id} for recording ${recordingId}, size: ${chunk.data.byteLength} bytes`);
      const jobId = await realtimeTranscriptionService.processChunk(recordingId, chunk);
      console.log(`[RealtimeTranscriptionHandlers] Queued chunk ${chunk.id} for transcription, job: ${jobId}`);
      
      return { success: true, jobId };
    } catch (error) {
      console.error('Failed to process chunk:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  // Get current transcript for a recording
  ipcMain.handle('realtime-transcription:get-transcript', async (
    _event: IpcMainInvokeEvent, 
    recordingId: string
  ) => {
    try {
      if (!realtimeTranscriptionService) {
        throw new Error('Real-time transcription service not available');
      }

      const segments = realtimeTranscriptionService.getTranscript(recordingId);
      return { success: true, segments };
    } catch (error) {
      console.error('Failed to get transcript:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  // Get merged text for a recording
  ipcMain.handle('realtime-transcription:get-text', async (
    _event: IpcMainInvokeEvent, 
    recordingId: string
  ) => {
    try {
      if (!realtimeTranscriptionService) {
        throw new Error('Real-time transcription service not available');
      }

      const text = realtimeTranscriptionService.getMergedText(recordingId);
      return { success: true, text };
    } catch (error) {
      console.error('Failed to get merged text:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  // Get job status
  ipcMain.handle('realtime-transcription:get-job', async (
    _event: IpcMainInvokeEvent, 
    jobId: string
  ) => {
    try {
      if (!realtimeTranscriptionService) {
        throw new Error('Real-time transcription service not available');
      }

      const job = realtimeTranscriptionService.getJob(jobId);
      return { success: true, job };
    } catch (error) {
      console.error('Failed to get job:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  // Cancel a job
  ipcMain.handle('realtime-transcription:cancel-job', async (
    _event: IpcMainInvokeEvent, 
    jobId: string
  ) => {
    try {
      if (!realtimeTranscriptionService) {
        throw new Error('Real-time transcription service not available');
      }

      const cancelled = await realtimeTranscriptionService.cancelJob(jobId);
      return { success: true, cancelled };
    } catch (error) {
      console.error('Failed to cancel job:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  // Update configuration
  ipcMain.handle('realtime-transcription:update-config', async (
    _event: IpcMainInvokeEvent, 
    config: any
  ) => {
    try {
      if (!realtimeTranscriptionService) {
        throw new Error('Real-time transcription service not available');
      }

      realtimeTranscriptionService.updateConfig(config);
      return { success: true };
    } catch (error) {
      console.error('Failed to update config:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  // Get service statistics
  ipcMain.handle('realtime-transcription:get-stats', async (_event: IpcMainInvokeEvent) => {
    try {
      if (!realtimeTranscriptionService) {
        throw new Error('Real-time transcription service not available');
      }

      const stats = realtimeTranscriptionService.getStats();
      return { success: true, stats };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  // Set up event forwarding from service to renderer
  setupEventForwarding();

  console.log('Real-time transcription handlers set up');
}

function setupEventForwarding(): void {
  if (!realtimeTranscriptionService) {
    return;
  }

  // Forward all real-time transcription events to renderer processes
  const eventEmitter = (realtimeTranscriptionService as any).eventEmitter;
  
  if (eventEmitter) {
    // Transcription started/stopped events
    eventEmitter.on('realtime-transcription:started', (event: any) => {
      broadcastToRenderers('realtime-transcription:started', event);
    });

    eventEmitter.on('realtime-transcription:stopped', (event: any) => {
      broadcastToRenderers('realtime-transcription:stopped', event);
    });

    // Job events
    eventEmitter.on('realtime-transcription:chunk-queued', (event: any) => {
      broadcastToRenderers('realtime-transcription:chunk-queued', event);
    });

    eventEmitter.on('realtime-transcription:job-started', (event: any) => {
      broadcastToRenderers('realtime-transcription:job-started', event);
    });

    eventEmitter.on('realtime-transcription:job-completed', (event: any) => {
      broadcastToRenderers('realtime-transcription:job-completed', event);
    });

    eventEmitter.on('realtime-transcription:job-failed', (event: any) => {
      broadcastToRenderers('realtime-transcription:job-failed', event);
    });

    eventEmitter.on('realtime-transcription:job-cancelled', (event: any) => {
      broadcastToRenderers('realtime-transcription:job-cancelled', event);
    });

    // Transcript events
    eventEmitter.on('realtime-transcription:segment-added', (event: any) => {
      broadcastToRenderers('realtime-transcription:segment-added', event);
    });

    eventEmitter.on('realtime-transcription:text-updated', (event: any) => {
      broadcastToRenderers('realtime-transcription:text-updated', event);
    });

    eventEmitter.on('realtime-transcription:finalized', (event: any) => {
      broadcastToRenderers('realtime-transcription:finalized', event);
    });

    console.log('Real-time transcription event forwarding set up');
  }
}

function broadcastToRenderers(channel: string, data: any): void {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(window => {
    try {
      window.webContents.send(channel, data);
    } catch (error) {
      console.warn(`Failed to send ${channel} to window:`, error);
    }
  });
}

export function disposeRealtimeTranscriptionHandlers(): void {
  // Remove all real-time transcription IPC handlers
  ipcMain.removeAllListeners('realtime-transcription:start');
  ipcMain.removeAllListeners('realtime-transcription:stop');
  ipcMain.removeAllListeners('realtime-transcription:process-chunk');
  ipcMain.removeAllListeners('realtime-transcription:get-transcript');
  ipcMain.removeAllListeners('realtime-transcription:get-text');
  ipcMain.removeAllListeners('realtime-transcription:get-job');
  ipcMain.removeAllListeners('realtime-transcription:cancel-job');
  ipcMain.removeAllListeners('realtime-transcription:update-config');
  ipcMain.removeAllListeners('realtime-transcription:get-stats');

  realtimeTranscriptionService = null;
  console.log('Real-time transcription handlers disposed');
}
