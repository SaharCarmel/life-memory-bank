import React, { useEffect } from 'react';
import { ServiceContainer } from '../../shared/services/ServiceContainer';
import { EventEmitter } from '../../shared/events/EventEmitter';
import { EventType, WindowEvent } from '../../shared/events/types';
import styles from './AppContainer.module.css';

interface AppContainerProps {
  events: EventEmitter;
  services: ServiceContainer;
}

export const AppContainer: React.FC<AppContainerProps> = ({ events }) => {
  useEffect(() => {
    // Subscribe to window state changes
    const unsubscribe = events.on(EventType.WINDOW_MAXIMIZED, (event: WindowEvent) => {
      console.log('Window maximized:', event);
    });

    return () => {
      unsubscribe();
    };
  }, [events]);

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
      <main className={styles.appMain}>
        {/* Main content will go here */}
      </main>
      <footer className={styles.appFooter}>
        <div className={styles.statusBar}>
          Ready
        </div>
      </footer>
    </div>
  );
};
