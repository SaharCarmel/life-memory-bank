import React, { useEffect, useState } from 'react';
import { ServiceContainer } from '../../shared/services/ServiceContainer';
import { EventEmitter } from '../../shared/events/EventEmitter';
import { EventType, WindowEvent } from '../../shared/events/types';
import { RecordingControls } from './RecordingControls';
import { Sidebar } from './Sidebar';
import { RecordingsList } from './RecordingsList';
import { SettingsWindow } from './SettingsWindow';
import styles from './AppContainer.module.css';

interface AppContainerProps {
  events: EventEmitter;
  services: ServiceContainer;
}

export const AppContainer: React.FC<AppContainerProps> = ({ events }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [realtimeTranscript, setRealtimeTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // Subscribe to window state changes
    const unsubscribe = events.on(EventType.WINDOW_MAXIMIZED, (event: WindowEvent) => {
      console.log('Window maximized:', event);
    });

    return () => {
      unsubscribe();
    };
  }, [events]);

  const handleRecordingComplete = () => {
    console.log('[AppContainer] Recording complete');
    setIsRecording(false);
    setRealtimeTranscript('');
    // RecordingsList will handle its own refresh via event listeners
  };

  const handleRealtimeTranscriptUpdate = (text: string) => {
    setRealtimeTranscript(text);
  };

  const handleRecordingStart = () => {
    setIsRecording(true);
    setRealtimeTranscript('');
  };

  const handleMinimize = () => {
    window.electron.window.minimize();
  };

  const handleMaximize = () => {
    window.electron.window.maximize();
  };

  const handleClose = () => {
    window.electron.window.close();
  };

  return (
    <div className={styles.appContainer}>
      <header className={styles.appHeader}>
        <h1>Voice MCP</h1>
        <div className={styles.headerActions}>
          <button 
            className={styles.settingsButton}
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
        <div className={styles.windowControls}>
          <button onClick={handleMinimize}>−</button>
          <button onClick={handleMaximize}>□</button>
          <button onClick={handleClose}>×</button>
        </div>
      </header>
      <div className={styles.layout}>
        <Sidebar>
          <RecordingsList />
        </Sidebar>
        <main className={styles.appMain}>
          <RecordingControls 
            onError={(error) => {
              console.error('Recording error:', error);
              // TODO: Show error notification
            }}
            onRecordingComplete={handleRecordingComplete}
            onRealtimeTranscriptUpdate={handleRealtimeTranscriptUpdate}
            onRecordingStart={handleRecordingStart}
          />
          
          {/* Real-time Transcript Display */}
          {isRecording && realtimeTranscript && (
            <div className={styles.realtimeTranscript}>
              <h3>Live Transcription</h3>
              <div className={styles.transcriptContent}>
                {realtimeTranscript}
              </div>
            </div>
          )}
        </main>
      </div>
      <footer className={styles.appFooter}>
        <div className={styles.statusBar}>
          Ready
        </div>
      </footer>
      
      <SettingsWindow 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
