/**
 * ADR-610 — per-domain «apply patched params → recompute geometry+validation → write
 * entity» helpers for the attach/detach batch commands.
 *
 * Each attach/detach command's `applyEntityPatch` was the SAME 3-line recompute per
 * domain (column ×4 · wall ×3 · stair ×2), mirroring `Update<Domain>ParamsCommand`.
 * These are that single source — pure `sceneManager.updateEntity` calls, no binding
 * logic (the binding mutation lives in `buildPatches` via
 * `attachEntitySide`/`detachEntitySide`).
 *
 * @see ./attach-detach-command-base.ts — the Template-Method base consuming these
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { ColumnGeometry, ColumnParams } from '../../../bim/types/column-types';
import { computeColumnGeometry } from '../../../bim/geometry/column-geometry';
import { validateColumnParams } from '../../../bim/validators/column-validator';
import type { WallGeometry, WallKind, WallParams } from '../../../bim/types/wall-types';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { validateWallParams } from '../../../bim/validators/wall-validator';
import type { StairGeometry, StairParams } from '../../../bim/types/stair-types';
import { computeStairGeometry } from '../../../bim/geometry/stairs/StairGeometryService';
import { validateStairParams } from '../../../bim/stairs/stair-validator';
import type { AttachDetachPatch } from './attach-detach-command-base';

/**
 * Wall attach/detach patch — carries `kind` alongside the {prev, next} params because
 * `computeWallGeometry` needs it (shared by the 3 wall attach/detach commands).
 */
export interface WallAttachDetachPatch extends AttachDetachPatch<WallParams> {
  readonly kind: WallKind;
}

/** Recompute + write a column entity from patched params (`kind` synced on the root). */
export function recomputeColumnEntity(
  sceneManager: ISceneManager,
  columnId: string,
  params: ColumnParams,
): void {
  const geometry: ColumnGeometry = computeColumnGeometry(params);
  const validation = validateColumnParams(params).bimValidation;
  sceneManager.updateEntity(columnId, {
    kind: params.kind,
    params,
    geometry,
    validation,
  } as unknown as Partial<SceneEntity>);
}

/** Recompute + write a wall entity from patched params (geometry needs `kind`). */
export function recomputeWallEntity(
  sceneManager: ISceneManager,
  wallId: string,
  params: WallParams,
  kind: WallKind,
): void {
  const geometry: WallGeometry = computeWallGeometry(params, kind);
  const validation = validateWallParams(params).bimValidation;
  sceneManager.updateEntity(wallId, {
    params,
    geometry,
    validation,
  } as unknown as Partial<SceneEntity>);
}

/** Recompute + write a stair entity from patched params. */
export function recomputeStairEntity(
  sceneManager: ISceneManager,
  stairId: string,
  params: StairParams,
): void {
  const geometry: StairGeometry = computeStairGeometry(params);
  const validation = validateStairParams(params);
  sceneManager.updateEntity(stairId, {
    params,
    geometry,
    validation,
  } as unknown as Record<string, unknown>);
}
