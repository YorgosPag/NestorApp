/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Per-edge setback engine — classifies plot edges (frontage/rear/lateral)
 * and computes the buildable footprint polygon via per-edge inward offset.
 * ΝΟΚ ν.4067/2012 Άρθρο 9: Δ (rear) ≠ δ (lateral).
 */
import type { EdgeRole, EdgeSetback, SetbackResult } from '@/services/building-code/types/setback.types';
import type { PlotSite, PlotType } from '@/services/building-code/types/site.types';
import {
  inwardNormal,
  shoelaceArea,
  polyEdgeLabel,
} from '@/services/building-code/utils/geometry';
import { MIN_BUILDABLE_SIDE_M } from '@/services/building-code/constants/setback.constants';

type Pt = readonly [number, number];
type Poly = ReadonlyArray<Pt>;
const PARALLEL_EPS = 1e-10;
const REAR_ANGLE_THRESHOLD_DEG = 120;

/** Average of all polygon vertices. */
export function computeCentroid(poly: Poly): [number, number] {
  let sx = 0, sz = 0;
  for (const [x, z] of poly) { sx += x; sz += z; }
  return [sx / poly.length, sz / poly.length];
}

function edgeMid(poly: Poly, i: number): [number, number] {
  const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function flattenFrontageSet(pfe: ReadonlyArray<number | ReadonlyArray<number>>): Set<number> {
  const s = new Set<number>();
  for (const e of pfe) { if (Array.isArray(e)) for (const idx of e) s.add(idx); else s.add(e as number); }
  return s;
}

function frontageCentroid(poly: Poly, fs: Set<number>): [number, number] {
  let sx = 0, sz = 0, c = 0;
  for (const i of fs) { const m = edgeMid(poly, i); sx += m[0]; sz += m[1]; c++; }
  return c > 0 ? [sx / c, sz / c] : computeCentroid(poly);
}

/** Assign 'rear' role based on plot type and dot-product ranking. */
function assignRearByType(
  dots: ReadonlyArray<{ readonly idx: number; readonly dot: number }>,
  plotType: PlotType, out: Map<number, EdgeRole>,
): void {
  if (dots.length === 0) return;
  const sorted = [...dots].sort((a, b) => b.dot - a.dot);
  if (plotType === 'mesaio') { out.set(sorted[0]!.idx, 'rear'); return; }
  const maxDot = sorted[0]!.dot;
  const threshold = maxDot * Math.cos((REAR_ANGLE_THRESHOLD_DEG / 180) * Math.PI);
  for (const s of sorted) { if (s.dot >= threshold && s.dot > 0) out.set(s.idx, 'rear'); }
  if (out.size === 0) out.set(sorted[0]!.idx, 'rear');
}

/** Classify non-frontage edges as rear/lateral using dot-product heuristic. */
function classifyNonFrontage(
  poly: Poly, nfIdx: number[], plotType: PlotType, fs: Set<number>,
): Map<number, EdgeRole> {
  const out = new Map<number, EdgeRole>();
  if (plotType === 'diamperes') { for (const i of nfIdx) out.set(i, 'lateral'); return out; }
  const fc = frontageCentroid(poly, fs), pc = computeCentroid(poly);
  const awayX = pc[0] - fc[0], awayZ = pc[1] - fc[1];
  const dots = nfIdx.map(i => {
    const m = edgeMid(poly, i);
    return { idx: i, dot: (m[0] - pc[0]) * awayX + (m[1] - pc[1]) * awayZ };
  });
  assignRearByType(dots, plotType, out);
  for (const i of nfIdx) { if (!out.has(i)) out.set(i, 'lateral'); }
  return out;
}

/** Classify each edge of polyOutline as frontage/rear/lateral. */
export function classifyEdges(
  polyOutline: Poly, polyFrontageEdges: ReadonlyArray<number | ReadonlyArray<number>>, plotType: PlotType,
): EdgeRole[] {
  const n = polyOutline.length;
  const fs = flattenFrontageSet(polyFrontageEdges);
  const nf: number[] = [];
  for (let i = 0; i < n; i++) { if (!fs.has(i)) nf.push(i); }
  const cls = classifyNonFrontage(polyOutline, nf, plotType, fs);
  return Array.from({ length: n }, (_, i) => fs.has(i) ? 'frontage' : cls.get(i) ?? 'lateral');
}

/** Compute per-edge setback values based on roles and ΝΟΚ distances. */
export function computeEdgeSetbacks(
  polyOutline: Poly, roles: readonly EdgeRole[], D_m: number, delta_m: number,
  frontages: ReadonlyArray<{ readonly prassia_m: number }>,
): EdgeSetback[] {
  const n = polyOutline.length;
  let fc = 0;
  return roles.map((role, i) => {
    let setback_m: number;
    if (role === 'frontage') {
      setback_m = fc < frontages.length ? frontages[fc]!.prassia_m : 0;
      fc++;
    } else { setback_m = role === 'rear' ? D_m : delta_m; }
    return { edgeIdx: i, role, setback_m, label: polyEdgeLabel(i, n) };
  });
}

/** Line-line intersection via Cramer's rule. Returns null if parallel. */
function lineIntersect(p1: Pt, d1: Pt, p2: Pt, d2: Pt): [number, number] | null {
  const det = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(det) < PARALLEL_EPS) return null;
  const dx = p2[0] - p1[0], dz = p2[1] - p1[1];
  const t = (dx * d2[1] - dz * d2[0]) / det;
  return [p1[0] + t * d1[0], p1[1] + t * d1[1]];
}

/** Offset polygon edges inward and intersect adjacent offset lines. */
export function insetPolygon(polyOutline: Poly, setbacks: readonly EdgeSetback[]): [number, number][] {
  const n = polyOutline.length;
  const c = computeCentroid(polyOutline);
  const off = Array.from({ length: n }, (_, i) => {
    const [ax, az] = polyOutline[i]!;
    const [bx, bz] = polyOutline[(i + 1) % n]!;
    const [nx, nz] = inwardNormal(ax, az, bx, bz, c[0], c[1]);
    const s = setbacks[i]!.setback_m;
    return { a: [ax + nx * s, az + nz * s] as Pt, b: [bx + nx * s, bz + nz * s] as Pt };
  });
  return off.map((cur, i) => {
    const prev = off[(i - 1 + n) % n]!;
    const d1: Pt = [prev.b[0] - prev.a[0], prev.b[1] - prev.a[1]];
    const d2: Pt = [cur.b[0] - cur.a[0], cur.b[1] - cur.a[1]];
    return lineIntersect(prev.a, d1, cur.a, d2) ?? [(prev.b[0] + cur.a[0]) / 2, (prev.b[1] + cur.a[1]) / 2];
  });
}

/** Minimum distance between consecutive vertices of a polygon. */
export function computeMinEdgeLength(poly: Poly): number {
  let min = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    min = Math.min(min, Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return min;
}

type SetbackInput = Pick<PlotSite, 'polyOutline' | 'polyFrontageEdges' | 'plotType' | 'D_m' | 'frontages'>
  & { readonly delta_m: number };

/** Full setback computation — returns null if insufficient polygon data. */
export function computeSetbackResult(site: SetbackInput): SetbackResult | null {
  if (!site.polyOutline || site.polyOutline.length < 3) return null;
  if (!site.polyFrontageEdges) return null;
  const D_m = site.D_m ?? 0;
  const roles = classifyEdges(site.polyOutline, site.polyFrontageEdges, site.plotType);
  const setbacks = computeEdgeSetbacks(site.polyOutline, roles, D_m, site.delta_m, site.frontages);
  const footprint = insetPolygon(site.polyOutline, setbacks);
  const area = shoelaceArea(footprint);
  const minSide = computeMinEdgeLength(footprint);
  const warnings: string[] = [];
  if (minSide < MIN_BUILDABLE_SIDE_M) {
    warnings.push(`Ελάχιστη πλευρά δομήσιμου ${minSide.toFixed(2)}m < ${MIN_BUILDABLE_SIDE_M}m`);
  }
  return { edges: setbacks, buildableFootprint: footprint, buildableArea_m2: area, minBuildableSide_m: minSide, warnings };
}
