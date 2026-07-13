/**
 * GEOMETRY SMOOTH-DISPLAY — non-destructive «fitted curve» display path for a
 * polyline (ADR-650 M3). The AutoCAD spline-fit-polyline / Civil 3D Surface-Style
 * «Contour Smoothing» model: the CONTROL vertices are never touched; this only
 * produces the curve that is STROKED in their place when `entity.smoothDisplay`.
 *
 * Pure composition of THREE existing SSoTs — zero new curve / intersection /
 * simplify math (N.18):
 *   - `catmullRom`      (geometry-spline-utils)  — the interpolating curve.
 *   - `segmentsIntersect` (GeometryUtils)         — the self-intersection guard.
 *   - `simplifyPolyline`  (geometry-polyline-utils, Ramer–Douglas–Peucker) — LOD.
 *
 * Guard (big-player pitfall): an interpolating spline can overshoot at a sharp
 * control vertex and fold into a cusp/loop. Per SPAN (control[i]→control[i+1]) we
 * detect a crossing — the span's own sub-path OR against the previous accepted
 * span across their shared junction — and, where found, keep the RAW straight
 * chord for that span. Cross-CONTOUR (neighbouring-elevation) intersection is a
 * multi-line concern a per-entity renderer has no context for and is deliberately
 * out of scope here (documented in ADR-650 §… M3); moderate smoothing + the
 * self/adjacent guard covers the visible artefacts, matching Civil 3D behaviour.
 *
 * No DOM / React / entity deps — world-space `Point2D[]` in, world-space out; the
 * caller maps to screen (so the cached world curve survives pan/zoom).
 */

import type { Point2D } from '../../types/Types';
import { catmullRom } from './geometry-spline-utils';
import { simplifyPolyline } from './geometry-polyline-utils';
import { segmentsIntersect } from '../../../utils/geometry/GeometryUtils';

/** Tessellation density of ONE control-point span (start + interior samples). */
export const SMOOTH_SEGMENTS_PER_SPAN = 8;

/** Target on-screen decimation budget (≈px) that drives the zoom-adaptive LOD. */
const LOD_TARGET_PX = 0.75;

export interface SmoothDisplayOptions {
  /** Samples per span. Default {@link SMOOTH_SEGMENTS_PER_SPAN}. */
  readonly segmentsPerSpan?: number;
  /** Ramer–Douglas–Peucker tolerance in WORLD units; ≤0 ⇒ no simplify. */
  readonly simplifyTolerance?: number;
}

/** Do two segments share an endpoint (by value)? Such pairs merely touch. */
function shareEndpoint(a1: Point2D, a2: Point2D, b1: Point2D, b2: Point2D): boolean {
  return (a1.x === b1.x && a1.y === b1.y) || (a1.x === b2.x && a1.y === b2.y)
    || (a2.x === b1.x && a2.y === b1.y) || (a2.x === b2.x && a2.y === b2.y);
}

/** Catmull-Rom samples of span i (start + interior; the end is the next span's start). */
function buildSpan(control: readonly Point2D[], i: number, steps: number): Point2D[] {
  const n = control.length;
  const p0 = control[(i - 1 + n) % n] ?? control[i];
  const p1 = control[i];
  const p2 = control[(i + 1) % n] ?? control[i];
  const p3 = control[(i + 2) % n] ?? p2;
  const out: Point2D[] = [];
  for (let s = 0; s < steps; s += 1) out.push(catmullRom(p0, p1, p2, p3, s / steps));
  return out;
}

/**
 * Windowed self-intersection scan of the provisional path: for every segment,
 * test the next few segments (bounded window — a fold on an interpolating curve
 * is always local), skipping endpoint-sharing (adjacent / junction) pairs. Every
 * crossing marks the SPANS its two segments belong to as unsafe. Closed paths
 * wrap so the seam between the last and first span is checked too.
 */
function scanUnsafeSpans(
  points: readonly Point2D[],
  spanOfPoint: readonly number[],
  closed: boolean,
  window: number,
): Set<number> {
  const unsafe = new Set<number>();
  const segCount = points.length - 1;
  if (segCount < 2) return unsafe;
  for (let a = 0; a < segCount; a += 1) {
    const a1 = points[a];
    const a2 = points[a + 1];
    for (let d = 2; d <= window; d += 1) {
      const b = closed ? (a + d) % segCount : a + d;
      if (!closed && b >= segCount) break;
      const b1 = points[b];
      const b2 = points[b + 1];
      if (shareEndpoint(a1, a2, b1, b2)) continue;
      if (segmentsIntersect(a1, a2, b1, b2)) {
        unsafe.add(spanOfPoint[a]).add(spanOfPoint[a + 1]);
        unsafe.add(spanOfPoint[b]).add(spanOfPoint[b + 1]);
      }
    }
  }
  return unsafe;
}

/** Concatenate spans (raw-fallback spans contribute only their start vertex) + close. */
function joinSpans(spans: readonly Point2D[][], control: readonly Point2D[], closed: boolean): Point2D[] {
  const path: Point2D[] = [];
  for (const span of spans) path.push(...span);
  path.push(closed ? control[0] : control[control.length - 1]);
  return path;
}

/**
 * Build the non-destructive smoothed DISPLAY path through `control`. Fewer than 3
 * control points cannot be fitted → returns a copy of the raw points. A `closed`
 * polyline wraps the last→first span. Self-intersection guard: where the fit would
 * fold (self-crossing on a sharp/tight vertex), the offending spans keep their RAW
 * straight chord; the rest stay smooth. Finally decimated (LOD) via Douglas–Peucker.
 */
export function buildSmoothedDisplayPath(
  control: readonly Point2D[],
  closed: boolean,
  options: SmoothDisplayOptions = {},
): Point2D[] {
  if (!control || control.length < 3) return control ? [...control] : [];

  const steps = Math.max(1, options.segmentsPerSpan ?? SMOOTH_SEGMENTS_PER_SPAN);
  const n = control.length;
  const spanCount = closed ? n : n - 1;

  const smoothSpans: Point2D[][] = [];
  const provisional: Point2D[] = [];
  const spanOfPoint: number[] = [];
  for (let i = 0; i < spanCount; i += 1) {
    const span = buildSpan(control, i, steps);
    smoothSpans.push(span);
    for (const p of span) { provisional.push(p); spanOfPoint.push(i); }
  }
  provisional.push(closed ? control[0] : control[n - 1]);
  spanOfPoint.push(spanCount - 1);

  // A fold spans at most a few control intervals → a small segment window suffices.
  const unsafe = scanUnsafeSpans(provisional, spanOfPoint, closed, 3 * steps + 2);
  const spans = unsafe.size === 0
    ? smoothSpans
    // Raw fallback = just the start vertex; the straight chord to control[i+1]
    // emerges from concatenation with the next span's start / the final close.
    : smoothSpans.map((span, i) => (unsafe.has(i) ? [control[i]] : span));

  const path = unsafe.size === 0 ? provisional : joinSpans(spans, control, closed);

  const tol = options.simplifyTolerance ?? 0;
  return tol > 0 ? simplifyPolyline(path, tol) : path;
}

/**
 * Zoom-adaptive LOD tolerance (WORLD units) for a given world→screen `scale`
 * (px per world unit), bucketed to powers of two so small zoom changes reuse the
 * cached curve instead of rebuilding every frame. ≤0 scale ⇒ 0 (no simplify).
 */
export function lodToleranceForScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 0;
  const raw = LOD_TARGET_PX / scale;
  return 2 ** Math.round(Math.log2(raw));
}

// ── Render-time cache (per entity) ────────────────────────────────────────────
// Keyed by entity id; a cache hit requires the SAME control-array reference (a
// patched entity gets a fresh array ⇒ miss ⇒ rebuild) AND the same closed flag +
// LOD tolerance bucket. So pan/zoom within a bucket is a pure Map lookup — the
// self-intersection guard + tessellation run only on real change (ADR-040: no
// per-frame smoothing on the hot path).

interface SmoothCacheEntry {
  readonly control: readonly Point2D[];
  readonly closed: boolean;
  readonly tol: number;
  readonly path: Point2D[];
}

const MAX_CACHE = 4096;
const smoothCache = new Map<string, SmoothCacheEntry>();

/** Cached {@link buildSmoothedDisplayPath} keyed by entity id (see cache note above). */
export function getSmoothedDisplayPath(
  entityId: string,
  control: readonly Point2D[],
  closed: boolean,
  simplifyTolerance: number,
): Point2D[] {
  const hit = smoothCache.get(entityId);
  if (hit && hit.control === control && hit.closed === closed && hit.tol === simplifyTolerance) {
    return hit.path;
  }
  const path = buildSmoothedDisplayPath(control, closed, { simplifyTolerance });
  if (smoothCache.size >= MAX_CACHE) smoothCache.clear();
  smoothCache.set(entityId, { control, closed, tol: simplifyTolerance, path });
  return path;
}
