import React, { useState, useEffect, useCallback } from 'react';
import styles from './RecordingControls.module.css';

interface RecordingControlsProps {
  onError?: (error: Error) => void;
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopping';

export const RecordingControls: React.FC<RecordingControlsProps> = ({ onError }) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioLevel] = useState(0);

  // Handle recording button click
  const handleRecordClick = useCallback(async () => {
    try {
      if (recordingState === 'idle') {
        // Start recording
        setRecordingState('recording');
        try {
          const result = await window.electron.recording.start() as unknown as { success: boolean };
          if (!result.success) {
            setRecordingState('idle');
          }
        } catch (err) {
          setRecordingState('idle');
          throw err;
        }
      } else if (recordingState === 'recording') {
        // Pause recording
        setRecordingState('paused');
        try {
          const result = await window.electron.recording.pause() as unknown as { success: boolean };
          if (!result.success) {
            setRecordingState('recording');
          }
        } catch (err) {
          setRecordingState('recording');
          throw err;
        }
      } else if (recordingState === 'paused') {
        // Resume recording
        setRecordingState('recording');
        try {
          const result = await window.electron.recording.resume() as unknown as { success: boolean };
          if (!result.success) {
            setRecordingState('paused');
          }
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
      const result = await window.electron.recording.stop() as unknown as { success: boolean };
      if (result.success) {
        setRecordingState('idle');
        setDuration(0);
      } else {
        setRecordingState('idle');
      }
    } catch (error) {
      console.error('Stop recording error:', error);
      setRecordingState('idle');
      onError?.(error as Error);
    }
  }, [onError]);

  // Update duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (recordingState === 'recording') {
      const startTime = Date.now() - duration * 1000;
      interval = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingState, duration]);

  // Listen for audio level updates
  useEffect(() => {
    // TODO: Set up IPC listener for audio levels
    // const handleAudioLevel = (level: number) => {
    //   setAudioLevel(level);
    // };
    // window.electron.recording.onAudioLevel(handleAudioLevel);

    return () => {
      // TODO: Clean up listener
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
