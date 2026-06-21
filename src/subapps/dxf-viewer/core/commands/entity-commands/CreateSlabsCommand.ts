/**
 * CREATE SLABS COMMAND — ADR-441 Slice GEN-SLAB («Πλάκες από κάναβο»).
 *
 * Batch-creates N pre-built `SlabEntity` (εδαφόπλακα / δάπεδα / οροφές από τον
 * κάναβο) σε ΕΝΑ undoable βήμα, ώστε οι αυτόματες πλάκες να πέφτουν ως μία Revit
 * transaction (ένα Ctrl+Z αφαιρεί ΟΛΕΣ). Ακριβής mirror του `CreateBeamsCommand` /
 * `CreateFoundationsCommand`.
 *
 * Γιατί ειδική command (όχι `CreateEntityCommand`): η slab persistence κλειδώνει στο
 * `drawing:entity-created` EventBus broadcast με `tool:'slab'` (το trigger του
 * `useSlabPersistence` first-save listener). Το `CreateEntityCommand` δεν το εκπέμπει →
 * πλάκα μέσω αυτού δεν θα persist-άρει ποτέ. Side-effects deferred σε microtask ώστε
 * να τρέχουν ΜΕΤΑ το synchronous `CommandHistory.execute`.
 *
 * @see ./CreateBeamsCommand.ts — batch + deferred-Firestore precedent
 * @see ../../../hooks/data/useSlabPersistence.ts — create + delete listeners
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §GEN-SLAB
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { SlabEntity } from '../../../bim/types/slab-types';
import type { AnySceneEntity } from '../../../types/scene';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { emitBimEntityCreated, emitBimEntityDeleteRequested } from '../../../systems/events/bim-entity-lifecycle-events';

const SLAB_TOOL = 'slab';

export class CreateSlabsCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateSlabs';
  readonly type = 'create-slabs';
  readonly timestamp: number;

  private readonly slabs: readonly SlabEntity[];
  private wasExecuted = false;

  constructor(
    slabs: readonly SlabEntity[],
    private readonly sceneManager: ISceneManager,
  ) {
    // Defensive deep-clone: snapshots ανεξάρτητα από μετέπειτα live-scene edits.
    this.slabs = slabs.map((s) => deepClone(s));
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

  /** scene: add κάθε πλάκα. */
  private applyScene(): void {
    for (const s of this.slabs) {
      this.sceneManager.addEntity(deepClone(s) as unknown as SceneEntity);
    }
  }

  /** scene: remove κάθε πλάκα. */
  private revertScene(): void {
    for (const s of this.slabs) this.sceneManager.removeEntity(s.id);
  }

  /**
   * Firestore side-effects, deferred σε microtask ώστε να τρέχουν μετά το
   * synchronous command dispatch (mirror `CreateBeamsCommand`).
   */
  private deferFirestore(direction: 'apply' | 'revert'): void {
    const slabs = this.slabs;
    queueMicrotask(() => {
      if (direction === 'apply') {
        for (const s of slabs) {
          emitBimEntityCreated(deepClone(s) as unknown as AnySceneEntity, SLAB_TOOL);
        }
      } else {
        for (const s of slabs) {
          emitBimEntityDeleteRequested('slab', s.id);
        }
      }
    });
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Create ${this.slabs.length} grid slabs`;
  }

  getAffectedEntityIds(): string[] {
    return this.slabs.map((s) => s.id);
  }

  validate(): string | null {
    if (this.slabs.length === 0) return 'At least one slab is required';
    if (this.slabs.some((s) => !s.id)) return 'Every slab must have an id';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { slabIds: this.slabs.map((s) => s.id) },
      version: 1,
    };
  }
}
