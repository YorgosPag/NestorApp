/**
 * WALL SPLIT COMMAND — ADR-363 Phase 5.6
 *
 * Atomic undo/redo command for splitting a single straight wall into two
 * segments at a given offset, redistributing hosted openings between them.
 *
 * execute():
 *   1. Remove original wall from scene.
 *   2. Add wall1 (start → splitPoint) + wall2 (splitPoint → end).
 *   3. Patch each hosted opening: new wallId + adjusted offsetFromStart, and
 *      recompute geometry/validation via the host-wall lookup pattern from
 *      UpdateOpeningParamsCommand (soft-orphan safe).
 *
 * undo():
 *   1. Remove wall1 + wall2.
 *   2. Restore original wall (verbatim snapshot).
 *   3. Restore original opening params (reversed order).
 *
 * redo(): delegates to execute().
 *
 * No merging — each split is a discrete user action (no drag merge window).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase 5.6
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { OpeningGeometry, OpeningParams } from '../../../bim/types/opening-types';
import type { OpeningUpdate } from '../../../bim/walls/wall-split';
import { computeOpeningGeometry } from '../../../bim/geometry/opening-geometry';
import { validateOpeningParams } from '../../../bim/validators/opening-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';

// ── Command params ────────────────────────────────────────────────────────────

export interface WallSplitCommandParams {
  /** Full snapshot of the original wall — restored verbatim on undo. */
  readonly originalWall: WallEntity;
  /** New wall for segment [start → splitPoint]. */
  readonly wall1: WallEntity;
  /** New wall for segment [splitPoint → end]. */
  readonly wall2: WallEntity;
  /** Param patches for all hosted openings (wallId + offsetFromStart changes). */
  readonly openingUpdates: readonly OpeningUpdate[];
}

// ── Command implementation ────────────────────────────────────────────────────

export class WallSplitCommand implements ICommand {
  readonly id: string;
  readonly name = 'SplitWall';
  readonly type = 'wall-split';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly params: WallSplitCommandParams,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const { originalWall, wall1, wall2, openingUpdates } = this.params;
    this.sceneManager.removeEntity(originalWall.id);
    this.sceneManager.addEntity(wall1 as unknown as SceneEntity);
    this.sceneManager.addEntity(wall2 as unknown as SceneEntity);
    for (const upd of openingUpdates) {
      this.applyOpeningPatch(upd.openingId, upd.nextParams);
    }
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    const { originalWall, wall1, wall2, openingUpdates } = this.params;
    this.sceneManager.removeEntity(wall1.id);
    this.sceneManager.removeEntity(wall2.id);
    this.sceneManager.addEntity(originalWall as unknown as SceneEntity);
    for (let i = openingUpdates.length - 1; i >= 0; i--) {
      const upd = openingUpdates[i];
      this.applyOpeningPatch(upd.openingId, upd.previousParams);
    }
  }

  redo(): void {
    this.execute();
  }

  validate(): string | null {
    if (!this.params.originalWall.id) return 'Original wall ID is required';
    if (!this.params.wall1.id) return 'Wall1 ID is required';
    if (!this.params.wall2.id) return 'Wall2 ID is required';
    return null;
  }

  getDescription(): string {
    const n = this.params.openingUpdates.length;
    return n > 0
      ? `Split wall (${n} opening${n === 1 ? '' : 's'} redistributed)`
      : 'Split wall';
  }

  getAffectedEntityIds(): string[] {
    return [
      this.params.originalWall.id,
      this.params.wall1.id,
      this.params.wall2.id,
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
        originalWallId: this.params.originalWall.id,
        wall1Id: this.params.wall1.id,
        wall2Id: this.params.wall2.id,
        openingUpdateCount: this.params.openingUpdates.length,
      },
      version: 1,
    };
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  /**
   * Patches opening params + recomputes geometry/validation from the host wall.
   * Mirrors UpdateOpeningParamsCommand.applyPatch — soft-orphan safe (proceeds
   * even if the host wall is not yet in the scene).
   */
  private applyOpeningPatch(openingId: string, params: OpeningParams): void {
    const hostRaw = this.sceneManager.getEntity(params.wallId);
    const hostCandidate = hostRaw as unknown as Partial<WallEntity>;
    const patch: Record<string, unknown> = { params };

    if (hostCandidate?.type === 'wall' && hostCandidate.params && hostCandidate.geometry) {
      const host = hostCandidate as WallEntity;
      const geometry: OpeningGeometry = computeOpeningGeometry(params, host, host.params.sceneUnits ?? 'mm');
      const validation = validateOpeningParams(params, host).bimValidation;
      patch.geometry = geometry;
      patch.validation = validation;
    }

    this.sceneManager.updateEntity(openingId, patch as Partial<SceneEntity>);
  }
}
