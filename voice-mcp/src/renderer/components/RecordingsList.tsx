import React, { useEffect, useState, useRef } from 'react';
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
  const [importing, setImporting] = useState(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastRecordingCountRef = useRef<number>(0);

  useEffect(() => {
    console.log('[RecordingsList] Component mounted, loading recordings...');
    loadRecordings();
    
    // Listen for recording completed events
    console.log('[RecordingsList] Setting up recording completed listener...');
    const unsubscribeRecording = window.electron.onRecordingCompleted(() => {
      console.log('[RecordingsList] ✅ RECORDING_COMPLETED event received! Starting aggressive refresh...');
      triggerAggressiveRefresh();
    });

    // Listen for real-time transcription finalized events  
    console.log('[RecordingsList] Setting up real-time transcription finalized listener...');
    const unsubscribeTranscription = window.electron.onRealtimeTranscriptionFinalized(() => {
      console.log('[RecordingsList] Real-time transcription finalized! Refreshing list...');
      loadRecordings();
    });

    // Start periodic polling as backup (every 5 seconds)
    startPeriodicPolling();
    
    // Cleanup listeners on unmount
    return () => {
      console.log('[RecordingsList] Cleaning up listeners and timers...');
      unsubscribeRecording();
      unsubscribeTranscription();
      stopPeriodicPolling();
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const startPeriodicPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const currentRecordings = await window.electron.storage.listRecordings();
        if (currentRecordings.length !== lastRecordingCountRef.current) {
          console.log(`[RecordingsList] 🔄 Polling detected count change: ${lastRecordingCountRef.current} → ${currentRecordings.length}`);
          setRecordings(currentRecordings);
          lastRecordingCountRef.current = currentRecordings.length;
        }
      } catch (error) {
        console.error('[RecordingsList] Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds
  };

  const stopPeriodicPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const triggerAggressiveRefresh = async () => {
    console.log('[RecordingsList] 🚀 Starting aggressive refresh sequence...');
    
    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // Immediate refresh attempts with increasing delays
    const delays = [0, 100, 300, 500, 800, 1200, 1800, 2500, 3500, 5000]; // 10 attempts over 14 seconds
    let currentRecordingCount = recordings.length;
    
    for (let i = 0; i < delays.length; i++) {
      const delay = delays[i];
      
      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          console.log(`[RecordingsList] 🔄 Aggressive refresh attempt ${i + 1}/${delays.length} (delay: ${delay}ms)`);
          const startTime = Date.now();
          const recordingsList = await window.electron.storage.listRecordings();
          const loadDuration = Date.now() - startTime;
          
          console.log(`[RecordingsList] Attempt ${i + 1}: loaded ${recordingsList.length} recordings in ${loadDuration}ms`);
          
          if (recordingsList.length > currentRecordingCount) {
            console.log(`[RecordingsList] ✅ SUCCESS! New recording detected (${recordingsList.length} vs ${currentRecordingCount})`);
            setRecordings(recordingsList);
            setError(null);
            lastRecordingCountRef.current = recordingsList.length;
            return; // Stop further attempts
          } else if (recordingsList.length !== recordings.length) {
            // Update even if count didn't increase (could be other changes)
            console.log(`[RecordingsList] 📝 Updating recordings list (${recordingsList.length} recordings)`);
            setRecordings(recordingsList);
            lastRecordingCountRef.current = recordingsList.length;
          } else {
            console.log(`[RecordingsList] ⏳ Attempt ${i + 1}: No changes detected, will continue...`);
          }
        } catch (err) {
          console.error(`[RecordingsList] ❌ Aggressive refresh attempt ${i + 1} failed:`, err);
        }
      }, delay);
    }
    
    // Final fallback after all attempts
    setTimeout(async () => {
      console.log('[RecordingsList] 🏁 Final fallback refresh...');
      try {
        const finalRecordings = await window.electron.storage.listRecordings();
        setRecordings(finalRecordings);
        lastRecordingCountRef.current = finalRecordings.length;
        console.log(`[RecordingsList] 🏁 Final refresh completed: ${finalRecordings.length} recordings`);
      } catch (err) {
        console.error('[RecordingsList] ❌ Final fallback refresh failed:', err);
      }
    }, 6000);
  };

  const loadRecordings = async () => {
    try {
      console.log('[RecordingsList] 📂 Starting loadRecordings...');
      const loadStartTime = Date.now();
      setLoading(true);
      setError(null);
      
      const recordingsList = await window.electron.storage.listRecordings();
      const loadDuration = Date.now() - loadStartTime;
      
      console.log(`[RecordingsList] ✅ Successfully loaded ${recordingsList.length} recordings in ${loadDuration}ms`);
      console.log('[RecordingsList] 📝 Recording IDs:', recordingsList.map(r => r.id));
      
      setRecordings(recordingsList);
      lastRecordingCountRef.current = recordingsList.length;
    } catch (err) {
      console.error('[RecordingsList] ❌ Failed to load recordings:', err);
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
      console.log('[RecordingsList] 🗑️ Deleting recording:', filepath);
      await window.electron.storage.deleteRecording(filepath);
      console.log('[RecordingsList] ✅ Recording deleted, reloading list...');
      await loadRecordings(); // Reload the list
    } catch (err) {
      console.error('[RecordingsList] ❌ Failed to delete recording:', err);
    }
  };

  const handleImport = async () => {
    try {
      console.log('[RecordingsList] 📥 Starting import process...');
      setImporting(true);
      
      // First, select files
      const selectResult = await window.electron.import.selectFiles();
      if (!selectResult.success || !selectResult.filePaths || selectResult.filePaths.length === 0) {
        console.log('[RecordingsList] File selection cancelled or failed:', selectResult.error);
        return;
      }

      console.log('[RecordingsList] Selected files:', selectResult.filePaths);

      // Then import the selected files
      const importResult = await window.electron.import.importFiles(selectResult.filePaths);
      if (importResult.success) {
        console.log(`[RecordingsList] ✅ Successfully imported ${importResult.imported} files`);
        if (importResult.failed > 0) {
          console.warn(`[RecordingsList] ⚠️ Failed to import ${importResult.failed} files:`, importResult.errors);
        }
        // Refresh the recordings list
        console.log('[RecordingsList] 📂 Import completed, reloading recordings list...');
        await loadRecordings();
      } else {
        console.error('[RecordingsList] ❌ Import failed:', importResult.errors);
        setError(`Import failed: ${importResult.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[RecordingsList] ❌ Failed to import recordings:', err);
      setError('Failed to import recordings');
    } finally {
      setImporting(false);
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
        <div className={styles.header}>
          <h2 className={styles.title}>Recordings</h2>
          <button 
            className={styles.importButton}
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? 'Importing...' : '📁 Import'}
          </button>
        </div>
        <div className={styles.empty}>
          <p>No recordings yet</p>
          <p className={styles.hint}>Start recording or import audio files to see them here</p>
        </div>
      </div>
    );
  }

  const groupedRecordings = groupRecordingsByDate(recordings);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Recordings ({recordings.length})</h2>
        <button 
          className={styles.importButton}
          onClick={handleImport}
          disabled={importing}
        >
          {importing ? 'Importing...' : '📁 Import'}
        </button>
      </div>
      
      {groupedRecordings.today.length > 0 && (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>💬 Today ({groupedRecordings.today.length})</h3>
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
          <h3 className={styles.groupTitle}>💬 Yesterday ({groupedRecordings.yesterday.length})</h3>
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
          <h3 className={styles.groupTitle}>💬 This Week ({groupedRecordings.thisWeek.length})</h3>
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
          <h3 className={styles.groupTitle}>💬 This Month ({groupedRecordings.thisMonth.length})</h3>
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
          <h3 className={styles.groupTitle}>💬 Older ({groupedRecordings.older.length})</h3>
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
