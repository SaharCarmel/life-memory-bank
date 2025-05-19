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
export type ServiceFactory<T> = (container: ServiceContainer) => T;

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
}

/**
 * Service container class for dependency injection
 */
export class ServiceContainer implements IServiceContainer {
  private services: Map<string, ServiceRegistration<any>>;

  constructor() {
    this.services = new Map();
  }

  /**
   * Register a service with the container
   * @param name - Service name
   * @param factory - Service factory function
   * @param options - Service registration options
   */
  register<T>(name: string, factory: ServiceFactory<T>, options: ServiceOptions = {}): void {
    this.services.set(name, {
      factory,
      options,
    });
  }

  /**
   * Get a service from the container
   * @param name - Service name
   * @returns Service instance
   * @throws Error if service not found
   */
  get<T>(name: string): T {
    const registration = this.services.get(name);
    if (!registration) {
      throw new Error(`Service '${name}' not found in container`);
    }

    if (registration.options.singleton) {
      if (!registration.instance) {
        registration.instance = registration.factory(this);
      }
      return registration.instance;
    }

    return registration.factory(this);
  }

  /**
   * Check if a service exists in the container
   * @param name - Service name
   * @returns Whether the service exists
   */
  has(name: string): boolean {
    return this.services.has(name);
  }
}
