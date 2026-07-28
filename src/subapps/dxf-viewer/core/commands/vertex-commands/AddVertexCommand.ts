/**
 * ADD VERTEX COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Command for adding vertices to polylines/polygons
 * Used when clicking on edge midpoint grips to insert new vertices.
 *
 * ADR-718 Μ3 — extends {@link EntityVertexCommand} like its `Remove`/`Move` siblings. It
 * always had the same target surface (`entityId` + index + `ISceneManager`) and re-declared
 * `getAffectedEntityIds()` + `validate()` by hand; adopting the family base drops both copies
 * and inherits the associative reconcile in ONE place instead of a third paste of it (N.0.2).
 *
 * @see ../entity-vertex-command.ts — family base (target surface + reconcileDependents)
 */

import type { ISceneManager } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { EntityVertexCommand } from '../entity-vertex-command';

/**
 * Command for adding a vertex to an entity
 */
export class AddVertexCommand extends EntityVertexCommand {
  readonly name = 'AddVertex';
  readonly type = 'add-vertex';

  private wasExecuted = false;

  constructor(
    entityId: string,
    insertIndex: number,
    private readonly position: Point2D,
    sceneManager: ISceneManager
  ) {
    super(entityId, insertIndex, sceneManager);
  }

  /**
   * Execute: Insert new vertex at specified index
   */
  execute(): void {
    this.sceneManager.insertVertex(this.entityId, this.vertexIndex, this.position);
    this.wasExecuted = true;
    // ADR-718 Μ3 — μια νέα κορυφή αλλάζει το σχήμα του πολυγώνου· ό,τι κρέμεται από αυτό
    // (τοπογραφικό όριο / ασυνέχεια, ετικέτα εμβαδού) ξανα-derive-άρεται τώρα.
    this.reconcileDependents();
  }

  /**
   * Undo: Remove the inserted vertex
   */
  undo(): void {
    if (this.wasExecuted) {
      this.sceneManager.removeVertex(this.entityId, this.vertexIndex);
      this.reconcileDependents();
    }
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
    return this.vertexIndex;
  }

  /**
   * Get the position
   */
  getPosition(): Point2D {
    return { ...this.position };
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Add vertex at index ${this.vertexIndex}`;
  }

  /** 🏢 ENTERPRISE: Serialized `data` payload. */
  protected serializeData(): Record<string, unknown> {
    return {
      entityId: this.entityId,
      insertIndex: this.vertexIndex,
      position: this.position,
    };
  }
}
