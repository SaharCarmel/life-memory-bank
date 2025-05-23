import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppContainer } from './components/AppContainer';
import { ServiceContainer } from '../shared/services/ServiceContainer';
import { EventEmitter } from '../shared/events/EventEmitter';
import '../index.css';

// Initialize services and event emitter
const services = new ServiceContainer();
const events = new EventEmitter();

// Create root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Create React root and render app
const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppContainer services={services} events={events} />
  </React.StrictMode>
);
