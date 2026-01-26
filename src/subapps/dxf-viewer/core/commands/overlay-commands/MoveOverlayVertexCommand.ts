/**
 * MOVE OVERLAY VERTEX COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-26): Command for moving overlay vertices with undo support - ADR-032
 * Stores original position for undo (restore) operations.
 *
 * Pattern: AutoCAD/Figma - Vertex editing with full undo support
 * Supports command merging for smooth drag operations.
 *
 * Note: Uses fire-and-forget async operations since ICommand interface is synchronous.
 * Firestore updates will be reflected via real-time listeners.
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import type { Overlay } from '../../../overlays/types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

/**
 * Overlay store interface for vertex operations
 * 🏢 ENTERPRISE: Type-safe interface instead of using any
 */
interface OverlayStoreVertexOperations {
  /** Get overlay by ID */
  overlays: Record<string, Overlay>;
  /** Update vertex position in overlay polygon */
  updateVertex: (id: string, vertexIndex: number, newPosition: [number, number]) => Promise<void>;
}

/**
 * Vertex movement data
 */
export interface VertexMovement {
  overlayId: string;
  vertexIndex: number;
  oldPosition: [number, number];
  newPosition: [number, number];
}

/**
 * Command for moving a single vertex in an overlay with undo support
 */
export class MoveOverlayVertexCommand implements ICommand {
  readonly id: string;
  readonly name = 'MoveOverlayVertex';
  readonly type = 'move-overlay-vertex';
  readonly timestamp: number;

  constructor(
    private readonly overlayId: string,
    private readonly vertexIndex: number,
    private readonly oldPosition: [number, number],
    private readonly newPosition: [number, number],
    private readonly overlayStore: OverlayStoreVertexOperations
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Move vertex to new position
   * 🏢 ENTERPRISE: Fire-and-forget async operation
   */
  execute(): void {
    this.overlayStore.updateVertex(this.overlayId, this.vertexIndex, this.newPosition).catch((error: unknown) => {
      console.error('❌ MoveOverlayVertexCommand.execute failed:', error);
    });
  }

  /**
   * Undo: Move vertex back to original position
   */
  undo(): void {
    this.overlayStore.updateVertex(this.overlayId, this.vertexIndex, this.oldPosition).catch((error: unknown) => {
      console.error('❌ MoveOverlayVertexCommand.undo failed:', error);
    });
  }

  /**
   * Redo: Move vertex to new position again
   */
  redo(): void {
    this.execute();
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Move vertex ${this.vertexIndex}`;
  }

  /**
   * Check if can merge with another command
   * Merges consecutive moves of the same vertex within time window
   */
  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof MoveOverlayVertexCommand)) {
      return false;
    }

    // Must be same overlay and vertex
    if (other.overlayId !== this.overlayId || other.vertexIndex !== this.vertexIndex) {
      return false;
    }

    // Check time window
    const timeDiff = other.timestamp - this.timestamp;
    return timeDiff < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  /**
   * Merge with another move command
   * Keeps original old position, uses new position from other command
   */
  mergeWith(other: ICommand): ICommand {
    const otherMove = other as MoveOverlayVertexCommand;
    return new MoveOverlayVertexCommand(
      this.overlayId,
      this.vertexIndex,
      this.oldPosition, // Keep original old position
      otherMove.newPosition, // Use latest new position
      this.overlayStore
    );
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
        vertexIndex: this.vertexIndex,
        oldPosition: this.oldPosition,
        newPosition: this.newPosition,
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
    if (this.vertexIndex < 0) {
      return 'Vertex index must be non-negative';
    }
    const overlay = this.overlayStore.overlays[this.overlayId];
    if (!overlay) {
      return `Overlay ${this.overlayId} not found`;
    }
    if (!overlay.polygon || this.vertexIndex >= overlay.polygon.length) {
      return `Vertex index ${this.vertexIndex} out of bounds`;
    }
    return null;
  }
}

/**
 * Command for moving multiple vertices at once with undo support
 * 🏢 ENTERPRISE (2026-01-26): Batch move with atomic undo - ADR-032
 *
 * Use case: Moving multiple selected grips together
 */
export class MoveMultipleOverlayVerticesCommand implements ICommand {
  readonly id: string;
  readonly name = 'MoveMultipleOverlayVertices';
  readonly type = 'move-multiple-overlay-vertices';
  readonly timestamp: number;

  constructor(
    /** Vertices to move with their old and new positions */
    private readonly movements: VertexMovement[],
    private readonly overlayStore: OverlayStoreVertexOperations
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Move all vertices to new positions
   */
  execute(): void {
    for (const { overlayId, vertexIndex, newPosition } of this.movements) {
      this.overlayStore.updateVertex(overlayId, vertexIndex, newPosition).catch((error: unknown) => {
        console.error(`❌ MoveMultipleOverlayVerticesCommand.execute failed for ${overlayId}:${vertexIndex}:`, error);
      });
    }
    console.log(`🔄 MoveMultipleOverlayVerticesCommand: Moved ${this.movements.length} vertices`);
  }

  /**
   * Undo: Move all vertices back to original positions
   */
  undo(): void {
    for (const { overlayId, vertexIndex, oldPosition } of this.movements) {
      this.overlayStore.updateVertex(overlayId, vertexIndex, oldPosition).catch((error: unknown) => {
        console.error(`❌ MoveMultipleOverlayVerticesCommand.undo failed for ${overlayId}:${vertexIndex}:`, error);
      });
    }
    console.log(`↩️ MoveMultipleOverlayVerticesCommand: Undo - restored ${this.movements.length} vertices`);
  }

  /**
   * Redo: Move all vertices to new positions again
   */
  redo(): void {
    this.execute();
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Move ${this.movements.length} vertices`;
  }

  /**
   * Move commands can merge if same vertices within time window
   */
  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof MoveMultipleOverlayVerticesCommand)) {
      return false;
    }

    // Must have same vertices (same overlayId + vertexIndex combinations)
    if (other.movements.length !== this.movements.length) {
      return false;
    }

    const thisKeys = new Set(this.movements.map(m => `${m.overlayId}:${m.vertexIndex}`));
    const otherKeys = new Set(other.movements.map(m => `${m.overlayId}:${m.vertexIndex}`));

    for (const key of thisKeys) {
      if (!otherKeys.has(key)) {
        return false;
      }
    }

    // Check time window
    const timeDiff = other.timestamp - this.timestamp;
    return timeDiff < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  /**
   * Merge with another move command
   * Keeps original old positions, uses new positions from other command
   */
  mergeWith(other: ICommand): ICommand {
    const otherMove = other as MoveMultipleOverlayVerticesCommand;

    // Create map of other movements for quick lookup
    const otherMap = new Map<string, VertexMovement>();
    for (const m of otherMove.movements) {
      otherMap.set(`${m.overlayId}:${m.vertexIndex}`, m);
    }

    // Merge: keep old positions from this, new positions from other
    const mergedMovements: VertexMovement[] = this.movements.map(m => {
      const key = `${m.overlayId}:${m.vertexIndex}`;
      const otherMovement = otherMap.get(key);
      return {
        overlayId: m.overlayId,
        vertexIndex: m.vertexIndex,
        oldPosition: m.oldPosition, // Keep original
        newPosition: otherMovement?.newPosition ?? m.newPosition, // Use latest
      };
    });

    return new MoveMultipleOverlayVerticesCommand(mergedMovements, this.overlayStore);
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
        movements: this.movements,
      },
      version: 1,
    };
  }

  /**
   * 🏢 ENTERPRISE: Get affected entity IDs
   */
  getAffectedEntityIds(): string[] {
    const uniqueIds = new Set(this.movements.map(m => m.overlayId));
    return Array.from(uniqueIds);
  }

  /**
   * Validate command can be executed
   */
  validate(): string | null {
    if (!this.movements || this.movements.length === 0) {
      return 'At least one vertex movement is required';
    }
    return null;
  }

  /**
   * Get the movements (for debugging/inspection)
   */
  getMovements(): VertexMovement[] {
    return [...this.movements];
  }
}
