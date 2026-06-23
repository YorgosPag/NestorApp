/**
 * MERGE COLUMNS COMMAND — ADR-363 Post-Creation Adjacency Merge.
 *
 * Συγχωνεύει N γειτονικές κολόνες που μαζί σχηματίζουν τοιχίο (Γ/Τ/Π) σε ΕΝΑ
 * composite `ColumnEntity` (Eurocode 8 §5.4.2.4 — ενιαίο φέρον στοιχείο). Single
 * undoable ενέργεια (ΕΝΑ Ctrl+Z): διαγραφή των N πηγών + δημιουργία του composite.
 *
 * Συμμετρικό scene + Firestore σε execute / undo / redo:
 *   - scene: μέσω `ISceneManager` (LevelSceneManagerAdapter — pending-cache batch).
 *   - Firestore: μέσω EventBus, **deferred σε microtask** ώστε (α) να μην γίνεται
 *     nested `CommandHistory.execute` (το `drawing:entity-created` πυροδοτεί
 *     `useStructuralAutoAttach` που τρέχει δικό του command), και (β) να εκτελείται
 *     ΣΕ ΚΑΘΕ execute/undo/redo → μηδέν asymmetry στο Firestore.
 *
 * Firestore mapping (precedent: `DeleteEntityCommand`):
 *   - apply (execute/redo): `bim:column-delete-requested` ανά πηγή (delete) +
 *     `drawing:entity-created` για το composite (first-save via useColumnPersistence).
 *   - revert (undo): `bim:column-delete-requested` για το composite (delete) +
 *     `bim:entity-restore-requested` ανά πηγή (re-create, action='restored').
 *
 * @see core/commands/entity-commands/DeleteEntityCommand.ts — restore-on-undo precedent
 * @see bim/columns/column-adjacency-detector.ts — group detection + composite build
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { ColumnEntity } from '../../../bim/types/column-types';
import type { AnySceneEntity } from '../../../types/scene';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import {
  emitBimEntityCreated,
  emitBimEntityDeleteRequested,
  emitBimEntityRestoreRequested,
} from '../../../systems/events/bim-entity-lifecycle-events';

export class MergeColumnsCommand implements ICommand {
  readonly id: string;
  readonly name = 'MergeColumns';
  readonly type = 'merge-columns';
  readonly timestamp: number;

  private readonly sources: readonly ColumnEntity[];
  private readonly composite: ColumnEntity;
  private wasExecuted = false;

  constructor(
    sources: readonly ColumnEntity[],
    composite: ColumnEntity,
    private readonly sceneManager: ISceneManager,
  ) {
    // Defensive deep-clone: snapshots πρέπει να είναι ανεξάρτητα από live scene
    // mutations (mirror DeleteEntityCommand snapshot semantics).
    this.sources = sources.map((s) => deepClone(s));
    this.composite = deepClone(composite);
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

  /** scene: αφαίρεσε τις πηγές + πρόσθεσε το composite. */
  private applyScene(): void {
    for (const s of this.sources) this.sceneManager.removeEntity(s.id);
    this.sceneManager.addEntity(this.composite as unknown as SceneEntity);
  }

  /** scene: αφαίρεσε το composite + επανάφερε τις πηγές. */
  private revertScene(): void {
    this.sceneManager.removeEntity(this.composite.id);
    for (const s of this.sources) {
      this.sceneManager.addEntity(deepClone(s) as unknown as SceneEntity);
    }
  }

  /**
   * Firestore side-effects, deferred ώστε να τρέχουν ΜΕΤΑ το συγχρονισμένο
   * `CommandHistory.execute` (αποφυγή nested command dispatch από auto-attach).
   */
  private deferFirestore(direction: 'apply' | 'revert'): void {
    const sources = this.sources;
    const composite = this.composite;
    queueMicrotask(() => {
      if (direction === 'apply') {
        for (const s of sources) emitBimEntityDeleteRequested('column', s.id);
        emitBimEntityCreated(composite as unknown as AnySceneEntity, 'column');
      } else {
        emitBimEntityDeleteRequested('column', composite.id);
        for (const s of sources) {
          emitBimEntityRestoreRequested('column', s as unknown as AnySceneEntity, 'undo-delete');
        }
      }
    });
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Merge ${this.sources.length} columns into composite`;
  }

  getAffectedEntityIds(): string[] {
    return [this.composite.id, ...this.sources.map((s) => s.id)];
  }

  validate(): string | null {
    if (this.sources.length < 2) return 'At least two source columns are required';
    if (!this.composite?.id) return 'Composite column is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        sourceIds: this.sources.map((s) => s.id),
        compositeId: this.composite.id,
      },
      version: 1,
    };
  }
}
