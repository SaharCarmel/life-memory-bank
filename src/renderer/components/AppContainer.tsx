import React, { useEffect, useRef } from 'react';
import { ServiceContainer } from '../../shared/services/ServiceContainer';
import { EventEmitter } from '../../shared/events/EventEmitter';
import { EventType, WindowEvent } from '../../shared/events/types';
import { RecordingControls } from './RecordingControls';
import { Sidebar } from './Sidebar';
import { RecordingsList } from './RecordingsList';
import styles from './AppContainer.module.css';

interface AppContainerProps {
  events: EventEmitter;
  services: ServiceContainer;
}

export const AppContainer: React.FC<AppContainerProps> = ({ events }) => {
  const [recordingsListKey, setRecordingsListKey] = React.useState(0);

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
    console.log('[AppContainer] Recording complete, refreshing recordings list');
    // Force RecordingsList to remount and reload
    setRecordingsListKey(prev => prev + 1);
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
        <div className={styles.windowControls}>
          <button onClick={handleMinimize}>−</button>
          <button onClick={handleMaximize}>□</button>
          <button onClick={handleClose}>×</button>
        </div>
      </header>
      <div className={styles.layout}>
        <Sidebar>
          <RecordingsList key={recordingsListKey} />
        </Sidebar>
        <main className={styles.appMain}>
          <RecordingControls 
            onError={(error) => {
              console.error('Recording error:', error);
              // TODO: Show error notification
            }}
            onRecordingComplete={handleRecordingComplete}
          />
        </main>
      </div>
      <footer className={styles.appFooter}>
        <div className={styles.statusBar}>
          Ready
        </div>
      </footer>
    </div>
  );
};
