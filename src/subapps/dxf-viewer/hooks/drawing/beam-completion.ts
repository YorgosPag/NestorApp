/**
 * ADR-363 Phase 5 + ADR-369 Phase A4 — Pure builders για beam entity creation.
 *
 * SSoT:
 *   - Entity creation via `createBeam()` factory (ADR-369 Phase A4).
 *   - IDs auto-generated από factory (prefix 'beam').
 *   - Geometry via `computeBeamGeometry()` — pure function.
 *   - Validation via `validateBeamParams()` — hardErrors block creation.
 *   - Types via `bim/types/beam-types.ts`.
 *
 * Placement flows:
 *   - 2-click (straight / cantilever): start → end, `completeBeamFromTwoClicks`.
 *   - 3-click (curved): start → end → curveControl, `completeBeamFromThreeClicks`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §2.2, §9 Q5, §9 Q8
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_BEAM_DEPTH_MM,
  DEFAULT_BEAM_TOP_ELEVATION_MM,
  DEFAULT_BEAM_WIDTH_MM,
  DEFAULT_BEAM_Z_OFFSET_MM,
  type BeamEntity,
  type BeamKind,
  type BeamParams,
  type BeamSupportType,
} from '../../bim/types/beam-types';
import { computeBeamGeometry } from '../../bim/geometry/beam-geometry';
import { validateBeamParams } from '../../bim/validators/beam-validator';
import { createBeam } from '@/services/factories/beam.factory';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides για `buildDefaultBeamParams`. Ribbon (contextual beam
 * tab) supplies kind / supportType / width / depth / topElevation / zOffset / material.
 */
export interface BeamParamOverrides {
  readonly kind?: BeamKind;
  readonly supportType?: BeamSupportType;
  /** mm. */
  readonly width?: number;
  /** mm. */
  readonly depth?: number;
  /** mm. Top face (top-of-beam) από project origin. ADR-369 §2.2. */
  readonly topElevation?: number;
  /** mm. Drop-from-ceiling offset (default 0). ADR-369 §854. */
  readonly zOffset?: number;
  readonly material?: string;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Resolve default support type based on kind. Cantilever beams MUST be
 * `'cantilever'`; straight/curved default σε `'simple'`.
 */
function defaultSupportType(kind: BeamKind): BeamSupportType {
  return kind === 'cantilever' ? 'cantilever' : 'simple';
}

/**
 * Build `BeamParams` από 2 click points + optional overrides.
 *
 *   1. Resolve kind (override → 'straight' default).
 *   2. Lift 2D points σε Point3D (z=0).
 *   3. Resolve width / depth / topElevation / zOffset / supportType.
 */
export function buildDefaultBeamParams(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  kindArg?: BeamKind,
  overrides: BeamParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): BeamParams {
  const kind = overrides.kind ?? kindArg ?? 'straight';
  const start: Point3D = { x: startPoint.x, y: startPoint.y, z: 0 };
  const end: Point3D = { x: endPoint.x, y: endPoint.y, z: 0 };
  const width = overrides.width ?? DEFAULT_BEAM_WIDTH_MM;
  const depth = overrides.depth ?? DEFAULT_BEAM_DEPTH_MM;
  const topElevation = overrides.topElevation ?? DEFAULT_BEAM_TOP_ELEVATION_MM;
  const zOffset = overrides.zOffset ?? DEFAULT_BEAM_Z_OFFSET_MM;
  const supportType = overrides.supportType ?? defaultSupportType(kind);

  const params: BeamParams = {
    kind,
    startPoint: start,
    endPoint: end,
    width,
    depth,
    topElevation,
    zOffset,
    supportType,
    sceneUnits,
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
  };
  return params;
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildBeamEntityResult =
  | { readonly ok: true; readonly entity: BeamEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `BeamEntity` από `BeamParams`. Geometry computed via SSoT
 * `computeBeamGeometry()`. Hard errors short-circuit creation. Final entity
 * assembled via `createBeam()` factory (ADR-369 Phase A4) — auto-fills
 * ifcGuid + ifcType='IfcBeam' + zOffset default 0.
 *
 * `sceneUnits` — passed to validator so length thresholds scale correctly
 * in non-mm scenes (mirrors wall/stair builder pattern).
 */
export function buildBeamEntity(
  params: Readonly<BeamParams>,
  layerId: string,
  sceneUnits: SceneUnits = 'mm',
): BuildBeamEntityResult {
  const validation = validateBeamParams(params, sceneUnits);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  // params.sceneUnits is already stored; computeBeamGeometry reads it directly.
  const geometry = computeBeamGeometry(params);
  const entity = createBeam({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  return { ok: true, entity };
}

// ─── Two-click + three-click completion helpers ─────────────────────────────

/**
 * High-level helper που bridges το beam-tool FSM (2-click chain) και το
 * builder pipeline. Pure — no side effects. Για straight + cantilever.
 */
export function completeBeamFromTwoClicks(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  layerId: string,
  kind: BeamKind = 'straight',
  overrides: BeamParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): BuildBeamEntityResult {
  const params = buildDefaultBeamParams(startPoint, endPoint, kind, overrides, sceneUnits);
  return buildBeamEntity(params, layerId, sceneUnits);
}

/**
 * Helper για curved kind (3-click flow). `curveControlPoint` = quadratic
 * Bezier control. Pure — no side effects.
 */
export function completeBeamFromThreeClicks(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  curveControlPoint: Readonly<Point2D>,
  layerId: string,
  overrides: BeamParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): BuildBeamEntityResult {
  const base = buildDefaultBeamParams(startPoint, endPoint, 'curved', overrides, sceneUnits);
  const curveControl: Point3D = { x: curveControlPoint.x, y: curveControlPoint.y, z: 0 };
  const params: BeamParams = { ...base, kind: 'curved', curveControl };
  return buildBeamEntity(params, layerId, sceneUnits);
}
