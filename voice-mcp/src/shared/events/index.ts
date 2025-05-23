import { EventEmitter } from './EventEmitter';
import { IPCEventBridge } from './IPCEventBridge';
import { IEventEmitter, EventType, BaseEvent } from './types';

// Create and export singleton instances
const eventEmitter = new EventEmitter();
const ipcEventBridge = new IPCEventBridge(eventEmitter);

// Export types and classes
export type { IEventEmitter, BaseEvent };
export { EventEmitter, IPCEventBridge, EventType };

// Export singleton instances
export { eventEmitter, ipcEventBridge };
