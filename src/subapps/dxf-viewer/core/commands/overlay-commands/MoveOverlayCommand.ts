/**
 * MOVE OVERLAY COMMAND
 *
 * 🏢 ENTERPRISE (2027-01-27): Command for moving entire overlays with undo support - ADR-032
 * Stores original polygon for undo (restore) operations.
 *
 * Pattern: AutoCAD/Figma - Entity movement with full undo support
 * Supports command merging for smooth drag operations.
 *
 * Note: Uses fire-and-forget async operations since ICommand interface is synchronous.
 * Firestore updates will be reflected via real-time listeners.
 *
 * @see MoveOverlayVertexCommand - For individual vertex movement
 * @see MoveEntityCommand - For DXF entity movement
 * @author Enterprise Architecture Team
 * @date 2027-01-27
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import type { Overlay } from '../../../overlays/types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';
import { deepClone } from '../../../utils/clone-utils';

/**
 * Point2D interface for delta calculation
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Overlay store interface for move operations
 * 🏢 ENTERPRISE: Type-safe interface instead of using any
 */
interface OverlayStoreMoveOperations {
  /** Get overlay by ID */
  overlays: Record<string, Overlay>;
  /** Update overlay polygon */
  update: (id: string, patch: { polygon: Array<[number, number]> }) => Promise<void>;
}

/**
 * Command for moving an entire overlay with undo support
 *
 * USAGE:
 * ```typescript
 * // Move overlay by delta (Δx, Δy)
 * const command = new MoveOverlayCommand(
 *   'overlay-123',
 *   { x: 10, y: 20 },
 *   overlayStore,
 *   true // isDragging = true for command merging
 * );
 * executeCommand(command);
 * ```
 */
export class MoveOverlayCommand implements ICommand {
  readonly id: string;
  readonly name = 'MoveOverlay';
  readonly type = 'move-overlay';
  readonly timestamp: number;

  private originalPolygon: Array<[number, number]> | null = null;
  private wasExecuted = false;

  /**
   * Constructor
   *
   * @param overlayId - ID of the overlay to move
   * @param delta - Movement delta { x: Δx, y: Δy }
   * @param overlayStore - Overlay store with operations
   * @param isDragging - Whether this is part of a drag operation (for merging)
   */
  constructor(
    private readonly overlayId: string,
    private readonly delta: Point2D,
    private readonly overlayStore: OverlayStoreMoveOperations,
    private readonly isDragging: boolean = false
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Move all vertices of the overlay by delta
   * 🏢 ENTERPRISE: Fire-and-forget async operation
   */
  execute(): void {
    const overlay = this.overlayStore.overlays[this.overlayId];
    if (!overlay) {
      console.error(`❌ MoveOverlayCommand.execute: Overlay ${this.overlayId} not found`);
      return;
    }

    // Store original polygon for undo (first execution only)
    if (!this.wasExecuted) {
      this.originalPolygon = deepClone(overlay.polygon);
    }

    // Calculate new polygon by adding delta to all vertices
    const newPolygon = overlay.polygon.map(([x, y]: [number, number]) => [
      x + this.delta.x,
      y + this.delta.y
    ] as [number, number]);

    // Update overlay with new polygon
    this.overlayStore.update(this.overlayId, {
      polygon: newPolygon
    }).catch((error: unknown) => {
      console.error('❌ MoveOverlayCommand.execute failed:', error);
    });

    this.wasExecuted = true;
    console.log(`↔️ MoveOverlayCommand: Moved overlay ${this.overlayId} by Δ(${this.delta.x}, ${this.delta.y})`);
  }

  /**
   * Undo: Restore overlay to original position
   */
  undo(): void {
    if (!this.originalPolygon || !this.wasExecuted) {
      console.warn('⚠️ MoveOverlayCommand.undo: No original polygon stored or command not executed');
      return;
    }

    this.overlayStore.update(this.overlayId, {
      polygon: this.originalPolygon
    }).catch((error: unknown) => {
      console.error('❌ MoveOverlayCommand.undo failed:', error);
    });

    console.log(`↩️ MoveOverlayCommand: Undid move for overlay ${this.overlayId}`);
  }

  /**
   * Redo: Move overlay again with the same delta
   */
  redo(): void {
    this.execute();
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Move overlay by (${this.delta.x.toFixed(2)}, ${this.delta.y.toFixed(2)})`;
  }

  /**
   * Check if can merge with another command
   * Merges consecutive moves of the same overlay within time window
   *
   * MERGE LOGIC:
   * - Same overlay ID
   * - Both commands are "dragging" operations
   * - Within merge time window (500ms)
   *
   * RESULT: Combines deltas for smooth drag with single undo
   */
  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof MoveOverlayCommand)) {
      return false;
    }

    // Must be same overlay
    if (other.overlayId !== this.overlayId) {
      return false;
    }

    // Both must be dragging operations
    if (!this.isDragging || !other.isDragging) {
      return false;
    }

    // Check time window (500ms default)
    const timeDiff = other.timestamp - this.timestamp;
    return timeDiff < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  /**
   * Merge with another move command
   * Keeps original polygon, combines deltas
   *
   * EXAMPLE:
   * - Command 1: Move by (10, 0)
   * - Command 2: Move by (5, 10)
   * - Merged: Move by (15, 10) - Single undo!
   */
  mergeWith(other: ICommand): ICommand {
    if (!(other instanceof MoveOverlayCommand)) {
      throw new Error('Cannot merge with non-MoveOverlayCommand');
    }
    const otherMove = other;

    // Combine deltas
    const combinedDelta: Point2D = {
      x: this.delta.x + otherMove.delta.x,
      y: this.delta.y + otherMove.delta.y
    };

    // Create merged command
    const merged = new MoveOverlayCommand(
      this.overlayId,
      combinedDelta,
      this.overlayStore,
      true // Keep isDragging = true
    );

    // Transfer original polygon (from first command)
    merged.originalPolygon = this.originalPolygon;
    merged.wasExecuted = this.wasExecuted;

    console.log(`🔀 MoveOverlayCommand: Merged moves for overlay ${this.overlayId} - Combined delta: (${combinedDelta.x}, ${combinedDelta.y})`);

    return merged;
  }

  /**
   * Validate command state
   * Checks if overlay exists and delta is valid
   */
  validate(): string | null {
    // Check overlay exists
    const overlay = this.overlayStore.overlays[this.overlayId];
    if (!overlay) {
      return `Overlay ${this.overlayId} not found`;
    }

    // Check delta is valid (not NaN or Infinity)
    if (!Number.isFinite(this.delta.x) || !Number.isFinite(this.delta.y)) {
      return `Invalid delta: (${this.delta.x}, ${this.delta.y})`;
    }

    return null; // Valid
  }

  /**
   * Serialize command for persistence/audit trail
   */
  serialize(): SerializedCommand {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      timestamp: this.timestamp,
      version: 1, // Command version for future compatibility
      data: {
        overlayId: this.overlayId,
        delta: this.delta,
        isDragging: this.isDragging,
        originalPolygon: this.originalPolygon
      }
    };
  }

  /**
   * Get affected entity IDs (for dependency tracking)
   */
  getAffectedEntityIds(): string[] {
    return [this.overlayId];
  }
}

/**
 * Command for moving multiple overlays at once
 *
 * USAGE:
 * ```typescript
 * // Move 3 overlays by same delta
 * const command = new MoveMultipleOverlaysCommand(
 *   ['overlay-1', 'overlay-2', 'overlay-3'],
 *   { x: 10, y: 20 },
 *   overlayStore
 * );
 * ```
 */
export class MoveMultipleOverlaysCommand implements ICommand {
  readonly id: string;
  readonly name = 'MoveMultipleOverlays';
  readonly type = 'move-multiple-overlays';
  readonly timestamp: number;

  private commands: MoveOverlayCommand[] = [];

  constructor(
    private readonly overlayIds: string[],
    private readonly delta: Point2D,
    private readonly overlayStore: OverlayStoreMoveOperations,
    private readonly isDragging: boolean = false
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();

    // Create individual move commands for each overlay
    this.commands = overlayIds.map(id =>
      new MoveOverlayCommand(id, delta, overlayStore, isDragging)
    );
  }

  execute(): void {
    this.commands.forEach(cmd => cmd.execute());
    console.log(`↔️ MoveMultipleOverlaysCommand: Moved ${this.overlayIds.length} overlays by Δ(${this.delta.x}, ${this.delta.y})`);
  }

  undo(): void {
    this.commands.forEach(cmd => cmd.undo());
  }

  redo(): void {
    this.commands.forEach(cmd => cmd.redo());
  }

  getDescription(): string {
    return `Move ${this.overlayIds.length} overlays by (${this.delta.x.toFixed(2)}, ${this.delta.y.toFixed(2)})`;
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof MoveMultipleOverlaysCommand)) {
      return false;
    }

    // Must be same set of overlays
    if (this.overlayIds.length !== other.overlayIds.length) {
      return false;
    }

    const thisIds = new Set(this.overlayIds);
    const otherIds = new Set(other.overlayIds);

    for (const id of thisIds) {
      if (!otherIds.has(id)) {
        return false;
      }
    }

    // Both must be dragging
    if (!this.isDragging || !other.isDragging) {
      return false;
    }

    // Check time window
    const timeDiff = other.timestamp - this.timestamp;
    return timeDiff < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    if (!(other instanceof MoveMultipleOverlaysCommand)) {
      throw new Error('Cannot merge with non-MoveMultipleOverlaysCommand');
    }
    const otherMove = other;

    const combinedDelta: Point2D = {
      x: this.delta.x + otherMove.delta.x,
      y: this.delta.y + otherMove.delta.y
    };

    return new MoveMultipleOverlaysCommand(
      this.overlayIds,
      combinedDelta,
      this.overlayStore,
      true
    );
  }

  serialize(): SerializedCommand {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      timestamp: this.timestamp,
      version: 1, // Command version for future compatibility
      data: {
        overlayIds: this.overlayIds,
        delta: this.delta,
        isDragging: this.isDragging
      }
    };
  }

  getAffectedEntityIds(): string[] {
    return this.overlayIds;
  }

  validate(): string | null {
    // Validate all individual commands
    for (const cmd of this.commands) {
      const error = cmd.validate();
      if (error) return error;
    }
    return null;
  }
}
