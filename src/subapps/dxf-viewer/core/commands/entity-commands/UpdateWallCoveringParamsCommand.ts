/**
 * UPDATE WALL COVERING PARAMS COMMAND — ADR-511.
 *
 * Patches `params` σε υπάρχον `WallCoveringEntity` και recompute-άρει `geometry`
 * atomically μέσω `computeWallCoveringGeometry()` ώστε ο renderer να μη διαβάζει stale
 * data. ΔΕΝ αγγίζει τον δομικό τοίχο (host) — το covering είναι ανεξάρτητη οντότητα.
 *
 * Merge/undo/redo skeleton inherited από `MergeableUpdateCommand` (ADR-507 §8) — διαδοχικά
 * drag samples collapse σε ΕΝΑ undo entry εντός του merge window. `useWallCoveringPersistence`
 * πιάνει το patched entity μέσω debounced auto-save.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 * @see core/commands/entity-commands/UpdateFloorFinishParamsCommand.ts — το πρότυπο
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { WallCoveringParams } from '../../../bim/types/wall-covering-types';
import { computeWallCoveringGeometry } from '../../../bim/types/wall-covering-types';
import {
  computeWallCoveringRenderGeometry,
  type WallCoveringHost,
} from '../../../bim/wall-coverings/wall-covering-strip-geometry';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

/** Narrow ένα SceneEntity σε WallCoveringHost (μόνο αν είναι τοίχος). */
function asWallHost(e: SceneEntity | undefined): WallCoveringHost | null {
  if (!e) return null;
  const probe = e as { type?: string; id?: string };
  if (probe.type !== 'wall' || typeof probe.id !== 'string') return null;
  return e as unknown as WallCoveringHost;
}

export class UpdateWallCoveringParamsCommand extends MergeableUpdateCommand<WallCoveringParams> {
  readonly name = 'UpdateWallCoveringParams';
  readonly type = 'update-wall-covering-params';

  constructor(
    coveringId: string,
    params: WallCoveringParams,
    previousParams: WallCoveringParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(coveringId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: WallCoveringParams): void {
    // Live render bits (outline + bbox) από τον host τοίχο, ώστε selection/hit-test να έχουν
    // ενημερωμένο στόχο μετά από κάθε edit. Ο 2D render παραμένει live ανεξάρτητα.
    const host = asWallHost(this.sceneManager.getEntity(params.hostWallId));
    const renderGeom = host ? computeWallCoveringRenderGeometry(host, params) : {};
    const geometry = { ...computeWallCoveringGeometry(params), ...renderGeom };
    const validation = { hasCodeViolations: false, violationKeys: [] as string[], lastValidatedAt: null };
    this.sceneManager.updateEntity(this.entityId, {
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: WallCoveringParams): UpdateWallCoveringParamsCommand {
    return new UpdateWallCoveringParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update wall covering params (${this.patch.faceSide}, ${this.patch.layers.length} layers)`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Wall covering entity ID is required';
    if (!this.patch.hostWallId) return 'hostWallId is required';
    if (this.patch.spanEndMm <= this.patch.spanStartMm) return 'spanEndMm must be > spanStartMm';
    if (this.patch.heightTopMm <= this.patch.heightBottomMm) return 'heightTopMm must be > heightBottomMm';
    if (!this.patch.layers || this.patch.layers.length < 1) return 'at least one covering layer is required';
    return null;
  }
}
