import { EventEmitter } from 'events';
import { AudioLevelData } from '@shared/types/audio';

export interface AudioLevelMonitorOptions {
  fftSize?: number;
  smoothingTimeConstant?: number;
  updateInterval?: number;
}

export class AudioLevelMonitor extends EventEmitter {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Float32Array | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private peakLevel: number = 0;
  private peakDecayRate: number = 0.95;
  private stream: MediaStream | null = null;

  constructor(private options: AudioLevelMonitorOptions = {}) {
    super();
    this.options = {
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      updateInterval: 50,
      ...options
    };
  }

  async start(stream: MediaStream): Promise<void> {
    if (this.audioContext) {
      throw new Error('Already monitoring');
    }

    try {
      this.stream = stream;
      
      // Create audio context
      this.audioContext = new AudioContext();
      
      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.options.fftSize!;
      this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant!;
      
      // Create source from stream
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      
      // Create data array for time domain data
      this.dataArray = new Float32Array(this.analyser.frequencyBinCount);
      
      // Start monitoring
      this.startMonitoring();
      
      this.emit('start');
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  stop(): void {
    this.cleanup();
    this.emit('stop');
  }

  getLevel(): AudioLevelData {
    if (!this.analyser || !this.dataArray) {
      return { level: 0, peak: 0, timestamp: Date.now() };
    }

    // Get time domain data
    this.analyser.getFloatTimeDomainData(this.dataArray);
    
    // Calculate RMS (Root Mean Square) for average level
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sum / this.dataArray.length);
    
    // Convert to a 0-1 range (assuming typical audio levels)
    const level = Math.min(1, rms * 4);
    
    // Update peak with decay
    if (level > this.peakLevel) {
      this.peakLevel = level;
    } else {
      this.peakLevel *= this.peakDecayRate;
    }
    
    return {
      level,
      peak: this.peakLevel,
      timestamp: Date.now()
    };
  }

  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) {
      return null;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  getWaveformData(): Uint8Array | null {
    if (!this.analyser) {
      return null;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  private startMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      const levelData = this.getLevel();
      this.emit('level', levelData);
    }, this.options.updateInterval!);
  }

  private cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.dataArray = null;
    this.stream = null;
    this.peakLevel = 0;
  }

  dispose(): void {
    this.cleanup();
    this.removeAllListeners();
  }
}
