import React, { useState, useEffect } from 'react';
import { RecordingMetadata } from '../preload';
import { TranscriptViewer } from './TranscriptViewer';
import { AISummaryViewer } from './AISummaryViewer';
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
  const [showTranscriptViewer, setShowTranscriptViewer] = useState(false);
  const [showAISummaryViewer, setShowAISummaryViewer] = useState(false);
  const [aiProgress, setAIProgress] = useState<number>(0);
  const [aiStatus, setAIStatus] = useState<string>(recording.aiStatus || 'none');
  const [currentAIJobId, setCurrentAIJobId] = useState<string | null>(null);
  const [showSummaryExpanded, setShowSummaryExpanded] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [aiTitle, setAITitle] = useState<string | null>(recording.aiTitle || null);
  const [aiSummary, setAISummary] = useState<string | null>(recording.aiSummary || null);

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

    // Set up AI event listeners
    const unsubscribeAIProgress = window.electron.onAIProgress((data) => {
      // Find the job for this recording
      window.electron.ai.getJobStatus(data.jobId).then((job) => {
        if (job && job.recordingId === recording.id) {
          setAIProgress(data.progress);
          setAIStatus('processing');
        }
      }).catch(console.error);
    });

    const unsubscribeAICompleted = window.electron.onAICompleted((data) => {
      // Find the job for this recording
      window.electron.ai.getJobStatus(data.jobId).then((job) => {
        if (job && job.recordingId === recording.id) {
          setAIStatus('completed');
          setAIProgress(100);
          setCurrentAIJobId(null);
          // Refresh AI content from storage
          refreshAIContent();
        }
      }).catch(console.error);
    });

    const unsubscribeAIFailed = window.electron.onAIFailed((data) => {
      // Find the job for this recording
      window.electron.ai.getJobStatus(data.jobId).then((job) => {
        if (job && job.recordingId === recording.id) {
          setAIStatus('failed');
          setAIProgress(0);
          setCurrentAIJobId(null);
        }
      }).catch(console.error);
    });

    return () => {
      unsubscribeProgress();
      unsubscribeCompleted();
      unsubscribeFailed();
      unsubscribeAIProgress();
      unsubscribeAICompleted();
      unsubscribeAIFailed();
    };
  }, [recording.id]);

  // Function to refresh AI content from storage
  const refreshAIContent = async () => {
    try {
      const recordingInfo = await window.electron.storage.getRecordingInfo(recording.id);
      if (recordingInfo) {
        setAITitle(recordingInfo.aiTitle || null);
        setAISummary(recordingInfo.aiSummary || null);
      }
    } catch (error) {
      console.error('Failed to refresh AI content:', error);
    }
  };

  // Function to handle title editing
  const handleEditTitle = () => {
    setEditedTitle(aiTitle || '');
    setIsEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    try {
      // TODO: Implement save title to storage
      setAITitle(editedTitle);
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Failed to save title:', error);
    }
  };

  const handleCancelEditTitle = () => {
    setEditedTitle('');
    setIsEditingTitle(false);
  };

  // Function to get display title
  const getDisplayTitle = () => {
    if (aiTitle) {
      return aiTitle;
    }
    return formatTime(recording.startTime);
  };

  // Function to get summary preview
  const getSummaryPreview = () => {
    if (!aiSummary) return '';
    const lines = aiSummary.split('\n').filter(line => line.trim());
    return lines.slice(0, 2).join('\n');
  };

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

  const handleViewTranscript = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTranscriptViewer(true);
    setShowMenu(false);
  };

  const handleViewAISummary = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAISummaryViewer(true);
    setShowMenu(false);
  };

  const handleGenerateAISummary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Check if we have OpenAI configuration
      const hasConfig = await window.electron.config.hasOpenAIConfig();
      if (!hasConfig) {
        alert('Please configure your OpenAI API key in settings first.');
        return;
      }

      // Get the transcript path from the recording
      if (!recording.transcriptPath) {
        alert('No transcript available. Please transcribe the recording first.');
        return;
      }

      const result = await window.electron.ai.processTranscript(recording.id, recording.transcriptPath);
      if (result.success) {
        setCurrentAIJobId(result.jobId);
        setAIStatus('processing');
        setAIProgress(0);
      }
    } catch (error) {
      console.error('Failed to start AI processing:', error);
      setAIStatus('failed');
      alert('Failed to start AI processing. Please try again.');
    }
    setShowMenu(false);
  };

  const handleCancelAISummary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentAIJobId) {
      try {
        await window.electron.ai.cancelJob(currentAIJobId);
        setAIStatus('none');
        setAIProgress(0);
        setCurrentAIJobId(null);
      } catch (error) {
        console.error('Failed to cancel AI processing:', error);
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

  const getAIStatusIcon = () => {
    switch (aiStatus) {
      case 'completed':
        return '🤖';
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
    <>
      <div className={styles.item}>
        <div className={styles.content}>
          <div className={styles.titleSection}>
            {isEditingTitle ? (
              <div className={styles.titleEdit}>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className={styles.titleInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') handleCancelEditTitle();
                  }}
                  autoFocus
                />
                <button onClick={handleSaveTitle} className={styles.saveButton}>✓</button>
                <button onClick={handleCancelEditTitle} className={styles.cancelButton}>✕</button>
              </div>
            ) : (
              <div className={styles.titleDisplay}>
                <span className={`${styles.title} ${aiTitle ? styles.aiTitle : ''}`}>
                  {getDisplayTitle()}
                  {aiTitle && <span className={styles.aiIndicator}>🤖</span>}
                </span>
                {aiTitle && (
                  <button onClick={handleEditTitle} className={styles.editButton}>✏️</button>
                )}
              </div>
            )}
          </div>
          
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
            {getAIStatusIcon() && (
              <>
                <span className={styles.separator}>•</span>
                <span className={styles.transcriptionStatus}>
                  {getAIStatusIcon()}
                  {aiStatus === 'processing' && (
                    <span className={styles.progressText}> {Math.round(aiProgress)}%</span>
                  )}
                </span>
              </>
            )}
          </div>

          {/* AI Summary Preview */}
          {aiSummary && aiStatus === 'completed' && (
            <div className={styles.summarySection}>
              <div className={styles.summaryPreview}>
                <div className={styles.summaryText}>
                  {showSummaryExpanded ? aiSummary : getSummaryPreview()}
                </div>
                <button 
                  className={styles.expandButton}
                  onClick={() => setShowSummaryExpanded(!showSummaryExpanded)}
                >
                  {showSummaryExpanded ? 'Show Less' : 'Show More'}
                </button>
              </div>
            </div>
          )}

          {transcriptionStatus === 'processing' && (
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${transcriptionProgress}%` }}
              />
            </div>
          )}
          {aiStatus === 'processing' && (
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${aiProgress}%` }}
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
              {transcriptionStatus === 'completed' && (
                <button 
                  className={styles.menuItem}
                  onClick={handleViewTranscript}
                >
                  📄 View Transcript
                </button>
              )}
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
              ) : transcriptionStatus === 'completed' ? (
                <button className={styles.menuItem} disabled>
                  ✓ Transcribed
                </button>
              ) : null}
              {/* AI Summary Menu Items */}
              {transcriptionStatus === 'completed' && (
                <>
                  {aiStatus === 'none' || aiStatus === 'failed' ? (
                    <button 
                      className={styles.menuItem}
                      onClick={handleGenerateAISummary}
                    >
                      🤖 Generate AI Summary
                    </button>
                  ) : aiStatus === 'processing' ? (
                    <button 
                      className={styles.menuItem}
                      onClick={handleCancelAISummary}
                    >
                      ⏹ Cancel AI Summary
                    </button>
                  ) : aiStatus === 'completed' ? (
                    <button 
                      className={styles.menuItem}
                      onClick={handleViewAISummary}
                    >
                      🤖 View AI Summary
                    </button>
                  ) : null}
                </>
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

      <TranscriptViewer
        recordingId={recording.id}
        recordingDate={new Date(recording.startTime)}
        isOpen={showTranscriptViewer}
        onClose={() => setShowTranscriptViewer(false)}
      />

      <AISummaryViewer
        recordingId={recording.id}
        recordingDate={new Date(recording.startTime)}
        isOpen={showAISummaryViewer}
        onClose={() => setShowAISummaryViewer(false)}
      />
    </>
  );
};
