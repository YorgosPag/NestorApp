/**
 * REMOVE VERTEX COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Command for removing vertices from polylines/polygons
 * Stores vertex position for undo (restore) operations.
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';

/**
 * Command for removing a vertex from an entity
 */
export class RemoveVertexCommand implements ICommand {
  readonly id: string;
  readonly name = 'RemoveVertex';
  readonly type = 'remove-vertex';
  readonly timestamp: number;

  private removedPosition: Point2D | null = null;
  private wasExecuted = false;

  constructor(
    private readonly entityId: string,
    private readonly vertexIndex: number,
    private readonly sceneManager: ISceneManager
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Store vertex position and remove it
   */
  execute(): void {
    // Get the vertex position before removal (for undo)
    const vertices = this.sceneManager.getVertices(this.entityId);
    if (vertices && vertices[this.vertexIndex]) {
      this.removedPosition = { ...vertices[this.vertexIndex] };
      this.sceneManager.removeVertex(this.entityId, this.vertexIndex);
      this.wasExecuted = true;
    }
  }

  /**
   * Undo: Re-insert the vertex at its original position
   */
  undo(): void {
    if (this.removedPosition && this.wasExecuted) {
      this.sceneManager.insertVertex(this.entityId, this.vertexIndex, this.removedPosition);
    }
  }

  /**
   * Redo: Remove the vertex again
   */
  redo(): void {
    if (this.removedPosition) {
      this.sceneManager.removeVertex(this.entityId, this.vertexIndex);
    }
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Remove vertex ${this.vertexIndex}`;
  }

  /**
   * Remove vertex commands cannot be merged
   */
  canMergeWith(): boolean {
    return false;
  }

  /**
   * Get the entity ID
   */
  getEntityId(): string {
    return this.entityId;
  }

  /**
   * Get the vertex index
   */
  getVertexIndex(): number {
    return this.vertexIndex;
  }

  /**
   * Get the removed position (after execution)
   */
  getRemovedPosition(): Point2D | null {
    return this.removedPosition ? { ...this.removedPosition } : null;
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
        entityId: this.entityId,
        vertexIndex: this.vertexIndex,
        removedPosition: this.removedPosition,
      },
      version: 1,
    };
  }

  /**
   * 🏢 ENTERPRISE: Get affected entity IDs
   */
  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  /**
   * Validate command can be executed
   */
  validate(): string | null {
    if (!this.entityId) {
      return 'Entity ID is required';
    }
    if (this.vertexIndex < 0) {
      return 'Vertex index must be non-negative';
    }
    return null;
  }
}
