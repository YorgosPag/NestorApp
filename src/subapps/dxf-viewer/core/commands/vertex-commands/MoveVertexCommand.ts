/**
 * MOVE VERTEX COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Command for moving entity vertices
 * Supports command merging for smooth drag operations.
 *
 * Pattern: Consecutive moves within 500ms are merged into single command
 * This provides smooth undo for drag operations (Autodesk/Figma pattern)
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

/**
 * Command for moving a single vertex
 */
export class MoveVertexCommand implements ICommand {
  readonly id: string;
  readonly name = 'MoveVertex';
  readonly type = 'move-vertex';
  readonly timestamp: number;

  constructor(
    private readonly entityId: string,
    private readonly vertexIndex: number,
    private readonly oldPosition: Point2D,
    private readonly newPosition: Point2D,
    private readonly sceneManager: ISceneManager
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
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
   * Check if can merge with another command
   * Merges consecutive moves of the same vertex
   */
  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof MoveVertexCommand)) {
      return false;
    }

    // Must be same entity and vertex
    if (other.entityId !== this.entityId || other.vertexIndex !== this.vertexIndex) {
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
    const otherMove = other as MoveVertexCommand;
    return new MoveVertexCommand(
      this.entityId,
      this.vertexIndex,
      this.oldPosition, // Keep original old position
      otherMove.newPosition, // Use latest new position
      this.sceneManager
    );
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
   * Get old position
   */
  getOldPosition(): Point2D {
    return { ...this.oldPosition };
  }

  /**
   * Get new position
   */
  getNewPosition(): Point2D {
    return { ...this.newPosition };
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
