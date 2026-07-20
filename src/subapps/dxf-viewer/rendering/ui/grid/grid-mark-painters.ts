/**
 * 🔵 GRID MARK PAINTERS — dot & cross rasterisers for the adaptive cascade.
 *
 * One painter per non-line grid style. Each lays a SINGLE pass of the
 * `renderAdaptiveGrid` schedule (ADR-681 §5.9): every position at the given
 * spacing, all in one style, since the pass — not the position — decides
 * minor vs major.
 *
 * ## Why the per-mark `majorInterval` test is gone
 *
 * The pre-§5.9 renderers tested each intersection's index against
 * `settings.majorInterval` to decide its style. That test is what made dots and
 * crosses unable to cascade: it hardwires "major" to a fixed multiple of ONE
 * raw step, so there is no level to promote and nothing to cross-fade. The
 * cascade expresses the same hierarchy as separate passes at separate spacings,
 * exactly as the line renderer has since §5. Reintroducing the index test would
 * silently reinstate the ×`subDivisions` pop.
 *
 * ## Batching
 *
 * A pass has ONE style, so it needs one `beginPath()` and one `fill()`/
 * `stroke()` — not one per mark. The pre-§5.9 dot loop issued a path+fill per
 * dot; combined with the dead `minVisibleSize` guard (shipped as 0) that reached
 * 8.3×10⁸ marks/frame at scale 0.005 and ~2×10¹⁰ at `MIN_SCALE` — measured
 * 2026-07-20 as >1.1s per frame for the bare loop alone, i.e. a frozen tab.
 * The cascade fixes the count (spacing never falls below `minGridSpacing`);
 * this batching fixes the per-mark call overhead.
 *
 * @module rendering/ui/grid/grid-mark-painters
 */

import type { Viewport } from '../../types/Types';
import type { GridSettings } from './GridTypes';
// 🏢 ADR-058: Centralized Canvas Primitives
import { addCirclePath } from '../../primitives/canvasPaths';
// 🪜 ADR-681 §5.7: major emphasis is DERIVED from minor, never set beside it.
import { deriveMajorGridWeight } from '../../../config/grid-emphasis';

/**
 * Where one pass's marks go: the lattice defined by the screen position of
 * world origin and the pass's on-screen spacing.
 */
export interface GridMarkLattice {
  readonly viewport: Viewport;
  /** Screen x of world (0,0) — the lattice anchor. */
  readonly originScreenX: number;
  /** Screen y of world (0,0) — the lattice anchor. */
  readonly originScreenY: number;
  /** This pass's on-screen spacing in px. */
  readonly spacingPx: number;
}

/**
 * First on-lattice coordinate at or after 0. A raw `origin % spacing` can be
 * negative, which merely starts the walk one mark off-screen — harmless, but
 * normalising keeps both painters walking an identical index space.
 */
function firstMark(originScreen: number, spacingPx: number): number {
  const start = originScreen % spacingPx;
  return start < 0 ? start + spacingPx : start;
}

/** A spacing this small means the walk would not terminate in useful time. */
const MIN_WALKABLE_SPACING_PX = 0.5;

/**
 * Where a mark walk begins, or `null` if this lattice must not be walked.
 *
 * Shared by every painter here — the guard and the two `firstMark` calls are
 * the same question ("can I walk this, and from where?") regardless of what is
 * being painted, so they live in one place rather than once per style.
 */
function walkStart(
  lattice: GridMarkLattice,
  markSizePx: number,
): { readonly x: number; readonly y: number } | null {
  if (!(lattice.spacingPx >= MIN_WALKABLE_SPACING_PX) || !(markSizePx > 0)) return null;
  return {
    x: firstMark(lattice.originScreenX, lattice.spacingPx),
    y: firstMark(lattice.originScreenY, lattice.spacingPx),
  };
}

/** Colour for a pass's style class. */
export function roleColor(settings: GridSettings, major: boolean): string {
  return major ? settings.majorGridColor : settings.minorGridColor;
}

/** Stroke weight for a pass's style class — major is DERIVED (ADR-681 §5.7). */
export function roleWeight(settings: GridSettings, major: boolean): number {
  return major ? deriveMajorGridWeight(settings.minorGridWeight) : settings.minorGridWeight;
}

/** Apply a pass's stroke style class in one call (lines and crosses). */
export function applyRoleStroke(
  ctx: CanvasRenderingContext2D,
  settings: GridSettings,
  major: boolean,
): void {
  ctx.strokeStyle = roleColor(settings, major);
  ctx.lineWidth = roleWeight(settings, major);
}

/**
 * Walk one pass's lattice, adding every mark to a SINGLE path, then close it
 * with `finish` (`fill` for dots, `stroke` for crosses).
 *
 * The walk is the same mechanism whatever the mark is, so it lives here once —
 * per-style painters supply only `addMark`. This is also where the one-draw-
 * call-per-pass guarantee is enforced: `beginPath` and `finish` are outside the
 * loop by construction, so no painter can regress to per-mark drawing.
 */
function walkMarks(
  ctx: CanvasRenderingContext2D,
  lattice: GridMarkLattice,
  markSizePx: number,
  addMark: (x: number, y: number) => void,
  finish: () => void,
): void {
  const { viewport, spacingPx } = lattice;
  const start = walkStart(lattice, markSizePx);
  if (!start) return;

  ctx.beginPath();
  for (let x = start.x; x <= viewport.width; x += spacingPx) {
    for (let y = start.y; y <= viewport.height; y += spacingPx) {
      addMark(x, y);
    }
  }
  finish();
}

/**
 * Paint one pass as filled dots of the given radius.
 *
 * Caller sets `fillStyle` and `globalAlpha` beforehand; this issues exactly one
 * `beginPath()` + one `fill()` for the whole pass.
 */
export function paintDotMarks(
  ctx: CanvasRenderingContext2D,
  lattice: GridMarkLattice,
  radiusPx: number,
): void {
  walkMarks(
    ctx,
    lattice,
    radiusPx,
    (x, y) => {
      // ⚠️ LOAD-BEARING `moveTo` — do NOT remove as redundant.
      //
      // `ellipse()`/`arc()` append to the CURRENT subpath: without an explicit
      // move, the spec joins each circle to the previous one with a straight
      // line. That is harmless while every mark gets its own `beginPath()` (as
      // the pre-§5.9 renderer did, one fill per dot), but batching a whole pass
      // into one path turns N circles into ONE self-intersecting snake, and the
      // nonzero fill rule then cancels most of it — the grid renders blank.
      //
      // Regression: introduced by the §5.9 batching, caught only in the live
      // app (Giorgio 2026-07-20, s=1). Crosses and lines were unaffected
      // because both already emit `moveTo` per mark — which is precisely why
      // dots were the ONLY broken style, and the clue that identified this.
      ctx.moveTo(x + radiusPx, y);
      addCirclePath(ctx, { x, y }, radiusPx);
    },
    () => ctx.fill(),
  );
}

/**
 * Paint one pass as plus-shaped crosses with the given arm half-length.
 *
 * Caller sets `strokeStyle`, `lineWidth` and `globalAlpha` beforehand; this
 * issues exactly one `beginPath()` + one `stroke()` for the whole pass.
 *
 * (The pre-§5.9 renderer set `strokeStyle` INSIDE the loop but stroked once at
 * the end, so every cross was painted in the last-assigned colour. Hoisting
 * style to the pass removes that class of bug by construction.)
 */
export function paintCrossMarks(
  ctx: CanvasRenderingContext2D,
  lattice: GridMarkLattice,
  armPx: number,
): void {
  walkMarks(
    ctx,
    lattice,
    armPx,
    (x, y) => {
      ctx.moveTo(x - armPx, y);
      ctx.lineTo(x + armPx, y);
      ctx.moveTo(x, y - armPx);
      ctx.lineTo(x, y + armPx);
    },
    () => ctx.stroke(),
  );
}

// ─── Legacy (non-cascading) renderers ───────────────────────────────────────
//
// Reached when `smoothFade` is off (the shipped default) or `majorInterval <= 1`
// — the same gate the line renderer uses. Preserved VERBATIM from the pre-§5.9
// GridRenderer, per-mark index test and all: users who leave the cascade off
// must see exactly the grid they saw before. Moved here purely so GridRenderer
// stays inside the 500-line limit (CLAUDE.md N.7.1); no behaviour was altered.

/** Minor/major mark sizes, derived exactly as the pre-§5.9 renderers derived them. */
export function dotRadii(settings: GridSettings): { minor: number; major: number } {
  return {
    // 1px default (1:1 with weight)
    minor: Math.max(1, settings.minorGridWeight),
    // 1.5px default
    major: Math.max(1.5, deriveMajorGridWeight(settings.minorGridWeight) * 0.75),
  };
}

/** Cross arm half-lengths, derived exactly as the pre-§5.9 renderer derived them. */
export function crossArms(settings: GridSettings): { minor: number; major: number } {
  return {
    minor: Math.max(2, settings.minorGridWeight * 2),
    major: Math.max(2, deriveMajorGridWeight(settings.minorGridWeight) * 2),
  };
}

/** Legacy dot grid: one raw step, per-intersection major/minor index test. */
export function paintLegacyDotGrid(
  ctx: CanvasRenderingContext2D,
  lattice: GridMarkLattice,
  settings: GridSettings,
): void {
  const { viewport, spacingPx: gridSize } = lattice;
  const { minor: minorDotSize, major: majorDotSize } = dotRadii(settings);
  const start = walkStart(lattice, minorDotSize);
  if (!start) return;

  for (let x = start.x; x <= viewport.width; x += gridSize) {
    for (let y = start.y; y <= viewport.height; y += gridSize) {
      // Math.round for floating point precision
      const gridIndexX = Math.round((x - start.x) / gridSize);
      const gridIndexY = Math.round((y - start.y) / gridSize);
      const isMajor =
        gridIndexX % settings.majorInterval === 0 && gridIndexY % settings.majorInterval === 0;

      if ((isMajor && settings.showMajorGrid) || (!isMajor && settings.showMinorGrid)) {
        ctx.fillStyle = roleColor(settings, isMajor);
        ctx.beginPath();
        addCirclePath(ctx, { x, y }, isMajor ? majorDotSize : minorDotSize);
        ctx.fill();
      }
    }
  }
}

/** Legacy cross grid: one raw step, per-intersection major/minor index test. */
export function paintLegacyCrossGrid(
  ctx: CanvasRenderingContext2D,
  lattice: GridMarkLattice,
  settings: GridSettings,
): void {
  const { viewport, spacingPx: gridSize } = lattice;
  const { minor: minorCrossSize, major: majorCrossSize } = crossArms(settings);
  const start = walkStart(lattice, minorCrossSize);
  if (!start) return;

  ctx.beginPath();
  for (let x = start.x; x <= viewport.width; x += gridSize) {
    for (let y = start.y; y <= viewport.height; y += gridSize) {
      const isMajor =
        ((x - start.x) / gridSize) % settings.majorInterval === 0 &&
        ((y - start.y) / gridSize) % settings.majorInterval === 0;

      if ((isMajor && settings.showMajorGrid) || (!isMajor && settings.showMinorGrid)) {
        applyRoleStroke(ctx, settings, isMajor);
        const size = isMajor ? majorCrossSize : minorCrossSize;
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size, y);
        ctx.moveTo(x, y - size);
        ctx.lineTo(x, y + size);
      }
    }
  }
  ctx.stroke();
}
