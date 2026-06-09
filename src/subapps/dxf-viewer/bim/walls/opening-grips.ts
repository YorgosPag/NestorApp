/**
 * ADR-363 Phase 2.5 — Opening parametric grip handlers (full wall parity).
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. A wall-hosted
 * opening (door/window) now exposes the SAME 6-grip vocabulary as a wall / a
 * furniture box — 4 corner handles + a rotation handle + a move handle — so the
 * user can resize / relocate / flip it in place (Giorgio request 2026-06-07).
 *
 * Grip layout (centred rotatable rectangle, the SAME visual SSoT used by
 * furniture / MEP / floorplan-symbol via `centred-box-grips.ts`):
 *   0 → opening-move        (SUPPRESSED, ADR-363 Φ1G.5 Slice 2 — declutter; the
 *                            whole-opening slide-along-wall is now an Alt+drag
 *                            from any grip via `applyOpeningAltSlide`. Still
 *                            computed for index stability, filtered from output.)
 *   1 → opening-rotation    (FLIP handing — Revit-style· stays hosted on the wall)
 *   2-5 → opening-corner-{ne,nw,sw,se} (resize WIDTH along the wall· opposite jamb pinned)
 *
 * Why positions are derived from `geometry.outline` (not `getCentredBoxGrips`):
 * the opening's authoritative footprint is its cached `outline` (already world
 * coords, width × host-wall thickness). Computing the handles from it is host- &
 * scene-units-independent (the emit path has only the entity, not the host wall).
 * We still reuse the centred-box ROLE vocabulary + the shared rotation stand-off
 * constant + the glyph registry SSoT, so the visual/behaviour stays identical.
 *
 * Drag is WALL-CONSTRAINED (the opening is hosted): all motion projects onto the
 * host wall axis (`projectPointToWallOffset`). Geometry is NOT recomputed here —
 * `UpdateOpeningParamsCommand` re-derives it via `computeOpeningGeometry()`.
 *
 * @see bim/grips/centred-box-grips.ts — the shared box grip SSoT (role vocabulary)
 * @see bim/furniture/furniture-grips.ts — the canonical thin-adapter template
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4 §6 Phase 2.5
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, OpeningGripKind } from '../../hooks/useGripMovement';
import type { OpeningEntity, OpeningParams } from '../types/opening-types';
import { DEFAULT_FRAME_WIDTH_MM, MIN_OPENING_WIDTH_MM, isHingedKind } from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';
import { projectPointToWallOffsetMm } from '../geometry/opening-geometry';
import { rotateVector } from '../grips/grip-math';
import { ROTATION_HANDLE_OFFSET_MM, type CentredBoxGripRole } from '../grips/centred-box-grips';

const RAD_TO_DEG = 180 / Math.PI;

// ─── Role ↔ opening-kind map (centred-box vocabulary reuse) ───────────────────

const ROLE_TO_KIND: Readonly<Record<CentredBoxGripRole, OpeningGripKind>> = {
  'move': 'opening-move',
  'rotation': 'opening-rotation',
  'corner-ne': 'opening-corner-ne',
  'corner-nw': 'opening-corner-nw',
  'corner-sw': 'opening-corner-sw',
  'corner-se': 'opening-corner-se',
};

/** Corner diagonal signs in the opening local frame (x = along wall, y = across). */
const CORNER_SIGNS: ReadonlyArray<readonly [CentredBoxGripRole, 1 | -1, 1 | -1]> = [
  ['corner-ne', 1, 1],
  ['corner-nw', -1, 1],
  ['corner-sw', -1, -1],
  ['corner-se', 1, -1],
];

// ─── Grip position computation (ADR-363 §6 Phase 2.5) ────────────────────────

/** Half-extents (world) of the opening footprint along the wall axis / across it. */
function halfExtents(
  outline: readonly { readonly x: number; readonly y: number }[],
  center: Point2D,
  axis: Point2D,
  perp: Point2D,
): { halfWidth: number; halfThick: number } {
  let halfWidth = 0;
  let halfThick = 0;
  for (const v of outline) {
    const dx = v.x - center.x;
    const dy = v.y - center.y;
    halfWidth = Math.max(halfWidth, Math.abs(dx * axis.x + dy * axis.y));
    halfThick = Math.max(halfThick, Math.abs(dx * perp.x + dy * perp.y));
  }
  return { halfWidth, halfThick };
}

/**
 * Compute the parametric grips for an `OpeningEntity` (centred-box layout):
 * rotation (flip handle, perpendicular stand-off) + 4 corners (+ facing on hinged
 * kinds). ADR-363 Φ1G.5 Slice 2: the central `opening-move` grip is computed (for
 * gripIndex stability) but filtered from the returned set — the opening is moved
 * by Alt+drag along the wall instead. Returns an empty array when the geometry
 * cache / outline isn't populated yet (e.g. opening hydrated before its host wall).
 */
export function getOpeningGrips(entity: Readonly<OpeningEntity>): GripInfo[] {
  const g = entity.geometry;
  const verts = g?.outline?.vertices;
  if (!g || !verts || verts.length < 4) return [];

  const center: Point2D = { x: g.position.x, y: g.position.y };
  const deg = g.rotation * RAD_TO_DEG;
  const axis = rotateVector({ x: 1, y: 0 }, deg); // along wall
  const perp = rotateVector({ x: 0, y: 1 }, deg); // across wall
  const { halfWidth, halfThick } = halfExtents(verts, center, axis, perp);

  // World scale factor (world-units per mm) derived from the authoritative width,
  // so the rotation handle stand-off is a constant mm regardless of scene units.
  const s = entity.params.width > 0 ? (2 * halfWidth) / entity.params.width : 1;
  const standoff = halfThick + ROTATION_HANDLE_OFFSET_MM * s;

  const grips: GripInfo[] = [
    {
      entityId: entity.id,
      gripIndex: 0,
      type: 'center',
      position: center,
      movesEntity: true,
      openingGripKind: 'opening-move',
    },
    {
      entityId: entity.id,
      gripIndex: 1,
      type: 'vertex',
      position: { x: center.x + perp.x * standoff, y: center.y + perp.y * standoff },
      movesEntity: false,
      openingGripKind: 'opening-rotation',
    },
  ];
  CORNER_SIGNS.forEach(([role, sx, sy], i) => {
    grips.push({
      entityId: entity.id,
      gripIndex: 2 + i,
      type: 'corner',
      position: {
        x: center.x + axis.x * sx * halfWidth + perp.x * sy * halfThick,
        y: center.y + axis.y * sx * halfWidth + perp.y * sy * halfThick,
      },
      movesEntity: false,
      openingGripKind: ROLE_TO_KIND[role],
    });
  });
  // Revit-style «Flip Facing» grip — opposite side of wall from the hand-flip grip.
  // Present only for hinged kinds (door / french-door) because `openDirection` is
  // undefined for windows, sliding-doors, and fixed glazing.
  if (isHingedKind(entity.params.kind)) {
    grips.push({
      entityId: entity.id,
      gripIndex: grips.length,
      type: 'vertex',
      position: { x: center.x - perp.x * standoff, y: center.y - perp.y * standoff },
      movesEntity: false,
      openingGripKind: 'opening-facing',
    });
  }
  // ADR-363 Φ1G.5 Slice 2 — drop the central MOVE marker (`opening-move`, 4-way
  // arrow): redundant now that Alt+drag from any opening grip (corner / rotation)
  // slides the WHOLE opening along the host wall (`applyOpeningAltSlide`). Filtered
  // here (not un-pushed) so the gripIndex math above — incl. the `opening-facing`
  // `grips.length` index — stays intact; the `opening-move` transform
  // (`moveAlongWall`) is retained but no longer reachable from a grip.
  return grips.filter((g) => g.openingGripKind !== 'opening-move');
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface OpeningGripDragInput {
  /** Original params at drag start (preserves width / kind / handing / etc.). */
  readonly originalParams: OpeningParams;
  /** Current world cursor position — projected onto host wall axis. */
  readonly currentPos: Point2D;
  /** Host wall — required for axis projection + length clamp. */
  readonly hostWall: WallEntity;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Translate the whole opening along the host wall axis (legacy `opening-offset`). */
function moveAlongWall(
  params: OpeningParams,
  currentPos: Point2D,
  hostWall: WallEntity,
): OpeningParams {
  const hostLengthMm = hostWall.geometry.length * 1000;
  const frameWidth = params.frameWidth ?? DEFAULT_FRAME_WIDTH_MM;
  const minOffset = frameWidth;
  const maxOffset = hostLengthMm - params.width - frameWidth;
  if (maxOffset < minOffset) return params; // host too short for opening + jambs

  const clamped = clamp(projectPointToWallOffsetMm(currentPos, hostWall) - params.width / 2, minOffset, maxOffset);
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
function slideAlongWallByDelta(
  params: OpeningParams,
  basePoint: Point2D,
  currentPos: Point2D,
  hostWall: WallEntity,
): OpeningParams {
  const hostLengthMm = hostWall.geometry.length * 1000;
  const frameWidth = params.frameWidth ?? DEFAULT_FRAME_WIDTH_MM;
  const minOffset = frameWidth;
  const maxOffset = hostLengthMm - params.width - frameWidth;
  if (maxOffset < minOffset) return params; // host too short for opening + jambs

  const baseMm = projectPointToWallOffsetMm(basePoint, hostWall);
  const curMm = projectPointToWallOffsetMm(currentPos, hostWall);
  const newOffset = clamp(params.offsetFromStart + (curMm - baseMm), minOffset, maxOffset);
  if (newOffset === params.offsetFromStart) return params;
  return { ...params, offsetFromStart: newOffset };
}

/** Resize by moving ONE jamb along the wall; the opposite jamb stays pinned. */
function resizeJamb(
  params: OpeningParams,
  currentPos: Point2D,
  hostWall: WallEntity,
  jamb: 'start' | 'end',
): OpeningParams {
  const hostLengthMm = hostWall.geometry.length * 1000;
  const frameWidth = params.frameWidth ?? DEFAULT_FRAME_WIDTH_MM;
  const cursorAxial = projectPointToWallOffsetMm(currentPos, hostWall);

  if (jamb === 'end') {
    // Start jamb pinned at offsetFromStart; the end jamb tracks the cursor.
    const startAxial = params.offsetFromStart;
    const newEnd = clamp(cursorAxial, startAxial + MIN_OPENING_WIDTH_MM, hostLengthMm - frameWidth);
    const newWidth = newEnd - startAxial;
    if (newWidth === params.width) return params;
    return { ...params, width: newWidth };
  }
  // Start jamb tracks the cursor; the end jamb pinned at offsetFromStart + width.
  const endAxial = params.offsetFromStart + params.width;
  const newStart = clamp(cursorAxial, frameWidth, endAxial - MIN_OPENING_WIDTH_MM);
  const newWidth = endAxial - newStart;
  if (newStart === params.offsetFromStart && newWidth === params.width) return params;
  return { ...params, offsetFromStart: newStart, width: newWidth };
}

/**
 * Flip the opening handing (Revit «Flip Hand» — click-to-toggle). Doors/french-doors
 * toggle `handing` left↔right on every click of the rotation glyph. Openings
 * without a swing (window / fixed / sliding) have nothing to flip → no-op.
 *
 * Cursor position is intentionally NOT used: the rotation grip is offset
 * perpendicularly from the wall, so its axial projection always lands at the
 * opening centre — making cursor-side logic always resolve to 'right'. A pure
 * toggle matches Revit behaviour and works correctly for a zero-delta click.
 */
function flipOpening(params: OpeningParams): OpeningParams {
  if (!params.handing) return params;
  return { ...params, handing: params.handing === 'left' ? 'right' : 'left' };
}

/**
 * Flip the opening facing direction (Revit «Flip Facing» — click-to-toggle).
 * Toggles `openDirection` inward↔outward — moves the swing arc to the opposite
 * face of the host wall. Hinged kinds only (door / french-door); no-op when
 * `openDirection` is undefined (window / sliding / fixed).
 */
function flipOpeningFacing(params: OpeningParams): OpeningParams {
  if (!params.openDirection) return params;
  return { ...params, openDirection: params.openDirection === 'inward' ? 'outward' : 'inward' };
}

/**
 * Pure transform: opening grip kind + drag input → new `OpeningParams`. Geometry
 * is NOT recomputed here — `UpdateOpeningParamsCommand.execute` re-derives it via
 * `computeOpeningGeometry()`. Returns `originalParams` referentially unchanged on
 * any no-op (foreign kind / out-of-range / identity) so the commit short-circuits.
 */
export function applyOpeningGripDrag(
  gripKind: OpeningGripKind,
  input: Readonly<OpeningGripDragInput>,
): OpeningParams {
  const { originalParams, currentPos, hostWall } = input;
  switch (gripKind) {
    case 'opening-move':
      return moveAlongWall(originalParams, currentPos, hostWall);
    case 'opening-corner-ne':
    case 'opening-corner-se':
      return resizeJamb(originalParams, currentPos, hostWall, 'end');
    case 'opening-corner-nw':
    case 'opening-corner-sw':
      return resizeJamb(originalParams, currentPos, hostWall, 'start');
    case 'opening-rotation':
      return flipOpening(originalParams);
    case 'opening-facing':
      return flipOpeningFacing(originalParams);
    default:
      return originalParams;
  }
}

// ─── Alt-drag whole-opening slide (ADR-363 Φ1G.5 Slice 2) ────────────────────

export interface OpeningAltSlideInput {
  /** Original params at drag start (preserves width / kind / handing / etc.). */
  readonly originalParams: OpeningParams;
  /** The grabbed characteristic point (grip world position) = the move base point. */
  readonly basePoint: Point2D;
  /** Current world cursor position (= basePoint + drag delta). */
  readonly currentPos: Point2D;
  /** Host wall — required for axis projection + length clamp. */
  readonly hostWall: WallEntity;
}

/**
 * Pure transform: Alt-drag base-point move of a hosted opening → new
 * `OpeningParams`, sliding it ALONG the host wall (offsetFromStart += projected
 * delta). Returns `originalParams` referentially unchanged on any no-op (host too
 * short / out-of-range / identity) so the commit short-circuits. Geometry is NOT
 * recomputed here — `UpdateOpeningParamsCommand` re-derives it.
 */
export function applyOpeningAltSlide(input: Readonly<OpeningAltSlideInput>): OpeningParams {
  const { originalParams, basePoint, currentPos, hostWall } = input;
  return slideAlongWallByDelta(originalParams, basePoint, currentPos, hostWall);
}
