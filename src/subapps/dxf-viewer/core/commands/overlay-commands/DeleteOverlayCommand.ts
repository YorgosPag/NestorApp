/**
 * DELETE OVERLAY COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-26): Command for deleting overlays with undo support - ADR-032
 * Stores overlay snapshot for undo (restore) operations.
 *
 * Pattern: SAP/Salesforce/Autodesk - Soft delete with restore capability
 *
 * Note: Uses fire-and-forget async operations since ICommand interface is synchronous.
 * Firestore updates will be reflected via real-time listeners.
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import type { Overlay } from '../../../overlays/types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';

/**
 * Overlay store interface for command operations
 * 🏢 ENTERPRISE: Type-safe interface instead of using any
 */
interface OverlayStoreOperations {
  /** Get overlay by ID */
  overlays: Record<string, Overlay>;
  /** Remove overlay from store */
  remove: (id: string) => Promise<void>;
  /** Restore overlay to store */
  restore: (overlay: Overlay) => Promise<void>;
}

/**
 * Command for deleting a single overlay with undo support
 */
export class DeleteOverlayCommand implements ICommand {
  readonly id: string;
  readonly name = 'DeleteOverlay';
  readonly type = 'delete-overlay';
  readonly timestamp: number;

  private overlaySnapshot: Overlay | null = null;
  private wasExecuted = false;

  constructor(
    private readonly overlayId: string,
    private readonly overlayStore: OverlayStoreOperations
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Store snapshot and remove overlay
   * 🏢 ENTERPRISE: Fire-and-forget async operation
   */
  execute(): void {
    // Store snapshot before deletion (for undo)
    const overlay = this.overlayStore.overlays[this.overlayId];
    if (overlay) {
      // Deep clone the overlay
      this.overlaySnapshot = deepClone(overlay);

      // Fire-and-forget async operation
      // Firestore real-time listener will update UI
      this.overlayStore.remove(this.overlayId).catch((error: unknown) => {
        console.error('❌ DeleteOverlayCommand.execute failed:', error);
      });

      this.wasExecuted = true;
      console.log(`🗑️ DeleteOverlayCommand: Executed for overlay ${this.overlayId}`);
    }
  }

  /**
   * Undo: Restore the overlay
   * 🏢 ENTERPRISE: Uses restore() method to recreate with original ID
   */
  undo(): void {
    if (this.overlaySnapshot && this.wasExecuted) {
      // Fire-and-forget async operation
      this.overlayStore.restore(this.overlaySnapshot).catch((error: unknown) => {
        console.error('❌ DeleteOverlayCommand.undo failed:', error);
      });

      console.log(`↩️ DeleteOverlayCommand: Undo - restored overlay ${this.overlayId}`);
    }
  }

  /**
   * Redo: Remove the overlay again
   */
  redo(): void {
    if (this.overlaySnapshot) {
      // Fire-and-forget async operation
      this.overlayStore.remove(this.overlaySnapshot.id).catch((error: unknown) => {
        console.error('❌ DeleteOverlayCommand.redo failed:', error);
      });

      console.log(`↪️ DeleteOverlayCommand: Redo - deleted overlay ${this.overlayId}`);
    }
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    const label = this.overlaySnapshot?.label;
    const kind = this.overlaySnapshot?.kind ?? 'overlay';
    return label ? `Delete ${kind} "${label}"` : `Delete ${kind}`;
  }

  /**
   * Delete commands cannot be merged
   */
  canMergeWith(): boolean {
    return false;
  }

  /**
   * 🏢 ENTERPRISE: Serialize for persistence
   */
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        overlayId: this.overlayId,
        overlaySnapshot: this.overlaySnapshot,
      },
      version: 1,
    };
  }

  /**
   * 🏢 ENTERPRISE: Get affected entity IDs
   */
  getAffectedEntityIds(): string[] {
    return [this.overlayId];
  }

  /**
   * Validate command can be executed
   */
  validate(): string | null {
    if (!this.overlayId) {
      return 'Overlay ID is required';
    }
    if (!this.overlayStore.overlays[this.overlayId]) {
      return `Overlay ${this.overlayId} not found`;
    }
    return null;
  }

  /**
   * Get the overlay snapshot (for debugging/inspection)
   */
  getOverlaySnapshot(): Overlay | null {
    return this.overlaySnapshot ? { ...this.overlaySnapshot } : null;
  }
}

/**
 * Command for deleting multiple overlays at once with undo support
 * 🏢 ENTERPRISE: Batch delete with atomic undo
 */
export class DeleteMultipleOverlaysCommand implements ICommand {
  readonly id: string;
  readonly name = 'DeleteMultipleOverlays';
  readonly type = 'delete-multiple-overlays';
  readonly timestamp: number;

  private overlaySnapshots: Overlay[] = [];
  private wasExecuted = false;

  constructor(
    private readonly overlayIds: string[],
    private readonly overlayStore: OverlayStoreOperations
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Store snapshots and remove all overlays
   */
  execute(): void {
    this.overlaySnapshots = [];

    for (const overlayId of this.overlayIds) {
      const overlay = this.overlayStore.overlays[overlayId];
      if (overlay) {
        // Deep clone the overlay
        this.overlaySnapshots.push(deepClone(overlay));

        // Fire-and-forget async operation
        this.overlayStore.remove(overlayId).catch((error: unknown) => {
          console.error(`❌ DeleteMultipleOverlaysCommand.execute failed for ${overlayId}:`, error);
        });
      }
    }

    this.wasExecuted = this.overlaySnapshots.length > 0;
    console.log(`🗑️ DeleteMultipleOverlaysCommand: Executed for ${this.overlaySnapshots.length} overlays`);
  }

  /**
   * Undo: Restore all overlays
   */
  undo(): void {
    if (this.wasExecuted) {
      for (const overlay of this.overlaySnapshots) {
        // Fire-and-forget async operation
        this.overlayStore.restore(overlay).catch((error: unknown) => {
          console.error(`❌ DeleteMultipleOverlaysCommand.undo failed for ${overlay.id}:`, error);
        });
      }

      console.log(`↩️ DeleteMultipleOverlaysCommand: Undo - restored ${this.overlaySnapshots.length} overlays`);
    }
  }

  /**
   * Redo: Remove all overlays again
   */
  redo(): void {
    for (const overlay of this.overlaySnapshots) {
      // Fire-and-forget async operation
      this.overlayStore.remove(overlay.id).catch((error: unknown) => {
        console.error(`❌ DeleteMultipleOverlaysCommand.redo failed for ${overlay.id}:`, error);
      });
    }

    console.log(`↪️ DeleteMultipleOverlaysCommand: Redo - deleted ${this.overlaySnapshots.length} overlays`);
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Delete ${this.overlaySnapshots.length} overlays`;
  }

  /**
   * Delete commands cannot be merged
   */
  canMergeWith(): boolean {
    return false;
  }

  /**
   * 🏢 ENTERPRISE: Serialize for persistence
   */
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        overlayIds: this.overlayIds,
        overlaySnapshots: this.overlaySnapshots,
      },
      version: 1,
    };
  }

  /**
   * 🏢 ENTERPRISE: Get affected entity IDs
   */
  getAffectedEntityIds(): string[] {
    return [...this.overlayIds];
  }

  /**
   * Validate command can be executed
   */
  validate(): string | null {
    if (!this.overlayIds || this.overlayIds.length === 0) {
      return 'At least one overlay ID is required';
    }
    return null;
  }
}
