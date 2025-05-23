import React, { useState, useEffect } from 'react';
import styles from './TranscriptViewer.module.css';

interface TranscriptData {
  text: string;
  language: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

interface TranscriptViewerProps {
  recordingId: string;
  recordingDate: Date;
  isOpen: boolean;
  onClose: () => void;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  recordingId,
  recordingDate,
  isOpen,
  onClose
}) => {
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && recordingId) {
      loadTranscript();
    }
  }, [isOpen, recordingId]);

  const loadTranscript = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await window.electron.transcription.loadTranscript(recordingId);
      if (result) {
        setTranscript(result);
      } else {
        setError('No transcript found for this recording');
      }
    } catch (err) {
      console.error('Failed to load transcript:', err);
      setError('Failed to load transcript');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTranscript = async () => {
    if (!transcript) return;
    
    try {
      await navigator.clipboard.writeText(transcript.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy transcript:', err);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>
            <h2>Transcript</h2>
            <p className={styles.date}>{formatDate(recordingDate)}</p>
          </div>
          <div className={styles.actions}>
            {transcript && (
              <button
                className={styles.copyButton}
                onClick={handleCopyTranscript}
                title="Copy transcript to clipboard"
              >
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            )}
            <button
              className={styles.closeButton}
              onClick={onClose}
              title="Close transcript viewer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Loading transcript...</p>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <p>⚠ {error}</p>
              <button onClick={loadTranscript} className={styles.retryButton}>
                Try Again
              </button>
            </div>
          )}

          {transcript && !loading && (
            <div className={styles.transcript}>
              <div className={styles.metadata}>
                <span className={styles.language}>
                  Language: {transcript.language || 'Unknown'}
                </span>
                <span className={styles.wordCount}>
                  {transcript.text.split(/\s+/).length} words
                </span>
              </div>

              {transcript.segments && transcript.segments.length > 0 ? (
                <div className={styles.segments}>
                  {transcript.segments.map((segment, index) => (
                    <div key={index} className={styles.segment}>
                      <span className={styles.timestamp}>
                        {formatTime(segment.start)}
                      </span>
                      <span className={styles.segmentText}>
                        {segment.text}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.fullText}>
                  <p>{transcript.text}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
