/**
 * CREATE BEAMS COMMAND — ADR-441 Slice GEN-BEAM («Δοκάρια από κάναβο»).
 *
 * Batch-creates N pre-built `BeamEntity` (στα segments του κανάβου) σε ΕΝΑ undoable
 * βήμα, ώστε οι αυτόματες δοκοί να πέφτουν ως μία Revit transaction (ένα Ctrl+Z
 * αφαιρεί ΟΛΕΣ). Ακριβής mirror του `CreateWallsCommand`/`CreateFoundationsCommand`.
 *
 * Γιατί ειδική command (όχι `CreateEntityCommand`): η beam persistence κλειδώνει στο
 * `drawing:entity-created` EventBus broadcast (το trigger του `addBeamToScene` για το
 * manual tool). Το `CreateEntityCommand` δεν το εκπέμπει → δοκός μέσω αυτού δεν θα
 * persist-άρει ποτέ. Side-effects deferred σε microtask ώστε να τρέχουν ΜΕΤΑ το
 * synchronous `CommandHistory.execute`.
 *
 * v1 scope: ΧΩΡΙΣ auto-miter στις τομές (create-only, Revit frame-into).
 *
 * @see ./CreateWallsCommand.ts — batch + deferred-Firestore precedent
 * @see ../../../bim/beams/add-beam-to-scene.ts — manual-draw append SSoT
 * @see ../../../hooks/data/useBeamPersistence.ts — create + delete listeners
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { BeamEntity } from '../../../bim/types/beam-types';
import type { AnySceneEntity } from '../../../types/scene';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { emitBimEntityCreated, emitBimEntityDeleteRequested } from '../../../systems/events/bim-entity-lifecycle-events';

const BEAM_TOOL = 'beam';

export class CreateBeamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateBeams';
  readonly type = 'create-beams';
  readonly timestamp: number;

  private readonly beams: readonly BeamEntity[];
  private wasExecuted = false;

  constructor(
    beams: readonly BeamEntity[],
    private readonly sceneManager: ISceneManager,
  ) {
    // Defensive deep-clone: snapshots ανεξάρτητα από μετέπειτα live-scene edits.
    this.beams = beams.map((b) => deepClone(b));
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

  /** scene: add κάθε δοκό. */
  private applyScene(): void {
    for (const b of this.beams) {
      this.sceneManager.addEntity(deepClone(b) as unknown as SceneEntity);
    }
  }

  /** scene: remove κάθε δοκό. */
  private revertScene(): void {
    for (const b of this.beams) this.sceneManager.removeEntity(b.id);
  }

  /**
   * Firestore side-effects, deferred σε microtask ώστε να τρέχουν μετά το
   * synchronous command dispatch (mirror `CreateWallsCommand`).
   */
  private deferFirestore(direction: 'apply' | 'revert'): void {
    const beams = this.beams;
    queueMicrotask(() => {
      if (direction === 'apply') {
        for (const b of beams) {
          emitBimEntityCreated(deepClone(b) as unknown as AnySceneEntity, BEAM_TOOL);
        }
      } else {
        for (const b of beams) {
          emitBimEntityDeleteRequested('beam', b.id);
        }
      }
    });
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Create ${this.beams.length} grid beams`;
  }

  getAffectedEntityIds(): string[] {
    return this.beams.map((b) => b.id);
  }

  validate(): string | null {
    if (this.beams.length === 0) return 'At least one beam is required';
    if (this.beams.some((b) => !b.id)) return 'Every beam must have an id';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { beamIds: this.beams.map((b) => b.id) },
      version: 1,
    };
  }
}
