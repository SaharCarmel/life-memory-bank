import { BaseEvent, EventHandler, IEventEmitter } from './types';

/**
 * Basic event emitter implementation
 */
export class EventEmitter implements IEventEmitter {
  private events: Map<string, Set<EventHandler<any>>>;

  constructor() {
    this.events = new Map();
  }

  /**
   * Subscribe to an event
   */
  on<T extends BaseEvent>(type: string, handler: EventHandler<T>): () => void {
    if (!this.events.has(type)) {
      this.events.set(type, new Set());
    }

    const handlers = this.events.get(type)!;
    handlers.add(handler);

    return () => {
      this.off(type, handler);
    };
  }

  /**
   * Unsubscribe from an event
   */
  off<T extends BaseEvent>(type: string, handler: EventHandler<T>): void {
    const handlers = this.events.get(type);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.events.delete(type);
      }
    }
  }

  /**
   * Subscribe to an event once
   */
  once<T extends BaseEvent>(type: string, handler: EventHandler<T>): void {
    const onceHandler: EventHandler<T> = (event: T) => {
      handler(event);
      this.off(type, onceHandler);
    };
    this.on(type, onceHandler);
  }

  /**
   * Emit an event
   */
  emit<T extends BaseEvent>(event: T): void {
    const handlers = this.events.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.events.clear();
  }
}
