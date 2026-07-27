/**
 * ADR-650 M5α.2 / M8β/Γ — «πήγαινέ με σε αυτό το εύρημα», once, for every review panel.
 *
 * A review panel (QA «καμπανάκι», auto-breakline proposals, and whatever comes next) is a list of
 * findings whose rows move the view. That move is NOT one behaviour but four, and all four were
 * about to be written a second time when the auto-breakline panel gained the same click:
 *
 *   1. Which view is live — 2D canvas or 3D camera. Two completely different drivers.
 *   2. FIRST jump of a review pass vs a later one (`preserveZoom`, see below).
 *   3. 2D: `canvas-fit-to-view-selected` (frame) vs `canvas-center-on-point` (slide over).
 *   4. 3D: `requestViewFocus` with `preserveZoom` — the bus decides frame vs `centerOn`.
 *
 * `jscpd --diff` would have flagged the second copy inside the very commit that wrote it (N.18),
 * and a copy is exactly the shape that rots: the day a third view mode appears, one panel learns
 * about it and the other silently keeps zooming the wrong canvas.
 *
 * ### Why the extent is DERIVED, not a per-domain constant
 * `focusFlag` originally carried a hand-picked `TOPO_QA_FOCUS_HALF_EXTENT_M = 15` and separately
 * built a ±15 m square for the 2D fit — two numbers that had to be kept equal by hand so «zoom to»
 * landed equally close in plan and in 3D. {@link reviewFocusExtent} removes the possibility: the
 * padded bounding box of the finding's own geometry produces the 2D box, the 2D centre AND the 3D
 * half-extent, so the two views cannot disagree by construction. A one-point finding padded by
 * 15 m still yields `halfExtentM = 15` — identical behaviour, now un-desyncable — while a 200 m
 * road edge frames its whole length instead of an arbitrary 30 m window around its middle.
 *
 * Click-driven only ⇒ ADR-040-safe (no per-frame traffic).
 *
 * @see ./view-focus-bus.ts — the 3D half of the routing
 * @see ../../hooks/canvas/useFitToView.ts — the 2D half (`canvas-*` EventBus SSoT)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WorldTriple } from '../../bim-3d/viewport/plan-to-world-math';
import { EventBus } from '../events';
import { useViewMode3DStore, selectIs3D } from '../../bim-3d/stores/ViewMode3DStore';
import { requestViewFocus } from './view-focus-bus';

/** An axis-aligned box in WORLD canonical mm (ADR-462) — the 2D canvas frame. */
export interface ReviewFocusBounds {
  readonly min: Point2D;
  readonly max: Point2D;
}

/** Everything both views need to frame ONE finding, derived from the same padded box. */
export interface ReviewFocusExtent {
  /** Centre of the padded box, WORLD canonical mm — what the 2D view slides over to. */
  readonly centre: Point2D;
  /** The padded box itself, WORLD canonical mm — what the 2D view fits to on the first jump. */
  readonly bounds: ReviewFocusBounds;
  /** Half the box's LARGER side, in metres — what the 3D camera frames on the first jump. */
  readonly halfExtentM: number;
}

const MM_TO_M = 0.001;

/**
 * The padded extent of a finding's geometry: one point (a QA flag) or many (a breakline chain).
 *
 * `null` when there is nothing finite to frame — an empty list, or coordinates that are NaN. That
 * is deliberately not a silent no-op with a zero box: a zero box would ask the 2D view to fit to a
 * single pixel and the camera to frame nothing, i.e. it would LOOK like the click worked while
 * throwing the engineer somewhere arbitrary. The caller skips the move instead.
 *
 * `padMm` is the domain's «how close is close enough»: centimetres for a clash, metres for a
 * survey blunder (it is only legible next to its neighbours — that is what makes it a blunder).
 */
export function reviewFocusExtent(
  points: readonly Point2D[],
  padMm: number,
): ReviewFocusExtent | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (minX > maxX) return null; // no finite point at all

  const bounds: ReviewFocusBounds = {
    min: { x: minX - padMm, y: minY - padMm },
    max: { x: maxX + padMm, y: maxY + padMm },
  };
  return {
    centre: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    bounds,
    halfExtentM: Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y) / 2 * MM_TO_M,
  };
}

/**
 * Move whichever view is live onto `extent`.
 *
 * `resolveWorld` is a THUNK, not a value: the 3D conversion is the expensive half (a TIN sample, a
 * geo projection, a datum read) and in plan view it is pure waste. It returns `null` when nothing
 * can answer for the finding's elevation, in which case the camera does NOT move — framing an
 * invented height would send the engineer to the wrong place, and doing nothing at least does not
 * mislead (the row still highlights; see the callers).
 *
 * `preserveZoom` is the caller's call because only it knows whether this is the FIRST jump of a
 * review pass (nothing worth keeping — frame the finding and establish a scale) or a later one
 * (the engineer has since dialled in a working scale, and re-fitting would throw it away on every
 * single row click — the behaviour Giorgio reported).
 */
export function focusReviewTarget(
  extent: ReviewFocusExtent,
  resolveWorld: () => WorldTriple | null,
  preserveZoom: boolean,
): void {
  if (selectIs3D(useViewMode3DStore.getState())) {
    const world = resolveWorld();
    if (world) {
      requestViewFocus({ point: world, halfExtentM: extent.halfExtentM, preserveZoom });
    }
    return;
  }

  if (preserveZoom) {
    EventBus.emit('canvas-center-on-point', { point: extent.centre });
    return;
  }
  EventBus.emit('canvas-fit-to-view-selected', { bounds: extent.bounds });
}
