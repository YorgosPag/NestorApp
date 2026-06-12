/**
 * CREATE WALLS COMMAND — ADR-441 Slice GEN-WALL («Τοίχοι από κάναβο»).
 *
 * Batch-creates N pre-built `WallEntity` (στα segments του κανάβου) σε ΕΝΑ undoable
 * βήμα, ώστε οι αυτόματοι τοίχοι να πέφτουν ως μία Revit transaction (ένα Ctrl+Z
 * αφαιρεί ΟΛΟΥΣ). Ακριβής mirror του `CreateFoundationsCommand`/`CreateColumnsCommand`.
 *
 * Γιατί ειδική command (όχι `CreateEntityCommand`): η wall persistence κλειδώνει στο
 * `drawing:entity-created` EventBus broadcast (το trigger του `addWallToScene` για το
 * manual tool). Το `CreateEntityCommand` δεν το εκπέμπει → τοίχος μέσω αυτού δεν θα
 * persist-άρει ποτέ. Side-effects deferred σε microtask ώστε να τρέχουν ΜΕΤΑ το
 * synchronous `CommandHistory.execute`.
 *
 * v1 scope: ΧΩΡΙΣ auto-miter στις τομές (το `addWallToScene` κάνει trim recompute· εδώ
 * προστίθεται απευθείας στη σκηνή ώστε το batch να μένει atomic). Miter-join εσχάρας
 * τοίχων = DEFER (ίδια incrementally προσέγγιση με την εσχάρα θεμελίωσης).
 *
 * @see ./CreateFoundationsCommand.ts — batch + deferred-Firestore precedent
 * @see ../../../bim/walls/add-wall-to-scene.ts — manual-draw append SSoT
 * @see ../../../hooks/data/useWallPersistence.ts — create + delete listeners
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { AnySceneEntity } from '../../../types/scene';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { EventBus } from '../../../systems/events/EventBus';

const WALL_TOOL = 'wall';

export class CreateWallsCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateWalls';
  readonly type = 'create-walls';
  readonly timestamp: number;

  private readonly walls: readonly WallEntity[];
  private wasExecuted = false;

  constructor(
    walls: readonly WallEntity[],
    private readonly sceneManager: ISceneManager,
  ) {
    // Defensive deep-clone: snapshots ανεξάρτητα από μετέπειτα live-scene edits.
    this.walls = walls.map((w) => deepClone(w));
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

  /** scene: add κάθε τοίχο. */
  private applyScene(): void {
    for (const w of this.walls) {
      this.sceneManager.addEntity(deepClone(w) as unknown as SceneEntity);
    }
  }

  /** scene: remove κάθε τοίχο. */
  private revertScene(): void {
    for (const w of this.walls) this.sceneManager.removeEntity(w.id);
  }

  /**
   * Firestore side-effects, deferred σε microtask ώστε να τρέχουν μετά το
   * synchronous command dispatch (mirror `CreateFoundationsCommand`).
   */
  private deferFirestore(direction: 'apply' | 'revert'): void {
    const walls = this.walls;
    queueMicrotask(() => {
      if (direction === 'apply') {
        for (const w of walls) {
          EventBus.emit('drawing:entity-created', {
            entity: deepClone(w) as unknown as AnySceneEntity,
            tool: WALL_TOOL,
          });
        }
      } else {
        for (const w of walls) {
          EventBus.emit('bim:wall-delete-requested', { wallId: w.id });
        }
      }
    });
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Create ${this.walls.length} grid walls`;
  }

  getAffectedEntityIds(): string[] {
    return this.walls.map((w) => w.id);
  }

  validate(): string | null {
    if (this.walls.length === 0) return 'At least one wall is required';
    if (this.walls.some((w) => !w.id)) return 'Every wall must have an id';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { wallIds: this.walls.map((w) => w.id) },
      version: 1,
    };
  }
}
