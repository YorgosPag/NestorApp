/**
 * ADR-397 — Move-glyph zone hit-test SSoT (Giorgio 2026-06-17, Revit-grade).
 *
 * The 4-arrow MOVE handle is logically FIVE pickable zones: a central disc (free
 * move — the existing await-base flow) and four directional arms (+X/−X/+Y/−Y in
 * the glyph's LOCAL screen frame). This pure module classifies a cursor position
 * into one of those zones, so BOTH the per-arm hover highlight AND the directional
 * move-by-value click (Φάση 2) share ONE hit-test — никаких divergence.
 *
 * The classification runs in the glyph's LOCAL screen frame (cursor un-rotated by
 * the glyph's screen angle around its centre), which is the SAME frame
 * `renderMoveGlyph` draws in (`translate + rotate` → arms at local (±arm,0)/(0,±arm)).
 * So a resolved zone maps 1:1 onto the drawn arm — the highlight lights exactly the
 * picked leg, never the whole cross.
 *
 * Mirrors the 3D gizmo's `hoveredAxis` model (`bim-3d/gizmo/gizmo-types.ts`) for the
 * 2D canvas. Pure: zero React / DOM / canvas / store deps.
 *
 * @see bim/grips/move-glyph-frame.ts — entity local axes (world) feeding the screen angle
 * @see rendering/grips/GripShapeRenderer.ts — renderMoveGlyph (draws + highlights a zone)
 * @see docs/centralized-systems/reference/adrs/ADR-397-bim-grip-glyph-behavior-ssot.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { MoveGlyphFrame } from './move-glyph-frame';

/** The five pickable zones of the move handle (local screen frame). */
export type MoveGlyphZone = 'center' | 'x+' | 'x-' | 'y+' | 'y-';

/** Inputs for a single zone hit-test (all screen-space px). */
export interface MoveGlyphZoneInput {
  /** Cursor position (screen px). */
  readonly cursorScreen: Point2D;
  /** Glyph centre = grip position (screen px). */
  readonly centerScreen: Point2D;
  /** Glyph rotation on screen (radians) — from `withMoveGlyphRotation`. */
  readonly screenAngleRad: number;
  /** Arm length (screen px) — `renderMoveGlyph`'s `arm`. */
  readonly armPx: number;
  /** Perpendicular hit tolerance (screen px) around each arm / centre disc radius. */
  readonly tolerancePx: number;
}

/** Fraction of the arm length used as the central free-move disc radius. */
const CENTER_DISC_FRACTION = 0.4;

/**
 * Perpendicular pick band (and centre-disc floor) as a fraction of the arm length,
 * used by {@link resolveMoveGlyphZoneForGrip}. Deliberately arm-RELATIVE, NOT tied
 * to the grip hit tolerance: the hit tolerance (~16px) is LARGER than the drawn arm
 * (~14px), so feeding it as the band would make the centre disc swallow the whole
 * cross and every cursor would read `'center'` — no arm could ever be picked.
 */
const ARM_PICK_BAND_FRACTION = 0.45;

/**
 * Classify a cursor position into a move-glyph zone, or `null` when it falls
 * outside the handle. Center disc wins inside `CENTER_DISC_FRACTION·armPx`; past
 * it, the dominant local axis (within `armPx + tolerancePx` reach and
 * `tolerancePx` perpendicular band) picks the arm.
 */
export function resolveMoveGlyphZone(input: MoveGlyphZoneInput): MoveGlyphZone | null {
  const { cursorScreen, centerScreen, screenAngleRad, armPx, tolerancePx } = input;
  const dx = cursorScreen.x - centerScreen.x;
  const dy = cursorScreen.y - centerScreen.y;

  // Un-rotate into the glyph's local screen frame (so arms align with the axes).
  const cos = Math.cos(-screenAngleRad);
  const sin = Math.sin(-screenAngleRad);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;

  const centerR = Math.max(tolerancePx, armPx * CENTER_DISC_FRACTION);
  if (Math.hypot(lx, ly) <= centerR) return 'center';

  const reach = armPx + tolerancePx;
  const absX = Math.abs(lx);
  const absY = Math.abs(ly);

  // Dominant axis decides the arm; the other coordinate must stay within the band.
  if (absX >= absY) {
    if (absX <= reach && absY <= tolerancePx) return lx >= 0 ? 'x+' : 'x-';
  } else {
    if (absY <= reach && absX <= tolerancePx) return ly >= 0 ? 'y+' : 'y-';
  }
  return null;
}

/** True for the four directional arms (i.e. NOT the central free-move disc). */
export function isDirectionalZone(zone: MoveGlyphZone | null): zone is 'x+' | 'x-' | 'y+' | 'y-' {
  return zone === 'x+' || zone === 'x-' || zone === 'y+' || zone === 'y-';
}

/**
 * Classify a cursor against an entity's move handle in its OWN local frame, in
 * WORLD coordinates. This is the SHARED entry point for BOTH the per-arm hover
 * highlight (`useUnifiedGripInteraction`) and the directional move-by-value click
 * (`grip-mouse-handlers`) — one classification, никаких divergence.
 *
 * `resolveMoveGlyphZone` is coordinate-system-agnostic (pure rotate + classify),
 * so we feed it WORLD values: the cursor/centre in world units, the frame's screen
 * angle taken straight from the WORLD `axisX` (no Y-flip — world is right-handed),
 * and the pixel arm/tolerance converted to world units via the view `scale`. The
 * returned zone is therefore expressed in the entity's WORLD frame: `'x+'` ⇒ +axisX,
 * `'y+'` ⇒ +axisY (see {@link directionForZone}). The renderer maps it back to the
 * drawn screen arm via {@link worldZoneToLocalArm}.
 */
export function resolveMoveGlyphZoneForGrip(args: {
  /** Cursor position (world units). */
  readonly cursorWorld: Point2D;
  /** Glyph centre = grip position (world units). */
  readonly centerWorld: Point2D;
  /** Entity local frame (world unit axes) from `resolveMoveGlyphFrame`. */
  readonly frame: MoveGlyphFrame;
  /** Grip render base size (screen px) — `renderMoveGlyph`'s `size` (cold/base). */
  readonly gripSizePx: number;
  /** View transform scale (screen px per world unit). */
  readonly scale: number;
}): MoveGlyphZone | null {
  const { cursorWorld, centerWorld, frame, gripSizePx, scale } = args;
  if (!(scale > 0)) return null;
  const armPx = Math.max(5, gripSizePx); // mirrors renderMoveGlyph's `arm`
  // Band is arm-relative (see ARM_PICK_BAND_FRACTION) so the centre disc stays
  // smaller than the arm and each of the four arms is individually pickable.
  const bandPx = armPx * ARM_PICK_BAND_FRACTION;
  return resolveMoveGlyphZone({
    cursorScreen: cursorWorld,
    centerScreen: centerWorld,
    screenAngleRad: Math.atan2(frame.axisX.y, frame.axisX.x),
    armPx: armPx / scale,
    tolerancePx: bandPx / scale,
  });
}

/**
 * World move direction (unit vector) for a directional zone, or `null` for
 * `'center'`/`null`. `'x±'` → ±axisX, `'y±'` → ±axisY. The directional move
 * translates the entity by `value × this vector`.
 */
export function directionForZone(zone: MoveGlyphZone | null, frame: MoveGlyphFrame): Point2D | null {
  switch (zone) {
    case 'x+': return frame.axisX;
    case 'x-': return { x: -frame.axisX.x, y: -frame.axisX.y };
    case 'y+': return frame.axisY;
    case 'y-': return { x: -frame.axisY.x, y: -frame.axisY.y };
    default: return null;
  }
}

/**
 * Map a WORLD-frame zone to the LOCAL arm the renderer draws (screen-local frame).
 * `renderMoveGlyph` draws in canvas space (Y points DOWN) while the world frame is
 * Y-up, so the canvas Y-flip in `worldToScreen` inverts the Y arm: world `'y+'`
 * (along +axisY, screen-UP) is drawn as the local `'y-'` arm, and vice-versa. X is
 * never flipped. `'center'`/`null` pass through. Locked by a transform-driven test.
 */
export function worldZoneToLocalArm(zone: MoveGlyphZone | null): MoveGlyphZone | null {
  switch (zone) {
    case 'y+': return 'y-';
    case 'y-': return 'y+';
    default: return zone;
  }
}
