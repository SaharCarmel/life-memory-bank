import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from './shared/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    recording: {
      start: () => ipcRenderer.invoke(IpcChannels.RECORDING_START) as Promise<{ success: boolean; recordingId?: string; sessionId?: string; error?: string }>,
      stop: () => ipcRenderer.invoke(IpcChannels.RECORDING_STOP) as Promise<{ success: boolean; metadata?: any; error?: string }>,
      pause: () => ipcRenderer.invoke(IpcChannels.RECORDING_PAUSE) as Promise<{ success: boolean; error?: string }>,
      resume: () => ipcRenderer.invoke(IpcChannels.RECORDING_RESUME) as Promise<{ success: boolean; error?: string }>,
      sendAudioData: (chunk: any) => ipcRenderer.send(IpcChannels.AUDIO_DATA_CHUNK, chunk),
    },
    app: {
      getVersion: () => ipcRenderer.invoke(IpcChannels.GET_APP_VERSION),
      quit: () => ipcRenderer.invoke(IpcChannels.QUIT_APP),
    },
    window: {
      minimize: () => ipcRenderer.send(IpcChannels.WINDOW_MINIMIZE),
      maximize: () => ipcRenderer.send(IpcChannels.WINDOW_MAXIMIZE),
      close: () => ipcRenderer.send(IpcChannels.WINDOW_CLOSE),
    },
    storage: {
      listRecordings: () => ipcRenderer.invoke('storage:list-recordings'),
      deleteRecording: (filepath: string) => ipcRenderer.invoke('storage:delete-recording', filepath),
      getRecordingInfo: (recordingId: string) => ipcRenderer.invoke('storage:get-recording-info', recordingId),
    },
    transcription: {
      transcribeRecording: (recordingId: string) => ipcRenderer.invoke('transcription:transcribe-recording', recordingId),
      transcribeMultiple: (recordingIds: string[]) => ipcRenderer.invoke('transcription:transcribe-multiple', recordingIds),
      getStatus: (jobId: string) => ipcRenderer.invoke('transcription:get-status', jobId),
      cancel: (jobId: string) => ipcRenderer.invoke('transcription:cancel', jobId),
      loadTranscript: (recordingId: string) => ipcRenderer.invoke('transcription:load-transcript', recordingId),
    },
    realtimeTranscription: {
      start: (recordingId: string) => ipcRenderer.invoke('realtime-transcription:start', recordingId),
      stop: (recordingId: string) => ipcRenderer.invoke('realtime-transcription:stop', recordingId),
      processChunk: (recordingId: string, chunk: any) => ipcRenderer.invoke('realtime-transcription:process-chunk', recordingId, chunk),
      getTranscript: (recordingId: string) => ipcRenderer.invoke('realtime-transcription:get-transcript', recordingId),
      getText: (recordingId: string) => ipcRenderer.invoke('realtime-transcription:get-text', recordingId),
      getJob: (jobId: string) => ipcRenderer.invoke('realtime-transcription:get-job', jobId),
      cancelJob: (jobId: string) => ipcRenderer.invoke('realtime-transcription:cancel-job', jobId),
      updateConfig: (config: any) => ipcRenderer.invoke('realtime-transcription:update-config', config),
      getStats: () => ipcRenderer.invoke('realtime-transcription:get-stats'),
    },
    config: {
      getOpenAIConfig: () => ipcRenderer.invoke('config:getOpenAI'),
      setOpenAIConfig: (config: { apiKey?: string; model: string; temperature: number }) => ipcRenderer.invoke('config:setOpenAI', config),
      hasOpenAIConfig: () => ipcRenderer.invoke('config:hasOpenAI'),
      testOpenAIConfig: (apiKey: string) => ipcRenderer.invoke('config:testOpenAI', apiKey),
      clearConfig: () => ipcRenderer.invoke('config:clear'),
      getRealTimeTranscriptionConfig: () => ipcRenderer.invoke('config:getRealTimeTranscription'),
      setRealTimeTranscriptionConfig: (config: any) => ipcRenderer.invoke('config:setRealTimeTranscription', config),
      updateRealTimeTranscriptionConfig: (updates: any) => ipcRenderer.invoke('config:updateRealTimeTranscription', updates),
      isRealTimeTranscriptionEnabled: () => ipcRenderer.invoke('config:isRealTimeTranscriptionEnabled'),
      getDefaultRealTimeTranscriptionConfig: () => ipcRenderer.invoke('config:getDefaultRealTimeTranscription'),
    },
    onRecordingStatus: (callback: (status: string) => void) => {
      ipcRenderer.on(IpcChannels.RECORDING_STATUS, (_, status) => callback(status));
      return () => {
        ipcRenderer.removeAllListeners(IpcChannels.RECORDING_STATUS);
      };
    },
    onAudioLevelUpdate: (callback: (data: { level: number; peak: number; timestamp: number }) => void) => {
      ipcRenderer.on(IpcChannels.AUDIO_LEVEL_UPDATE, (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners(IpcChannels.AUDIO_LEVEL_UPDATE);
      };
    },
    onRecordingCompleted: (callback: () => void) => {
      console.log('[Preload] Setting up RECORDING_COMPLETED listener');
      ipcRenderer.on(IpcChannels.RECORDING_COMPLETED, () => {
        console.log('[Preload] RECORDING_COMPLETED event received from main process');
        callback();
      });
      return () => {
        console.log('[Preload] Removing RECORDING_COMPLETED listener');
        ipcRenderer.removeAllListeners(IpcChannels.RECORDING_COMPLETED);
      };
    },
    onTranscriptionProgress: (callback: (data: { jobId: string; recordingId: string; progress: number; message: string }) => void) => {
      ipcRenderer.on('transcription:progress', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('transcription:progress');
      };
    },
    onTranscriptionCompleted: (callback: (data: { jobId: string; recordingId: string; result: any }) => void) => {
      ipcRenderer.on('transcription:completed', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('transcription:completed');
      };
    },
    onTranscriptionFailed: (callback: (data: { jobId: string; recordingId: string; error: string }) => void) => {
      ipcRenderer.on('transcription:failed', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('transcription:failed');
      };
    },
    // Real-time transcription event listeners
    onRealtimeTranscriptionStarted: (callback: (data: { recordingId: string; timestamp: number }) => void) => {
      ipcRenderer.on('realtime-transcription:started', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('realtime-transcription:started');
      };
    },
    onRealtimeTranscriptionStopped: (callback: (data: { recordingId: string; timestamp: number }) => void) => {
      ipcRenderer.on('realtime-transcription:stopped', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('realtime-transcription:stopped');
      };
    },
    onRealtimeChunkQueued: (callback: (data: { recordingId: string; chunkId: string; jobId: string; timestamp: number }) => void) => {
      ipcRenderer.on('realtime-transcription:chunk-queued', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('realtime-transcription:chunk-queued');
      };
    },
    onRealtimeJobStarted: (callback: (data: { recordingId: string; chunkId: string; jobId: string; timestamp: number }) => void) => {
      ipcRenderer.on('realtime-transcription:job-started', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('realtime-transcription:job-started');
      };
    },
    onRealtimeJobCompleted: (callback: (data: { recordingId: string; chunkId: string; jobId: string; segment: any; timestamp: number }) => void) => {
      ipcRenderer.on('realtime-transcription:job-completed', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('realtime-transcription:job-completed');
      };
    },
    onRealtimeJobFailed: (callback: (data: { recordingId: string; chunkId: string; jobId: string; error: string; timestamp: number }) => void) => {
      ipcRenderer.on('realtime-transcription:job-failed', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('realtime-transcription:job-failed');
      };
    },
    onRealtimeJobCancelled: (callback: (data: { recordingId: string; chunkId: string; jobId: string; timestamp: number }) => void) => {
      ipcRenderer.on('realtime-transcription:job-cancelled', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('realtime-transcription:job-cancelled');
      };
    },
    onRealtimeSegmentAdded: (callback: (data: { recordingId: string; segment: any; timestamp: number }) => void) => {
      ipcRenderer.on('realtime-transcription:segment-added', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('realtime-transcription:segment-added');
      };
    },
    onRealtimeTextUpdated: (callback: (data: { recordingId: string; text: string; timestamp: number }) => void) => {
      ipcRenderer.on('realtime-transcription:text-updated', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('realtime-transcription:text-updated');
      };
    },
    onRealtimeTranscriptionFinalized: (callback: (data: { recordingId: string; segments: any[]; text: string; timestamp: number }) => void) => {
      ipcRenderer.on('realtime-transcription:finalized', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('realtime-transcription:finalized');
      };
    },
    ai: {
      processTranscript: (recordingId: string, transcriptPath: string) => ipcRenderer.invoke('ai:processTranscript', recordingId, transcriptPath),
      getJobStatus: (jobId: string) => ipcRenderer.invoke('ai:getJobStatus', jobId),
      cancelJob: (jobId: string) => ipcRenderer.invoke('ai:cancelJob', jobId),
      getActiveJobs: () => ipcRenderer.invoke('ai:getActiveJobs'),
    },
    onAIProgress: (callback: (data: { jobId: string; progress: number; message: string }) => void) => {
      ipcRenderer.on('ai:progress', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('ai:progress');
      };
    },
    onAICompleted: (callback: (data: { jobId: string; result: any }) => void) => {
      ipcRenderer.on('ai:completed', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('ai:completed');
      };
    },
    onAIFailed: (callback: (data: { jobId: string; error: string }) => void) => {
      ipcRenderer.on('ai:failed', (_, data) => callback(data));
      return () => {
        ipcRenderer.removeAllListeners('ai:failed');
      };
    },
  }
);
