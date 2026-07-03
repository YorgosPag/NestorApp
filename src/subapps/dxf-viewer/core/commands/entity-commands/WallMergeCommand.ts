/**
 * WALL MERGE COMMAND — ADR-566 (Merge/Join Walls).
 *
 * Atomic undo/redo command for merging two collinear straight walls into one,
 * re-hosting every opening of both onto the merged wall. The inverse of
 * `WallSplitCommand`.
 *
 * execute():
 *   1. Remove wallA + wallB from the scene.
 *   2. Add the merged wall (spanning both, outer-to-outer).
 *   3. Re-host each opening: new wallId + recomputed offsetFromStart, geometry +
 *      validation via the shared host-lookup patch (soft-orphan safe).
 *
 * undo():
 *   1. Remove the merged wall.
 *   2. Restore wallA + wallB (verbatim snapshots).
 *   3. Restore original opening params (reversed order).
 *
 * redo(): delegates to execute().
 *
 * @see core/commands/entity-commands/WallSplitCommand.ts — the mirrored inverse
 * @see docs/centralized-systems/reference/adrs/ADR-566-merge-join-walls.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { OpeningUpdate } from '../../../bim/walls/wall-split';
import { applyOpeningHostPatch } from '../../../bim/walls/opening-host-patch';
import { generateEntityId } from '../../../systems/entity-creation/utils';

// ── Command params ────────────────────────────────────────────────────────────

export interface WallMergeCommandParams {
  /** Full snapshot of the primary (first-picked) wall — restored verbatim on undo. */
  readonly wallA: WallEntity;
  /** Full snapshot of the secondary wall — restored verbatim on undo. */
  readonly wallB: WallEntity;
  /** New merged wall spanning both (fresh id, hostedOpeningIds = all). */
  readonly merged: WallEntity;
  /** Param patches re-hosting every opening of A+B onto the merged wall. */
  readonly openingUpdates: readonly OpeningUpdate[];
}

// ── Command implementation ────────────────────────────────────────────────────

export class WallMergeCommand implements ICommand {
  readonly id: string;
  readonly name = 'MergeWalls';
  readonly type = 'wall-merge';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly params: WallMergeCommandParams,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const { wallA, wallB, merged, openingUpdates } = this.params;
    this.sceneManager.removeEntity(wallA.id);
    this.sceneManager.removeEntity(wallB.id);
    this.sceneManager.addEntity(merged as unknown as SceneEntity);
    for (const upd of openingUpdates) {
      applyOpeningHostPatch(this.sceneManager, upd.openingId, upd.nextParams);
    }
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    const { wallA, wallB, merged, openingUpdates } = this.params;
    this.sceneManager.removeEntity(merged.id);
    this.sceneManager.addEntity(wallA as unknown as SceneEntity);
    this.sceneManager.addEntity(wallB as unknown as SceneEntity);
    for (let i = openingUpdates.length - 1; i >= 0; i--) {
      const upd = openingUpdates[i];
      applyOpeningHostPatch(this.sceneManager, upd.openingId, upd.previousParams);
    }
  }

  redo(): void {
    this.execute();
  }

  validate(): string | null {
    if (!this.params.wallA.id) return 'Wall A ID is required';
    if (!this.params.wallB.id) return 'Wall B ID is required';
    if (!this.params.merged.id) return 'Merged wall ID is required';
    return null;
  }

  getDescription(): string {
    const n = this.params.openingUpdates.length;
    return n > 0
      ? `Merge walls (${n} opening${n === 1 ? '' : 's'} re-hosted)`
      : 'Merge walls';
  }

  getAffectedEntityIds(): string[] {
    return [
      this.params.wallA.id,
      this.params.wallB.id,
      this.params.merged.id,
      ...this.params.openingUpdates.map((u) => u.openingId),
    ];
  }

  canMergeWith(_other: ICommand): boolean { return false; }

  mergeWith(_other: ICommand): ICommand { return this; }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        wallAId: this.params.wallA.id,
        wallBId: this.params.wallB.id,
        mergedId: this.params.merged.id,
        openingUpdateCount: this.params.openingUpdates.length,
      },
      version: 1,
    };
  }
}
