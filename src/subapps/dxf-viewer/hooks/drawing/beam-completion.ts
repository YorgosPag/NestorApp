/**
 * ADR-363 Phase 5 — Pure builders για beam entity creation.
 *
 * SSoT:
 *   - IDs via `generateBeamId()` (N.6 enterprise-id).
 *   - Geometry via `computeBeamGeometry()` — pure function.
 *   - Validation via `validateBeamParams()` — hardErrors block creation.
 *   - Types via `bim/types/beam-types.ts`.
 *
 * Placement flows:
 *   - 2-click (straight / cantilever): start → end, `completeBeamFromTwoClicks`.
 *   - 3-click (curved): start → end → curveControl, `completeBeamFromThreeClicks`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_BEAM_DEPTH_MM,
  DEFAULT_BEAM_ELEVATION_MM,
  DEFAULT_BEAM_WIDTH_MM,
  type BeamEntity,
  type BeamKind,
  type BeamParams,
  type BeamSupportType,
} from '../../bim/types/beam-types';
import { computeBeamGeometry } from '../../bim/geometry/beam-geometry';
import { validateBeamParams } from '../../bim/validators/beam-validator';
import { generateBeamId } from '@/services/enterprise-id-convenience';

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides για `buildDefaultBeamParams`. Ribbon (contextual beam
 * tab) supplies kind / supportType / width / depth / elevation / material.
 */
export interface BeamParamOverrides {
  readonly kind?: BeamKind;
  readonly supportType?: BeamSupportType;
  /** mm. */
  readonly width?: number;
  /** mm. */
  readonly depth?: number;
  /** mm. Top-of-beam από project origin. */
  readonly elevation?: number;
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
 *   3. Resolve width / depth / elevation / supportType (override → defaults).
 */
export function buildDefaultBeamParams(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  kindArg?: BeamKind,
  overrides: BeamParamOverrides = {},
): BeamParams {
  const kind = overrides.kind ?? kindArg ?? 'straight';
  const start: Point3D = { x: startPoint.x, y: startPoint.y, z: 0 };
  const end: Point3D = { x: endPoint.x, y: endPoint.y, z: 0 };
  const width = overrides.width ?? DEFAULT_BEAM_WIDTH_MM;
  const depth = overrides.depth ?? DEFAULT_BEAM_DEPTH_MM;
  const elevation = overrides.elevation ?? DEFAULT_BEAM_ELEVATION_MM;
  const supportType = overrides.supportType ?? defaultSupportType(kind);

  const params: BeamParams = {
    kind,
    startPoint: start,
    endPoint: end,
    width,
    depth,
    elevation,
    supportType,
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
 * `computeBeamGeometry()`. Hard errors short-circuit creation.
 */
export function buildBeamEntity(
  params: Readonly<BeamParams>,
  layerId: string,
): BuildBeamEntityResult {
  const validation = validateBeamParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeBeamGeometry(params);
  const entity: BeamEntity = {
    id: generateBeamId(),
    type: 'beam',
    kind: params.kind,
    layerId,
    params,
    geometry,
    validation: validation.bimValidation,
    visible: true,
  };
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
): BuildBeamEntityResult {
  const params = buildDefaultBeamParams(startPoint, endPoint, kind, overrides);
  return buildBeamEntity(params, layerId);
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
): BuildBeamEntityResult {
  const base = buildDefaultBeamParams(startPoint, endPoint, 'curved', overrides);
  const curveControl: Point3D = { x: curveControlPoint.x, y: curveControlPoint.y, z: 0 };
  const params: BeamParams = { ...base, kind: 'curved', curveControl };
  return buildBeamEntity(params, layerId);
}
