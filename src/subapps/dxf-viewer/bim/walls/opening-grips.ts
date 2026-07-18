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
 * ADR-615 — SELF-HOSTED branch (additive, guarded by `isSelfHostedOpening`): a
 * free-standing opening has no `WallEntity` to slide/clamp/rehost against, so it
 * behaves like every other free-standing box (furniture parity) — MOVE (free 2D
 * anchor translate), ROTATION (real drag-rotate of `selfHost.rotationRad`) and
 * CORNER resize (μήκος `width` + πλάτος `hostThicknessMm`, max-clamped) are ALL
 * delegated to the shared centred-box grip SSoT (`applySelfHostedBoxGripDrag`,
 * ADR-602). Only `opening-facing` (hinged swing side) stays a local host-agnostic
 * click-toggle. Rehost is N/A (no wall to pick). The wall-hosted path is byte-identical.
 *
 * @see bim/grips/centred-box-grips.ts — the shared box grip SSoT (role vocabulary)
 * @see bim/furniture/furniture-grips.ts — the canonical thin-adapter template
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4 §6 Phase 2.5
 * @see docs/centralized-systems/reference/adrs/ADR-615-free-standing-self-hosted-opening.md §Decision 4
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, OpeningGripKind } from '../../hooks/useGripMovement';
import { gripKindOf } from '../../hooks/grip-kinds';
import type { OpeningEntity, OpeningParams } from '../types/opening-types';
import { DEFAULT_FRAME_WIDTH_MM, MIN_OPENING_WIDTH_MM, isHingedKind, isSelfHostedOpening } from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';
import { projectPointToWallOffsetMm } from '../geometry/opening-geometry';
import { rotateVector } from '../grips/grip-math';
import { clamp } from '../../utils/scalar-math';
import { ROTATION_HANDLE_OFFSET_MM, type CentredBoxGripRole } from '../grips/centred-box-grips';
import type { SceneUnits } from '../../utils/scene-units';
import { applySelfHostedBoxGripDrag } from './opening-grips-self-host';
import { openingOffsetBounds, withOpeningOffset, slideAlongWallByDelta } from './opening-grips-wall-move';

// ADR-363 Φ1G.5 Slice 2 / N.7.1 file-size split — re-export the wall-hosted
// "Pick New Host" resolver so existing consumers keep importing it from this
// module's public path (`bim/walls/opening-grips`); the implementation lives
// in `opening-grips-wall-move.ts` (WALL-HOSTED ONLY — see that file's header).
export {
  OPENING_REHOST_SNAP_TOLERANCE_MM,
  openingRehostToleranceWorld,
  resolveOpeningAltMove,
  type OpeningAltMoveInput,
  type OpeningAltMoveResult,
} from './opening-grips-wall-move';

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
  if (!entity) return []; // defensive: 3D edit/snap may pass an unresolved entity
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
      gripKind: { on: 'opening', kind: 'opening-move' },
    },
    {
      entityId: entity.id,
      gripIndex: 1,
      type: 'vertex',
      position: { x: center.x + perp.x * standoff, y: center.y + perp.y * standoff },
      movesEntity: false,
      gripKind: { on: 'opening', kind: 'opening-rotation' },
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
      gripKind: { on: 'opening', kind: ROLE_TO_KIND[role] },
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
      gripKind: { on: 'opening', kind: 'opening-facing' },
    });
  }
  // ADR-615 — a SELF-HOSTED opening moves FREELY on the plan (no wall to slide
  // along), so it KEEPS the central MOVE handle (4-way arrow) — the user relocates
  // it by dragging that glyph (→ `applySelfHostedBoxGripDrag('opening-move')`).
  if (isSelfHostedOpening(entity.params)) return grips;
  // ADR-363 Φ1G.5 Slice 2 — a WALL-HOSTED opening drops the central MOVE marker
  // (`opening-move`, 4-way arrow): redundant now that Alt+drag from any opening
  // grip (corner / rotation) slides the WHOLE opening along the host wall
  // (`applyOpeningAltSlide`).
  //
  // ADR-501 fix (Giorgio 2026-07-18) — the wall-hosted rotation grip is a Revit
  // «Flip Hand» toggle (`flipOpening`), meaningful ONLY for hinged kinds (they carry
  // `handing`). Non-hinged kinds (windows / sliding / pocket / fixed …) have no
  // handing to flip, so the marker would be a DEAD click — hide it. Filtered here
  // (not un-pushed) so the gripIndex math above stays intact.
  const hinged = isHingedKind(entity.params.kind);
  return grips.filter((g) => {
    const kind = gripKindOf(g, 'opening');
    if (kind === 'opening-move') return false;
    if (kind === 'opening-rotation' && !hinged) return false;
    return true;
  });
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface OpeningGripDragInput {
  /** Original params at drag start (preserves width / kind / handing / etc.). */
  readonly originalParams: OpeningParams;
  /** Current world cursor position — projected onto host wall axis. */
  readonly currentPos: Point2D;
  /**
   * Host wall — required for axis projection + length clamp on a WALL-HOSTED
   * opening. ADR-615: absent for a self-hosted opening (`isSelfHostedOpening`
   * guards the branch that doesn't need it — never fabricate a `WallEntity`).
   */
  readonly hostWall?: WallEntity;
  /**
   * ADR-615 — mm↔scene conversion for the self-hosted grip math (`selfHost.anchor`
   * is stored in mm; the box drag works in scene units). Defaults to `'mm'` (the
   * canonical-mm scene these openings live on, ADR-462). Unused on the wall-hosted
   * path (the host wall carries its own sceneUnits).
   */
  readonly sceneUnits?: SceneUnits;
  /**
   * ADR-615 — world-space drag delta (grip anchor → cursor). Drives the
   * self-hosted centred-box drag (move / rotate / resize). Unused on the
   * wall-hosted path (which reads `currentPos` and projects onto the wall axis).
   */
  readonly delta?: Point2D;
  /** ADR-615 — ORTHO (F8) → self-hosted corner resize constrained to one local axis. */
  readonly ortho?: boolean;
}

/** Translate the whole opening along the host wall axis (legacy `opening-offset`). */
function moveAlongWall(
  params: OpeningParams,
  currentPos: Point2D,
  hostWall: WallEntity,
): OpeningParams {
  const bounds = openingOffsetBounds(params, hostWall);
  if (!bounds) return params;
  return withOpeningOffset(params, projectPointToWallOffsetMm(currentPos, hostWall) - params.width / 2, bounds);
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

  // TEMP DIAGNOSTIC (ADR-513 §opening-width) — αφαιρείται μετά τη διάγνωση.
  // eslint-disable-next-line no-console
  console.warn('[resizeJamb]', {
    jamb,
    currentPos,
    cursorAxial,
    offsetFromStart: params.offsetFromStart,
    width: params.width,
    hostLengthMm,
  });

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
 *
 * ADR-615: self-hosted openings (`isSelfHostedOpening`) branch to
 * `applySelfHostedGripDrag` — no host wall involved. The wall-hosted switch
 * below is unchanged (byte-identical).
 */
export function applyOpeningGripDrag(
  gripKind: OpeningGripKind,
  input: Readonly<OpeningGripDragInput>,
): OpeningParams {
  const { originalParams, currentPos, hostWall, sceneUnits, delta, ortho } = input;
  if (isSelfHostedOpening(originalParams)) {
    return applySelfHostedGripDrag(gripKind, originalParams, delta ?? { x: 0, y: 0 }, sceneUnits ?? 'mm', ortho);
  }
  if (!hostWall) return originalParams; // defensive: wall-hosted params require a host
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

// ─── ADR-615 self-hosted branch (additive — no WallEntity involved) ──────────
// The centred-box drag math (move / rotate / resize) lives in the shared box SSoT
// via `applySelfHostedBoxGripDrag` (`opening-grips-self-host.ts`); only the
// `opening-facing` click-toggle stays local (host-agnostic, shared with the
// wall-hosted switch above).

/**
 * ADR-615 — self-hosted grip-drag dispatch. The free-standing opening behaves as
 * a centred box (furniture parity): MOVE = free anchor translate, ROTATION =
 * real drag-rotate (`selfHost.rotationRad`), CORNER = two-direction resize
 * (μήκος `width` + πλάτος `hostThicknessMm`, max-clamped) — ALL delegated to the
 * centred-box grip SSoT (`applySelfHostedBoxGripDrag`, ADR-602). The `opening-facing`
 * grip (hinged kinds) stays a host-agnostic click-toggle so the user can flip the
 * swing side without a wall. Handing/left-right no longer needs a dedicated flip —
 * the whole symbol rotates.
 */
function applySelfHostedGripDrag(
  gripKind: OpeningGripKind,
  originalParams: OpeningParams,
  delta: Point2D,
  sceneUnits: SceneUnits,
  ortho?: boolean,
): OpeningParams {
  if (gripKind === 'opening-facing') return flipOpeningFacing(originalParams);
  return applySelfHostedBoxGripDrag(gripKind, { originalParams, delta, sceneUnits, ortho });
}

// ─── Alt-drag whole-opening slide (ADR-363 Φ1G.5 Slice 2) ────────────────────

export interface OpeningAltSlideInput {
  /** Original params at drag start (preserves width / kind / handing / etc.). */
  readonly originalParams: OpeningParams;
  /** The grabbed characteristic point (grip world position) = the move base point. */
  readonly basePoint: Point2D;
  /** Current world cursor position (= basePoint + drag delta). */
  readonly currentPos: Point2D;
  /**
   * Host wall — required for axis projection + length clamp on a WALL-HOSTED
   * opening. ADR-615: absent for a self-hosted opening.
   */
  readonly hostWall?: WallEntity;
  /**
   * ADR-615 — mm↔scene conversion for the self-hosted anchor translate.
   * Defaults to `'mm'` (canonical-mm scene, ADR-462). Unused on the
   * wall-hosted path.
   */
  readonly sceneUnits?: SceneUnits;
}

/**
 * Pure transform: Alt-drag base-point move of a hosted opening → new
 * `OpeningParams`, sliding it ALONG the host wall (offsetFromStart += projected
 * delta). Returns `originalParams` referentially unchanged on any no-op (host too
 * short / out-of-range / identity) so the commit short-circuits. Geometry is NOT
 * recomputed here — `UpdateOpeningParamsCommand` re-derives it.
 *
 * ADR-615: a self-hosted opening (`isSelfHostedOpening`) has no wall axis to
 * slide along — Alt-drag instead translates `selfHost.anchor` by the raw world
 * delta via the centred-box MOVE SSoT (`applySelfHostedBoxGripDrag`), a free 2D
 * whole-object move. The wall-hosted branch below is unchanged.
 */
export function applyOpeningAltSlide(input: Readonly<OpeningAltSlideInput>): OpeningParams {
  const { originalParams, basePoint, currentPos, hostWall, sceneUnits } = input;
  if (isSelfHostedOpening(originalParams)) {
    // Alt-drag from a characteristic point = free 2D whole-object move → same
    // centred-box MOVE SSoT as the primary move grip (delta = base → cursor).
    const delta: Point2D = { x: currentPos.x - basePoint.x, y: currentPos.y - basePoint.y };
    return applySelfHostedBoxGripDrag('opening-move', { originalParams, delta, sceneUnits: sceneUnits ?? 'mm' });
  }
  if (!hostWall) return originalParams; // defensive: wall-hosted params require a host
  return slideAlongWallByDelta(originalParams, basePoint, currentPos, hostWall);
}
