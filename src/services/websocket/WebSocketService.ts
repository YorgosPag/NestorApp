'use client';

import { generateMessageId, generateTempId } from '@/services/enterprise-id.service';

// WebSocket service for real-time communication
export type WebSocketEventType =
  | 'user_online'
  | 'user_offline'
  | 'user_status'
  | 'message_received'
  | 'notification'
  | 'task_updated'
  | 'property_updated'
  | 'dxf_collaboration'
  | 'system_update'
  | 'email_queue_updated'
  | 'email_received'
  | 'email_processed'
  | 'error';

// 🏢 ENTERPRISE: Generic interface with unknown default for type safety
export interface WebSocketMessage<T = unknown> {
  id: string;
  type: WebSocketEventType;
  payload: T;
  timestamp: number;
  userId?: string;
  targetUsers?: string[];
  metadata?: Record<string, unknown>;
}

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  enableLogging?: boolean;
}

export type WebSocketConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

// 🏢 ENTERPRISE: Generic listener with unknown default
export interface WebSocketListener<T = unknown> {
  id: string;
  type: WebSocketEventType;
  handler: (message: WebSocketMessage<T>) => void;
  once?: boolean;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private listeners: Map<string, WebSocketListener<unknown>[]> = new Map();
  private connectionState: WebSocketConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private heartbeatIntervalId: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private isReconnecting = false;

  // Connection state listeners
  private connectionListeners: Array<(state: WebSocketConnectionState) => void> = [];
  
  // Message middleware
  private middleware: Array<(message: WebSocketMessage) => WebSocketMessage | null> = [];

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectAttempts: 5,
      reconnectInterval: 3000,
      heartbeatInterval: 30000,
      enableLogging: process.env.NODE_ENV === 'development',
      ...config
    };
  }

  // Connection management
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setConnectionState('connecting');
      this.log('Connecting to WebSocket server...');

      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);

        this.ws.onopen = () => {
          this.log('WebSocket connected');
          this.setConnectionState('connected');
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          this.startHeartbeat();
          this.processMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          this.log(`WebSocket closed: ${event.code} - ${event.reason}`);
          this.setConnectionState('disconnected');
          this.stopHeartbeat();
          
          if (!event.wasClean && this.shouldReconnect()) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.log('WebSocket error:', error);
          this.setConnectionState('error');
          reject(new Error('WebSocket connection failed'));
        };

      } catch (error) {
        this.log('Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.log('Disconnecting WebSocket...');
    
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setConnectionState('disconnected');
    this.messageQueue = [];
  }

  // Message handling
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      // Apply middleware
      const processedMessage = this.applyMiddleware(message);
      if (!processedMessage) return;

      this.log('Received message:', processedMessage.type, processedMessage.payload);

      // Handle system messages
      if (processedMessage.type === 'error') {
        this.handleSystemError(processedMessage);
        return;
      }

      // Dispatch to listeners
      const typeListeners = this.listeners.get(processedMessage.type) || [];
      const globalListeners = this.listeners.get('*' as WebSocketEventType) || [];
      
      [...typeListeners, ...globalListeners].forEach(listener => {
        try {
          listener.handler(processedMessage);
          
          // Remove one-time listeners
          if (listener.once) {
            this.removeListener(listener.id);
          }
        } catch (error) {
          this.log('Error in message handler:', error);
        }
      });

    } catch (error) {
      this.log('Error parsing WebSocket message:', error);
    }
  }

  private applyMiddleware(message: WebSocketMessage): WebSocketMessage | null {
    // 🏢 ENTERPRISE: Fix reduce callback signature - explicit parameter types
    return this.middleware.reduce<WebSocketMessage | null>((msg: WebSocketMessage | null, middlewareFunc: (message: WebSocketMessage<unknown>) => WebSocketMessage<unknown> | null) => {
      return msg ? middlewareFunc(msg) : null;
    }, message as WebSocketMessage | null);
  }

  private handleSystemError(message: WebSocketMessage): void {
    this.log('System error received:', message.payload);
    this.setConnectionState('error');
  }

  // Send messages
  send<T>(type: WebSocketEventType, payload: T, options: {
    targetUsers?: string[];
    metadata?: Record<string, unknown>;
    priority?: 'low' | 'normal' | 'high';
  } = {}): boolean {
    const message: WebSocketMessage<T> = {
      id: this.generateMessageIdInternal(),
      type,
      payload,
      timestamp: Date.now(),
      targetUsers: options.targetUsers,
      metadata: options.metadata
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        this.log('Sent message:', type, payload);
        return true;
      } catch (error) {
        this.log('Error sending message:', error);
        this.queueMessage(message);
        return false;
      }
    } else {
      // Queue message for later if connection is not ready
      this.queueMessage(message);
      return false;
    }
  }

  private queueMessage(message: WebSocketMessage): void {
    this.messageQueue.push(message);
    
    // Limit queue size
    if (this.messageQueue.length > 100) {
      this.messageQueue = this.messageQueue.slice(-100);
    }
  }

  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;
    
    this.log(`Processing ${this.messageQueue.length} queued messages`);
    
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    messages.forEach(message => {
      this.send(message.type, message.payload, {
        targetUsers: message.targetUsers,
        metadata: message.metadata
      });
    });
  }

  // Event listeners
  addEventListener<T = unknown>(
    type: WebSocketEventType | '*',
    handler: (message: WebSocketMessage<T>) => void,
    options: { once?: boolean } = {}
  ): string {
    const listenerId = this.generateListenerId();
    const wrappedHandler = (message: WebSocketMessage<unknown>) => {
      handler(message as WebSocketMessage<T>);
    };
    const listener: WebSocketListener<unknown> = {
      id: listenerId,
      type: type as WebSocketEventType,
      handler: wrappedHandler,
      once: options.once
    };

    if (!this.listeners.has(type as WebSocketEventType)) {
      this.listeners.set(type as WebSocketEventType, []);
    }

    this.listeners.get(type as WebSocketEventType)!.push(listener);
    return listenerId;
  }

  removeEventListener(listenerId: string): boolean {
    return this.removeListener(listenerId);
  }

  private removeListener(listenerId: string): boolean {
    for (const [type, listeners] of this.listeners) {
      const index = listeners.findIndex(l => l.id === listenerId);
      if (index !== -1) {
        listeners.splice(index, 1);
        if (listeners.length === 0) {
          this.listeners.delete(type);
        }
        return true;
      }
    }
    return false;
  }

  // Connection state management
  onConnectionStateChange(callback: (state: WebSocketConnectionState) => void): () => void {
    this.connectionListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.connectionListeners.indexOf(callback);
      if (index !== -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  private setConnectionState(state: WebSocketConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.connectionListeners.forEach(callback => {
        try {
          callback(state);
        } catch (error) {
          this.log('Error in connection state callback:', error);
        }
      });
    }
  }

  getConnectionState(): WebSocketConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  // Reconnection logic
  private shouldReconnect(): boolean {
    return this.reconnectAttempts < (this.config.reconnectAttempts || 5);
  }

  private scheduleReconnect(): void {
    if (this.isReconnecting) return;
    
    this.isReconnecting = true;
    this.setConnectionState('reconnecting');
    
    const delay = this.calculateReconnectDelay();
    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
    
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(() => {
        if (this.shouldReconnect()) {
          this.scheduleReconnect();
        } else {
          this.log('Max reconnection attempts reached');
          this.setConnectionState('error');
          this.isReconnecting = false;
        }
      });
    }, delay);
  }

  private calculateReconnectDelay(): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.reconnectInterval || 3000;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), 30000);
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
  }

  // Heartbeat mechanism
  private startHeartbeat(): void {
    if (!this.config.heartbeatInterval) return;
    
    this.heartbeatIntervalId = setInterval(() => {
      this.send('system_ping' as WebSocketEventType, { timestamp: Date.now() });
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  // Middleware
  addMiddleware(middleware: (message: WebSocketMessage) => WebSocketMessage | null): void {
    this.middleware.push(middleware);
  }

  removeMiddleware(middleware: (message: WebSocketMessage) => WebSocketMessage | null): void {
    const index = this.middleware.indexOf(middleware);
    if (index !== -1) {
      this.middleware.splice(index, 1);
    }
  }

  // Utility methods
  // 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
  private generateMessageIdInternal(): string {
    return generateMessageId();
  }

  private generateListenerId(): string {
    return generateTempId(); // Listeners are ephemeral, use temp IDs
  }

  // 🏢 ENTERPRISE: Using unknown[] for variadic logging args
  private log(...args: unknown[]): void {
    if (this.config.enableLogging) {
      // WebSocket logging (console removed for production)
    }
  }

  // Statistics and debugging
  getStats() {
    return {
      connectionState: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      activeListeners: Array.from(this.listeners.entries()).reduce(
        (total, [, listeners]) => total + listeners.length, 0
      ),
      isReconnecting: this.isReconnecting
    };
  }

  // Cleanup
  destroy(): void {
    this.disconnect();
    this.listeners.clear();
    this.connectionListeners = [];
    this.middleware = [];
  }
}

export default WebSocketService;
