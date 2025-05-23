import { IPCEventBridge } from '../events/IPCEventBridge';
import { IEventEmitter } from '../events/types';
import { IServiceContainer, ServiceFactory, ServiceOptions } from './types';

/**
 * Container for all application services
 */
export class ServiceContainer implements IServiceContainer {
  private services: Map<string, any>;
  private factories: Map<string, ServiceFactory<any>>;
  private options: Map<string, ServiceOptions>;
  private _events: IEventEmitter | null = null;

  constructor() {
    this.services = new Map();
    this.factories = new Map();
    this.options = new Map();
  }

  /**
   * Initialize the event system
   */
  initializeEventSystem(ipcEventBridge: IPCEventBridge): void {
    this.register('ipcEventBridge', () => ipcEventBridge, { singleton: true });
  }

  /**
   * Get a service by ID
   */
  get<T>(id: string): T {
    if (this.services.has(id)) {
      return this.services.get(id);
    }

    const factory = this.factories.get(id);
    if (!factory) {
      throw new Error(`Service not found: ${id}`);
    }

    const options = this.options.get(id) || {};
    const instance = factory(this);

    if (options.singleton) {
      this.services.set(id, instance);
    }

    return instance;
  }

  /**
   * Check if a service exists
   */
  has(id: string): boolean {
    return this.factories.has(id) || this.services.has(id);
  }

  /**
   * Register a new service
   */
  register<T>(id: string, factory: ServiceFactory<T>, options?: ServiceOptions): void {
    if (this.factories.has(id)) {
      throw new Error(`Service already registered: ${id}`);
    }

    this.factories.set(id, factory);
    if (options) {
      this.options.set(id, options);
    }
  }

  /**
   * Get the event emitter service
   */
  get events(): IEventEmitter {
    if (!this._events) {
      throw new Error('Event system not initialized');
    }
    return this._events;
  }
}
