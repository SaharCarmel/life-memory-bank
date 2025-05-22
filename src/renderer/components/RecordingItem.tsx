import React, { useState } from 'react';
import { RecordingMetadata } from '../preload';
import styles from './RecordingItem.module.css';

interface RecordingItemProps {
  recording: RecordingMetadata;
  onDelete: () => void;
}

export const RecordingItem: React.FC<RecordingItemProps> = ({ recording, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);

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
        </div>
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
