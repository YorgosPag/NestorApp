/**
 * BATCH REORDER ENTITY COMMAND (ADR-661)
 *
 * Atomically sends a SET of entities to the back (rendered below all) or front (rendered on top) of
 * the scene render list, in ONE scene commit — no per-id jank when the set is large (e.g. a whole
 * topo contour layer of 40+ polylines + labels). The moved set keeps its relative order.
 *
 * Undo restores the exact prior render order via a snapshot captured at execute() time — correct for
 * an arbitrary N-entity move, where restoring each id to a captured index one-by-one would not invert
 * (indices shift as siblings move).
 *
 * Two callers:
 *   • (B) multi-select «Send to Back / Bring to Front» (useCanvasEditActions).
 *   • (A) topo contour auto-send-to-back, wrapped with the CreateEntityCommand(s) in a CompoundCommand
 *     so create + reorder undo as one step (mirror of the ADR-507 hatch §5δ precedent).
 *
 * @see ISceneManager.reorderEntities / getEntityOrder / setEntityOrder
 * @see ./ReorderEntityCommand — the single-entity sibling
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';

export class BatchReorderEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'BatchReorderEntity';
  readonly type = 'batch-reorder-entity';
  readonly timestamp: number;

  /** Full render order captured at execute() time — restored verbatim on undo. */
  private orderBefore: readonly string[] = [];

  constructor(
    private readonly entityIds: readonly string[],
    private readonly direction: 'front' | 'back',
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = `batch-reorder-${direction}-${entityIds.length}-${Date.now()}`;
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.entityIds.length === 0) return;
    this.orderBefore = this.sceneManager.getEntityOrder();
    this.sceneManager.reorderEntities(this.entityIds, this.direction);
  }

  undo(): void {
    if (this.orderBefore.length === 0) return;
    this.sceneManager.setEntityOrder(this.orderBefore);
  }

  redo(): void {
    this.sceneManager.reorderEntities(this.entityIds, this.direction);
  }

  getDescription(): string {
    return `Reorder ${this.entityIds.length} entities ${this.direction === 'front' ? 'to front' : 'to back'}`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityIds: [...this.entityIds], direction: this.direction, orderBefore: [...this.orderBefore] },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return [...this.entityIds];
  }
}
