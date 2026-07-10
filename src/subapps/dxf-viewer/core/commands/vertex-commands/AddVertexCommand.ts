/**
 * ADD VERTEX COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Command for adding vertices to polylines/polygons
 * Used when clicking on edge midpoint grips to insert new vertices.
 */

import type { ISceneManager } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { BaseCommand } from '../base-command';

/**
 * Command for adding a vertex to an entity
 */
export class AddVertexCommand extends BaseCommand {
  readonly name = 'AddVertex';
  readonly type = 'add-vertex';

  private wasExecuted = false;

  constructor(
    private readonly entityId: string,
    private readonly insertIndex: number,
    private readonly position: Point2D,
    private readonly sceneManager: ISceneManager
  ) {
    super();
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
   * Get description for UI
   */
  getDescription(): string {
    return `Add vertex at index ${this.insertIndex}`;
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

  /** 🏢 ENTERPRISE: Serialized `data` payload. */
  protected serializeData(): Record<string, unknown> {
    return {
      entityId: this.entityId,
      insertIndex: this.insertIndex,
      position: this.position,
    };
  }
}
