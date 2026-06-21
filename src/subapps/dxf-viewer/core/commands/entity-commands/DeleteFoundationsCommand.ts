/**
 * DELETE FOUNDATIONS COMMAND — ADR-441 Slice 6 (reconciling εσχάρα από κάναβο).
 *
 * Batch-deletes N existing `FoundationEntity` (strips) σε ΕΝΑ undoable βήμα —
 * το inverse του `CreateFoundationsCommand`. Χρησιμοποιείται από το managed
 * reconcile («Εσχάρα από κάναβο»): οι obsolete grid λωρίδες (split-superseded ή
 * πρώην περιμετρικές με stale corner-fill) διαγράφονται ατομικά μαζί με τη
 * δημιουργία των νέων, ώστε όλο το reconcile = μία Revit transaction (1 undo).
 *
 * Persistence-correct (ADR-436): forward emits `bim:foundation-delete-requested`
 * (deleteDoc + scene remove via `useFoundationPersistence`), undo emits
 * `drawing:entity-created` (re-persist με τα ΑΡΧΙΚΑ ids). Side-effects deferred σε
 * microtask ώστε να τρέχουν μετά το synchronous dispatch — mirror του
 * `CreateFoundationsCommand` (αντεστραμμένες κατευθύνσεις apply/revert).
 *
 * @see ./CreateFoundationsCommand.ts — batch create (inverse)
 * @see ../../../hooks/data/useFoundationPersistence.ts — delete + create listeners
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { FoundationEntity } from '../../../bim/types/foundation-types';
import type { AnySceneEntity } from '../../../types/scene';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { emitBimEntityCreated, emitBimEntityDeleteRequested } from '../../../systems/events/bim-entity-lifecycle-events';

const FOUNDATION_TOOL = 'foundation';

export class DeleteFoundationsCommand implements ICommand {
  readonly id: string;
  readonly name = 'DeleteFoundations';
  readonly type = 'delete-foundations';
  readonly timestamp: number;

  private readonly foundations: readonly FoundationEntity[];
  private wasExecuted = false;

  constructor(
    foundations: readonly FoundationEntity[],
    private readonly sceneManager: ISceneManager,
  ) {
    // Defensive deep-clone: snapshots για ακριβές re-create στο undo.
    this.foundations = foundations.map((f) => deepClone(f));
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.removeScene();
    this.wasExecuted = true;
    this.deferFirestore('delete');
  }

  redo(): void {
    this.removeScene();
    this.deferFirestore('delete');
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.addScene();
    this.deferFirestore('restore');
  }

  /** scene: remove κάθε strip. */
  private removeScene(): void {
    for (const f of this.foundations) this.sceneManager.removeEntity(f.id);
  }

  /** scene: re-add κάθε strip (undo). */
  private addScene(): void {
    for (const f of this.foundations) {
      this.sceneManager.addEntity(deepClone(f) as unknown as SceneEntity);
    }
  }

  /**
   * Firestore side-effects, deferred σε microtask (mirror CreateFoundationsCommand,
   * αντεστραμμένο: delete→delete-requested, restore→entity-created).
   */
  private deferFirestore(direction: 'delete' | 'restore'): void {
    const foundations = this.foundations;
    queueMicrotask(() => {
      if (direction === 'delete') {
        for (const f of foundations) {
          emitBimEntityDeleteRequested('foundation', f.id);
        }
      } else {
        for (const f of foundations) {
          emitBimEntityCreated(deepClone(f) as unknown as AnySceneEntity, FOUNDATION_TOOL);
        }
      }
    });
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Delete ${this.foundations.length} foundation strips`;
  }

  getAffectedEntityIds(): string[] {
    return this.foundations.map((f) => f.id);
  }

  validate(): string | null {
    if (this.foundations.length === 0) return 'At least one foundation is required';
    if (this.foundations.some((f) => !f.id)) return 'Every foundation must have an id';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { foundationIds: this.foundations.map((f) => f.id) },
      version: 1,
    };
  }
}
