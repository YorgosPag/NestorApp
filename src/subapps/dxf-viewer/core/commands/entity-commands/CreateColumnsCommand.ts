/**
 * CREATE COLUMNS COMMAND — ADR-441 Slice GEN-COL («Κολώνες από κάναβο»).
 *
 * Batch-creates N pre-built `ColumnEntity` (στις τομές του κανάβου) σε ΕΝΑ undoable
 * βήμα, ώστε οι αυτόματες κολώνες να πέφτουν ως μία Revit transaction (ένα Ctrl+Z
 * αφαιρεί ΟΛΕΣ). Ακριβής mirror του `CreateFoundationsCommand`.
 *
 * Γιατί ειδική command (όχι `CreateEntityCommand`): η column persistence κλειδώνει
 * στο `drawing:entity-created` EventBus broadcast (το trigger του `appendEntityToScene`
 * για το manual tool). Το `CreateEntityCommand` δεν το εκπέμπει → κολώνα μέσω αυτού
 * δεν θα persist-άρει ποτέ. Side-effects deferred σε microtask ώστε να τρέχουν ΜΕΤΑ
 * το synchronous `CommandHistory.execute` (precedent: `CreateFoundationsCommand`).
 *
 * @see ./CreateFoundationsCommand.ts — batch + deferred-Firestore precedent
 * @see ../../../bim/columns/add-column-to-scene.ts — manual-draw append SSoT
 * @see ../../../hooks/data/useColumnPersistence.ts — create + delete listeners
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { ColumnEntity } from '../../../bim/types/column-types';
import type { AnySceneEntity } from '../../../types/scene';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { EventBus } from '../../../systems/events/EventBus';

const COLUMN_TOOL = 'column';

export class CreateColumnsCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateColumns';
  readonly type = 'create-columns';
  readonly timestamp: number;

  private readonly columns: readonly ColumnEntity[];
  private wasExecuted = false;

  constructor(
    columns: readonly ColumnEntity[],
    private readonly sceneManager: ISceneManager,
  ) {
    // Defensive deep-clone: snapshots ανεξάρτητα από μετέπειτα live-scene edits.
    this.columns = columns.map((c) => deepClone(c));
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.applyScene();
    this.wasExecuted = true;
    this.deferFirestore('apply');
  }

  redo(): void {
    this.applyScene();
    this.deferFirestore('apply');
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.revertScene();
    this.deferFirestore('revert');
  }

  /** scene: add κάθε κολώνα. */
  private applyScene(): void {
    for (const c of this.columns) {
      this.sceneManager.addEntity(deepClone(c) as unknown as SceneEntity);
    }
  }

  /** scene: remove κάθε κολώνα. */
  private revertScene(): void {
    for (const c of this.columns) this.sceneManager.removeEntity(c.id);
  }

  /**
   * Firestore side-effects, deferred σε microtask ώστε να τρέχουν μετά το
   * synchronous command dispatch (mirror `CreateFoundationsCommand`).
   */
  private deferFirestore(direction: 'apply' | 'revert'): void {
    const columns = this.columns;
    queueMicrotask(() => {
      if (direction === 'apply') {
        for (const c of columns) {
          EventBus.emit('drawing:entity-created', {
            entity: deepClone(c) as unknown as AnySceneEntity,
            tool: COLUMN_TOOL,
          });
        }
      } else {
        for (const c of columns) {
          EventBus.emit('bim:column-delete-requested', { columnId: c.id });
        }
      }
    });
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Create ${this.columns.length} grid columns`;
  }

  getAffectedEntityIds(): string[] {
    return this.columns.map((c) => c.id);
  }

  validate(): string | null {
    if (this.columns.length === 0) return 'At least one column is required';
    if (this.columns.some((c) => !c.id)) return 'Every column must have an id';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { columnIds: this.columns.map((c) => c.id) },
      version: 1,
    };
  }
}
