/**
 * ADD VERTEX COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Command for adding vertices to polylines/polygons
 * Used when clicking on edge midpoint grips to insert new vertices.
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';

/**
 * Command for adding a vertex to an entity
 */
export class AddVertexCommand implements ICommand {
  readonly id: string;
  readonly name = 'AddVertex';
  readonly type = 'add-vertex';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly entityId: string,
    private readonly insertIndex: number,
    private readonly position: Point2D,
    private readonly sceneManager: ISceneManager
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Insert new vertex at specified index
   */
  execute(): void {
    this.sceneManager.insertVertex(this.entityId, this.insertIndex, this.position);
    this.wasExecuted = true;
  }

  /**
   * Undo: Remove the inserted vertex
   */
  undo(): void {
    if (this.wasExecuted) {
      this.sceneManager.removeVertex(this.entityId, this.insertIndex);
    }
  }

  /**
   * Redo: Re-insert the vertex
   */
  redo(): void {
    this.sceneManager.insertVertex(this.entityId, this.insertIndex, this.position);
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Add vertex at index ${this.insertIndex}`;
  }

  /**
   * Add vertex commands cannot be merged
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
   * Get the insert index
   */
  getInsertIndex(): number {
    return this.insertIndex;
  }

  /**
   * Get the position
   */
  getPosition(): Point2D {
    return { ...this.position };
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
        insertIndex: this.insertIndex,
        position: this.position,
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
    if (this.insertIndex < 0) {
      return 'Insert index must be non-negative';
    }
    return null;
  }
}
