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

import type { Overlay } from '../../../overlays/types';
import { BaseCommand } from '../base-command';
import { deepClone } from '../../../utils/clone-utils';
import { dlog, derr } from '../../../debug';

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
export class DeleteOverlayCommand extends BaseCommand {
  readonly name = 'DeleteOverlay';
  readonly type = 'delete-overlay';

  private overlaySnapshot: Overlay | null = null;
  private wasExecuted = false;

  constructor(
    private readonly overlayId: string,
    private readonly overlayStore: OverlayStoreOperations
  ) {
    super();
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
        derr('Commands', 'DeleteOverlayCommand.execute failed:', error);
      });

      this.wasExecuted = true;
      dlog('Commands', `DeleteOverlayCommand: Executed for overlay ${this.overlayId}`);
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
        derr('Commands', 'DeleteOverlayCommand.undo failed:', error);
      });

      dlog('Commands', `DeleteOverlayCommand: Undo - restored overlay ${this.overlayId}`);
    }
  }

  /**
   * Redo: Remove the overlay again
   */
  redo(): void {
    if (this.overlaySnapshot) {
      // Fire-and-forget async operation
      this.overlayStore.remove(this.overlaySnapshot.id).catch((error: unknown) => {
        derr('Commands', 'DeleteOverlayCommand.redo failed:', error);
      });

      dlog('Commands', `DeleteOverlayCommand: Redo - deleted overlay ${this.overlayId}`);
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
   * 🏢 ENTERPRISE: Serialized `data` payload.
   */
  protected serializeData(): Record<string, unknown> {
    return {
      overlayId: this.overlayId,
      overlaySnapshot: this.overlaySnapshot,
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
export class DeleteMultipleOverlaysCommand extends BaseCommand {
  readonly name = 'DeleteMultipleOverlays';
  readonly type = 'delete-multiple-overlays';

  private overlaySnapshots: Overlay[] = [];
  private wasExecuted = false;

  constructor(
    private readonly overlayIds: string[],
    private readonly overlayStore: OverlayStoreOperations
  ) {
    super();
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
          derr('Commands', `DeleteMultipleOverlaysCommand.execute failed for ${overlayId}:`, error);
        });
      }
    }

    this.wasExecuted = this.overlaySnapshots.length > 0;
    dlog('Commands', `DeleteMultipleOverlaysCommand: Executed for ${this.overlaySnapshots.length} overlays`);
  }

  /**
   * Undo: Restore all overlays
   */
  undo(): void {
    if (this.wasExecuted) {
      for (const overlay of this.overlaySnapshots) {
        // Fire-and-forget async operation
        this.overlayStore.restore(overlay).catch((error: unknown) => {
          derr('Commands', `DeleteMultipleOverlaysCommand.undo failed for ${overlay.id}:`, error);
        });
      }

      dlog('Commands', `DeleteMultipleOverlaysCommand: Undo - restored ${this.overlaySnapshots.length} overlays`);
    }
  }

  /**
   * Redo: Remove all overlays again
   */
  redo(): void {
    for (const overlay of this.overlaySnapshots) {
      // Fire-and-forget async operation
      this.overlayStore.remove(overlay.id).catch((error: unknown) => {
        derr('Commands', `DeleteMultipleOverlaysCommand.redo failed for ${overlay.id}:`, error);
      });
    }

    dlog('Commands', `DeleteMultipleOverlaysCommand: Redo - deleted ${this.overlaySnapshots.length} overlays`);
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Delete ${this.overlaySnapshots.length} overlays`;
  }

  /**
   * 🏢 ENTERPRISE: Serialized `data` payload.
   */
  protected serializeData(): Record<string, unknown> {
    return {
      overlayIds: this.overlayIds,
      overlaySnapshots: this.overlaySnapshots,
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
