/**
 * REORDER ENTITY COMMAND
 *
 * Moves a selected entity to the front (rendered on top) or back (rendered below all)
 * of the scene entity list. Supports full undo/redo via index snapshot.
 *
 * Render order: entities are drawn in array order — last index = topmost layer.
 *   PageUp   → bring to front (array end)
 *   PageDown → send to back  (array start)
 *
 * @see ISceneManager.getEntityIndex / reorderEntity / moveEntityToIndex
 */

import type { ICommand, ISceneManager } from '../interfaces';

export class ReorderEntityCommand implements ICommand {
  readonly id: string;
  readonly timestamp: number;

  /** Index captured at execute() time — used to restore exact position on undo. */
  private originalIndex: number = -1;

  constructor(
    private readonly entityId: string,
    private readonly direction: 'front' | 'back',
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = `reorder-${entityId}-${direction}-${Date.now()}`;
    this.timestamp = Date.now();
  }

  execute(): void {
    this.originalIndex = this.sceneManager.getEntityIndex(this.entityId);
    if (this.originalIndex === -1) return;
    this.sceneManager.reorderEntity(this.entityId, this.direction);
  }

  undo(): void {
    if (this.originalIndex === -1) return;
    this.sceneManager.moveEntityToIndex(this.entityId, this.originalIndex);
  }

  redo(): void {
    this.sceneManager.reorderEntity(this.entityId, this.direction);
  }
}
