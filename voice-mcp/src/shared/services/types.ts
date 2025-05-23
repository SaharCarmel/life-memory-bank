import type { IEventEmitter } from '@events/types';

export type { IEventEmitter };

/**
 * Interface for service registration options
 */
export interface ServiceOptions {
  /** Whether the service should be treated as a singleton */
  singleton?: boolean;
  /** Service initialization options */
  initOptions?: Record<string, unknown>;
}

/**
 * Interface for a service factory function
 */
export type ServiceFactory<T> = (container: IServiceContainer) => T;

/**
 * Interface for a service registration
 */
export interface ServiceRegistration<T> {
  /** The service factory function */
  factory: ServiceFactory<T>;
  /** Service registration options */
  options: ServiceOptions;
  /** Service instance (for singletons) */
  instance?: T;
}

/**
 * Interface for the service container
 */
export interface IServiceContainer {
  /** Register a service with the container */
  register<T>(name: string, factory: ServiceFactory<T>, options?: ServiceOptions): void;
  /** Get a service from the container */
  get<T>(name: string): T;
  /** Check if a service exists in the container */
  has(name: string): boolean;
  /** Get the event emitter service */
  readonly events: IEventEmitter;
}
