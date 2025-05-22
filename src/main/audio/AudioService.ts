import { IAudioService, IAudioRecorder, IAudioProcessor, AudioServiceOptions } from './types';
import { RecordingState, RecordingOptions, RecordingResult, AudioDevice, AudioLevelData, AudioFormat } from '@shared/types/audio';
import { EventEmitter, EventType } from '@shared/events';
import { ServiceContainer } from '@shared/services';
import { v4 as uuidv4 } from 'uuid';
import { AudioRecorder } from './AudioRecorder';
import { AudioProcessor } from './AudioProcessor';

export class AudioService implements IAudioService {
  private state: RecordingState = RecordingState.IDLE;
  private recorder: IAudioRecorder | null = null;
  private processor: IAudioProcessor | null = null;
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private pauseStartTime: number = 0;
  private audioChunks: Blob[] = [];
  private eventEmitter: EventEmitter;
  private currentDeviceId?: string;
  
  constructor(
    private options: AudioServiceOptions = {},
    serviceContainer: ServiceContainer
  ) {
    this.eventEmitter = serviceContainer.get('EventEmitter');
  }

  // State management
  getState(): RecordingState {
    return this.state;
  }

  private setState(newState: RecordingState): void {
    this.state = newState;
  }

  // Recording controls
  async startRecording(options?: RecordingOptions): Promise<void> {
    if (this.state !== RecordingState.IDLE) {
      throw new Error(`Cannot start recording in ${this.state} state`);
    }

    try {
      this.setState(RecordingState.PROCESSING);
      
      // Merge options with defaults
      const recordingOptions: RecordingOptions = {
        format: AudioFormat.WEBM_OPUS,
        sampleRate: 48000,
        channels: 1,
        autoGainControl: true,
        noiseSuppression: true,
        echoCancellation: true,
        ...this.options.defaultOptions,
        ...options
      };

      // Get media stream
      this.stream = await this.getMediaStream(recordingOptions);
      
      // Initialize audio processor for visualization
      if (this.processor) {
        this.processor.dispose();
      }
      this.processor = new AudioProcessor();
      await this.processor.initialize(this.stream);

      // Initialize recorder
      if (this.recorder) {
        this.recorder.dispose();
      }
      this.recorder = new AudioRecorder();
      this.recorder.onDataAvailable((chunk) => {
        this.audioChunks.push(chunk);
        // Note: We'll need to define proper event types for audio chunks
        // this.eventEmitter.emit('audio:chunk', { data: chunk, timestamp: Date.now() });
      });
      await this.recorder.start(recordingOptions);

      // Reset timing
      this.startTime = Date.now();
      this.pausedDuration = 0;
      this.audioChunks = [];

      this.setState(RecordingState.RECORDING);
      this.eventEmitter.emit({
        type: EventType.RECORDING_STARTED,
        timestamp: Date.now(),
        recordingId: uuidv4(),
        options: recordingOptions
      });

      // Start audio level monitoring
      this.startAudioLevelMonitoring();

    } catch (error) {
      this.setState(RecordingState.ERROR);
      this.eventEmitter.emit({
        type: EventType.RECORDING_ERROR,
        timestamp: Date.now(),
        recordingId: '',
        error: error as Error
      });
      throw error;
    }
  }

  async stopRecording(): Promise<RecordingResult> {
    if (this.state !== RecordingState.RECORDING && this.state !== RecordingState.PAUSED) {
      throw new Error(`Cannot stop recording in ${this.state} state`);
    }

    try {
      this.setState(RecordingState.PROCESSING);

      // Stop recorder
      const audioBlob = this.recorder ? await this.recorder.stop() : new Blob();
      
      // Get the output path from recorder if available
      const outputPath = (this.recorder as any).outputPath || null;

      // Calculate duration
      const duration = this.getDuration();

      // Generate result
      const result: RecordingResult = {
        id: uuidv4(),
        filename: outputPath ? outputPath.split('/').pop()! : `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`,
        duration,
        size: audioBlob.size,
        format: AudioFormat.WEBM_OPUS,
        createdAt: new Date(),
        audioBlob
      };

      // Cleanup
      this.cleanup();

      this.setState(RecordingState.IDLE);
      this.eventEmitter.emit({
        type: EventType.RECORDING_STOPPED,
        timestamp: Date.now(),
        recordingId: result.id,
        duration: result.duration
      });

      return result;

    } catch (error) {
      this.setState(RecordingState.ERROR);
      this.eventEmitter.emit({
        type: EventType.RECORDING_ERROR,
        timestamp: Date.now(),
        recordingId: '',
        error: error as Error
      });
      throw error;
    }
  }

  async pauseRecording(): Promise<void> {
    if (this.state !== RecordingState.RECORDING) {
      throw new Error(`Cannot pause recording in ${this.state} state`);
    }

    this.pauseStartTime = Date.now();
    this.recorder?.pause();
    this.setState(RecordingState.PAUSED);
    this.eventEmitter.emit({
      type: EventType.RECORDING_PAUSED,
      timestamp: this.pauseStartTime,
      recordingId: '' // TODO: Track recording ID
    });
  }

  async resumeRecording(): Promise<void> {
    if (this.state !== RecordingState.PAUSED) {
      throw new Error(`Cannot resume recording in ${this.state} state`);
    }

    this.pausedDuration += Date.now() - this.pauseStartTime;
    this.recorder?.resume();
    this.setState(RecordingState.RECORDING);
    this.eventEmitter.emit({
      type: EventType.RECORDING_RESUMED,
      timestamp: Date.now(),
      recordingId: '' // TODO: Track recording ID
    });
  }

  // Device management
  async getAudioDevices(): Promise<AudioDevice[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    
    return audioInputs.map(device => ({
      deviceId: device.deviceId,
      label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
      kind: 'audioinput' as const,
      isDefault: device.deviceId === 'default'
    }));
  }

  async setInputDevice(deviceId: string): Promise<void> {
    this.currentDeviceId = deviceId;
    
    // If recording, restart with new device
    if (this.state === RecordingState.RECORDING) {
      const currentOptions = this.recorder ? {} : {}; // TODO: Get current options from recorder
      await this.stopRecording();
      await this.startRecording({ ...currentOptions, deviceId });
    }
  }

  async getDefaultDevice(): Promise<AudioDevice | null> {
    const devices = await this.getAudioDevices();
    return devices.find(device => device.isDefault) || devices[0] || null;
  }

  getCurrentDeviceId(): string | undefined {
    return this.currentDeviceId;
  }

  // Monitoring
  getAudioLevel(): AudioLevelData {
    if (!this.processor) {
      return { level: 0, peak: 0, timestamp: Date.now() };
    }

    return {
      level: this.processor.getAudioLevel(),
      peak: this.processor.getPeakLevel(),
      timestamp: Date.now()
    };
  }

  isRecording(): boolean {
    return this.state === RecordingState.RECORDING;
  }

  getDuration(): number {
    if (this.state === RecordingState.IDLE) {
      return 0;
    }

    const now = Date.now();
    const totalTime = now - this.startTime;
    const recordingTime = totalTime - this.pausedDuration;

    if (this.state === RecordingState.PAUSED) {
      return recordingTime - (now - this.pauseStartTime);
    }

    return recordingTime;
  }

  // Cleanup
  dispose(): void {
    this.cleanup();
  }

  // Private methods
  private async getMediaStream(options: RecordingOptions): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: options.deviceId ? { exact: options.deviceId } : undefined,
        sampleRate: options.sampleRate,
        channelCount: options.channels,
        autoGainControl: options.autoGainControl,
        noiseSuppression: options.noiseSuppression,
        echoCancellation: options.echoCancellation
      },
      video: false
    };

    return await navigator.mediaDevices.getUserMedia(constraints);
  }

  private startAudioLevelMonitoring(): void {
    const monitorInterval = setInterval(() => {
      if (this.state !== RecordingState.RECORDING) {
        clearInterval(monitorInterval);
        return;
      }

      const levelData = this.getAudioLevel();
      // For audio level, we'll use a custom event structure
      this.eventEmitter.emit({
        type: 'audio:level',
        ...levelData
      });
    }, 50); // Update every 50ms
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.recorder) {
      this.recorder.dispose();
      this.recorder = null;
    }

    if (this.processor) {
      this.processor.dispose();
      this.processor = null;
    }

    this.audioChunks = [];
  }
}
