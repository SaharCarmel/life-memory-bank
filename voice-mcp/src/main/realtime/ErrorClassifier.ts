import { ErrorType } from './types';

export class ErrorClassifier {
  /**
   * Classify error type for appropriate handling
   */
  static classifyError(error: string): ErrorType {
    const errorLower = error.toLowerCase();
    
    // Non-recoverable errors (permanent failures)
    if (errorLower.includes('invalid audio format') ||
        errorLower.includes('corrupted audio') ||
        errorLower.includes('unsupported format') ||
        errorLower.includes('no audio data') ||
        errorLower.includes('invalid chunk data')) {
      return 'non-recoverable';
    }
    
    // Configuration errors
    if (errorLower.includes('model not found') ||
        errorLower.includes('invalid model') ||
        errorLower.includes('configuration error') ||
        errorLower.includes('missing required parameter')) {
      return 'config';
    }
    
    // Resource errors (temporary issues)
    if (errorLower.includes('out of memory') ||
        errorLower.includes('disk space') ||
        errorLower.includes('insufficient resources') ||
        errorLower.includes('process failed to start') ||
        errorLower.includes('python environment') ||
        errorLower.includes('ffmpeg')) {
      return 'resource';
    }
    
    // Default to recoverable (network, temporary failures, etc.)
    return 'recoverable';
  }

  /**
   * Determine if a job should be retried based on error type and retry count
   */
  static shouldRetry(errorType: ErrorType, retryCount: number, maxRetries: number, isCircuitBreakerOpen: boolean): boolean {
    // Don't retry if circuit breaker is open
    if (isCircuitBreakerOpen) {
      return false;
    }
    
    // Don't retry non-recoverable errors
    if (errorType === 'non-recoverable') {
      return false;
    }
    
    // Don't retry if max retries exceeded
    if (retryCount >= maxRetries) {
      return false;
    }
    
    // Retry recoverable and resource errors
    return errorType === 'recoverable' || errorType === 'resource';
  }
}
