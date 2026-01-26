/**
 * DELETE OVERLAY VERTEX COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-26): Command for deleting overlay vertices with undo support - ADR-032
 * Stores vertex position for undo (restore) operations.
 *
 * Pattern: AutoCAD/Figma - Vertex editing with full undo support
 *
 * Note: Uses fire-and-forget async operations since ICommand interface is synchronous.
 * Firestore updates will be reflected via real-time listeners.
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import type { Overlay } from '../../../overlays/types';
import { generateEntityId } from '../../../systems/entity-creation/utils';

/**
 * Overlay store interface for vertex operations
 * 🏢 ENTERPRISE: Type-safe interface instead of using any
 */
interface OverlayStoreVertexOperations {
  /** Get overlay by ID */
  overlays: Record<string, Overlay>;
  /** Add vertex to overlay polygon */
  addVertex: (id: string, insertIndex: number, vertex: [number, number]) => Promise<void>;
  /** Remove vertex from overlay polygon */
  removeVertex: (id: string, vertexIndex: number) => Promise<boolean>;
}

/**
 * Command for deleting a single vertex from an overlay with undo support
 */
export class DeleteOverlayVertexCommand implements ICommand {
  readonly id: string;
  readonly name = 'DeleteOverlayVertex';
  readonly type = 'delete-overlay-vertex';
  readonly timestamp: number;

  private removedVertex: [number, number] | null = null;
  private wasExecuted = false;

  constructor(
    private readonly overlayId: string,
    private readonly vertexIndex: number,
    private readonly overlayStore: OverlayStoreVertexOperations
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Store vertex position and remove it
   * 🏢 ENTERPRISE: Fire-and-forget async operation
   */
  execute(): void {
    // Get overlay to access vertex position
    const overlay = this.overlayStore.overlays[this.overlayId];
    if (!overlay || !overlay.polygon) {
      console.error(`❌ DeleteOverlayVertexCommand: Overlay ${this.overlayId} not found`);
      return;
    }

    // Store vertex position before deletion (for undo)
    if (this.vertexIndex >= 0 && this.vertexIndex < overlay.polygon.length) {
      this.removedVertex = [...overlay.polygon[this.vertexIndex]] as [number, number];

      // Fire-and-forget async operation
      // Firestore real-time listener will update UI
      this.overlayStore.removeVertex(this.overlayId, this.vertexIndex).catch((error: unknown) => {
        console.error('❌ DeleteOverlayVertexCommand.execute failed:', error);
      });

      this.wasExecuted = true;
      console.log(`🗑️ DeleteOverlayVertexCommand: Executed for overlay ${this.overlayId}, vertex ${this.vertexIndex}`);
    } else {
      console.error(`❌ DeleteOverlayVertexCommand: Invalid vertex index ${this.vertexIndex}`);
    }
  }

  /**
   * Undo: Re-insert the vertex at its original position
   * 🏢 ENTERPRISE: Uses addVertex() method to restore
   */
  undo(): void {
    if (this.removedVertex && this.wasExecuted) {
      // Fire-and-forget async operation
      this.overlayStore.addVertex(this.overlayId, this.vertexIndex, this.removedVertex).catch((error: unknown) => {
        console.error('❌ DeleteOverlayVertexCommand.undo failed:', error);
      });

      console.log(`↩️ DeleteOverlayVertexCommand: Undo - restored vertex ${this.vertexIndex} at overlay ${this.overlayId}`);
    }
  }

  /**
   * Redo: Remove the vertex again
   */
  redo(): void {
    if (this.removedVertex) {
      // Fire-and-forget async operation
      this.overlayStore.removeVertex(this.overlayId, this.vertexIndex).catch((error: unknown) => {
        console.error('❌ DeleteOverlayVertexCommand.redo failed:', error);
      });

      console.log(`↪️ DeleteOverlayVertexCommand: Redo - deleted vertex ${this.vertexIndex} at overlay ${this.overlayId}`);
    }
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Delete vertex ${this.vertexIndex}`;
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
        vertexIndex: this.vertexIndex,
        removedVertex: this.removedVertex,
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
    // Minimum 3 vertices for a valid polygon
    if (overlay.polygon && overlay.polygon.length <= 3) {
      return 'Cannot delete vertex - minimum 3 vertices required for polygon';
    }
    return null;
  }

  /**
   * Get the removed vertex position (for debugging/inspection)
   */
  getRemovedVertex(): [number, number] | null {
    return this.removedVertex ? [...this.removedVertex] as [number, number] : null;
  }
}

/**
 * Command for deleting multiple vertices at once with undo support
 * 🏢 ENTERPRISE: Batch delete with atomic undo
 *
 * IMPORTANT: Vertices must be sorted by index DESCENDING before passing to this command
 * to avoid index shifting issues during deletion.
 */
export class DeleteMultipleOverlayVerticesCommand implements ICommand {
  readonly id: string;
  readonly name = 'DeleteMultipleOverlayVertices';
  readonly type = 'delete-multiple-overlay-vertices';
  readonly timestamp: number;

  /** Stored vertex data for undo: { overlayId, vertexIndex, position } */
  private removedVertices: Array<{
    overlayId: string;
    vertexIndex: number;
    position: [number, number];
  }> = [];
  private wasExecuted = false;

  constructor(
    /** Vertices to delete - MUST be sorted by index DESCENDING within each overlay */
    private readonly vertices: Array<{ overlayId: string; vertexIndex: number }>,
    private readonly overlayStore: OverlayStoreVertexOperations
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Store vertex positions and remove all vertices
   */
  execute(): void {
    this.removedVertices = [];

    for (const { overlayId, vertexIndex } of this.vertices) {
      const overlay = this.overlayStore.overlays[overlayId];
      if (overlay && overlay.polygon && vertexIndex >= 0 && vertexIndex < overlay.polygon.length) {
        // Store vertex position before deletion
        this.removedVertices.push({
          overlayId,
          vertexIndex,
          position: [...overlay.polygon[vertexIndex]] as [number, number],
        });

        // Fire-and-forget async operation
        this.overlayStore.removeVertex(overlayId, vertexIndex).catch((error: unknown) => {
          console.error(`❌ DeleteMultipleOverlayVerticesCommand.execute failed for ${overlayId}:${vertexIndex}:`, error);
        });
      }
    }

    this.wasExecuted = this.removedVertices.length > 0;
    console.log(`🗑️ DeleteMultipleOverlayVerticesCommand: Executed for ${this.removedVertices.length} vertices`);
  }

  /**
   * Undo: Restore all vertices (in REVERSE order - ascending indices)
   * 🏢 ENTERPRISE: Restore from lowest to highest index to maintain correct positions
   */
  undo(): void {
    if (this.wasExecuted) {
      // Restore in reverse order (ascending indices) to avoid index conflicts
      const sortedForRestore = [...this.removedVertices].sort((a, b) => {
        if (a.overlayId !== b.overlayId) return a.overlayId.localeCompare(b.overlayId);
        return a.vertexIndex - b.vertexIndex; // Ascending for restore
      });

      for (const { overlayId, vertexIndex, position } of sortedForRestore) {
        // Fire-and-forget async operation
        this.overlayStore.addVertex(overlayId, vertexIndex, position).catch((error: unknown) => {
          console.error(`❌ DeleteMultipleOverlayVerticesCommand.undo failed for ${overlayId}:${vertexIndex}:`, error);
        });
      }

      console.log(`↩️ DeleteMultipleOverlayVerticesCommand: Undo - restored ${this.removedVertices.length} vertices`);
    }
  }

  /**
   * Redo: Remove all vertices again (in descending order)
   */
  redo(): void {
    // Delete in descending order to avoid index shifting
    const sortedForDelete = [...this.removedVertices].sort((a, b) => {
      if (a.overlayId !== b.overlayId) return a.overlayId.localeCompare(b.overlayId);
      return b.vertexIndex - a.vertexIndex; // Descending for delete
    });

    for (const { overlayId, vertexIndex } of sortedForDelete) {
      // Fire-and-forget async operation
      this.overlayStore.removeVertex(overlayId, vertexIndex).catch((error: unknown) => {
        console.error(`❌ DeleteMultipleOverlayVerticesCommand.redo failed for ${overlayId}:${vertexIndex}:`, error);
      });
    }

    console.log(`↪️ DeleteMultipleOverlayVerticesCommand: Redo - deleted ${this.removedVertices.length} vertices`);
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Delete ${this.removedVertices.length} vertices`;
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
        vertices: this.vertices,
        removedVertices: this.removedVertices,
      },
      version: 1,
    };
  }

  /**
   * 🏢 ENTERPRISE: Get affected entity IDs
   */
  getAffectedEntityIds(): string[] {
    const uniqueIds = new Set(this.vertices.map(v => v.overlayId));
    return Array.from(uniqueIds);
  }

  /**
   * Validate command can be executed
   */
  validate(): string | null {
    if (!this.vertices || this.vertices.length === 0) {
      return 'At least one vertex is required';
    }
    return null;
  }
}
