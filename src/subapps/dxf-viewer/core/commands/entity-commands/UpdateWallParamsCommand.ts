/**
 * UPDATE WALL PARAMS COMMAND — ADR-363 Phase 1B.
 *
 * Patches `params` on an existing `WallEntity` and recomputes `geometry` +
 * `validation` atomically via `computeWallGeometry()` + `validateWallParams()`
 * so renderer reads never diverge from the parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 * The wall carries a CONSTANT `kind` discriminator (not part of the directional
 * patch — same for forward/undo) used by `computeWallGeometry`; it is threaded
 * through `withMergedPatch` and `serializedData` to preserve behaviour.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.9 §6
 */

import type { ISceneManager } from '../interfaces';
import type { WallGeometry, WallKind, WallParams } from '../../../bim/types/wall-types';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { validateWallParams } from '../../../bim/validators/wall-validator';
// ADR-363 §5.4 — hosted-opening cascade SSoT. After the wall geometry is
// patched, every opening hosted on this wall is recomputed atomically so it
// follows the wall (grip / endpoint / length-edit / ribbon / bulk all funnel
// through this command). Same offsetFromStart, new wall → computeOpeningGeometry.
import { cascadeHostedOpeningsForWalls } from '../../../bim/walls/wall-opening-coordinator';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateWallParamsCommand extends MergeableUpdateCommand<WallParams> {
  readonly name = 'UpdateWallParams';
  readonly type = 'update-wall-params';

  private readonly kind: WallKind;

  constructor(
    wallId: string,
    params: WallParams,
    previousParams: WallParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
    kind: WallKind = 'straight',
  ) {
    super(wallId, params, previousParams, sceneManager, isDragging);
    this.kind = kind;
  }

  protected applyPatch(params: WallParams): void {
    const geometry: WallGeometry = computeWallGeometry(params, this.kind);
    const validation = validateWallParams(params).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      params,
      geometry,
      validation,
    } as unknown as Record<string, unknown>);
    // ADR-363 §5.4 — recompute hosted openings against the now-updated wall.
    cascadeHostedOpeningsForWalls([this.entityId], this.sceneManager);
  }

  protected withMergedPatch(nextPatch: WallParams): UpdateWallParamsCommand {
    return new UpdateWallParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
      this.kind,
    );
  }

  getDescription(): string {
    return `Update wall params (${this.patch.category})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Wall entity ID is required';
    if (this.patch.thickness <= 0) return 'thickness must be > 0';
    if (this.patch.height <= 0) return 'height must be > 0';
    return null;
  }

  protected serializedData(): Record<string, unknown> {
    // Canonical base shape + Wall's genuine extra state (the geometry `kind`).
    return { ...this.baseSerializedData(), kind: this.kind };
  }
}
