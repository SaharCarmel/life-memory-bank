export interface TranscriptionJob {
  id: string;
  recordingId: string;
  filepath: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  result?: TranscriptionResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  segments: TranscriptionSegment[];
  duration?: number;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface WhisperWorkerMessage {
  type: 'progress' | 'result' | 'error';
  progress?: number;
  message?: string;
  text?: string;
  language?: string;
  segments?: TranscriptionSegment[];
  error?: string;
  details?: string;
}

export interface WhisperServiceOptions {
  modelName?: string;
  maxConcurrentJobs?: number;
  timeout?: number;
}

export interface TranscriptionRequest {
  recordingId: string;
  filepath: string;
  outputPath?: string;
}
