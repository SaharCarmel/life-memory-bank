/**
 * Base interface for all application events
 */
export interface BaseEvent {
  type: string;
  timestamp: number;
}

/**
 * Event types enum for type-safe event handling
 */
export enum EventType {
  // Window events
  WINDOW_CREATED = 'window:created',
  WINDOW_CLOSED = 'window:closed',
  WINDOW_FOCUSED = 'window:focused',
  WINDOW_BLURRED = 'window:blurred',
  WINDOW_MAXIMIZED = 'window:maximized',
  WINDOW_UNMAXIMIZED = 'window:unmaximized',

  // Recording events
  RECORDING_STARTED = 'recording:started',
  RECORDING_STOPPED = 'recording:stopped',
  RECORDING_PAUSED = 'recording:paused',
  RECORDING_RESUMED = 'recording:resumed',
  RECORDING_ERROR = 'recording:error',

  // Transcription events
  TRANSCRIPTION_STARTED = 'transcription:started',
  TRANSCRIPTION_COMPLETED = 'transcription:completed',
  TRANSCRIPTION_ERROR = 'transcription:error',
  TRANSCRIPTION_PROGRESS = 'transcription:progress',
  TRANSCRIPTION_FAILED = 'transcription:failed',
  TRANSCRIPTION_JOB_CREATED = 'transcription:job-created',
  TRANSCRIPTION_JOB_STARTED = 'transcription:job-started',
  TRANSCRIPTION_JOB_CANCELLED = 'transcription:job-cancelled',

  // Application events
  APP_READY = 'app:ready',
  APP_ERROR = 'app:error',
  APP_QUIT = 'app:quit'
}

/**
 * Event handler type definition
 */
export type EventHandler<T extends BaseEvent> = (event: T) => void | Promise<void>;

/**
 * Event emitter interface
 */
export interface IEventEmitter {
  emit<T extends BaseEvent>(event: T): void;
  on<T extends BaseEvent>(type: string, handler: EventHandler<T>): () => void;
  off<T extends BaseEvent>(type: string, handler: EventHandler<T>): void;
  once<T extends BaseEvent>(type: string, handler: EventHandler<T>): void;
}

/**
 * Window event interfaces
 */
export interface WindowEvent extends BaseEvent {
  windowId: string;
}

export interface WindowCreatedEvent extends WindowEvent {
  type: EventType.WINDOW_CREATED;
}

export interface WindowClosedEvent extends WindowEvent {
  type: EventType.WINDOW_CLOSED;
}

/**
 * Recording event interfaces
 */
export interface RecordingEvent extends BaseEvent {
  recordingId: string;
}

export interface RecordingStartedEvent extends RecordingEvent {
  type: EventType.RECORDING_STARTED;
}

export interface RecordingStoppedEvent extends RecordingEvent {
  type: EventType.RECORDING_STOPPED;
  duration: number;
}

export interface RecordingErrorEvent extends RecordingEvent {
  type: EventType.RECORDING_ERROR;
  error: Error;
}

/**
 * Transcription event interfaces
 */
export interface TranscriptionEvent extends BaseEvent {
  jobId: string;
  recordingId: string;
}

export interface TranscriptionProgressEvent extends TranscriptionEvent {
  type: EventType.TRANSCRIPTION_PROGRESS;
  progress: number;
  message?: string;
}

export interface TranscriptionCompletedEvent extends TranscriptionEvent {
  type: EventType.TRANSCRIPTION_COMPLETED;
  result: {
    text: string;
    language: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };
}

export interface TranscriptionFailedEvent extends TranscriptionEvent {
  type: EventType.TRANSCRIPTION_FAILED;
  error: string;
  details?: string;
}

export interface TranscriptionJobCreatedEvent extends TranscriptionEvent {
  type: EventType.TRANSCRIPTION_JOB_CREATED;
}

export interface TranscriptionJobStartedEvent extends TranscriptionEvent {
  type: EventType.TRANSCRIPTION_JOB_STARTED;
}

export interface TranscriptionJobCancelledEvent extends TranscriptionEvent {
  type: EventType.TRANSCRIPTION_JOB_CANCELLED;
}

/**
 * Application event interfaces
 */
export interface AppEvent extends BaseEvent {
  version: string;
}

export interface AppErrorEvent extends AppEvent {
  type: EventType.APP_ERROR;
  error: Error;
  context?: string;
}
