export type TranscriptionProvider = 'local' | 'openai';

export interface TranscriptionJob {
  id: string;
  recordingId: string;
  filepath: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  result?: TranscriptionResult;
  error?: string;
  provider?: TranscriptionProvider;
  estimatedCost?: number;
  actualCost?: number;
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
  timeoutMultiplier?: number;
  minTimeout?: number;
  maxTimeout?: number;
  enableRetry?: boolean;
  maxRetries?: number;
  retryWithFasterModel?: boolean;
}

export interface TranscriptionRequest {
  recordingId: string;
  filepath: string;
  outputPath?: string;
}
