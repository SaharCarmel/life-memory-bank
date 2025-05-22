import React, { useState, useEffect } from 'react';
import { RecordingMetadata } from '../preload';
import styles from './RecordingItem.module.css';

interface RecordingItemProps {
  recording: RecordingMetadata;
  onDelete: () => void;
}

export const RecordingItem: React.FC<RecordingItemProps> = ({ recording, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState<number>(0);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string>(recording.transcriptStatus || 'none');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  useEffect(() => {
    // Set up transcription event listeners
    const unsubscribeProgress = window.electron.onTranscriptionProgress((data) => {
      if (data.recordingId === recording.id) {
        setTranscriptionProgress(data.progress);
        setTranscriptionStatus('processing');
      }
    });

    const unsubscribeCompleted = window.electron.onTranscriptionCompleted((data) => {
      if (data.recordingId === recording.id) {
        setTranscriptionStatus('completed');
        setTranscriptionProgress(100);
        setCurrentJobId(null);
      }
    });

    const unsubscribeFailed = window.electron.onTranscriptionFailed((data) => {
      if (data.recordingId === recording.id) {
        setTranscriptionStatus('failed');
        setTranscriptionProgress(0);
        setCurrentJobId(null);
      }
    });

    return () => {
      unsubscribeProgress();
      unsubscribeCompleted();
      unsubscribeFailed();
    };
  }, [recording.id]);

  const handleTranscribe = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const jobId = await window.electron.transcription.transcribeRecording(recording.id);
      setCurrentJobId(jobId);
      setTranscriptionStatus('processing');
      setTranscriptionProgress(0);
    } catch (error) {
      console.error('Failed to start transcription:', error);
      setTranscriptionStatus('failed');
    }
    setShowMenu(false);
  };

  const handleCancelTranscription = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentJobId) {
      try {
        await window.electron.transcription.cancel(currentJobId);
        setTranscriptionStatus('none');
        setTranscriptionProgress(0);
        setCurrentJobId(null);
      } catch (error) {
        console.error('Failed to cancel transcription:', error);
      }
    }
    setShowMenu(false);
  };

  const getTranscriptionStatusIcon = () => {
    switch (transcriptionStatus) {
      case 'completed':
        return '✓';
      case 'processing':
        return '⏳';
      case 'failed':
        return '⚠';
      default:
        return null;
    }
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this recording?')) {
      onDelete();
    }
    setShowMenu(false);
  };

  return (
    <div className={styles.item}>
      <div className={styles.content}>
        <div className={styles.time}>{formatTime(recording.startTime)}</div>
        <div className={styles.details}>
          <span className={styles.duration}>{formatDuration(recording.duration)}</span>
          <span className={styles.separator}>•</span>
          <span className={styles.size}>{formatFileSize(recording.size)}</span>
          {getTranscriptionStatusIcon() && (
            <>
              <span className={styles.separator}>•</span>
              <span className={styles.transcriptionStatus}>
                {getTranscriptionStatusIcon()}
                {transcriptionStatus === 'processing' && (
                  <span className={styles.progressText}> {Math.round(transcriptionProgress)}%</span>
                )}
              </span>
            </>
          )}
        </div>
        {transcriptionStatus === 'processing' && (
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${transcriptionProgress}%` }}
            />
          </div>
        )}
      </div>
      
      <div className={styles.actions}>
        <button 
          className={styles.menuButton}
          onClick={handleMenuClick}
          aria-label="Recording options"
        >
          ⋮
        </button>
        
        {showMenu && (
          <div className={styles.menu}>
            <button className={styles.menuItem} disabled>
              Play
            </button>
            <button className={styles.menuItem} disabled>
              Rename
            </button>
            <button className={styles.menuItem} disabled>
              Export
            </button>
            <div className={styles.menuDivider} />
            {transcriptionStatus === 'none' || transcriptionStatus === 'failed' ? (
              <button 
                className={styles.menuItem}
                onClick={handleTranscribe}
              >
                📝 Transcribe
              </button>
            ) : transcriptionStatus === 'processing' ? (
              <button 
                className={styles.menuItem}
                onClick={handleCancelTranscription}
              >
                ⏹ Cancel Transcription
              </button>
            ) : (
              <button className={styles.menuItem} disabled>
                ✓ Transcribed
              </button>
            )}
            <div className={styles.menuDivider} />
            <button 
              className={`${styles.menuItem} ${styles.deleteItem}`}
              onClick={handleDelete}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
