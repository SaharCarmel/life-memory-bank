import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { UI_THEMES, DEFAULT_SETTINGS } from '../shared';
import '../index.css';

const App: React.FC = () => {
  const [version, setVersion] = useState<string>('unknown');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<string>('');
  const [theme, setTheme] = useState(DEFAULT_SETTINGS.theme);

  useEffect(() => {
    // Get app version
    window.electron.app.getVersion()
      .then(version => setVersion(version))
      .catch(error => {
        console.error('Failed to get app version:', error);
        setVersion('unknown');
      });

    // Set up recording status listener
    const cleanup = window.electron.onRecordingStatus((status) => {
      console.log('Recording status:', status);
      setRecordingStatus(status);
    });

    // Set theme
    document.documentElement.setAttribute('data-theme', theme);

    // Clean up listener on unmount
    return () => cleanup();
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === UI_THEMES.LIGHT ? UI_THEMES.DARK : UI_THEMES.LIGHT;
    setTheme(newTheme);
  };

  const toggleRecording = async () => {
    try {
      if (!isRecording) {
        await window.electron.recording.start();
        setIsRecording(true);
      } else {
        await window.electron.recording.stop();
        setIsRecording(false);
      }
    } catch (error: unknown) {
      console.error('Recording operation failed:', error);
      if (error instanceof Error) {
        setRecordingStatus(`Error: ${error.message}`);
      } else {
        setRecordingStatus('An unknown error occurred');
      }
    }
  };

  return (
    <div id="app">
      <header>
        <h1>VoiceMCP</h1>
        <div id="app-version">Version {version}</div>
        <button onClick={toggleTheme}>
          Switch to {theme === UI_THEMES.LIGHT ? 'Dark' : 'Light'} Theme
        </button>
      </header>
      
      <main>
        <div id="recording-controls">
          <button 
            id="record-button"
            className={isRecording ? 'recording' : ''}
            onClick={toggleRecording}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          <div id="recording-status">{recordingStatus}</div>
        </div>

        <div id="recordings-list">
          {/* Recordings will be listed here */}
        </div>
      </main>

      <footer>
        <div id="status-bar">
          {/* Status messages will appear here */}
        </div>
      </footer>
    </div>
  );
};

// Initialize the application
const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
