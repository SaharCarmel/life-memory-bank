import React from 'react';
import { createRoot } from 'react-dom/client';

const App: React.FC = () => {
  return (
    <div className="container">
      <div className="window-info">
        <h1>VoiceMCP</h1>
        <p>Window Management Test</p>
      </div>
      <div className="controls">
        <button onClick={() => window.close()}>Close Window</button>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
