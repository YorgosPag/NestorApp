/**
 * MOVE VERTEX COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Command for moving entity vertices
 * Supports command merging for smooth drag operations.
 *
 * Pattern: Consecutive moves within 500ms are merged into single command
 * This provides smooth undo for drag operations (Autodesk/Figma pattern)
 */

import type { ICommand, ISceneManager } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { EntityVertexCommand } from '../entity-vertex-command';
import { canMergeDragSamples } from '../merge-window';

/**
 * Command for moving a single vertex
 */
export class MoveVertexCommand extends EntityVertexCommand {
  readonly name = 'MoveVertex';
  readonly type = 'move-vertex';

  constructor(
    entityId: string,
    vertexIndex: number,
    private readonly oldPosition: Point2D,
    private readonly newPosition: Point2D,
    sceneManager: ISceneManager,
    /**
     * True only for per-frame samples of a live drag. Two DISTINCT edits of the
     * same vertex (both `false`) must NOT coalesce — mirrors the transform
     * family's `isDragging` gate (ADR-507 §8). Defaults `false` (single edit).
     */
    private readonly isDragging: boolean = false
  ) {
    super(entityId, vertexIndex, sceneManager);
  }

  /**
   * Execute: Move vertex to new position
   */
  execute(): void {
    this.sceneManager.updateVertex(this.entityId, this.vertexIndex, this.newPosition);
  }

  /**
   * Undo: Move vertex back to old position
   */
  undo(): void {
    this.sceneManager.updateVertex(this.entityId, this.vertexIndex, this.oldPosition);
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
   * Merge consecutive live-drag samples of the same vertex — distinct edits stay
   * separate. SSoT gate via `canMergeDragSamples`.
   */
  canMergeWith(other: ICommand): boolean {
    return (
      other instanceof MoveVertexCommand &&
      other.entityId === this.entityId &&
      other.vertexIndex === this.vertexIndex &&
      canMergeDragSamples(this, other, this.isDragging, other.isDragging)
    );
  }

  /**
   * Merge: keep the original old position, adopt the latest new position.
   */
  mergeWith(other: ICommand): ICommand {
    const otherMove = other as MoveVertexCommand;
    return new MoveVertexCommand(
      this.entityId,
      this.vertexIndex,
      this.oldPosition, // Keep original old position
      otherMove.newPosition, // Use latest new position
      this.sceneManager,
      true // merged result stays a drag so subsequent samples keep coalescing
    );
  }

  /** 🏢 ENTERPRISE: Serialized `data` payload. */
  protected serializeData(): Record<string, unknown> {
    return {
      entityId: this.entityId,
      vertexIndex: this.vertexIndex,
      oldPosition: this.oldPosition,
      newPosition: this.newPosition,
      isDragging: this.isDragging,
    };
  }
}
