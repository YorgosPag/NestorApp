/**
 * ADR-920 §14.10 Ε3 — **the elevation profile A → B, exact on the published TIN**. Pure.
 *
 * 🔑 **Exact, not sampled**: CalTopo / Mapbox / ArcGIS sample the line at fixed steps, so a short steep bank between two
 *   samples is lost or smeared. On a TIN the ground is planar inside each triangle, so the profile is PIECEWISE LINEAR
 *   with a vertex exactly where the line crosses a triangle edge. We place a station at every such crossing: every
 *   change of grade the surface has, the profile has — and nothing the surface does not have.
 * 🔑 **Gaps are told, never bridged**: a stretch of the line off the published surface (outside the survey, or across a
 *   concave notch of it) is a piece with `onSurface: false` and no elevation. The chart draws a gap; nothing is invented.
 * 🔑 Every piece also carries «interpolated ground» (the map's hatched area), so the chart can say where to trust less.
 *
 * @module lib/terrain/inspect/terrain-profile
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import { elevationAt, type TerrainInspectIndex } from './terrain-inspect-index';

/** A station of the profile: distance along the line, plan position, elevation (`null` off the surface). */
interface ProfileStation {
  readonly s: number;
  readonly x: number;
  readonly y: number;
  readonly z: number | null;
}

/** The ground between two consecutive stations — planar, so ONE grade describes it. */
interface ProfilePiece {
  readonly fromS: number;
  readonly toS: number;
  readonly onSurface: boolean;
  /** Signed grade along A → B, percent (`+` climbs). `0` off the surface. */
  readonly gradePct: number;
  readonly sparse: boolean;
}

export interface TerrainProfile {
  readonly a: PlanarPoint;
  readonly b: PlanarPoint;
  readonly lengthM: number;
  readonly stations: readonly ProfileStation[];
  readonly pieces: readonly ProfilePiece[];
  /** Total climb / descent walking A → B, metres (on-surface pieces only). */
  readonly gainM: number;
  readonly lossM: number;
  readonly minM: number | null;
  readonly maxM: number | null;
  /** Steepest |grade| along the line, percent. */
  readonly maxGradePct: number;
  /** Some of the line runs off the published surface. */
  readonly hasGap: boolean;
}

/** Below this the line is a click, not a profile. */
const PROFILE_MIN_LENGTH_M = 0.5;
const EPSILON = 1e-9;

/** Parameter `t ∈ (0, 1)` where A→B crosses the edge `q0 q1`, or `null`. */
function crossingT(a: PlanarPoint, r: PlanarPoint, q0: PlanarPoint, q1: PlanarPoint): number | null {
  const sx = q1.x - q0.x;
  const sy = q1.y - q0.y;
  const denom = r.x * sy - r.y * sx;
  if (Math.abs(denom) < EPSILON) return null;
  const qx = q0.x - a.x;
  const qy = q0.y - a.y;
  const t = (qx * sy - qy * sx) / denom;
  const u = (qx * r.y - qy * r.x) / denom;
  return t > EPSILON && t < 1 - EPSILON && u >= -EPSILON && u <= 1 + EPSILON ? t : null;
}

/** Every `t` where the line crosses a mesh edge, plus both ends — sorted, without near-duplicates. */
function crossingsOf(index: TerrainInspectIndex, a: PlanarPoint, b: PlanarPoint): number[] {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const minX = Math.min(a.x, b.x); const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y); const maxY = Math.max(a.y, b.y);
  const ts = [0, 1];
  const { edges, xy } = index;
  for (let e = 0; e + 1 < edges.length; e += 2) {
    const [x0, y0] = xy[edges[e]];
    const [x1, y1] = xy[edges[e + 1]];
    if (Math.max(x0, x1) < minX || Math.min(x0, x1) > maxX || Math.max(y0, y1) < minY || Math.min(y0, y1) > maxY) continue;
    const t = crossingT(a, r, { x: x0, y: y0 }, { x: x1, y: y1 });
    if (t !== null) ts.push(t);
  }
  ts.sort((p, q) => p - q);
  return ts.filter((t, i) => i === 0 || t - ts[i - 1] > EPSILON);
}

function pieceOf(index: TerrainInspectIndex, from: ProfileStation, to: ProfileStation): ProfilePiece {
  const mid = elevationAt(index, (from.x + to.x) / 2, (from.y + to.y) / 2);
  const ds = to.s - from.s;
  if (mid === null || from.z === null || to.z === null || ds <= 0) {
    return { fromS: from.s, toS: to.s, onSurface: false, gradePct: 0, sparse: false };
  }
  return { fromS: from.s, toS: to.s, onSurface: true, gradePct: ((to.z - from.z) / ds) * 100, sparse: index.sparse[mid.triangle] };
}

interface Totals { gainM: number; lossM: number; minM: number | null; maxM: number | null; maxGradePct: number; hasGap: boolean }

function totalsOf(stations: readonly ProfileStation[], pieces: readonly ProfilePiece[]): Totals {
  const totals: Totals = { gainM: 0, lossM: 0, minM: null, maxM: null, maxGradePct: 0, hasGap: false };
  for (const st of stations) {
    if (st.z === null) continue;
    totals.minM = totals.minM === null ? st.z : Math.min(totals.minM, st.z);
    totals.maxM = totals.maxM === null ? st.z : Math.max(totals.maxM, st.z);
  }
  pieces.forEach((piece, i) => {
    if (!piece.onSurface) { totals.hasGap = true; return; }
    const dz = (stations[i + 1].z ?? 0) - (stations[i].z ?? 0);
    if (dz > 0) totals.gainM += dz; else totals.lossM -= dz;
    totals.maxGradePct = Math.max(totals.maxGradePct, Math.abs(piece.gradePct));
  });
  return totals;
}

/** The profile of the line A → B (snapshot frame), or `null` when the line is shorter than {@link PROFILE_MIN_LENGTH_M}. */
export function terrainProfileOf(index: TerrainInspectIndex, a: PlanarPoint, b: PlanarPoint): TerrainProfile | null {
  const lengthM = Math.hypot(b.x - a.x, b.y - a.y);
  if (lengthM < PROFILE_MIN_LENGTH_M) return null;
  const stations = crossingsOf(index, a, b).map((t): ProfileStation => {
    const x = a.x + t * (b.x - a.x);
    const y = a.y + t * (b.y - a.y);
    return { s: t * lengthM, x, y, z: elevationAt(index, x, y)?.z ?? null };
  });
  const pieces = stations.slice(1).map((to, i) => pieceOf(index, stations[i], to));
  return { a, b, lengthM, stations, pieces, ...totalsOf(stations, pieces) };
}

/** The point of the profile at distance `s` (clamped to the line) — exact, since the ground is linear between stations. */
export function profilePointAt(profile: TerrainProfile, s: number): ProfileStation {
  const at = Math.min(profile.lengthM, Math.max(0, s));
  const { stations } = profile;
  let i = 1;
  while (i < stations.length - 1 && stations[i].s < at) i++;
  const p = stations[i - 1];
  const q = stations[i];
  const f = q.s > p.s ? (at - p.s) / (q.s - p.s) : 0;
  const z = p.z !== null && q.z !== null && profile.pieces[i - 1]?.onSurface ? p.z + f * (q.z - p.z) : null;
  return { s: at, x: p.x + f * (q.x - p.x), y: p.y + f * (q.y - p.y), z };
}
