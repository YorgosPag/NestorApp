/**
 * ADR-363 Φ1G.5 Slice 2 — Wall-hosted opening whole-object move: base-point
 * slide along the host wall axis + Alt-drag re-host ("Pick New Host").
 *
 * Extracted from `opening-grips.ts` (N.7.1 file-size split — the ADR-615
 * self-hosted branch pushed the host module past 500 lines). WALL-HOSTED ONLY
 * — a self-hosted opening never reaches this module: `opening-grips.ts`
 * branches to the centred-box SSoT (`applySelfHostedBoxGripDrag`, ADR-615
 * §Decision 4 — no wall, so REHOST is N/A) before calling in here. Re-exported from
 * `opening-grips.ts` so the public import path for existing consumers (3D /
 * renderer / ghost-preview) stays unchanged.
 *
 * @see bim/walls/opening-grips.ts — `applyOpeningGripDrag` / `applyOpeningAltSlide`
 *   (the self-hosted branch lives there; the wall-hosted move primitives live here)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { OpeningParams } from '../types/opening-types';
import { DEFAULT_FRAME_WIDTH_MM } from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';
import { projectPointToWallOffsetMm } from '../geometry/opening-geometry';
import { clamp } from '../../utils/scalar-math';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { mmToSceneUnits } from '../../utils/scene-units';

/** Επιτρεπτά offset bounds `[minOffset,maxOffset]` του opening στον host wall· `null` αν πολύ κοντός. */
export function openingOffsetBounds(
  params: OpeningParams,
  hostWall: WallEntity,
): { minOffset: number; maxOffset: number } | null {
  const hostLengthMm = hostWall.geometry.length * 1000;
  const frameWidth = params.frameWidth ?? DEFAULT_FRAME_WIDTH_MM;
  const minOffset = frameWidth;
  const maxOffset = hostLengthMm - params.width - frameWidth;
  if (maxOffset < minOffset) return null; // host too short for opening + jambs
  return { minOffset, maxOffset };
}

/** Apply a clamped offset → new params (referential no-op preserved). */
export function withOpeningOffset(
  params: OpeningParams,
  rawOffset: number,
  bounds: { minOffset: number; maxOffset: number },
): OpeningParams {
  const clamped = clamp(rawOffset, bounds.minOffset, bounds.maxOffset);
  if (clamped === params.offsetFromStart) return params;
  return { ...params, offsetFromStart: clamped };
}

/**
 * ADR-363 Φ1G.5 Slice 2 — Alt-drag «move-from-characteristic-point» for a hosted
 * opening: translate the WHOLE opening ALONG the host wall by the world `delta`,
 * keeping the grabbed point (`basePoint`) under the cursor. Unlike the free
 * whole-entity move (walls/columns/…), a hosted opening can only slide on its
 * wall, so the displacement is the component of `delta` along the wall axis —
 * computed via the projection SSoT (`projectPointToWallOffsetMm`) as the offset
 * difference between `basePoint` and `basePoint + delta`. Base-point semantics
 * (offset += Δ), NOT center-on-cursor, so grabbing any corner slides 1:1.
 * Clamped to the same [frame, hostLength − width − frame] bounds as `moveAlongWall`.
 */
export function slideAlongWallByDelta(
  params: OpeningParams,
  basePoint: Point2D,
  currentPos: Point2D,
  hostWall: WallEntity,
): OpeningParams {
  const bounds = openingOffsetBounds(params, hostWall);
  if (!bounds) return params;
  const baseMm = projectPointToWallOffsetMm(basePoint, hostWall);
  const curMm = projectPointToWallOffsetMm(currentPos, hostWall);
  return withOpeningOffset(params, params.offsetFromStart + (curMm - baseMm), bounds);
}

// ─── Re-host «Pick New Host» (ADR-363 Φ1G.5 Slice 2) ─────────────────────────

/**
 * mm — how close the cursor must come to ANOTHER wall's axis for the Alt-drag to
 * re-host the opening onto it (Revit «Pick New Host»). Below this → stays on the
 * current wall and slides. Converted to world units per scene via the host's units.
 */
export const OPENING_REHOST_SNAP_TOLERANCE_MM = 600;

/** World-unit re-host snap tolerance for a given host wall (scene-unit aware). */
export function openingRehostToleranceWorld(host: WallEntity): number {
  return OPENING_REHOST_SNAP_TOLERANCE_MM * mmToSceneUnits(host.params.sceneUnits ?? 'mm');
}

/** Nearest wall to `point` by axis distance, within `tolerance` (world units). null if none. */
function nearestWallTo(
  point: Point2D,
  walls: readonly WallEntity[],
  tolerance: number,
): WallEntity | null {
  let best: WallEntity | null = null;
  let bestDist = tolerance;
  for (const w of walls) {
    const d = pointToLineDistance(
      point,
      { x: w.params.start.x, y: w.params.start.y },
      { x: w.params.end.x, y: w.params.end.y },
    );
    if (d <= bestDist) { bestDist = d; best = w; }
  }
  return best;
}

export interface OpeningAltMoveInput {
  readonly originalParams: OpeningParams;
  /** The grabbed characteristic point (grip world position) = move base point. */
  readonly basePoint: Point2D;
  /** Current world cursor position (= basePoint + drag delta). */
  readonly currentPos: Point2D;
  /** The opening's current host wall (`params.wallId`). */
  readonly currentHost: WallEntity;
  /** All walls on the level — candidate re-host targets. */
  readonly candidateWalls: readonly WallEntity[];
  /** World-unit distance under which the cursor re-hosts onto another wall. */
  readonly rehostToleranceWorld: number;
  /**
   * Explicit re-host target wall (overrides the `nearestWallTo` proximity scan).
   * Used by the 3D path, where the wall UNDER THE CURSOR at release (raycast) is a
   * far more reliable target than the proximity of the gizmo-constrained end point.
   * When set, it IS the host (slide if it equals the current wall, else re-host).
   */
  readonly forcedHost?: WallEntity;
}

export interface OpeningAltMoveResult {
  /** New params (wallId + offsetFromStart). Spread over the original on commit. */
  readonly params: OpeningParams;
  /** The wall the new geometry must be computed against (current or new host). */
  readonly host: WallEntity;
}

/**
 * ADR-363 Φ1G.5 Slice 2 — resolve an Alt-drag «move-from-characteristic-point» of
 * a hosted opening, the SINGLE SSoT shared by the live ghost AND the commit:
 *   · cursor nearest the CURRENT host → slide along it (base-point delta).
 *   · cursor nearest a DIFFERENT wall (within tolerance) → RE-HOST (Revit «Pick
 *     New Host»): change `wallId` + drop at the cursor projection. Auto-rotation
 *     and auto-thickness follow for free because the opening's geometry is derived
 *     from its host wall (`computeOpeningGeometry`).
 * Returns `null` for a no-op (identity slide / degenerate target wall) so the
 * caller short-circuits. NEVER recomputes geometry here (the caller does, against
 * `result.host`) — keeps the geometry SSoT in one place.
 */
export function resolveOpeningAltMove(
  input: Readonly<OpeningAltMoveInput>,
): OpeningAltMoveResult | null {
  const { originalParams, basePoint, currentPos, currentHost, candidateWalls, rehostToleranceWorld, forcedHost } = input;
  const host = forcedHost ?? nearestWallTo(currentPos, candidateWalls, rehostToleranceWorld) ?? currentHost;

  // ── Same wall → base-point slide ──────────────────────────────────────────
  if (host.id === originalParams.wallId) {
    const slid = slideAlongWallByDelta(originalParams, basePoint, currentPos, host);
    if (slid === originalParams) return null;
    return { params: slid, host };
  }

  // ── Different wall → RE-HOST (drop at the cursor projection, centre-on-cursor) ─
  const hostLengthMm = host.geometry.length * 1000;
  const frameWidth = originalParams.frameWidth ?? DEFAULT_FRAME_WIDTH_MM;
  const minOffset = frameWidth;
  const maxOffset = hostLengthMm - originalParams.width - frameWidth;
  if (maxOffset < minOffset) return null; // new wall too short for opening + jambs
  const offset = clamp(
    projectPointToWallOffsetMm(currentPos, host) - originalParams.width / 2,
    minOffset,
    maxOffset,
  );
  return { params: { ...originalParams, wallId: host.id, offsetFromStart: offset }, host };
}
