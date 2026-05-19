/**
 * BIM COPY COMMAND — ADR-363 Phase 7.2
 *
 * Wraps `buildBimCopyClones` (SSoT) in an undoable `ICommand`. Handles the
 * scene-side of copy: addEntity on execute / redo, removeEntity on undo.
 * Firestore writes happen automatically via the existing per-type persistence
 * subscriptions (`useWallPersistence`, `useOpeningPersistence`, …) — the
 * clones carry kind-specific enterprise IDs (`wall_<ulid>`, `opening_<ulid>`,
 * …) so the subscriptions `setDoc()` them to the correct collection.
 *
 * Why a new command class (rather than extending `CopyEntityCommand`):
 *   The existing `CopyEntityCommand` is grip-flow specific (vertex-stretch +
 *   anchor-translate displacement, math layer = `stretch-entity-transform`).
 *   The BIM clipboard-style copy needs:
 *     - kind-specific ID generation (SOS N.6)
 *     - host rewire (wallId / slabId)
 *     - per-kind param transform (translate / mirror / rotate via Phase 7.2
 *       SSoTs)
 *   Conflating both into one class would obscure both responsibilities, so
 *   we keep `CopyEntityCommand` intact for grip flows and route BIM Copy
 *   through `BimCopyCommand`.
 *
 * @see bim/transforms/bim-copy-builder.ts — pure SSoT
 * @see CopyEntityCommand — grip-flow analog (NOT extended)
 */
import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import {
  buildBimCopyClones,
  type BimCopyTransform,
} from '../../../bim/transforms/bim-copy-builder';

export class BimCopyCommand implements ICommand {
  readonly id: string;
  readonly name = 'BimCopyEntities';
  readonly type = 'bim-copy-entities';
  readonly timestamp: number;

  /** IDs of the clones added by this command — used by undo() and redo(). */
  private createdEntityIds: string[] = [];

  /** Frozen clone snapshots — replayed verbatim on redo (deterministic). */
  private cloneSnapshots: SceneEntity[] = [];

  /** Source IDs that were skipped during the initial execute (for descr). */
  private skipped: string[] = [];

  private wasExecuted = false;

  constructor(
    private readonly sourceIds: readonly string[],
    private readonly transform: BimCopyTransform,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const result = buildBimCopyClones(this.sourceIds, this.transform, this.sceneManager);
    this.createdEntityIds = [];
    this.cloneSnapshots = result.clones.slice();
    this.skipped = result.skipped.slice();
    for (const clone of result.clones) {
      this.sceneManager.addEntity(clone);
      this.createdEntityIds.push(clone.id);
    }
    this.wasExecuted = this.createdEntityIds.length > 0;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const id of this.createdEntityIds) {
      this.sceneManager.removeEntity(id);
    }
  }

  redo(): void {
    // Replay snapshots verbatim — deterministic, immune to source mutations
    // that may have happened during the undone interval.
    this.createdEntityIds = [];
    for (const clone of this.cloneSnapshots) {
      this.sceneManager.addEntity(clone);
      this.createdEntityIds.push(clone.id);
    }
  }

  getDescription(): string {
    const n = this.createdEntityIds.length;
    return n === 1 ? 'Copy BIM entity' : `Copy ${n} BIM entities`;
  }

  getAffectedEntityIds(): string[] {
    return [...this.createdEntityIds];
  }

  validate(): string | null {
    if (this.sourceIds.length === 0) return 'At least one source entity is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        sourceIds: this.sourceIds,
        transform: this.transform,
        createdEntityIds: this.createdEntityIds,
        skipped: this.skipped,
      },
      version: 1,
    };
  }
}
