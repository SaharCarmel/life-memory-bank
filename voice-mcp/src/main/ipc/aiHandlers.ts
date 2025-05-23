import { ipcMain, BrowserWindow } from 'electron';
import { aiService } from '../ai/AIService';
import { StorageService } from '../storage/StorageService';

// We'll need to get the storage service instance
let storageServiceInstance: StorageService | null = null;

export function setupAIHandlers(storageService?: StorageService): void {
  // Store the storage service instance for use in event handlers
  if (storageService) {
    storageServiceInstance = storageService;
  }

  // Process transcript with AI
  ipcMain.handle('ai:processTranscript', async (_, recordingId: string, transcriptPath: string) => {
    try {
      const jobId = await aiService.processTranscript(recordingId, transcriptPath);
      return { success: true, jobId };
    } catch (error) {
      console.error('Failed to start AI processing:', error);
      throw error;
    }
  });

  // Get AI job status
  ipcMain.handle('ai:getJobStatus', async (_, jobId: string) => {
    try {
      const job = await aiService.getJobStatus(jobId);
      return job;
    } catch (error) {
      console.error('Failed to get AI job status:', error);
      throw error;
    }
  });

  // Cancel AI job
  ipcMain.handle('ai:cancelJob', async (_, jobId: string) => {
    try {
      await aiService.cancelJob(jobId);
      return { success: true };
    } catch (error) {
      console.error('Failed to cancel AI job:', error);
      throw error;
    }
  });

  // Get active AI jobs
  ipcMain.handle('ai:getActiveJobs', async () => {
    try {
      const jobs = await aiService.getActiveJobs();
      return jobs;
    } catch (error) {
      console.error('Failed to get active AI jobs:', error);
      throw error;
    }
  });

  // Set up event forwarding from AI service to renderer
  setupAIEventForwarding();
}

function setupAIEventForwarding(): void {
  // Override the AI service event emission methods to forward to renderer
  const originalEmitJobProgress = (aiService as any).emitJobProgress;
  const originalEmitJobCompleted = (aiService as any).emitJobCompleted;
  const originalEmitJobFailed = (aiService as any).emitJobFailed;

  (aiService as any).emitJobProgress = async (jobId: string, progress: number, message: string) => {
    // Call original method
    originalEmitJobProgress.call(aiService, jobId, progress, message);
    
    // Update storage with AI progress
    const job = await aiService.getJobStatus(jobId);
    if (job && storageServiceInstance) {
      await storageServiceInstance.updateAIStatus(job.recordingId, 'processing', progress, message);
    }
    
    // Forward to renderer
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('ai:progress', { jobId, progress, message });
    }
  };

  (aiService as any).emitJobCompleted = async (jobId: string, result: any) => {
    // Call original method
    originalEmitJobCompleted.call(aiService, jobId, result);
    
    // Update storage with AI results
    const job = await aiService.getJobStatus(jobId);
    if (job && result && storageServiceInstance) {
      try {
        await storageServiceInstance.saveAIContent(job.recordingId, result.title, result.summary);
        await storageServiceInstance.updateAIStatus(job.recordingId, 'completed', 100);
        console.log(`AI content saved for recording ${job.recordingId}: "${result.title}"`);
      } catch (error) {
        console.error(`Failed to save AI content for recording ${job.recordingId}:`, error);
        await storageServiceInstance.updateAIStatus(job.recordingId, 'failed', 100, 'Failed to save AI content');
      }
    }
    
    // Forward to renderer
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('ai:completed', { jobId, result });
    }
  };

  (aiService as any).emitJobFailed = async (jobId: string, error: string) => {
    // Call original method
    originalEmitJobFailed.call(aiService, jobId, error);
    
    // Update storage with AI failure
    const job = await aiService.getJobStatus(jobId);
    if (job && storageServiceInstance) {
      await storageServiceInstance.updateAIStatus(job.recordingId, 'failed', 0, error);
    }
    
    // Forward to renderer
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('ai:failed', { jobId, error });
    }
  };
}
