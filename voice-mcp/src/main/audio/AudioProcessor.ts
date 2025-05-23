import { IAudioProcessor } from './types';

export class AudioProcessor implements IAudioProcessor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Float32Array | null = null;
  private frequencyDataArray: Float32Array | null = null;
  private peakLevel: number = 0;
  private peakDecay: number = 0.95; // Peak level decay rate

  async initialize(stream: MediaStream): Promise<void> {
    try {
      // Create audio context
      this.audioContext = new AudioContext();
      
      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // Create source from stream
      this.source = this.audioContext.createMediaStreamSource(stream);
      
      // Connect source to analyser
      this.source.connect(this.analyser);
      
      // Initialize data arrays
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Float32Array(bufferLength);
      this.frequencyDataArray = new Float32Array(bufferLength);
      
    } catch (error) {
      this.dispose();
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize audio processor: ${message}`);
    }
  }

  getAudioLevel(): number {
    if (!this.analyser || !this.dataArray) {
      return 0;
    }

    // Get time domain data
    this.analyser.getFloatTimeDomainData(this.dataArray);
    
    // Calculate RMS (Root Mean Square) for a more accurate level
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sum / this.dataArray.length);
    
    // Convert to 0-1 range (assuming typical audio levels)
    // RMS of a sine wave at full scale is 0.707, but speech is typically lower
    const level = Math.min(1, rms * 3);
    
    // Update peak level
    if (level > this.peakLevel) {
      this.peakLevel = level;
    } else {
      this.peakLevel *= this.peakDecay;
    }
    
    return level;
  }

  getPeakLevel(): number {
    return this.peakLevel;
  }

  getFrequencyData(): Float32Array {
    if (!this.analyser || !this.frequencyDataArray) {
      return new Float32Array(0);
    }

    this.analyser.getFloatFrequencyData(this.frequencyDataArray);
    return this.frequencyDataArray;
  }

  getWaveformData(): Float32Array {
    if (!this.analyser || !this.dataArray) {
      return new Float32Array(0);
    }

    this.analyser.getFloatTimeDomainData(this.dataArray);
    return this.dataArray;
  }

  dispose(): void {
    // Disconnect nodes
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {
        // Ignore errors during cleanup
      });
      this.audioContext = null;
    }

    // Clear data arrays
    this.dataArray = null;
    this.frequencyDataArray = null;
    this.peakLevel = 0;
  }
}
