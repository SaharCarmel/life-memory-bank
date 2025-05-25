import { EventEmitter } from '@shared/events';

export class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly threshold: number;
  private readonly resetTime: number;
  private eventEmitter: EventEmitter;

  constructor(
    threshold: number = 5,
    resetTime: number = 60000, // 1 minute
    eventEmitter: EventEmitter
  ) {
    this.threshold = threshold;
    this.resetTime = resetTime;
    this.eventEmitter = eventEmitter;
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    if (this.failureCount > 0) {
      console.log('Circuit breaker reset after successful operation');
      this.failureCount = 0;
      
      this.eventEmitter.emit({
        type: 'realtime-transcription:circuit-breaker-reset',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    const now = Date.now();
    this.failureCount++;
    this.lastFailureTime = now;
    
    if (this.failureCount >= this.threshold) {
      console.warn(`Circuit breaker opened after ${this.failureCount} failures`);
      
      this.eventEmitter.emit({
        type: 'realtime-transcription:circuit-breaker-opened',
        timestamp: now,
        failureCount: this.failureCount
      });
    }
  }

  /**
   * Check if circuit breaker is open
   */
  isOpen(): boolean {
    if (this.failureCount < this.threshold) {
      return false;
    }
    
    const now = Date.now();
    const timeSinceLastFailure = now - this.lastFailureTime;
    
    // Reset circuit breaker after timeout
    if (timeSinceLastFailure >= this.resetTime) {
      console.log(`Circuit breaker auto-reset after ${this.resetTime}ms`);
      this.failureCount = 0;
      
      this.eventEmitter.emit({
        type: 'realtime-transcription:circuit-breaker-reset',
        timestamp: now
      });
      
      return false;
    }
    
    return true;
  }

  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Get last failure time
   */
  getLastFailureTime(): number {
    return this.lastFailureTime;
  }

  /**
   * Reset the circuit breaker manually
   */
  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    
    this.eventEmitter.emit({
      type: 'realtime-transcription:circuit-breaker-reset',
      timestamp: Date.now()
    });
  }
}
