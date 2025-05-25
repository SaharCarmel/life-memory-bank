import { ipcMain, BrowserWindow } from 'electron';
import { WhisperService } from '../whisper/WhisperService';
import { StorageService } from '../storage/StorageService';
import { TranscriptionRequest, TranscriptionJob } from '../whisper/types';
import { EventEmitter } from '@shared/events';
import { 
  TranscriptionProgressEvent, 
  TranscriptionCompletedEvent, 
  TranscriptionFailedEvent,
  TranscriptionJobCreatedEvent,
  TranscriptionJobStartedEvent,
  TranscriptionJobCancelledEvent
} from '@shared/events/types';
import { aiService } from '../ai/AIService';
import { configService } from '../config/ConfigService';

export function registerTranscriptionHandlers(
  whisperService: WhisperService, 
  storageService: StorageService,
  mainWindow: BrowserWindow,
  eventEmitter: EventEmitter
): void {
  
  // Start transcription for a single recording
  ipcMain.handle('transcription:transcribe-recording', async (_, recordingId: string): Promise<string> => {
    try {
      // Get recording metadata
      const recordings = await storageService.listRecordings();
      const recording = recordings.find(r => r.id === recordingId);
      
      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      // Create transcription request
      const request: TranscriptionRequest = {
        recordingId,
        filepath: recording.filepath
      };

      // Start transcription
      const jobId = await whisperService.transcribe(request);
      
      console.log(`Started transcription job ${jobId} for recording ${recordingId}`);
      return jobId;
    } catch (error) {
      console.error('Failed to start transcription:', error);
      throw error;
    }
  });

  // Start batch transcription for multiple recordings
  ipcMain.handle('transcription:transcribe-multiple', async (_, recordingIds: string[]): Promise<string[]> => {
    try {
      const jobIds: string[] = [];
      
      for (const recordingId of recordingIds) {
        // Get recording metadata
        const recordings = await storageService.listRecordings();
        const recording = recordings.find(r => r.id === recordingId);
        
        if (!recording) {
          console.warn(`Recording not found, skipping: ${recordingId}`);
          continue;
        }

        // Create transcription request
        const request: TranscriptionRequest = {
          recordingId,
          filepath: recording.filepath
        };

        // Start transcription
        const jobId = await whisperService.transcribe(request);
        jobIds.push(jobId);
      }
      
      console.log(`Started ${jobIds.length} transcription jobs for batch processing`);
      return jobIds;
    } catch (error) {
      console.error('Failed to start batch transcription:', error);
      throw error;
    }
  });

  // Get transcription status for a job
  ipcMain.handle('transcription:get-status', async (_, jobId: string): Promise<TranscriptionJob | null> => {
    try {
      const job = whisperService.getJob(jobId);
      return job || null;
    } catch (error) {
      console.error('Failed to get transcription status:', error);
      throw error;
    }
  });

  // Get all jobs for a recording
  ipcMain.handle('transcription:get-jobs-for-recording', async (_, recordingId: string): Promise<TranscriptionJob[]> => {
    try {
      return whisperService.getJobsForRecording(recordingId);
    } catch (error) {
      console.error('Failed to get transcription jobs for recording:', error);
      throw error;
    }
  });

  // Cancel a transcription job
  ipcMain.handle('transcription:cancel', async (_, jobId: string): Promise<void> => {
    try {
      await whisperService.cancelJob(jobId);
      console.log(`Cancelled transcription job: ${jobId}`);
    } catch (error) {
      console.error('Failed to cancel transcription:', error);
      throw error;
    }
  });

  // Load an existing transcript
  ipcMain.handle('transcription:load-transcript', async (_, recordingId: string) => {
    try {
      const transcript = await storageService.loadTranscript(recordingId);
      return transcript;
    } catch (error) {
      console.error('Failed to load transcript:', error);
      throw error;
    }
  });

  // Set up event forwarding from EventEmitter to renderer
  eventEmitter.on('transcription:progress', (event) => {
    const progressEvent = event as TranscriptionProgressEvent;
    mainWindow.webContents.send('transcription:progress', {
      jobId: progressEvent.jobId,
      recordingId: progressEvent.recordingId,
      progress: progressEvent.progress,
      message: progressEvent.message
    });
  });

  eventEmitter.on('transcription:completed', async (event) => {
    try {
      const completedEvent = event as TranscriptionCompletedEvent;
      // Save transcript to storage
      const job = whisperService.getJob(completedEvent.jobId);
      if (job && completedEvent.result) {
        await storageService.saveTranscript(job.recordingId, completedEvent.result);
        await storageService.updateTranscriptStatus(job.recordingId, 'completed');

        // Auto-trigger AI processing if OpenAI is configured
        try {
          const hasOpenAIConfig = await configService.hasOpenAIConfig();
          if (hasOpenAIConfig) {
            console.log(`Starting AI processing for recording ${job.recordingId} after transcription completion`);
            
            // Update AI status to processing
            await storageService.updateAIStatus(job.recordingId, 'processing', undefined, 0);
            
            // Get recording to get transcript path for AI processing
            const recordings = await storageService.listRecordings();
            const recording = recordings.find(r => r.id === job.recordingId);
            
            if (recording) {
              const transcriptPath = storageService.getTranscriptPath(recording.filepath);
              
              // Start AI processing
              const aiJobId = await aiService.processTranscript(job.recordingId, transcriptPath);
              console.log(`Started AI job ${aiJobId} for recording ${job.recordingId}`);
              
              // Notify renderer about AI processing start
              mainWindow.webContents.send('ai:started', {
                recordingId: job.recordingId,
                aiJobId
              });
            } else {
              throw new Error(`Recording ${job.recordingId} not found for AI processing`);
            }
          } else {
            console.log(`Skipping AI processing for recording ${job.recordingId} - OpenAI not configured`);
          }
        } catch (aiError) {
          console.error(`Failed to start AI processing for recording ${job.recordingId}:`, aiError);
          await storageService.updateAIStatus(job.recordingId, 'failed', aiError instanceof Error ? aiError.message : 'Unknown AI error', 0);
        }
      }
      
      mainWindow.webContents.send('transcription:completed', {
        jobId: completedEvent.jobId,
        recordingId: completedEvent.recordingId,
        result: completedEvent.result
      });
    } catch (error) {
      console.error('Failed to save transcript:', error);
      const completedEvent = event as TranscriptionCompletedEvent;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      mainWindow.webContents.send('transcription:failed', {
        jobId: completedEvent.jobId,
        recordingId: completedEvent.recordingId,
        error: errorMessage
      });
    }
  });

  eventEmitter.on('transcription:failed', async (event) => {
    try {
      const failedEvent = event as TranscriptionFailedEvent;
      // Update transcript status
      const job = whisperService.getJob(failedEvent.jobId);
      if (job) {
        await storageService.updateTranscriptStatus(job.recordingId, 'failed', failedEvent.error, undefined);
      }
      
      mainWindow.webContents.send('transcription:failed', {
        jobId: failedEvent.jobId,
        recordingId: failedEvent.recordingId,
        error: failedEvent.error,
        details: failedEvent.details
      });
    } catch (updateError) {
      console.error('Failed to update transcript status:', updateError);
    }
  });

  eventEmitter.on('transcription:job-created', (event) => {
    const createdEvent = event as TranscriptionJobCreatedEvent;
    mainWindow.webContents.send('transcription:job-created', {
      jobId: createdEvent.jobId,
      recordingId: createdEvent.recordingId
    });
  });

  eventEmitter.on('transcription:job-started', (event) => {
    const startedEvent = event as TranscriptionJobStartedEvent;
    mainWindow.webContents.send('transcription:job-started', {
      jobId: startedEvent.jobId,
      recordingId: startedEvent.recordingId
    });
  });

  eventEmitter.on('transcription:job-cancelled', (event) => {
    const cancelledEvent = event as TranscriptionJobCancelledEvent;
    mainWindow.webContents.send('transcription:job-cancelled', {
      jobId: cancelledEvent.jobId,
      recordingId: cancelledEvent.recordingId
    });
  });

  console.log('Transcription IPC handlers registered');
}
