/**
 * ADR-410 — Pure builders for furniture entity creation.
 *
 * SSoT:
 *   - IDs via `generateFurnitureId()` (createFurniture factory, N.6).
 *   - Geometry via `computeFurnitureGeometry()` — pure function.
 *   - Validation via `validateFurnitureParams()` — hardErrors block creation.
 *   - Footprint defaults via `resolveFurnitureAsset()` (catalog SSoT).
 *   - Types via `bim/types/furniture-types.ts`.
 *
 * Single-click flow:
 *   - User picks the furniture tool → asset preselected (default `chair_01`).
 *   - Click on canvas → `buildDefaultFurnitureParams(clickPoint, overrides)`
 *     resolves position + footprint (from catalog) + rotation + mounting.
 *   - `buildFurnitureEntity()` validates + builds the entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_FURNITURE_DEPTH_MM,
  DEFAULT_FURNITURE_HEIGHT_MM,
  DEFAULT_FURNITURE_MOUNTING_ELEVATION_MM,
  DEFAULT_FURNITURE_WIDTH_MM,
  type FurnitureEntity,
  type FurnitureKind,
  type FurnitureParams,
} from '../../bim/types/furniture-types';
import {
  computeFurnitureGeometry,
  validateFurnitureParams,
} from '../../bim/furniture/furniture-geometry';
import {
  DEFAULT_FURNITURE_ASSET_ID,
  resolveFurnitureAsset,
} from '../../bim/furniture/furniture-catalog';
import { createFurniture } from '@/services/factories/furniture.factory';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides for `buildDefaultFurnitureParams`. The ribbon (contextual
 * furniture tab) supplies assetId / rotation / mounting elevation / scale.
 * Footprint dims default from the catalog entry of `assetId`.
 */
export interface FurnitureParamOverrides {
  readonly assetId?: string;
  /** mm. Footprint width (X before rotation). Default = catalog. */
  readonly widthMm?: number;
  /** mm. Footprint depth (Y before rotation). Default = catalog. */
  readonly depthMm?: number;
  /** mm. Overall height. Default = catalog. */
  readonly heightMm?: number;
  /** mm. Mounting elevation above FFL. */
  readonly mountingElevationMm?: number;
  /** Degrees CCW about the vertical axis. */
  readonly rotationDeg?: number;
  /** Uniform mesh scale multiplier. */
  readonly scaleOverride?: number;
  readonly material?: string;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `FurnitureParams` from a clicked point + optional overrides. Footprint
 * dimensions resolve from the catalog entry of `assetId` (authored SSoT), with
 * per-call overrides on top.
 */
export function buildDefaultFurnitureParams(
  clickPoint: Readonly<Point2D>,
  overrides: FurnitureParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): FurnitureParams {
  const assetId = overrides.assetId ?? DEFAULT_FURNITURE_ASSET_ID;
  const preset = resolveFurnitureAsset(assetId);
  const kind: FurnitureKind = preset?.kind ?? 'chair';

  const widthMm = overrides.widthMm ?? preset?.widthMm ?? DEFAULT_FURNITURE_WIDTH_MM;
  const depthMm = overrides.depthMm ?? preset?.depthMm ?? DEFAULT_FURNITURE_DEPTH_MM;
  const heightMm = overrides.heightMm ?? preset?.heightMm ?? DEFAULT_FURNITURE_HEIGHT_MM;
  const mountingElevationMm = overrides.mountingElevationMm ?? DEFAULT_FURNITURE_MOUNTING_ELEVATION_MM;
  const rotationDeg = overrides.rotationDeg ?? 0;

  const position: Point3D = { x: clickPoint.x, y: clickPoint.y, z: 0 };

  return {
    kind,
    assetId,
    position,
    rotationDeg,
    widthMm,
    depthMm,
    heightMm,
    mountingElevationMm,
    sceneUnits,
    ...(overrides.scaleOverride !== undefined ? { scaleOverride: overrides.scaleOverride } : {}),
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
  };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildFurnitureEntityResult =
  | { readonly ok: true; readonly entity: FurnitureEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `FurnitureEntity` from `FurnitureParams`. Geometry computed via SSoT
 * `computeFurnitureGeometry()`. Hard errors short-circuit creation.
 */
export function buildFurnitureEntity(
  params: Readonly<FurnitureParams>,
  layerId: string,
): BuildFurnitureEntityResult {
  const validation = validateFurnitureParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeFurnitureGeometry(params);
  const entity = createFurniture({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  return { ok: true, entity };
}
