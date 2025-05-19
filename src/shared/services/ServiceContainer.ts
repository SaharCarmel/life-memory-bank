import type { ServiceContainer as BaseServiceContainer, ServiceOptions } from '@services/types';
import { ServiceContainer as ServiceContainerImpl } from '@services/types';

/**
 * Global service container instance
 */
export const container = new ServiceContainerImpl();

/**
 * Service identifiers for type-safe service registration and retrieval
 */
export const ServiceIdentifiers = {
  WINDOW_MANAGER: 'windowManager',
  CONFIG: 'config',
  LOGGER: 'logger',
  STATE: 'state',
  ERROR_HANDLER: 'errorHandler',
  AUDIO_ENGINE: 'audioEngine',
  WHISPER_ENGINE: 'whisperEngine',
  STORAGE: 'storage',
  MCP_SERVER: 'mcpServer',
} as const;

/**
 * Type for service identifiers
 */
export type ServiceIdentifier = typeof ServiceIdentifiers[keyof typeof ServiceIdentifiers];

/**
 * Get a service from the container with type inference
 * @param identifier - Service identifier
 * @returns Service instance
 */
export function getService<T>(identifier: ServiceIdentifier): T {
  return container.get<T>(identifier);
}

/**
 * Check if a service exists in the container
 * @param identifier - Service identifier
 * @returns Whether the service exists
 */
export function hasService(identifier: ServiceIdentifier): boolean {
  return container.has(identifier);
}

/**
 * Register a service with the container
 * @param identifier - Service identifier
 * @param factory - Service factory function
 * @param options - Service registration options
 */
export function registerService<T>(
  identifier: ServiceIdentifier,
  factory: (container: BaseServiceContainer) => T,
  options: Parameters<BaseServiceContainer['register']>[2] = {}
): void {
  container.register(identifier, factory, options);
}
