/**
 * CROSSHAIR COMPOSITOR LAYOUT — pure geometry/style helpers (ADR-040 / ADR-549).
 *
 * The AutoCAD/Revit-grade crosshair is repainted SYNCHRONOUSLY into a
 * `desynchronized` Canvas2D context on every move (ADR-549 Phase 6 — low-latency
 * present). These pure functions compute the geometry (arm length / centre gap)
 * consumed by `crosshair-compositor-paint`; they own no DOM and no canvas, so they
 * are unit-testable and shared verbatim by the 2D + 3D hosts.
 *
 * The centre gap is preserved by stopping each arm `gap` px before the cursor
 * centre (the AutoCAD hole). `gap` changes only on settings / pick-box changes
 * (rare), never per mouse move.
 *
 * NOTE — the `computeSegmentBoxes` / `translate3d` / `segmentBackground` helpers
 * below are legacy DOM-era geometry (promoted `translate3d` layers); the Phase 6
 * canvas paint no longer uses them. Kept until the DOM crosshair fallback is
 * deleted; do not add new callers.
 *
 * @module canvas-v2/overlays/crosshair-compositor-layout
 */

export type CrosshairLineStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot';

/** Static box of a single line segment, in area-local CSS pixels. */
export interface SegmentBox {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly top: number;
}

/** The four arm segments + their static boxes. */
export interface CrosshairSegmentBoxes {
  readonly left: SegmentBox;
  readonly right: SegmentBox;
  readonly top: SegmentBox;
  readonly bottom: SegmentBox;
}

/**
 * Length of each crosshair arm (CSS px). At 100% the arm spans the whole area
 * (so a full-screen cross always reaches the edges from any cursor position);
 * below 100% it is a fixed fraction of the smaller area dimension (AutoCAD
 * "equal arms" behaviour).
 */
export function computeArmLength(areaWidth: number, areaHeight: number, sizePercent: number): number {
  if (sizePercent >= 100) return Math.max(areaWidth, areaHeight);
  return (Math.min(areaWidth, areaHeight) / 2) * (Math.max(0, sizePercent) / 100);
}

/**
 * Static boxes for the 4 arm segments, positioned relative to the crosshair
 * centre (0,0). The whole cross lives inside ONE promoted layer that is moved
 * per frame with a single `translate3d(cursorX, cursorY, 0)`; the segments
 * themselves never change their `transform`, so the per-move cost is one
 * compositor translate (one display-list item) instead of 6-8.
 *
 * The centre gap is BAKED into the static positions here (not applied per move):
 * left/top arms sit `gap` px before the origin (their inner edge lands at -gap),
 * right/bottom arms start `gap` px after it. `gap` changes only on settings /
 * pick-box changes (rare), never per mouse move.
 */
export function computeSegmentBoxes(
  armLength: number,
  lineWidth: number,
  gap = 0,
): CrosshairSegmentBoxes {
  const halfLw = lineWidth / 2;
  return {
    left: { width: armLength, height: lineWidth, left: -armLength - gap, top: -halfLw },
    right: { width: armLength, height: lineWidth, left: gap, top: -halfLw },
    top: { width: lineWidth, height: armLength, left: -halfLw, top: -armLength - gap },
    bottom: { width: lineWidth, height: armLength, left: -halfLw, top: gap },
  };
}

/**
 * Static offset (CSS px) of the AutoCAD-style `+`/`−` selection badge from the
 * crosshair centre: placed just outside the top-right of the centre gap. Baked
 * into the badge's static `left`/`top` so the badge rides the single moving
 * layer without a per-move transform.
 */
export function computeBadgeOffset(gap: number): number {
  return Math.max(gap, 4) + 2;
}

/**
 * Extra clearance (CSS px) beyond the centre square's outer face so the arms
 * never touch its border — guarantees a permanently visible hole inside the
 * square (Giorgio 2026-06-24, ADR-515).
 */
export const CENTER_SQUARE_GAP_CLEARANCE = 2;

/**
 * Effective half-gap (CSS px) between the cursor centre and the inner edge of
 * each crosshair arm.
 *
 * When the centre square (the AutoCAD aperture / APBOX) is visible, the arms
 * ALWAYS stop at its outer faces plus a small clearance, so there is permanently
 * a hole inside the square — the cross never crosses the centre box (Giorgio
 * 2026-06-24, ADR-515). With no centre square it falls back to the optional
 * user-configured cursor gap.
 */
export function computeCenterGap(opts: {
  readonly showCenterSquare: boolean;
  readonly centerSquareSize: number;
  readonly useCursorGap: boolean;
  readonly centerGapPx: number;
}): number {
  if (opts.showCenterSquare && opts.centerSquareSize > 0) {
    return opts.centerSquareSize / 2 + CENTER_SQUARE_GAP_CLEARANCE;
  }
  if (!opts.useCursorGap) return 0;
  return Math.max(0, opts.centerGapPx || 5);
}

/** Cursor position in area-local coordinates (overlay coords minus ruler margins). */
export interface AreaLocalPoint {
  readonly x: number;
  readonly y: number;
}

/** Convert overlay-space cursor coords to area-local coords (after ruler margins). */
export function toAreaLocal(
  pos: { x: number; y: number },
  margins: { left: number; top: number },
): AreaLocalPoint {
  return { x: pos.x - margins.left, y: pos.y - margins.top };
}

/** Whether the (area-local) cursor is inside the drawable area, i.e. not over a ruler. */
export function isWithinArea(local: AreaLocalPoint, areaWidth: number, areaHeight: number): boolean {
  return local.x >= 0 && local.y >= 0 && local.x <= areaWidth && local.y <= areaHeight;
}

/** A `translate3d(...)` string — GPU-composited, no layout/paint. */
export function translate3d(x: number, y: number): string {
  return `translate3d(${x}px, ${y}px, 0)`;
}

/** Background CSS for a segment given its orientation + line style (static). */
export function segmentBackground(
  orientation: 'horizontal' | 'vertical',
  style: CrosshairLineStyle,
  color: string,
): { backgroundColor?: string; backgroundImage?: string } {
  if (style === 'solid') return { backgroundColor: color };
  const angle = orientation === 'horizontal' ? '90deg' : '180deg';
  // dash/gap lengths (CSS px) — mirror the canvas dash patterns' intent.
  const [dash, gap] =
    style === 'dotted' ? [1, 3] : style === 'dash-dot' ? [8, 4] : [6, 4];
  return {
    backgroundImage: `repeating-linear-gradient(${angle}, ${color} 0 ${dash}px, transparent ${dash}px ${dash + gap}px)`,
  };
}
