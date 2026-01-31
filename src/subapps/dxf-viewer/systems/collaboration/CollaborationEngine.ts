/**
 * @module CollaborationEngine
 * @description Real-time collaboration system για conference demo
 * Multi-user editing με presence indicators και conflict resolution
 * INNOVATION: Live cursor sharing και collaborative drawing
 */

import { EventEmitter } from 'events';
import type { Point2D } from '../../rendering/types/Types';
import { UI_COLORS } from '../../config/color-config';
import { generateUserId, generateOperationId as generateEnterpriseOperationId } from '@/services/enterprise-id.service';
// 🏢 ADR-098: Centralized Timing Constants
import { COLLABORATION_TIMING } from '../../config/timing-config';

/**
 * User presence data
 */
export interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor: Point2D;
  isActive: boolean;
  isDrawing: boolean;
  selectedTool?: string;
  lastActivity: Date;
  avatar?: string;
}

/**
 * Entity operation data
 */
export interface EntityOperationData {
  position?: Point2D;
  properties?: Record<string, unknown>;
  geometry?: unknown;
  style?: Record<string, unknown>;
}

/**
 * Collaborative operation
 */
export interface CollabOperation {
  id: string;
  userId: string;
  type: 'create' | 'update' | 'delete' | 'select';
  entityId: string;
  data: EntityOperationData;
  timestamp: Date;
  conflictResolution?: 'merge' | 'override' | 'reject';
}

/**
 * Conflict resolution strategies
 */
export enum ConflictStrategy {
  LAST_WRITE_WINS = 'last-write-wins',
  MERGE = 'merge',
  OPERATIONAL_TRANSFORM = 'operational-transform',
  USER_CHOICE = 'user-choice'
}

/**
 * Collaboration state
 */
interface CollaborationState {
  sessionId: string;
  users: Map<string, UserPresence>;
  operations: CollabOperation[];
  conflicts: CollabOperation[];
  isConnected: boolean;
}

/**
 * Main Collaboration Engine
 */
export class CollaborationEngine extends EventEmitter {
  private static instance: CollaborationEngine;

  private state: CollaborationState = {
    sessionId: '',
    users: new Map(),
    operations: [],
    conflicts: [],
    isConnected: false
  };

  private currentUserId: string = '';
  private userColor: string = '';
  private conflictStrategy = ConflictStrategy.OPERATIONAL_TRANSFORM;

  // Mock WebSocket για demo
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.generateUserId();
    this.generateUserColor();
  }

  static getInstance(): CollaborationEngine {
    if (!CollaborationEngine.instance) {
      CollaborationEngine.instance = new CollaborationEngine();
    }
    return CollaborationEngine.instance;
  }

  /**
   * Connect to collaboration session
   */
  async connect(sessionId: string): Promise<void> {
    this.state.sessionId = sessionId;

    // Mock connection για demo
    // 🏢 ADR-098: Using COLLABORATION_TIMING.CONNECTION_DELAY
    return new Promise((resolve) => {
      setTimeout(() => {
        this.state.isConnected = true;
        this.emit('connected', sessionId);

        // Add mock users για demo
        this.addMockUsers();

        resolve();
      }, COLLABORATION_TIMING.CONNECTION_DELAY);
    });
  }

  /**
   * Disconnect από session
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.state.isConnected = false;
    this.state.users.clear();
    this.emit('disconnected');
  }

  /**
   * Send user cursor position
   */
  updateCursor(position: Point2D): void {
    if (!this.state.isConnected) return;

    const presence: UserPresence = {
      id: this.currentUserId,
      name: this.getUserName(),
      color: this.userColor,
      cursor: position,
      isActive: true,
      isDrawing: false,
      lastActivity: new Date()
    };

    this.broadcastPresence(presence);
  }

  /**
   * Send operation to other users
   */
  sendOperation(operation: Omit<CollabOperation, 'id' | 'timestamp'>): void {
    if (!this.state.isConnected) return;

    const op: CollabOperation = {
      ...operation,
      id: this.generateOperationId(),
      userId: this.currentUserId,
      timestamp: new Date()
    };

    // Check για conflicts
    const conflict = this.detectConflict(op);
    if (conflict) {
      this.resolveConflict(op, conflict);
    } else {
      this.applyOperation(op);
    }

    this.broadcastOperation(op);
  }

  /**
   * Detect conflicts με other operations
   */
  private detectConflict(op: CollabOperation): CollabOperation | null {
    // Find recent operations on same entity
    const recentOps = this.state.operations.filter(
      o => o.entityId === op.entityId &&
           o.userId !== op.userId &&
           Date.now() - o.timestamp.getTime() < 1000 // Within 1 second
    );

    return recentOps.length > 0 ? recentOps[0] : null;
  }

  /**
   * Resolve conflict using selected strategy
   */
  private resolveConflict(op1: CollabOperation, op2: CollabOperation): void {
    switch (this.conflictStrategy) {
      case ConflictStrategy.LAST_WRITE_WINS:
        // Latest operation wins
        const winner = op1.timestamp > op2.timestamp ? op1 : op2;
        this.applyOperation(winner);
        break;

      case ConflictStrategy.MERGE:
        // Merge both operations
        const merged = this.mergeOperations(op1, op2);
        this.applyOperation(merged);
        break;

      case ConflictStrategy.OPERATIONAL_TRANSFORM:
        // Transform operations για consistency
        const transformed = this.transformOperation(op1, op2);
        this.applyOperation(transformed);
        break;

      case ConflictStrategy.USER_CHOICE:
        // Add to conflicts για user resolution
        this.state.conflicts.push(op1, op2);
        this.emit('conflict', { op1, op2 });
        break;
    }
  }

  /**
   * Merge two operations
   */
  private mergeOperations(op1: CollabOperation, op2: CollabOperation): CollabOperation {
    // Simplified merge - in reality would be more sophisticated
    return {
      ...op1,
      data: { ...op2.data, ...op1.data },
      conflictResolution: 'merge'
    };
  }

  /**
   * Operational transformation
   */
  private transformOperation(op1: CollabOperation, op2: CollabOperation): CollabOperation {
    // Simplified OT - actual implementation would be complex
    if (op1.type === 'update' && op2.type === 'update') {
      // Transform updates to avoid conflicts
      return {
        ...op1,
        data: this.transformData(op1.data, op2.data),
        conflictResolution: 'merge'
      };
    }

    return op1;
  }

  /**
   * Transform data για OT
   */
  private transformData(data1: EntityOperationData, data2: EntityOperationData): EntityOperationData {
    // Simplified transformation
    const result = { ...data2 } as Record<string, unknown>;
    const d1 = data1 as Record<string, unknown>;

    for (const key in data1) {
      if (!(key in data2)) {
        result[key] = d1[key];
      }
    }

    return result as EntityOperationData;
  }

  /**
   * Apply operation locally
   */
  private applyOperation(op: CollabOperation): void {
    this.state.operations.push(op);

    // Keep only last 100 operations
    if (this.state.operations.length > 100) {
      this.state.operations = this.state.operations.slice(-100);
    }

    this.emit('operation', op);
  }

  /**
   * Broadcast presence to other users
   */
  private broadcastPresence(presence: UserPresence): void {
    // In real implementation, send via WebSocket
    this.emit('presence', presence);
  }

  /**
   * Broadcast operation to other users
   */
  private broadcastOperation(op: CollabOperation): void {
    // In real implementation, send via WebSocket
    this.emit('broadcast-operation', op);
  }

  /**
   * Get all active users
   */
  getActiveUsers(): UserPresence[] {
    const now = Date.now();
    return Array.from(this.state.users.values()).filter(
      user => now - user.lastActivity.getTime() < 30000 // Active in last 30 seconds
    );
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): UserPresence | undefined {
    return this.state.users.get(userId);
  }

  /**
   * Get recent operations
   */
  getRecentOperations(limit = 10): CollabOperation[] {
    return this.state.operations.slice(-limit);
  }

  /**
   * Get conflict count
   */
  getConflictCount(): number {
    return this.state.conflicts.length;
  }

  /**
   * Set conflict resolution strategy
   */
  setConflictStrategy(strategy: ConflictStrategy): void {
    this.conflictStrategy = strategy;
  }

  /**
   * Helper methods
   * 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
   */
  private generateUserId(): void {
    this.currentUserId = generateUserId();
  }

  private generateUserColor(): void {
    const colors = [
      UI_COLORS.COLLAB_USER_1, UI_COLORS.COLLAB_USER_2, UI_COLORS.COLLAB_USER_3, UI_COLORS.COLLAB_USER_4,
      UI_COLORS.COLLAB_USER_5, UI_COLORS.COLLAB_USER_6, UI_COLORS.COLLAB_USER_7, UI_COLORS.COLLAB_USER_8
    ];
    // Random color selection (crypto not required for UI color)
    this.userColor = colors[Math.floor(Math.random() * colors.length)];
  }

  // 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
  private generateOperationId(): string {
    return generateEnterpriseOperationId();
  }

  private getUserName(): string {
    return `User ${this.currentUserId.substr(-4)}`;
  }

  /**
   * Add mock users για demo
   */
  private addMockUsers(): void {
    const mockUsers: UserPresence[] = [
      {
        id: 'user-alice',
        name: 'Alice',
        color: UI_COLORS.COLLAB_USER_1,
        cursor: { x: 100, y: 100 },
        isActive: true,
        isDrawing: false,
        selectedTool: 'line',
        lastActivity: new Date(),
        avatar: '👩'
      },
      {
        id: 'user-bob',
        name: 'Bob',
        color: UI_COLORS.COLLAB_USER_2,
        cursor: { x: 200, y: 150 },
        isActive: true,
        isDrawing: true,
        selectedTool: 'circle',
        lastActivity: new Date(),
        avatar: '👨'
      },
      {
        id: 'user-charlie',
        name: 'Charlie',
        color: UI_COLORS.COLLAB_USER_3,
        cursor: { x: 300, y: 200 },
        isActive: true,
        isDrawing: false,
        selectedTool: 'rectangle',
        lastActivity: new Date(),
        avatar: '🧑'
      }
    ];

    mockUsers.forEach(user => {
      this.state.users.set(user.id, user);
    });

    // Simulate cursor movements
    // 🏢 ADR-098: Using COLLABORATION_TIMING.CURSOR_UPDATE_INTERVAL
    setInterval(() => {
      this.state.users.forEach(user => {
        if (user.id !== this.currentUserId) {
          user.cursor.x += (Math.random() - 0.5) * 20;
          user.cursor.y += (Math.random() - 0.5) * 20;
          this.emit('cursor-update', user);
        }
      });
    }, COLLABORATION_TIMING.CURSOR_UPDATE_INTERVAL);
  }

  /**
   * Get collaboration stats για demo
   */
  getStats(): {
    activeUsers: number;
    totalOperations: number;
    conflictsResolved: number;
    sessionUptime: number;
  } {
    return {
      activeUsers: this.getActiveUsers().length,
      totalOperations: this.state.operations.length,
      conflictsResolved: this.state.operations.filter(
        op => op.conflictResolution !== undefined
      ).length,
      sessionUptime: Date.now() // Mock
    };
  }
}