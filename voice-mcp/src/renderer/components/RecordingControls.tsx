import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './RecordingControls.module.css';
import { RecorderService, AudioLevelMonitor } from '../services';

interface RecordingControlsProps {
  onError?: (error: Error) => void;
  onRecordingComplete?: () => void;
  onRealtimeTranscriptUpdate?: (text: string) => void;
  onRecordingStart?: () => void;
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopping';

export const RecordingControls: React.FC<RecordingControlsProps> = ({ 
  onError, 
  onRecordingComplete,
  onRealtimeTranscriptUpdate,
  onRecordingStart
}) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  // const [realTimeEnabled, setRealTimeEnabled] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);
  
  // Service instances
  const recorderRef = useRef<RecorderService | null>(null);
  const audioMonitorRef = useRef<AudioLevelMonitor | null>(null);
  const transcriptListenerRef = useRef<(() => void) | null>(null);

  // Check real-time transcription config on mount
  useEffect(() => {
    const checkRealtimeConfig = async () => {
      try {
        // const config = await window.electron.config.getRealTimeTranscriptionConfig();
        // setRealTimeEnabled(config.enabled && config.autoStartForRecordings);
      } catch (error) {
        console.error('Failed to get real-time transcription config:', error);
      }
    };
    checkRealtimeConfig();
  }, []);

  // Handle recording button click
  const handleRecordClick = useCallback(async () => {
    try {
      if (recordingState === 'idle') {
        // Check real-time config right before starting
        let rtEnabled = false;
        try {
          const config = await window.electron.config.getRealTimeTranscriptionConfig();
          rtEnabled = config.enabled && config.autoStartForRecordings;
          console.log('Real-time transcription config:', config);
          console.log('Real-time enabled:', rtEnabled);
        } catch (error) {
          console.error('Failed to get real-time transcription config:', error);
        }
        
        // Create new recorder instance
        recorderRef.current = new RecorderService();
        audioMonitorRef.current = new AudioLevelMonitor();
        
        // Set up event listeners
        recorderRef.current.on('start', () => {
          console.log('Recording started');
        });
        
        recorderRef.current.on('data', async (chunk) => {
          // Send audio data to main process for storage
          await window.electron.recording.sendAudioData(chunk);
        });
        
        recorderRef.current.on('error', (error) => {
          console.error('Recording error:', error);
          setRecordingState('idle');
          onError?.(error);
        });
        
        // Start recording
        setRecordingState('recording');
        try {
          // Call the main process to start recording
          const result = await window.electron.recording.start();
          console.log('Main process recording start result:', result);
          console.log('Result type:', typeof result);
          console.log('Result keys:', result ? Object.keys(result) : 'null');
          console.log('Result JSON:', JSON.stringify(result, null, 2));
          
          // Extract recording ID from result
          const recordingId = (result as any)?.recordingId || (result as any)?.id;
          console.log('Extracted recording ID:', recordingId);
          console.log('rtEnabled value:', rtEnabled);
          
          if (recordingId) {
            setCurrentRecordingId(recordingId);
            
            // Start real-time transcription if enabled
            if (rtEnabled) {
              console.log('Real-time transcription is enabled, starting for recording:', recordingId);
              try {
                await window.electron.realtimeTranscription.start(recordingId);
                setIsTranscribing(true);
                
                // Set up transcript update listener
                transcriptListenerRef.current = window.electron.onRealtimeTextUpdated((data) => {
                  console.log('Received real-time transcript update:', data);
                  if (data.recordingId === recordingId) {
                    onRealtimeTranscriptUpdate?.(data.text);
                  }
                });
                
                console.log('Real-time transcription started for recording:', recordingId);
              } catch (error) {
                console.error('Failed to start real-time transcription:', error);
                // Continue recording even if real-time transcription fails
              }
            } else {
              console.log('Real-time transcription is disabled');
            }
          } else {
            console.log('No recording ID found in result, cannot start real-time transcription');
          }
          
          // Set up real-time chunk processing listener
          if (rtEnabled && recordingId) {
            console.log('[RecordingControls] Setting up processing-chunk listener for recording:', recordingId);
            recorderRef.current.on('processing-chunk', async (chunk) => {
              console.log('[RecordingControls] Processing chunk for real-time transcription:', chunk.id, 'size:', chunk.data.byteLength);
              try {
                const result = await window.electron.realtimeTranscription.processChunk(recordingId, chunk);
                console.log('[RecordingControls] Chunk processing result:', result);
              } catch (error) {
                console.error('[RecordingControls] Failed to process chunk:', error);
              }
            });
          }
          
          await recorderRef.current.start({ enableRealTimeTranscription: rtEnabled });
          
          // Notify parent that recording has started
          onRecordingStart?.();
          
          // Start audio level monitoring
          const devices = await recorderRef.current.getDevices();
          if (devices.length > 0) {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: devices[0].deviceId }
            });
            
            audioMonitorRef.current.on('level', (levelData) => {
              setAudioLevel(levelData.level);
            });
            
            await audioMonitorRef.current.start(stream);
          }
          
          // Start duration tracking
          setDuration(0);
        } catch (err) {
          setRecordingState('idle');
          throw err;
        }
      } else if (recordingState === 'recording') {
        // Pause recording
        setRecordingState('paused');
        try {
          recorderRef.current?.pause();
        } catch (err) {
          setRecordingState('recording');
          throw err;
        }
      } else if (recordingState === 'paused') {
        // Resume recording
        setRecordingState('recording');
        try {
          recorderRef.current?.resume();
        } catch (err) {
          setRecordingState('paused');
          throw err;
        }
      }
    } catch (error) {
      console.error('Recording control error:', error);
      onError?.(error as Error);
    }
  }, [recordingState, onError]);

  // Handle stop button click
  const handleStopClick = useCallback(async () => {
    try {
      setRecordingState('stopping');
      
      if (recorderRef.current) {
        const audioBlob = await recorderRef.current.stop();
        console.log('Recording stopped, blob size:', audioBlob.size);
        
        // Stop real-time transcription if it was running
        if (isTranscribing && currentRecordingId) {
          try {
            await window.electron.realtimeTranscription.stop(currentRecordingId);
            console.log('Real-time transcription stopped');
          } catch (error) {
            console.error('Failed to stop real-time transcription:', error);
          }
        }
        
        // Clean up transcript listener
        if (transcriptListenerRef.current) {
          transcriptListenerRef.current();
          transcriptListenerRef.current = null;
        }
        
        // Call the main process to stop recording
        const result = await window.electron.recording.stop();
        console.log('Main process recording stop result:', result);
        
        console.log('Recording completed');
        
        // Notify parent component that recording is complete
        // Add a delay to ensure file is written
        setTimeout(() => {
          console.log('[RecordingControls] Calling onRecordingComplete callback');
          onRecordingComplete?.();
        }, 1000);
      }
      
      if (audioMonitorRef.current) {
        audioMonitorRef.current.stop();
      }
      
      // Clean up
      recorderRef.current = null;
      audioMonitorRef.current = null;
      
      setRecordingState('idle');
      setDuration(0);
      setAudioLevel(0);
      setIsTranscribing(false);
      setCurrentRecordingId(null);
    } catch (error) {
      console.error('Stop recording error:', error);
      setRecordingState('idle');
      onError?.(error as Error);
    }
  }, [onError, onRecordingComplete, isTranscribing, currentRecordingId]);

  // Update duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (recordingState === 'recording' || recordingState === 'paused') {
      interval = setInterval(() => {
        if (recorderRef.current) {
          const durationMs = recorderRef.current.getDuration();
          setDuration(Math.floor(durationMs / 1000));
        }
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.dispose();
      }
      if (audioMonitorRef.current) {
        audioMonitorRef.current.dispose();
      }
    };
  }, []);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        {/* Record/Pause Button */}
        <button
          className={`${styles.recordButton} ${styles[recordingState]}`}
          onClick={handleRecordClick}
          disabled={recordingState === 'stopping'}
          aria-label={recordingState === 'idle' ? 'Start recording' : recordingState === 'recording' ? 'Pause recording' : 'Resume recording'}
        >
          <div className={styles.recordIcon}>
            {recordingState === 'idle' && (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="8" />
              </svg>
            )}
            {recordingState === 'recording' && (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="7" y="7" width="4" height="10" rx="1" />
                <rect x="13" y="7" width="4" height="10" rx="1" />
              </svg>
            )}
            {recordingState === 'paused' && (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </button>

        {/* Stop Button */}
        {recordingState !== 'idle' && (
          <button
            className={styles.stopButton}
            onClick={handleStopClick}
            disabled={recordingState === 'stopping'}
            aria-label="Stop recording"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        )}
      </div>

      {/* Duration Display */}
      {recordingState !== 'idle' && (
        <div className={styles.duration}>
          <span className={styles.durationLabel}>Recording</span>
          <span className={styles.durationTime}>{formatDuration(duration)}</span>
        </div>
      )}

      {/* Audio Level Meter */}
      <div className={styles.audioMeter}>
        <div className={styles.audioMeterLabel}>Audio Level</div>
        <div className={styles.audioMeterBar}>
          <div 
            className={styles.audioMeterFill}
            style={{ width: `${audioLevel * 100}%` }}
          />
        </div>
      </div>

      {/* Status Indicator */}
      <div className={styles.status}>
        <div className={`${styles.statusDot} ${styles[recordingState]}`} />
        <span className={styles.statusText}>
          {recordingState === 'idle' && 'Ready to record'}
          {recordingState === 'recording' && 'Recording...'}
          {recordingState === 'paused' && 'Paused'}
          {recordingState === 'stopping' && 'Stopping...'}
        </span>
      </div>
    </div>
  );
};
