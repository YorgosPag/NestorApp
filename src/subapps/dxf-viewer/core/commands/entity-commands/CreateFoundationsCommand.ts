/**
 * CREATE FOUNDATIONS COMMAND — ADR-441 Slice 2 (εσχάρα πεδιλοδοκών από κάναβο).
 *
 * Batch-creates N pre-built `FoundationEntity` (strips) σε ΕΝΑ undoable βήμα, ώστε
 * η αυτόματη εσχάρα να πέφτει στον καμβά ως μία Revit transaction (ένα Ctrl+Z
 * αφαιρεί ΟΛΗ την εσχάρα).
 *
 * Γιατί ειδική command (όχι `CreateEntityCommand`): η foundation persistence
 * (ADR-436 Slice 1-persist) κλειδώνει στο `drawing:entity-created` EventBus
 * broadcast (το trigger που εκπέμπει το `appendEntityToScene` για το manual tool).
 * Το `CreateEntityCommand` δεν το εκπέμπει → strip μέσω αυτού δεν θα persist-άρει
 * ποτέ. Αυτή η command καθρεφτίζει τον canonical BIM append: scene via
 * `ISceneManager`, Firestore via deferred `drawing:entity-created` ανά strip.
 *
 * Symmetric scene + Firestore σε execute / undo / redo, με τα EventBus side-effects
 * deferred σε microtask (precedent: `CreateMepSegmentsCommand` / `MergeColumnsCommand`)
 * ώστε να τρέχουν ΜΕΤΑ το synchronous `CommandHistory.execute` (αποφυγή nested dispatch).
 *
 * @see ./CreateMepSegmentsCommand.ts — batch + deferred-Firestore precedent
 * @see ../../../bim/foundations/add-foundation-to-scene.ts — manual-draw append SSoT
 * @see ../../../hooks/data/useFoundationPersistence.ts — create + delete listeners
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { FoundationEntity } from '../../../bim/types/foundation-types';
import type { AnySceneEntity } from '../../../types/scene';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { EventBus } from '../../../systems/events/EventBus';
import { emitBimEntityDeleteRequested } from '../../../systems/events/emit-bim-entity-delete-requested';

const FOUNDATION_TOOL = 'foundation';

export class CreateFoundationsCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateFoundations';
  readonly type = 'create-foundations';
  readonly timestamp: number;

  private readonly foundations: readonly FoundationEntity[];
  private wasExecuted = false;

  constructor(
    foundations: readonly FoundationEntity[],
    private readonly sceneManager: ISceneManager,
  ) {
    // Defensive deep-clone: snapshots ανεξάρτητα από μετέπειτα live-scene edits.
    this.foundations = foundations.map((f) => deepClone(f));
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

  /** scene: add κάθε strip. */
  private applyScene(): void {
    for (const f of this.foundations) {
      this.sceneManager.addEntity(deepClone(f) as unknown as SceneEntity);
    }
  }

  /** scene: remove κάθε strip. */
  private revertScene(): void {
    for (const f of this.foundations) this.sceneManager.removeEntity(f.id);
  }

  /**
   * Firestore side-effects, deferred σε microtask ώστε να τρέχουν μετά το
   * synchronous command dispatch (mirror `CreateMepSegmentsCommand`).
   */
  private deferFirestore(direction: 'apply' | 'revert'): void {
    const foundations = this.foundations;
    queueMicrotask(() => {
      if (direction === 'apply') {
        for (const f of foundations) {
          EventBus.emit('drawing:entity-created', {
            entity: deepClone(f) as unknown as AnySceneEntity,
            tool: FOUNDATION_TOOL,
          });
        }
      } else {
        for (const f of foundations) {
          emitBimEntityDeleteRequested('foundation', f.id);
        }
      }
    });
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Create ${this.foundations.length} foundation strips`;
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
