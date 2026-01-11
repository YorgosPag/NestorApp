/**
 * 🏢 ENTERPRISE: Optimistic Updates System
 *
 * Provides optimistic UI updates for entity linking operations.
 * Follows React Query and Apollo Client patterns for instant feedback.
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 * @pattern Optimistic Update Pattern (React Query, Apollo Client)
 *
 * @example
 * ```typescript
 * import { OptimisticUpdateManager } from './optimistic';
 *
 * const manager = new OptimisticUpdateManager();
 *
 * // Start optimistic update
 * const rollback = manager.apply({
 *   id: 'building123',
 *   previousState: { projectId: null },
 *   optimisticState: { projectId: 'project456' },
 *   onRollback: (prev) => setState(prev),
 * });
 *
 * // If operation fails, rollback
 * rollback();
 * ```
 */

import type { EntityType } from '../types';
import { generateOptimisticId } from '@/services/enterprise-id.service';

// ============================================================================
// 🏢 ENTERPRISE: Optimistic Update Types
// ============================================================================

/**
 * State snapshot for rollback
 */
export interface StateSnapshot<T = unknown> {
  /** Unique identifier for this snapshot */
  readonly id: string;
  /** Entity type */
  readonly entityType: EntityType;
  /** Entity ID */
  readonly entityId: string;
  /** Previous state before optimistic update */
  readonly previousState: T;
  /** Optimistic state applied */
  readonly optimisticState: T;
  /** Timestamp when snapshot was created */
  readonly timestamp: number;
  /** Whether this update has been confirmed */
  confirmed: boolean;
  /** Whether this update has been rolled back */
  rolledBack: boolean;
}

/**
 * Parameters for applying an optimistic update
 */
export interface OptimisticUpdateParams<T = unknown> {
  /** Entity type */
  readonly entityType: EntityType;
  /** Entity ID */
  readonly entityId: string;
  /** Previous state to save for rollback */
  readonly previousState: T;
  /** Optimistic state to apply immediately */
  readonly optimisticState: T;
  /** Callback to apply state change */
  readonly onApply?: (state: T) => void;
  /** Callback for rollback */
  readonly onRollback?: (previousState: T) => void;
  /** Callback when confirmed */
  readonly onConfirm?: (state: T) => void;
}

/**
 * Result of applying an optimistic update
 */
export interface OptimisticUpdateResult {
  /** Unique update ID */
  readonly updateId: string;
  /** Function to rollback this update */
  readonly rollback: () => void;
  /** Function to confirm this update */
  readonly confirm: () => void;
  /** Check if already rolled back */
  readonly isRolledBack: () => boolean;
  /** Check if already confirmed */
  readonly isConfirmed: () => boolean;
}

// ============================================================================
// 🏢 ENTERPRISE: Optimistic Update Manager
// ============================================================================

/**
 * 🔄 Optimistic Update Manager
 *
 * Manages optimistic updates for entity linking operations.
 *
 * Features:
 * - Automatic rollback on failure
 * - State snapshot management
 * - Confirmation tracking
 * - Pending update queue
 */
export class OptimisticUpdateManager {
  private snapshots = new Map<string, StateSnapshot>();
  private pendingCount = 0;

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * 🚀 Apply an optimistic update
   *
   * @param params - Update parameters
   * @returns Control object for rollback/confirm
   *
   * @example
   * ```typescript
   * const { rollback, confirm } = manager.apply({
   *   entityType: 'building',
   *   entityId: 'building123',
   *   previousState: { projectId: null },
   *   optimisticState: { projectId: 'project456' },
   *   onApply: (state) => updateUI(state),
   *   onRollback: (prev) => updateUI(prev),
   * });
   *
   * try {
   *   await serverOperation();
   *   confirm();
   * } catch {
   *   rollback();
   * }
   * ```
   */
  apply<T>(params: OptimisticUpdateParams<T>): OptimisticUpdateResult {
    const updateId = this.generateUpdateId();

    // Create snapshot
    const snapshot: StateSnapshot<T> = {
      id: updateId,
      entityType: params.entityType,
      entityId: params.entityId,
      previousState: params.previousState,
      optimisticState: params.optimisticState,
      timestamp: Date.now(),
      confirmed: false,
      rolledBack: false,
    };

    // Store snapshot
    this.snapshots.set(updateId, snapshot as StateSnapshot);
    this.pendingCount++;

    // Apply optimistic state immediately
    if (params.onApply) {
      params.onApply(params.optimisticState);
    }

    console.log(
      `🚀 [OptimisticUpdate] Applied: ${params.entityType}:${params.entityId} (${updateId})`
    );

    // Return control object
    return {
      updateId,
      rollback: () => this.rollback(updateId, params.onRollback),
      confirm: () => this.confirm(updateId, params.onConfirm),
      isRolledBack: () => snapshot.rolledBack,
      isConfirmed: () => snapshot.confirmed,
    };
  }

  /**
   * 🔙 Rollback an optimistic update
   *
   * @param updateId - The update ID to rollback
   * @param callback - Optional callback with previous state
   */
  rollback<T>(updateId: string, callback?: (previousState: T) => void): boolean {
    const snapshot = this.snapshots.get(updateId) as StateSnapshot<T> | undefined;

    if (!snapshot) {
      console.warn(`⚠️ [OptimisticUpdate] Snapshot not found: ${updateId}`);
      return false;
    }

    if (snapshot.confirmed) {
      console.warn(`⚠️ [OptimisticUpdate] Cannot rollback confirmed update: ${updateId}`);
      return false;
    }

    if (snapshot.rolledBack) {
      console.warn(`⚠️ [OptimisticUpdate] Already rolled back: ${updateId}`);
      return false;
    }

    // Mark as rolled back
    snapshot.rolledBack = true;
    this.pendingCount = Math.max(0, this.pendingCount - 1);

    // Execute rollback callback
    if (callback) {
      callback(snapshot.previousState);
    }

    console.log(
      `🔙 [OptimisticUpdate] Rolled back: ${snapshot.entityType}:${snapshot.entityId} (${updateId})`
    );

    // Clean up after short delay
    setTimeout(() => {
      this.snapshots.delete(updateId);
    }, 5000);

    return true;
  }

  /**
   * ✅ Confirm an optimistic update
   *
   * @param updateId - The update ID to confirm
   * @param callback - Optional callback with confirmed state
   */
  confirm<T>(updateId: string, callback?: (state: T) => void): boolean {
    const snapshot = this.snapshots.get(updateId) as StateSnapshot<T> | undefined;

    if (!snapshot) {
      console.warn(`⚠️ [OptimisticUpdate] Snapshot not found: ${updateId}`);
      return false;
    }

    if (snapshot.rolledBack) {
      console.warn(`⚠️ [OptimisticUpdate] Cannot confirm rolled back update: ${updateId}`);
      return false;
    }

    if (snapshot.confirmed) {
      console.warn(`⚠️ [OptimisticUpdate] Already confirmed: ${updateId}`);
      return true;
    }

    // Mark as confirmed
    snapshot.confirmed = true;
    this.pendingCount = Math.max(0, this.pendingCount - 1);

    // Execute confirm callback
    if (callback) {
      callback(snapshot.optimisticState);
    }

    console.log(
      `✅ [OptimisticUpdate] Confirmed: ${snapshot.entityType}:${snapshot.entityId} (${updateId})`
    );

    // Clean up after short delay
    setTimeout(() => {
      this.snapshots.delete(updateId);
    }, 5000);

    return true;
  }

  /**
   * Get pending update count
   */
  getPendingCount(): number {
    return this.pendingCount;
  }

  /**
   * Check if there are pending updates
   */
  hasPendingUpdates(): boolean {
    return this.pendingCount > 0;
  }

  /**
   * Get all pending snapshots
   */
  getPendingSnapshots(): StateSnapshot[] {
    return Array.from(this.snapshots.values()).filter(
      (s) => !s.confirmed && !s.rolledBack
    );
  }

  /**
   * Rollback all pending updates
   */
  rollbackAll(): number {
    let rolledBackCount = 0;

    for (const [updateId, snapshot] of this.snapshots) {
      if (!snapshot.confirmed && !snapshot.rolledBack) {
        this.rollback(updateId);
        rolledBackCount++;
      }
    }

    console.log(`🔙 [OptimisticUpdate] Rolled back all: ${rolledBackCount} updates`);
    return rolledBackCount;
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots.clear();
    this.pendingCount = 0;
    console.log('🧹 [OptimisticUpdate] Cleared all snapshots');
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Generate unique update ID
   * 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
   */
  private generateUpdateId(): string {
    return generateOptimisticId();
  }
}

// ============================================================================
// 🏢 ENTERPRISE: React Hook Helper Types
// ============================================================================

/**
 * State for useOptimisticUpdate hook
 */
export interface OptimisticState<T> {
  /** Current state (may be optimistic) */
  readonly current: T;
  /** Whether there's an optimistic update in progress */
  readonly isPending: boolean;
  /** Apply optimistic update */
  readonly apply: (newState: T) => OptimisticUpdateResult;
  /** Check if current state is optimistic */
  readonly isOptimistic: boolean;
}

/**
 * Create optimistic state helpers for entity linking
 */
export function createOptimisticHelpers<T>(
  manager: OptimisticUpdateManager,
  entityType: EntityType,
  entityId: string
): {
  applyUpdate: (previousState: T, optimisticState: T) => OptimisticUpdateResult;
  withOptimisticUpdate: <R>(
    previousState: T,
    optimisticState: T,
    operation: () => Promise<R>
  ) => Promise<R>;
} {
  return {
    /**
     * Apply an optimistic update
     */
    applyUpdate: (previousState: T, optimisticState: T) => {
      return manager.apply({
        entityType,
        entityId,
        previousState,
        optimisticState,
      });
    },

    /**
     * Wrap an async operation with optimistic update
     */
    withOptimisticUpdate: async <R>(
      previousState: T,
      optimisticState: T,
      operation: () => Promise<R>
    ): Promise<R> => {
      const { rollback, confirm } = manager.apply({
        entityType,
        entityId,
        previousState,
        optimisticState,
      });

      try {
        const result = await operation();
        confirm();
        return result;
      } catch (error) {
        rollback();
        throw error;
      }
    },
  };
}

// ============================================================================
// 🏢 ENTERPRISE: Singleton Instance
// ============================================================================

/**
 * Global optimistic update manager instance
 */
export const optimisticUpdateManager = new OptimisticUpdateManager();

// Default export
export default OptimisticUpdateManager;
