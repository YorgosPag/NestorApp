/**
 * Line-pattern grip overlay geometry — ADR-642 Φ6-A (§6.7.4).
 *
 * Pure, React/DOM-free math for the 8-handle bounding box that sits over the compound-pattern
 * preview swatch: handle layout in pixel space, AABB hit-test, per-handle outward-drag direction,
 * and the pixel-delta → model-mm scale factor (with 0.5 mm snap + min-guard). Kept OUT of the React
 * component so it is jest-testable and cannot silently clone into the overlay (N.18).
 *
 * Scale-free by design: a factor is the ratio of the new to the old half-dimension in PIXEL space, so
 * it is independent of the swatch's px/mm zoom; the 0.5 mm snap is applied to the resulting MODEL mm
 * (the caller supplies the base mm from `bandHalfExtentMm` / `patternTotalLengthMm`).
 */

/** Which authored dimension a handle drives (a corner drives both). */
export type HandleAxis = 'vertical' | 'horizontal' | 'both';

/** The 8 bounding-box handles: corners (`tl/tr/bl/br`) + edge mid-points (`tm/bm/ml/mr`). */
export type HandleId = 'tl' | 'tm' | 'tr' | 'ml' | 'mr' | 'bl' | 'bm' | 'br';

export const HANDLE_IDS: readonly HandleId[] = ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br'];

/** A laid-out handle: its id, pixel centre, and the axis it drives. */
export interface HandleLayout {
  readonly id: HandleId;
  readonly x: number;
  readonly y: number;
  readonly axis: HandleAxis;
}

/** The pixel box the overlay covers (the swatch canvas), inset by `inset` so handles sit inside the edge. */
export interface OverlayBox {
  readonly width: number;
  readonly height: number;
  /** Margin (px) from the box edge to the handle centres — keeps the squares fully visible. */
  readonly inset: number;
}

/** Outward (box-growing) pixel deltas a drag contributes on each axis. */
export interface OutwardDelta {
  readonly vertical: number;
  readonly horizontal: number;
}

/** Inputs for the pixel-delta → model factor mapping (one axis at a time). */
export interface DragFactorInput {
  /** Half of the box dimension on this axis (px) — the lever the ratio is taken against. */
  readonly axisHalfPx: number;
  /** Outward pixel delta on this axis (box grows when > 0). */
  readonly outwardPx: number;
  /** Current authored dimension on this axis (mm) — band half-extent (vertical) / total length (horizontal). */
  readonly baseMm: number;
  /** Snap step (mm) applied to the target dimension unless `free`. */
  readonly stepMm: number;
  /** Minimum authored dimension (mm) the target is clamped to. */
  readonly minMm: number;
  /** `true` → free/continuous (Alt), no snap. */
  readonly free: boolean;
}

const AXIS_BY_ID: Readonly<Record<HandleId, HandleAxis>> = {
  tl: 'both', tr: 'both', bl: 'both', br: 'both',
  tm: 'vertical', bm: 'vertical',
  ml: 'horizontal', mr: 'horizontal',
};

/** The axis a handle drives (corner = both). */
export function handleAxis(id: HandleId): HandleAxis {
  return AXIS_BY_ID[id];
}

/** Lay out the 8 handles at the corners + edge mid-points of `box`, inset from the edge. */
export function layoutHandles(box: OverlayBox): HandleLayout[] {
  const left = box.inset;
  const right = box.width - box.inset;
  const top = box.inset;
  const bottom = box.height - box.inset;
  const midX = box.width / 2;
  const midY = box.height / 2;
  const at = (id: HandleId, x: number, y: number): HandleLayout => ({ id, x, y, axis: AXIS_BY_ID[id] });
  return [
    at('tl', left, top), at('tm', midX, top), at('tr', right, top),
    at('ml', left, midY), at('mr', right, midY),
    at('bl', left, bottom), at('bm', midX, bottom), at('br', right, bottom),
  ];
}

/** Nearest handle whose centre is within `radius` px of (`px`,`py`), or `null` if none is close enough. */
export function hitTestHandle(
  handles: readonly HandleLayout[],
  px: number,
  py: number,
  radius: number,
): HandleId | null {
  let best: HandleId | null = null;
  let bestDistSq = radius * radius;
  for (const h of handles) {
    const dx = h.x - px;
    const dy = h.y - py;
    const distSq = dx * dx + dy * dy;
    if (distSq <= bestDistSq) {
      bestDistSq = distSq;
      best = h.id;
    }
  }
  return best;
}

/**
 * Outward (box-growing) pixel deltas a raw pointer move (`dxPx`,`dyPx`) contributes, per handle:
 * top edge grows upward (−dy), bottom downward (+dy), left leftward (−dx), right rightward (+dx). A
 * corner contributes on both axes; an edge mid-point on its single axis (the other stays 0).
 */
export function outwardDeltaPx(id: HandleId, dxPx: number, dyPx: number): OutwardDelta {
  const top = id === 'tl' || id === 'tm' || id === 'tr';
  const bottom = id === 'bl' || id === 'bm' || id === 'br';
  const left = id === 'tl' || id === 'ml' || id === 'bl';
  const right = id === 'tr' || id === 'mr' || id === 'br';
  const vertical = top ? -dyPx : bottom ? dyPx : 0;
  const horizontal = left ? -dxPx : right ? dxPx : 0;
  return { vertical, horizontal };
}

/**
 * Pixel-delta → model scale factor. The raw factor is the pixel-space ratio
 * `(axisHalfPx + outwardPx) / axisHalfPx` (scale-free); it is turned into a target mm, snapped to
 * `stepMm` (unless `free`), clamped to `minMm`, then divided back to a factor. `baseMm ≤ 0` → `1`
 * (no-op: a scale cannot create a dimension out of nothing).
 */
export function computeDragFactor(input: DragFactorInput): number {
  const { axisHalfPx, outwardPx, baseMm, stepMm, minMm, free } = input;
  if (baseMm <= 0 || axisHalfPx <= 0) return 1;
  const raw = (axisHalfPx + outwardPx) / axisHalfPx;
  let targetMm = raw * baseMm;
  if (!free && stepMm > 0) targetMm = Math.round(targetMm / stepMm) * stepMm;
  targetMm = Math.max(minMm, targetMm);
  return targetMm / baseMm;
}
