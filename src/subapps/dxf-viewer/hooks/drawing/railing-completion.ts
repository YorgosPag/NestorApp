/**
 * ADR-407 — Pure builders for railing entity creation (Φ1 sketch slice).
 *
 * SSoT:
 *   - IDs via `generateRailingId()` (createRailing factory, N.6).
 *   - Geometry via `computeRailingGeometry()` — pure SSoT engine.
 *   - Validation via `validateRailingParams()` — hardErrors block creation.
 *   - Types via `bim/types/railing-types.ts`.
 *
 * Two-click flow (AutoCAD `LINE` chain — PATH ⊥ TYPE):
 *   - User picks the railing tool → built-in `DEFAULT_RAILING_TYPE` preselected.
 *   - Click 1 = path start, Click 2 = path end → `buildDefaultRailingParams`
 *     assembles a straight `pathSource: { kind: 'sketch', path: [start, end] }`.
 *   - `buildRailingEntity()` validates + builds the entity (posts + balusters +
 *     top rail derived by the engine).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_RAILING_TOTAL_HEIGHT_MM,
  DEFAULT_RAILING_TYPE,
  type RailingEntity,
  type RailingParams,
  type RailingType,
} from '../../bim/types/railing-types';
import {
  computeRailingGeometry,
  validateRailingParams,
} from '../../bim/railings/railing-geometry';
import { createRailing } from '@/services/factories/railing.factory';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides for `buildDefaultRailingParams`. The ribbon supplies overall
 * height + datum elevation (+ a named Type in Φ6; Φ1 ships the single built-in
 * `DEFAULT_RAILING_TYPE`).
 */
export interface RailingParamOverrides {
  /** mm. Overall guardrail height (default 1000). */
  readonly totalHeightMm?: number;
  /** mm. Path datum elevation above the storey FFL (default 0). */
  readonly baseElevationMm?: number;
  /** Named Type (Φ6). Φ1 = `DEFAULT_RAILING_TYPE`. */
  readonly type?: RailingType;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `RailingParams` from 2 click points + optional overrides. Φ1: straight
 * standalone sketch path `[start, end]` (canvas-unit xy). The Type is the
 * built-in `DEFAULT_RAILING_TYPE` unless overridden.
 */
export function buildDefaultRailingParams(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  overrides: RailingParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
  storeyId?: string,
): RailingParams {
  const type = overrides.type ?? DEFAULT_RAILING_TYPE;
  const totalHeightMm = overrides.totalHeightMm ?? DEFAULT_RAILING_TOTAL_HEIGHT_MM;
  const baseElevationMm = overrides.baseElevationMm ?? 0;

  const path: Point3D[] = [
    { x: startPoint.x, y: startPoint.y, z: 0 },
    { x: endPoint.x, y: endPoint.y, z: 0 },
  ];

  return {
    type,
    pathSource: { kind: 'sketch', path },
    totalHeightMm,
    baseElevationMm,
    sceneUnits,
    ...(storeyId !== undefined ? { storeyId } : {}),
  };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildRailingEntityResult =
  | { readonly ok: true; readonly entity: RailingEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `RailingEntity` from `RailingParams`. Geometry computed via the SSoT
 * `computeRailingGeometry()`. Hard errors short-circuit creation.
 */
export function buildRailingEntity(
  params: Readonly<RailingParams>,
  layerId: string,
): BuildRailingEntityResult {
  const validation = validateRailingParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeRailingGeometry(params);
  const entity = createRailing({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  return { ok: true, entity };
}

// ─── Two-click completion helper ─────────────────────────────────────────────

/**
 * High-level helper bridging the railing-tool FSM (2-click chain) and the
 * builder pipeline. Pure — no side effects.
 */
export function completeRailingFromTwoClicks(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  layerId: string,
  overrides: RailingParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
  storeyId?: string,
): BuildRailingEntityResult {
  const params = buildDefaultRailingParams(startPoint, endPoint, overrides, sceneUnits, storeyId);
  return buildRailingEntity(params, layerId);
}
