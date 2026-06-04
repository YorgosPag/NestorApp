/**
 * CROSSHAIR COMPOSITOR LAYOUT — pure geometry/style helpers (ADR-040).
 *
 * The AutoCAD/Revit-grade crosshair is drawn ONCE as promoted DOM elements and
 * moved purely with `transform: translate3d(...)` on the GPU compositor — off the
 * main thread — so it tracks the pointer 1:1 regardless of main-thread load.
 *
 * The center gap is preserved by splitting each axis into TWO fixed-size segments
 * (left/right, top/bottom): the gap is simply the distance between them, applied
 * via the translate offset. Because every segment is a FIXED-size box that only
 * ever changes its `transform`, there is zero layout/paint work per mouse move.
 *
 * These functions are pure (no DOM) so they are unit-testable.
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
 * Static boxes for the 4 arm segments, positioned so that a single
 * `translate3d(cursorX, cursorY, 0)` (plus the gap offset) centres the cross on
 * the cursor. Left/top segments sit BEFORE the origin (negative offset) so their
 * inner edge lands at the origin; right/bottom sit AT the origin.
 */
export function computeSegmentBoxes(armLength: number, lineWidth: number): CrosshairSegmentBoxes {
  const halfLw = lineWidth / 2;
  return {
    left: { width: armLength, height: lineWidth, left: -armLength, top: -halfLw },
    right: { width: armLength, height: lineWidth, left: 0, top: -halfLw },
    top: { width: lineWidth, height: armLength, left: -halfLw, top: -armLength },
    bottom: { width: lineWidth, height: armLength, left: -halfLw, top: 0 },
  };
}

/**
 * Effective half-gap (CSS px) on each side of the cursor. Zero when the gap is
 * disabled; otherwise at least large enough to clear the pick box.
 */
export function computeCenterGap(opts: {
  readonly useCursorGap: boolean;
  readonly centerGapPx: number;
  readonly pickBoxSize: number;
}): number {
  if (!opts.useCursorGap) return 0;
  return Math.max(opts.pickBoxSize + 4, opts.centerGapPx || 5);
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
