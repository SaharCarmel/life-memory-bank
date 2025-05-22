import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './RecordingControls.module.css';
import { RecorderService, AudioLevelMonitor } from '../services';

interface RecordingControlsProps {
  onError?: (error: Error) => void;
  onRecordingComplete?: () => void;
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopping';

export const RecordingControls: React.FC<RecordingControlsProps> = ({ onError, onRecordingComplete }) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Service instances
  const recorderRef = useRef<RecorderService | null>(null);
  const audioMonitorRef = useRef<AudioLevelMonitor | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle recording button click
  const handleRecordClick = useCallback(async () => {
    try {
      if (recordingState === 'idle') {
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
          
          await recorderRef.current.start();
          
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
    } catch (error) {
      console.error('Stop recording error:', error);
      setRecordingState('idle');
      onError?.(error as Error);
    }
  }, [onError, onRecordingComplete]);

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
