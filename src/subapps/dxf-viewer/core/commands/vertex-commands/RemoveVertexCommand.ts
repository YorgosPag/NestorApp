/**
 * REMOVE VERTEX COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Command for removing vertices from polylines/polygons
 * Stores vertex position for undo (restore) operations.
 */

import type { ISceneManager } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { EntityVertexCommand } from '../entity-vertex-command';

/**
 * Command for removing a vertex from an entity
 */
export class RemoveVertexCommand extends EntityVertexCommand {
  readonly name = 'RemoveVertex';
  readonly type = 'remove-vertex';

  private removedPosition: Point2D | null = null;
  private wasExecuted = false;

  constructor(entityId: string, vertexIndex: number, sceneManager: ISceneManager) {
    super(entityId, vertexIndex, sceneManager);
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

  /** 🏢 ENTERPRISE: Serialized `data` payload. */
  protected serializeData(): Record<string, unknown> {
    return {
      entityId: this.entityId,
      vertexIndex: this.vertexIndex,
      removedPosition: this.removedPosition,
    };
  }
}
