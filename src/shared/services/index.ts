import { ServiceContainer } from './ServiceContainer';
import type { IServiceContainer, ServiceFactory, ServiceOptions } from './types';
import { ipcEventBridge } from '../events';

export type { IServiceContainer, ServiceFactory, ServiceOptions };
export { ServiceContainer };

// Create and export the global service container instance
const container = new ServiceContainer();

// Initialize the event system
container.initializeEventSystem(ipcEventBridge);

// Export the initialized container
export { container };

// Service identifiers
export const ServiceIdentifiers = {
  EVENTS: 'events',
  WINDOW_MANAGER: 'windowManager',
  AUDIO_ENGINE: 'audioEngine',
  STORAGE: 'storage',
  WHISPER: 'whisper',
  MCP_SERVER: 'mcpServer'
} as const;

// Helper functions
export const getService = <T>(id: string): T => container.get<T>(id);
export const hasService = (id: string): boolean => container.has(id);
export const registerService = <T>(
  id: string,
  factory: ServiceFactory<T>,
  options?: ServiceOptions
): void => container.register(id, factory, options);
