import React, { useEffect, useState } from 'react';
import { RecordingMetadata } from '../preload';
import { RecordingItem } from './RecordingItem';
import styles from './RecordingsList.module.css';

interface GroupedRecordings {
  today: RecordingMetadata[];
  yesterday: RecordingMetadata[];
  thisWeek: RecordingMetadata[];
  thisMonth: RecordingMetadata[];
  older: RecordingMetadata[];
}

export const RecordingsList: React.FC = () => {
  const [recordings, setRecordings] = useState<RecordingMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[RecordingsList] Component mounted, loading recordings...');
    loadRecordings();
    
    // Listen for recording completed events
    console.log('[RecordingsList] Setting up recording completed listener...');
    const unsubscribeRecording = window.electron.onRecordingCompleted(() => {
      console.log('[RecordingsList] Recording completed event received! Refreshing list...');
      loadRecordings();
    });

    // Listen for real-time transcription finalized events
    console.log('[RecordingsList] Setting up real-time transcription finalized listener...');
    const unsubscribeTranscription = window.electron.onRealtimeTranscriptionFinalized(() => {
      console.log('[RecordingsList] Real-time transcription finalized! Refreshing list...');
      loadRecordings();
    });
    
    // Cleanup listeners on unmount
    return () => {
      console.log('[RecordingsList] Cleaning up recording completed listener...');
      unsubscribeRecording();
      console.log('[RecordingsList] Cleaning up real-time transcription finalized listener...');
      unsubscribeTranscription();
    };
  }, []);

  const loadRecordings = async () => {
    try {
      setLoading(true);
      setError(null);
      const recordingsList = await window.electron.storage.listRecordings();
      setRecordings(recordingsList);
    } catch (err) {
      console.error('Failed to load recordings:', err);
      setError('Failed to load recordings');
    } finally {
      setLoading(false);
    }
  };

  const groupRecordingsByDate = (recordings: RecordingMetadata[]): GroupedRecordings => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const groups: GroupedRecordings = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: []
    };

    recordings.forEach(recording => {
      const recordingDate = new Date(recording.startTime);
      
      if (recordingDate >= today) {
        groups.today.push(recording);
      } else if (recordingDate >= yesterday) {
        groups.yesterday.push(recording);
      } else if (recordingDate >= weekAgo) {
        groups.thisWeek.push(recording);
      } else if (recordingDate >= monthAgo) {
        groups.thisMonth.push(recording);
      } else {
        groups.older.push(recording);
      }
    });

    return groups;
  };

  const handleDelete = async (filepath: string) => {
    try {
      await window.electron.storage.deleteRecording(filepath);
      await loadRecordings(); // Reload the list
    } catch (err) {
      console.error('Failed to delete recording:', err);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading recordings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>No recordings yet</p>
          <p className={styles.hint}>Start recording to see your audio files here</p>
        </div>
      </div>
    );
  }

  const groupedRecordings = groupRecordingsByDate(recordings);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Recordings</h2>
      
      {groupedRecordings.today.length > 0 && (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>💬 Today</h3>
          {groupedRecordings.today.map(recording => (
            <RecordingItem
              key={recording.id}
              recording={recording}
              onDelete={() => handleDelete(recording.filepath)}
            />
          ))}
        </div>
      )}

      {groupedRecordings.yesterday.length > 0 && (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>💬 Yesterday</h3>
          {groupedRecordings.yesterday.map(recording => (
            <RecordingItem
              key={recording.id}
              recording={recording}
              onDelete={() => handleDelete(recording.filepath)}
            />
          ))}
        </div>
      )}

      {groupedRecordings.thisWeek.length > 0 && (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>💬 This Week</h3>
          {groupedRecordings.thisWeek.map(recording => (
            <RecordingItem
              key={recording.id}
              recording={recording}
              onDelete={() => handleDelete(recording.filepath)}
            />
          ))}
        </div>
      )}

      {groupedRecordings.thisMonth.length > 0 && (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>💬 This Month</h3>
          {groupedRecordings.thisMonth.map(recording => (
            <RecordingItem
              key={recording.id}
              recording={recording}
              onDelete={() => handleDelete(recording.filepath)}
            />
          ))}
        </div>
      )}

      {groupedRecordings.older.length > 0 && (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>💬 Older</h3>
          {groupedRecordings.older.map(recording => (
            <RecordingItem
              key={recording.id}
              recording={recording}
              onDelete={() => handleDelete(recording.filepath)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
