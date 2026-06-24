/**
 * ADR-436 Slice 1c — Pad (foundation) grip frame/handle geometry adapter.
 *
 * Pure geometry helpers extracted from `foundation-grips.ts` (SRP / 500-line split):
 * translate `PadFootingParams` ↔ world-space handle positions and ↔ the shared
 * `RectFrame` the corner/edge resize engine reads. Zero React / DOM / Firestore /
 * canvas deps.
 *
 * Pad is ALWAYS a `width × length` rectangle (no polygon/circular variants), so
 * `dimX = width`, `dimY = length`.
 *
 * SSoT:
 *   - Centroid / local→world math = shared `bim/grips/centred-anchor-frame`.
 *   - Corner/edge resize frame = shared `bim/grips/rect-grip-engine` (`RectFrame`).
 *   - Rotation handle offset = shared `bim/grips/rotation-handle-policy`.
 *
 * @see foundation-grips.ts — grip emission + drag dispatch (consumer)
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4.3
 */

import type { Point2D } from '../../rendering/types/Types';
import type { FoundationGripKind } from '../../hooks/useGripMovement';
import type { PadFootingParams } from '../types/foundation-types';
import { ANCHOR_OFFSETS, MIN_FOUNDATION_DIMENSION_MM } from '../types/foundation-types';
import { rotateVector, farEdgeSign } from '../grips/grip-math';
import type { RectFrame, RectCorner } from '../grips/rect-frame';
import type { RectResizeLimits } from '../grips/rect-grip-engine';
import { mmScaleFor } from '../../utils/scene-units';
import {
  centredCentroidWorld,
  centredLocalToWorld,
  type CentredAnchorFrame,
} from '../grips/centred-anchor-frame';

// ─── Local-frame helpers (mirror column-grip-utils, pad width×length) ─────────
// Far-edge face sign = shared `farEdgeSign` SSoT (grip-math), applied to dx (width)
// or dy (length); was a local `farEdgeSignX`/`farEdgeSignY` duplicate.

/**
 * Pad footprint → shared `CentredAnchorFrame`. Pad is always a `width × length`
 * rectangle (no polygon/circular variants), so `dimX = width`, `dimY = length`.
 */
function padAnchorFrame(params: PadFootingParams): CentredAnchorFrame {
  return {
    position: { x: params.position.x, y: params.position.y },
    rotationDeg: params.rotation,
    scale: mmScaleFor(params),
    anchorOffset: ANCHOR_OFFSETS[params.anchor],
    dimX: params.width,
    dimY: params.length,
  };
}

/** Centroid (bbox centre) του pad footprint σε world coords — shared SSoT. */
export function computeCentroidWorld(params: PadFootingParams): Point2D {
  return centredCentroidWorld(padAnchorFrame(params));
}

/** Local-frame mm point (centered on centroid, no anchor shift) → world — shared SSoT. */
function localToWorld(local: Point2D, params: PadFootingParams): Point2D {
  return centredLocalToWorld(padAnchorFrame(params), local);
}

/** World position της λαβής width (far edge midpoint κατά local X). */
export function widthHandleWorld(params: PadFootingParams): Point2D {
  const { dx } = ANCHOR_OFFSETS[params.anchor];
  const signX = farEdgeSign(dx);
  return localToWorld({ x: (signX * params.width) / 2, y: 0 }, params);
}

/** World position της λαβής length (far edge midpoint κατά local Y). */
export function lengthHandleWorld(params: PadFootingParams): Point2D {
  const { dy } = ANCHOR_OFFSETS[params.anchor];
  const signY = farEdgeSign(dy);
  return localToWorld({ x: 0, y: (signY * params.length) / 2 }, params);
}

/**
 * ADR-517 — WEST edge-midpoint λαβή (the «other» local-X face). Always the −X
 * face του local frame (centroid-centred), mirror `column-edge-w`
 * (`localToWorld({ x: -width/2, y: 0 })`). Completes the 4 mid-side grips.
 */
export function edgeWHandleWorld(params: PadFootingParams): Point2D {
  return localToWorld({ x: -params.width / 2, y: 0 }, params);
}

/**
 * ADR-517 — SOUTH edge-midpoint λαβή (the «other» local-Y face). Always the −Y
 * face του local frame, mirror `column-edge-s` (`localToWorld({ x: 0, y: -depth/2 })`).
 */
export function edgeSHandleWorld(params: PadFootingParams): Point2D {
  return localToWorld({ x: 0, y: -params.length / 2 }, params);
}

/**
 * World position της λαβής rotation. ADR-517 — full rect-column parity: το σήμα
 * περιστροφής κάθεται στο ΜΕΣΟ της νοητής γραμμής κέντρου→νότιας μέσης-πλευράς →
 * local `(0, −length/4)` (καθρέφτης `column-grip-utils.rotationHandleWorld` για
 * rectangular/shear-wall). Κρατιέται ΕΔΩ (single rotation-position SSoT) ώστε η
 * εκπομπή ΚΑΙ το rotation drag (`rotateAroundPosition`, που διαβάζει αυτό) να
 * συμφωνούν — αλλιώς η λαβή θα «πηδούσε» στο πιάσιμο. Επιπλέον δεν συμπίπτει με
 * τη νέα `foundation-edge-s` (στο −length/2), σε αντίθεση με την παλιά
 * on-the-face θέση (`rotation-handle-policy`).
 */
export function rotationHandleWorld(params: PadFootingParams): Point2D {
  return localToWorld({ x: 0, y: -params.length / 4 }, params);
}

/** World position μιας γωνιακής λαβής (local signs `sx`/`sy` × half-extents). */
export function cornerHandleWorld(params: PadFootingParams, sx: number, sy: number): Point2D {
  return localToWorld({ x: (sx * params.width) / 2, y: (sy * params.length) / 2 }, params);
}

// ─── RectFrame adapter (ADR-436 Slice 1c — shared rect-grip-engine SSoT) ──────

/** `foundation-corner-*` grip kind → local-axis signs for the engine. */
export const FOUNDATION_CORNER_MAP: Partial<Record<FoundationGripKind, RectCorner>> = {
  'foundation-corner-ne': { sx: 1, sy: 1 },
  'foundation-corner-nw': { sx: -1, sy: 1 },
  'foundation-corner-sw': { sx: -1, sy: -1 },
  'foundation-corner-se': { sx: 1, sy: -1 },
};

/**
 * ADR-517 — `foundation-{width|length|edge-w|edge-s}` → engine edge axis + face.
 * `near:false` = the FAR face from the anchor (width=E, length=N)· `near:true` =
 * the OPPOSITE face (edge-w=W, edge-s=S). One table → one `applyRectEdgeDrag`
 * call (DRY, mirror `column-rect-adapter.COLUMN_EDGE_MAP`). The sign derives from
 * `farEdgeSign(anchorOffset)` so every anchor resizes the correct face.
 */
export const FOUNDATION_EDGE_MAP: Partial<
  Record<FoundationGripKind, { axis: 'x' | 'y'; near: boolean }>
> = {
  'foundation-width': { axis: 'x', near: false },
  'foundation-edge-w': { axis: 'x', near: true },
  'foundation-length': { axis: 'y', near: false },
  'foundation-edge-s': { axis: 'y', near: true },
};

/**
 * Pad params → centroid `RectFrame` (scene units). The centroid + half-extents
 * are exactly what `computeCentroidWorld` / `mmScaleFor` already derive, so the
 * engine math is unit- and anchor-agnostic.
 */
export function padToRectFrame(pad: PadFootingParams): RectFrame {
  const s = mmScaleFor(pad);
  return {
    center: computeCentroidWorld(pad),
    rotationDeg: pad.rotation,
    halfWidth: (pad.width * s) / 2,
    halfLength: (pad.length * s) / 2,
  };
}

/**
 * `RectFrame` (post-resize) → pad params, preserving the anchor: `position` is
 * recomputed as the anchor reference point of the new rectangle
 * (`centroid + R(dx·width, dy·length)`), the inverse of `computeCentroidWorld`.
 */
export function rectFrameToPadParams(frame: RectFrame, pad: PadFootingParams): PadFootingParams {
  const s = mmScaleFor(pad);
  const width = (frame.halfWidth * 2) / s;
  const length = (frame.halfLength * 2) / s;
  const { dx, dy } = ANCHOR_OFFSETS[pad.anchor];
  const shift = rotateVector({ x: dx * width * s, y: dy * length * s }, frame.rotationDeg);
  return {
    ...pad,
    width,
    length,
    position: { x: frame.center.x + shift.x, y: frame.center.y + shift.y, z: pad.position.z ?? 0 },
  };
}

/** Min half-extents (scene units) for the engine clamp = `MIN_FOUNDATION_DIMENSION_MM`. */
export function padResizeLimits(pad: PadFootingParams): RectResizeLimits {
  const half = (MIN_FOUNDATION_DIMENSION_MM * mmScaleFor(pad)) / 2;
  return { minHalfWidth: half, minHalfLength: half };
}
