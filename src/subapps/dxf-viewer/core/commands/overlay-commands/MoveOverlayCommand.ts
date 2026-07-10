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

import type { ICommand } from '../interfaces';
import type { Overlay } from '../../../overlays/types';
import { DragVertexEditCommand } from '../drag-vertex-edit-command';
import { deepClone } from '../../../utils/clone-utils';
import { dlog, dwarn, derr } from '../../../debug';

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
export class MoveOverlayCommand extends DragVertexEditCommand<MoveOverlayCommand> {
  readonly name = 'MoveOverlay';
  readonly type = 'move-overlay';

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
    isDragging: boolean = false
  ) {
    super(isDragging);
  }

  /**
   * Execute: Move all vertices of the overlay by delta
   * 🏢 ENTERPRISE: Fire-and-forget async operation
   */
  execute(): void {
    const overlay = this.overlayStore.overlays[this.overlayId];
    if (!overlay) {
      derr('Commands', `❌ MoveOverlayCommand.execute: Overlay ${this.overlayId} not found`);
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
      derr('Commands', '❌ MoveOverlayCommand.execute failed:', error);
    });

    this.wasExecuted = true;
    dlog('Commands', `↔️ MoveOverlayCommand: Moved overlay ${this.overlayId} by Δ(${this.delta.x}, ${this.delta.y})`);
  }

  /**
   * Undo: Restore overlay to original position
   */
  undo(): void {
    if (!this.originalPolygon || !this.wasExecuted) {
      dwarn('Commands', '⚠️ MoveOverlayCommand.undo: No original polygon stored or command not executed');
      return;
    }

    this.overlayStore.update(this.overlayId, {
      polygon: this.originalPolygon
    }).catch((error: unknown) => {
      derr('Commands', '❌ MoveOverlayCommand.undo failed:', error);
    });

    dlog('Commands', `↩️ MoveOverlayCommand: Undid move for overlay ${this.overlayId}`);
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Move overlay by (${this.delta.x.toFixed(2)}, ${this.delta.y.toFixed(2)})`;
  }

  protected isSameCommand(other: ICommand): other is MoveOverlayCommand {
    return other instanceof MoveOverlayCommand;
  }

  protected sameTarget(other: MoveOverlayCommand): boolean {
    return other.overlayId === this.overlayId;
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
  protected cloneForMerge(latest: MoveOverlayCommand): ICommand {
    // Combine deltas
    const combinedDelta: Point2D = {
      x: this.delta.x + latest.delta.x,
      y: this.delta.y + latest.delta.y
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

    dlog('Commands', `🔀 MoveOverlayCommand: Merged moves for overlay ${this.overlayId} - Combined delta: (${combinedDelta.x}, ${combinedDelta.y})`);

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
   * Serialized `data` payload for persistence/audit trail
   */
  protected serializeData(): Record<string, unknown> {
    return {
      overlayId: this.overlayId,
      delta: this.delta,
      isDragging: this.isDragging,
      originalPolygon: this.originalPolygon
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
export class MoveMultipleOverlaysCommand extends DragVertexEditCommand<MoveMultipleOverlaysCommand> {
  readonly name = 'MoveMultipleOverlays';
  readonly type = 'move-multiple-overlays';

  private commands: MoveOverlayCommand[] = [];

  constructor(
    private readonly overlayIds: string[],
    private readonly delta: Point2D,
    private readonly overlayStore: OverlayStoreMoveOperations,
    isDragging: boolean = false
  ) {
    super(isDragging);

    // Create individual move commands for each overlay
    this.commands = overlayIds.map(id =>
      new MoveOverlayCommand(id, delta, overlayStore, isDragging)
    );
  }

  execute(): void {
    this.commands.forEach(cmd => cmd.execute());
    dlog('Commands', `↔️ MoveMultipleOverlaysCommand: Moved ${this.overlayIds.length} overlays by Δ(${this.delta.x}, ${this.delta.y})`);
  }

  undo(): void {
    this.commands.forEach(cmd => cmd.undo());
  }

  getDescription(): string {
    return `Move ${this.overlayIds.length} overlays by (${this.delta.x.toFixed(2)}, ${this.delta.y.toFixed(2)})`;
  }

  protected isSameCommand(other: ICommand): other is MoveMultipleOverlaysCommand {
    return other instanceof MoveMultipleOverlaysCommand;
  }

  protected sameTarget(other: MoveMultipleOverlaysCommand): boolean {
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

    return true;
  }

  protected cloneForMerge(latest: MoveMultipleOverlaysCommand): ICommand {
    const combinedDelta: Point2D = {
      x: this.delta.x + latest.delta.x,
      y: this.delta.y + latest.delta.y
    };

    return new MoveMultipleOverlaysCommand(
      this.overlayIds,
      combinedDelta,
      this.overlayStore,
      true
    );
  }

  /**
   * Serialized `data` payload for persistence/audit trail
   */
  protected serializeData(): Record<string, unknown> {
    return {
      overlayIds: this.overlayIds,
      delta: this.delta,
      isDragging: this.isDragging
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
