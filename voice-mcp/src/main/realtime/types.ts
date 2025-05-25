import { ProcessingChunk } from '../../renderer/services/RecorderService';
import { TranscriptSegment } from '../storage/StorageService';

export interface RealTimeJob {
  id: string;
  recordingId: string;
  chunkId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'retrying';
  priority: number;
  chunk: ProcessingChunk;
  tempFilePath?: string;
  result?: TranscriptSegment;
  error?: string;
  retryCount: number;
  maxRetries: number;
  lastRetryAt?: Date;
  errorType?: 'recoverable' | 'non-recoverable' | 'resource' | 'config';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TranscriptBuilder {
  recordingId: string;
  segments: Map<string, TranscriptSegment>;
  mergedText: string;
  lastUpdateTime: number;
}

export interface MemoryUsageStats {
  peakJobs: number;
  peakSegments: number;
  peakTempFiles: number;
  totalCleanups: number;
  lastCleanupDuration: number;
  bytesFreed: number;
  tempFilesDeleted: number;
}

export type ErrorType = 'recoverable' | 'non-recoverable' | 'resource' | 'config';

export interface TranscriptionResult {
  text: string;
  language?: string;
  confidence?: number;
}
