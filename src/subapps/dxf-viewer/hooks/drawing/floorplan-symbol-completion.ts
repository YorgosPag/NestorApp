/**
 * ADR-415 Φ1 — Pure builders for floorplan-symbol entity creation.
 *
 * SSoT:
 *   - IDs via `createFloorplanSymbol` factory (`generateFloorplanSymbolId`, N.6).
 *   - Geometry via `computeFloorplanSymbolGeometry()` — pure function.
 *   - Validation via `validateFloorplanSymbolParams()` — hardErrors block creation.
 *   - Footprint defaults via `resolveFloorplanSymbolPreset()` (catalog SSoT).
 *   - Category (discipline/IFC) via `resolveFloorplanSymbolPreset().category`.
 *
 * Single-click flow:
 *   - User picks the floorplan-symbol tool → asset preselected (default WC).
 *   - Click on canvas → `buildDefaultFloorplanSymbolParams(clickPoint, overrides)`
 *     resolves position + footprint (from catalog) + rotation.
 *   - `buildFloorplanSymbolEntity()` validates + builds the entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_FLOORPLAN_SYMBOL_DEPTH_MM,
  DEFAULT_FLOORPLAN_SYMBOL_WIDTH_MM,
  type FloorplanSymbolCategory,
  type FloorplanSymbolEntity,
  type FloorplanSymbolKind,
  type FloorplanSymbolParams,
} from '../../bim/types/floorplan-symbol-types';
import {
  computeFloorplanSymbolGeometry,
  validateFloorplanSymbolParams,
} from '../../bim/floorplan-symbols/floorplan-symbol-geometry';
import {
  DEFAULT_FLOORPLAN_SYMBOL_ASSET_ID,
  resolveFloorplanSymbolPreset,
} from '../../bim/floorplan-symbols/floorplan-symbol-catalog';
import { createFloorplanSymbol } from '@/services/factories/floorplan-symbol.factory';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

export interface FloorplanSymbolParamOverrides {
  readonly assetId?: string;
  /** mm. Footprint width (X before rotation). Default = catalog. */
  readonly widthMm?: number;
  /** mm. Footprint depth (Y before rotation). Default = catalog. */
  readonly depthMm?: number;
  /** Degrees CCW about the vertical axis. */
  readonly rotationDeg?: number;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `FloorplanSymbolParams` from a clicked point + optional overrides.
 * Footprint dimensions + category + kind resolve from the catalog entry of
 * `assetId` (authored SSoT), with per-call overrides on top.
 */
export function buildDefaultFloorplanSymbolParams(
  clickPoint: Readonly<Point2D>,
  overrides: FloorplanSymbolParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): FloorplanSymbolParams {
  const assetId = overrides.assetId ?? DEFAULT_FLOORPLAN_SYMBOL_ASSET_ID;
  const preset = resolveFloorplanSymbolPreset(assetId);
  const category: FloorplanSymbolCategory = preset?.category ?? 'sanitary';
  const kind: FloorplanSymbolKind = preset?.kind ?? 'wc';

  const widthMm = overrides.widthMm ?? preset?.widthMm ?? DEFAULT_FLOORPLAN_SYMBOL_WIDTH_MM;
  const depthMm = overrides.depthMm ?? preset?.depthMm ?? DEFAULT_FLOORPLAN_SYMBOL_DEPTH_MM;
  const rotationDeg = overrides.rotationDeg ?? 0;

  const position: Point3D = { x: clickPoint.x, y: clickPoint.y, z: 0 };

  return {
    category,
    kind,
    assetId,
    position,
    rotationDeg,
    widthMm,
    depthMm,
    sceneUnits,
  };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildFloorplanSymbolEntityResult =
  | { readonly ok: true; readonly entity: FloorplanSymbolEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `FloorplanSymbolEntity` from params. Geometry computed via SSoT
 * `computeFloorplanSymbolGeometry()`. Hard errors short-circuit creation.
 */
export function buildFloorplanSymbolEntity(
  params: Readonly<FloorplanSymbolParams>,
  layerId: string,
): BuildFloorplanSymbolEntityResult {
  const validation = validateFloorplanSymbolParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeFloorplanSymbolGeometry(params);
  const entity = createFloorplanSymbol({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  return { ok: true, entity };
}
