import React, { useState, useEffect } from 'react';
import styles from './AISummaryViewer.module.css';

interface AISummaryViewerProps {
  recordingId: string;
  recordingDate: Date;
  isOpen: boolean;
  onClose: () => void;
}

interface AISummaryData {
  title: string;
  summary: string;
  generatedAt?: Date;
}

export const AISummaryViewer: React.FC<AISummaryViewerProps> = ({
  recordingId,
  recordingDate,
  isOpen,
  onClose
}) => {
  const [summaryData, setSummaryData] = useState<AISummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && recordingId) {
      loadAISummary();
    }
  }, [isOpen, recordingId]);

  const loadAISummary = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // For now, we'll get the AI content from storage
      // In a full implementation, this would query the database
      const aiContent = await window.electron.storage.getRecordingInfo(recordingId);
      
      if (aiContent && aiContent.aiTitle && aiContent.aiSummary) {
        setSummaryData({
          title: aiContent.aiTitle,
          summary: aiContent.aiSummary,
          generatedAt: aiContent.aiGeneratedAt ? new Date(aiContent.aiGeneratedAt) : undefined
        });
      } else {
        setError('No AI summary available for this recording.');
      }
    } catch (err) {
      console.error('Failed to load AI summary:', err);
      setError('Failed to load AI summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCopyToClipboard = async () => {
    if (summaryData) {
      const content = `${summaryData.title}\n\n${summaryData.summary}`;
      try {
        await navigator.clipboard.writeText(content);
        // You could add a toast notification here
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <h2 className={styles.modalTitle}>🤖 AI Summary</h2>
            <p className={styles.recordingDate}>
              Recording from {formatDate(recordingDate)}
            </p>
          </div>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close AI summary"
          >
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Loading AI summary...</p>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <p>{error}</p>
              <button onClick={loadAISummary} className={styles.retryButton}>
                Try Again
              </button>
            </div>
          )}

          {summaryData && !loading && (
            <div className={styles.summaryContent}>
              <div className={styles.titleSection}>
                <h3 className={styles.summaryTitle}>{summaryData.title}</h3>
                {summaryData.generatedAt && (
                  <p className={styles.generatedDate}>
                    Generated on {formatDate(summaryData.generatedAt)}
                  </p>
                )}
              </div>

              <div className={styles.summaryText}>
                {summaryData.summary.split('\n').map((paragraph, index) => (
                  <p key={index} className={styles.paragraph}>
                    {paragraph}
                  </p>
                ))}
              </div>

              <div className={styles.actions}>
                <button 
                  onClick={handleCopyToClipboard}
                  className={styles.copyButton}
                >
                  📋 Copy to Clipboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
