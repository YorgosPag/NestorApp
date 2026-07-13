/**
 * complex-linetype-snap-geometry — ADR-642 §6.8 (Φ6-B): pure OSNAP sampler for the
 * RENDERED complex-linetype pattern (railway rails + sleepers).
 *
 * Given a resolved `ComplexLinetypeDef` and the entity's WORLD-space axis polyline
 * (canonical mm), it derives the snappable pattern geometry WITHOUT any canvas:
 *   - **rails** — each layer that carries a visible line (dash/dot) at `offsetMm` → its
 *     two endpoints + midpoint (reuse `offsetPolyline`, the SAME parallel-offset the
 *     stroker draws with, so a snap sits exactly on the painted rail).
 *   - **sleepers** — each `symbol` slot along a layer's cycle → a perpendicular tick
 *     segment of height `scale × 2.5 mm` (the `BASE_SYMBOL_HEIGHT_MM` multiplier —
 *     ADR-642 gotcha) centred on the axis point → its two endpoints + midpoint.
 *   - **intersections** — every sleeper × every rail segment (reuse the ONE
 *     `GeometricCalculations.getLineIntersection` segment×segment primitive).
 *
 * FULL SSoT (N.18): the tick-placement arc-length walk is the SAME `walkCyclePlacements`
 * the `ComplexLineStroker` draws with — the sampler is NOT a second walk. The pure
 * geometry primitives (`buildSegments`/`cumulativeLengths`/`pointAt`/`offsetPolyline`)
 * are unit-agnostic, so they run here in world-mm exactly as they run in screen-px there.
 *
 * Beyond standard CAD: AutoCAD does NOT snap to linetype-generated geometry (Giorgio
 * asked for it explicitly — ADR-642 §6.8 documents the conscious deviation).
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  ComplexLinetypeDef,
  PatternElement,
  StrokeLayer,
} from '../../config/complex-linetype-types';
import {
  buildSegments,
  cumulativeLengths,
  offsetPolyline,
  pointAt,
  walkCyclePlacements,
  type Point,
  type Seg,
} from '../../rendering/linetype/complex-stroke-geometry';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { TEXT_SIZE_LIMITS } from '../../config/text-rendering-config';

/** Nominal glyph height (mm) that a symbol `scale` of 1 maps to — mirror `complex-symbol-draw`. */
const BASE_SYMBOL_HEIGHT_MM = TEXT_SIZE_LIMITS.DEFAULT_HEIGHT;

/**
 * Perf ceiling: sleepers sampled per line. A pattern's tick period (railway = 650 mm)
 * on a very long axis could otherwise materialise tens of thousands of points into the
 * snap index; past this the tail is dropped (documented, not silent — ADR-642 §6.8).
 */
export const MAX_SLEEPERS_PER_LINE = 2000;

/** The three snap-point categories the pattern geometry yields. */
export interface ComplexLinetypeSnapGeometry {
  readonly endpoints: readonly Point2D[];
  readonly midpoints: readonly Point2D[];
  readonly intersections: readonly Point2D[];
}

/**
 * Perpendicular half-extent (mm) of the whole pattern from the line axis — the largest of
 * every rail `|offsetMm|` and every symbol's half-height (`scale × 2.5 / 2`). This is the
 * half-width of the pattern's oriented bounding box (the sleepers, at ±1300 mm, reach past
 * the rails at ±753.5 mm → they set it). NOT `bandHalfExtentMm` (that is offsets-only, on
 * the editor's `LinePatternLayer`, and ignores the symbol reach).
 */
export function patternHalfExtentMm(def: ComplexLinetypeDef): number {
  let h = 0;
  for (const layer of def.layers) {
    h = Math.max(h, Math.abs(layer.offsetMm ?? 0));
    for (const el of layer.elements) {
      if (el.kind === 'symbol') h = Math.max(h, 0.5 * Math.max(el.scale, 0) * BASE_SYMBOL_HEIGHT_MM);
    }
  }
  return h;
}

const EMPTY: ComplexLinetypeSnapGeometry = { endpoints: [], midpoints: [], intersections: [] };

/**
 * Does this def carry pattern geometry worth snapping to — i.e. a parallel-offset layer
 * (rail) OR an embedded symbol (sleeper)? A plain single-axis dash/dot def has none of
 * its own (its endpoints are already the entity's, covered by the normal engines) → the
 * snap engine skips it, so it never duplicates the geometric endpoint/midpoint snaps.
 */
export function hasSnappablePatternGeometry(def: ComplexLinetypeDef): boolean {
  return def.layers.some(
    (l) => (l.offsetMm != null && l.offsetMm !== 0) || l.elements.some((e) => e.kind === 'symbol'),
  );
}

/** Arc-length length (mm) of a pattern element — only dash/gap advance the walk. */
function elementLengthMm(el: PatternElement): number {
  return el.kind === 'dash' || el.kind === 'gap' ? el.lengthMm : 0;
}

/** A visible line element (contributes a rail), vs a gap/symbol/text. */
function isLineElement(el: PatternElement): boolean {
  return el.kind === 'dash' || el.kind === 'dot';
}

const clonePt = (p: Point): Point2D => ({ x: p.x, y: p.y });

/** A rendered cross-tie: its two ends (± half the tick height along the normal) + centre. */
interface Sleeper {
  readonly a: Point2D;
  readonly b: Point2D;
  readonly mid: Point2D;
}

/**
 * Sleepers of one symbol-carrying layer: walk the cycle (SSoT `walkCyclePlacements`),
 * and at each `symbol` slot emit a tick segment perpendicular to the axis tangent,
 * `scale × BASE_SYMBOL_HEIGHT_MM` tall, centred on the point. `limit` caps the count.
 */
function sampleLayerSleepers(
  layer: StrokeLayer,
  segs: readonly Seg[],
  cum: readonly number[],
  total: number,
  phaseMm: number,
  limit: number,
): Sleeper[] {
  const lengths = layer.elements.map(elementLengthMm);
  const cycleLen = lengths.reduce((s, l) => s + l, 0);
  if (cycleLen <= 0 || limit <= 0) return [];
  const out: Sleeper[] = [];
  for (const { index, dist } of walkCyclePlacements(total, lengths, cycleLen, phaseMm)) {
    if (out.length >= limit) break;
    const el = layer.elements[index];
    if (el.kind !== 'symbol' || dist < 0 || dist > total) continue;
    const half = 0.5 * Math.max(el.scale, 0) * BASE_SYMBOL_HEIGHT_MM;
    if (half <= 0) continue;
    // Insertion = the axis point (tick offsetX/Y are 0 for the railway sleeper). The tick
    // glyph is `line(0,-0.5,0,0.5)` → its height runs along the left unit-normal (-uy, ux).
    const at = pointAt(segs, cum, dist);
    const nx = -at.uy;
    const ny = at.ux;
    out.push({
      a: { x: at.x + nx * half, y: at.y + ny * half },
      b: { x: at.x - nx * half, y: at.y - ny * half },
      mid: { x: at.x, y: at.y },
    });
  }
  return out;
}

/** Every sleeper × every rail segment (segment×segment; closed rails also test the wrap). */
function railSleeperIntersections(
  rails: readonly Point2D[][],
  sleepers: readonly Sleeper[],
  closed: boolean,
): Point2D[] {
  const out: Point2D[] = [];
  for (const s of sleepers) {
    for (const rail of rails) {
      for (let i = 1; i < rail.length; i++) {
        const hit = GeometricCalculations.getLineIntersection(s.a, s.b, rail[i - 1], rail[i]);
        if (hit) out.push(hit);
      }
      if (closed && rail.length > 2) {
        const hit = GeometricCalculations.getLineIntersection(s.a, s.b, rail[rail.length - 1], rail[0]);
        if (hit) out.push(hit);
      }
    }
  }
  return out;
}

/**
 * The oriented bounding-box snap points of the pattern along `axis` (Giorgio 2026-07-13):
 * the **4 corners** (endpoint-class ■) and the **west/east side midpoints** (midpoint-class
 * △ — the middle of each short side, which fall on the axis ends). The box is aligned to the
 * axis chord (start→end) with half-width `halfExtentMm` perpendicular — for a straight
 * railway this is its exact selection frame; for a polyline it is the chord-aligned OBB.
 * Empty for a degenerate axis / zero extent.
 */
function boundingBoxSnaps(
  axis: readonly Point2D[],
  halfExtentMm: number,
): { corners: Point2D[]; sideMids: Point2D[] } {
  const start = axis[0];
  const end = axis[axis.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len <= 0 || halfExtentMm <= 0) return { corners: [], sideMids: [] };
  const nx = -(dy / len); // left unit normal
  const ny = dx / len;
  const off = (p: Point2D, s: number): Point2D => ({
    x: p.x + nx * halfExtentMm * s,
    y: p.y + ny * halfExtentMm * s,
  });
  return {
    corners: [off(start, 1), off(start, -1), off(end, 1), off(end, -1)],
    sideMids: [{ x: start.x, y: start.y }, { x: end.x, y: end.y }],
  };
}

/**
 * Sample the snappable pattern geometry of `def` along the world-space `axis` polyline.
 * Returns endpoints/midpoints/intersections for the rendered rails + sleepers. Pure —
 * no canvas, no state, no store reads → safe to call from the snap engine's index build.
 */
export function sampleComplexLinetypeSnapGeometry(
  def: ComplexLinetypeDef,
  axis: readonly Point2D[],
  closed = false,
  maxSleepers = MAX_SLEEPERS_PER_LINE,
): ComplexLinetypeSnapGeometry {
  if (axis.length < 2 || def.layers.length === 0) return EMPTY;
  const endpoints: Point2D[] = [];
  const midpoints: Point2D[] = [];
  const rails: Point2D[][] = [];
  const sleepers: Sleeper[] = [];
  const phaseMm = def.phaseMm ?? 0;

  for (const layer of def.layers) {
    const layerPts = layer.offsetMm ? offsetPolyline(axis, layer.offsetMm) : axis.map(clonePt);
    const segs = buildSegments(layerPts, closed);
    if (segs.length === 0) continue;
    const cum = cumulativeLengths(segs);
    const total = cum[cum.length - 1];

    if (layer.elements.some(isLineElement)) {
      rails.push(layerPts.map(clonePt));
      endpoints.push(clonePt(layerPts[0]), clonePt(layerPts[layerPts.length - 1]));
      const m = pointAt(segs, cum, total / 2);
      midpoints.push({ x: m.x, y: m.y });
    }

    if (sleepers.length < maxSleepers && layer.elements.some((e) => e.kind === 'symbol')) {
      sleepers.push(
        ...sampleLayerSleepers(layer, segs, cum, total, phaseMm, maxSleepers - sleepers.length),
      );
    }
  }

  for (const s of sleepers) {
    endpoints.push(s.a, s.b);
    midpoints.push(s.mid);
  }
  // Selection-frame snaps (Giorgio 2026-07-13): the pattern's bounding box — 4 corners (■) +
  // west/east side midpoints (△). The half-width spans the sleepers (the widest element).
  const box = boundingBoxSnaps(axis, patternHalfExtentMm(def));
  endpoints.push(...box.corners);
  midpoints.push(...box.sideMids);
  const intersections = railSleeperIntersections(rails, sleepers, closed);
  return { endpoints, midpoints, intersections };
}
