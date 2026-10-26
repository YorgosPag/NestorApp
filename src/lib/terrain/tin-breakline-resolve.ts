/**
 * ADR-650 / ADR-920 Β4.8 Τ — breaklines → constraint edges the triangulator can ALWAYS honour.
 *
 * Measured 2026-10-25: two crossing breaklines made `cdt2d` cut holes in the surface and drop surveyed vertices, and
 * the Delaunator constrainer refuses them outright. Neither is acceptable, and the big tools agree on why: a crossing
 * states two elevations for one position. Trimble's breakline rule inserts a node at every intersection; Civil 3D asks
 * which elevation wins (first / higher / lower / average); Carlson highlights crossings. Here:
 *
 * 1. A **crossing** gets a TIN node, and BOTH breaklines are split there — nothing is dropped. Its Z is the EARLIER
 *    breakline's interpolation: the survey points' rule (`surveyFactsOf`: the first statement is kept).
 * 2. A **vertex on a breakline** splits the breakline there (what `cdt2d` did) and keeps the vertex's own Z; a
 *    breakline vertex that merges with an existing one (same position) keeps the existing Z — also reported.
 * 3. Every DISAGREEMENT is returned as a {@link BreaklineElevationConflict} — the builder classifies strictly
 *    (float noise only); how loud a given Δz is belongs to QA, not to the geometry.
 * 4. ADR-920 Β3.6 — where BOTH sides are breaklines, a stored engineer's rule (`Breakline.crossingResolutions`,
 *    Civil 3D Higher / Lower / Average / Specify) replaces «the earlier wins» at that meeting point; the conflict is
 *    still reported, carrying the resolution. A survey vertex is never overruled by a rule (ADR-720).
 *
 * Predicates are EXACT (`robust-predicates`): whether a vertex is on a segment, or two segments cross, is never decided
 * by rounding. The `orient2d` sign convention is irrelevant here — only «same side / opposite / zero» is used.
 */

import { orient2d } from 'robust-predicates';
import { crossingRuleZ, indexCrossingResolutions, type CrossingResolutionIndex } from './breakline-crossing-rule';
import type {
  Breakline,
  BreaklineElevationConflict,
  CrossingResolutionKey,
  LocalOrigin,
  TinPosition,
} from './terrain-types';
import { localVertexKey, pushVertex, type CollectedVertices } from './tin-vertex-accumulator';
import { cellOf, cellsAlongSegment, createSegmentGrid, type SegmentGrid } from './tin-segment-grid';
import type { TinEdge } from './tin-triangulate';

/**
 * Two interpolated elevations «agree» when they differ by float noise only. Deliberately NOT a survey tolerance: a
 * declared Δz is reported as a conflict and QA decides its severity.
 */
const ELEVATION_AGREEMENT_RELATIVE = 1e-9;

export function elevationsAgree(a: number, b: number): boolean {
  return Math.abs(a - b) <= ELEVATION_AGREEMENT_RELATIVE * Math.max(1, Math.abs(a), Math.abs(b));
}

interface Segment {
  readonly a: number;
  readonly b: number;
  readonly breaklineId: string;
}

/** A vertex that splits a segment, at parameter `t` ∈ (0, 1) from `a`. */
interface SplitPoint {
  readonly index: number;
  readonly t: number;
}

interface ResolvedBreaklines {
  readonly edges: TinEdge[];
  readonly conflicts: BreaklineElevationConflict[];
  /** ADR-920 Β3.6 — stored decisions that decided nothing in this build. */
  readonly unappliedResolutions: CrossingResolutionKey[];
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** Breaklines → index segments (rings closed), in input order; a repeated segment is kept once (the first). */
function segmentsOf(breaklines: readonly Breakline[], acc: CollectedVertices, origin: LocalOrigin): Segment[] {
  const segments: Segment[] = [];
  const seen = new Set<string>();
  const add = (a: number | undefined, b: number | undefined, breaklineId: string): void => {
    if (a === undefined || b === undefined || a === b || seen.has(pairKey(a, b))) return;
    seen.add(pairKey(a, b));
    segments.push({ a, b, breaklineId });
  };
  for (const bl of breaklines) {
    const idx = bl.vertices.map((v) => acc.keyToIndex.get(localVertexKey(v.x - origin.x, v.y - origin.y)));
    for (let i = 0; i < idx.length - 1; i++) add(idx[i], idx[i + 1], bl.id);
    if (bl.closed && idx.length > 2) add(idx[idx.length - 1], idx[0], bl.id);
  }
  return segments;
}

function orient(p: TinPosition, q: TinPosition, r: TinPosition): number {
  return Math.sign(orient2d(p[0], p[1], q[0], q[1], r[0], r[1]));
}

/** Z of segment `s` at parameter `t`. */
function zAlong(acc: CollectedVertices, s: Segment, t: number): number {
  const za = acc.elevations[s.a];
  return za + t * (acc.elevations[s.b] - za);
}

/** Parameter of the (collinear) point `p` along `s`. */
function paramOf(acc: CollectedVertices, s: Segment, p: TinPosition): number {
  const [ax, ay] = acc.positions[s.a];
  const [bx, by] = acc.positions[s.b];
  const dx = bx - ax;
  const dy = by - ay;
  return ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy);
}

/** Bucket key → indices; one helper for both buckets (vertices, segments). */
function pushBucket(buckets: Map<number, number[]>, cell: number, value: number): void {
  const list = buckets.get(cell);
  if (list) list.push(value);
  else buckets.set(cell, [value]);
}

/**
 * ADR-920 Β3.2 — vertex index → the breakline that STATED it first (its Z is what the surface carries). Survey vertices
 * (`index < surveyVertexCount`, collected first) have no owner: their Z is a measurement. A breakline vertex that merged
 * with a survey point therefore stays unowned too — the measurement was there first.
 */
function vertexOwnersOf(
  breaklines: readonly Breakline[],
  acc: CollectedVertices,
  origin: LocalOrigin,
  surveyVertexCount: number,
): Map<number, string> {
  const owners = new Map<number, string>();
  for (const bl of breaklines) {
    for (const v of bl.vertices) {
      const index = acc.keyToIndex.get(localVertexKey(v.x - origin.x, v.y - origin.y));
      if (index !== undefined && index >= surveyVertexCount && !owners.has(index)) owners.set(index, bl.id);
    }
  }
  return owners;
}

class Resolution {
  readonly splits = new Map<number, SplitPoint[]>();
  readonly conflicts: BreaklineElevationConflict[] = [];

  constructor(
    readonly acc: CollectedVertices,
    readonly segments: readonly Segment[],
    /** Who stated each vertex's kept Z — see {@link vertexOwnersOf}. Crossing nodes are added as they are created. */
    readonly owners: Map<number, string>,
    /** ADR-920 Β3.6 — the engineer's decisions, by pair + position. */
    readonly decisions: CrossingResolutionIndex,
  ) {}

  split(segmentIndex: number, point: SplitPoint): void {
    const list = this.splits.get(segmentIndex);
    if (list) list.push(point);
    else this.splits.set(segmentIndex, [point]);
  }

  /** Report `overruledZ` against what the surface keeps at `vertex`, when they disagree. */
  check(kind: BreaklineElevationConflict['kind'], vertex: number, overruledZ: number, breaklineId: string): void {
    const keptZ = this.acc.elevations[vertex];
    if (elevationsAgree(keptZ, overruledZ)) return;
    const [x, y] = this.acc.positions[vertex];
    const keptBreaklineId = this.owners.get(vertex);
    this.conflicts.push({
      kind, x, y, keptZ, overruledZ, overruledBreaklineId: breaklineId,
      ...(keptBreaklineId !== undefined && { keptBreaklineId }),
    });
  }

  /**
   * ADR-920 Β3.6 — the ONE door where an engineer's rule can decide a meeting point: `breaklineId` states
   * `overruledZ` at `vertex`, which already carries its owner's Z. When BOTH sides are breaklines and a stored rule for
   * that pair matches the position, the vertex takes the rule's Z (both lines then pass through it) and ONE conflict
   * is reported with the resolution. A survey vertex is never decided by a rule — the measurement wins (ADR-720).
   * Otherwise this is {@link check}.
   */
  decide(kind: BreaklineElevationConflict['kind'], vertex: number, overruledZ: number, breaklineId: string): void {
    const keptLineZ = this.acc.elevations[vertex];
    const keptBreaklineId = this.owners.get(vertex);
    const [x, y] = this.acc.positions[vertex];
    const found = keptBreaklineId === undefined || elevationsAgree(keptLineZ, overruledZ)
      ? undefined
      : this.decisions.find(keptBreaklineId, breaklineId, x, y);
    if (keptBreaklineId === undefined || found === undefined) {
      this.check(kind, vertex, overruledZ, breaklineId);
      return;
    }
    const keptZ = crossingRuleZ(found.resolution, keptLineZ, overruledZ);
    this.acc.elevations[vertex] = keptZ;
    this.decisions.markApplied(found.key);
    this.conflicts.push({
      kind, x, y, keptZ, overruledZ, overruledBreaklineId: breaklineId, keptBreaklineId,
      resolution: { rule: found.resolution.rule, keptLineZ, key: found.key },
    });
  }
}

/** Proper crossing (interiors only) of `s` and `u` → parameters along each, or `null`. */
function crossingOf(acc: CollectedVertices, s: Segment, u: Segment): readonly [number, number] | null {
  if (s.a === u.a || s.a === u.b || s.b === u.a || s.b === u.b) return null;
  const [a, b, c, d] = [acc.positions[s.a], acc.positions[s.b], acc.positions[u.a], acc.positions[u.b]];
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0 || o1 === o2 || o3 === o4) return null;
  const rx = b[0] - a[0], ry = b[1] - a[1];
  const sx = d[0] - c[0], sy = d[1] - c[1];
  const denom = rx * sy - ry * sx;
  const qx = c[0] - a[0], qy = c[1] - a[1];
  return [(qx * sy - qy * sx) / denom, (qx * ry - qy * rx) / denom];
}

/** Insert a node at the crossing of segments `i` (earlier) and `j`; split both; report the overruled Z. */
function resolveCrossing(res: Resolution, i: number, j: number, ts: number, tu: number): void {
  const s = res.segments[i];
  const u = res.segments[j];
  const [ax, ay] = res.acc.positions[s.a];
  const [bx, by] = res.acc.positions[s.b];
  const before = res.acc.positions.length;
  const node = pushVertex(res.acc, ax + ts * (bx - ax), ay + ts * (by - ay), zAlong(res.acc, s, ts));
  // A NEW node carries the earlier breakline's Z, so that breakline owns it; a node that landed on an existing vertex
  // (one dedup grid) keeps whoever stated that vertex.
  if (node >= before) res.owners.set(node, s.breaklineId);
  res.split(i, { index: node, t: ts });
  res.split(j, { index: node, t: tu });
  res.check('crossing', node, zAlong(res.acc, s, ts), s.breaklineId);
  res.decide('crossing', node, zAlong(res.acc, u, tu), u.breaklineId);
}

function segmentBuckets(res: Resolution, grid: SegmentGrid): Map<number, number[]> {
  const buckets = new Map<number, number[]>();
  res.segments.forEach((s, i) => {
    for (const cell of cellsAlongSegment(grid, res.acc.positions[s.a], res.acc.positions[s.b])) pushBucket(buckets, cell, i);
  });
  return buckets;
}

/** Every proper crossing between two segments, each pair tested once, earlier segment first. */
function resolveCrossings(res: Resolution, grid: SegmentGrid): void {
  const tested = new Set<string>();
  for (const list of segmentBuckets(res, grid).values()) {
    for (let p = 0; p < list.length; p++) {
      for (let q = p + 1; q < list.length; q++) {
        const [i, j] = list[p] < list[q] ? [list[p], list[q]] : [list[q], list[p]];
        const key = `${i}-${j}`;
        if (tested.has(key)) continue;
        tested.add(key);
        const hit = crossingOf(res.acc, res.segments[i], res.segments[j]);
        if (hit) resolveCrossing(res, i, j, hit[0], hit[1]);
      }
    }
  }
}

/** Vertex `v` exactly on the interior of segment `s` → its parameter, else `null`. */
function vertexOnSegment(acc: CollectedVertices, s: Segment, v: number): number | null {
  if (v === s.a || v === s.b) return null;
  const [a, b, p] = [acc.positions[s.a], acc.positions[s.b], acc.positions[v]];
  if (orient(a, b, p) !== 0) return null;
  const t = paramOf(acc, s, p);
  return t > 0 && t < 1 ? t : null;
}

/** Every ORIGINAL vertex (index < `vertexCount`) lying on a segment splits it, keeping its own Z. */
function resolveVerticesOnSegments(res: Resolution, grid: SegmentGrid, vertexCount: number): void {
  const buckets = new Map<number, number[]>();
  for (let v = 0; v < vertexCount; v++) pushBucket(buckets, cellOf(grid, ...res.acc.positions[v]), v);
  res.segments.forEach((s, i) => {
    for (const cell of cellsAlongSegment(grid, res.acc.positions[s.a], res.acc.positions[s.b])) {
      for (const v of buckets.get(cell) ?? []) {
        const t = vertexOnSegment(res.acc, s, v);
        if (t === null) continue;
        res.split(i, { index: v, t });
        res.decide('vertex-on-breakline', v, zAlong(res.acc, s, t), s.breaklineId);
      }
    }
  });
}

/**
 * A breakline VERTEX that landed on a position already taken (a survey point, an earlier breakline's vertex) was merged
 * by the one dedup grid, which keeps the first elevation — report the breakline's own Z when it disagrees.
 */
function reportMergedBreaklineVertices(res: Resolution, breaklines: readonly Breakline[], origin: LocalOrigin): void {
  for (const bl of breaklines) {
    for (const v of bl.vertices) {
      const index = res.acc.keyToIndex.get(localVertexKey(v.x - origin.x, v.y - origin.y));
      if (index !== undefined) res.decide('vertex-on-breakline', index, v.z, bl.id);
    }
  }
}

/** Each segment, cut at its split points (sorted along it), as unique edges. */
function emitEdges(res: Resolution): TinEdge[] {
  const edges: TinEdge[] = [];
  const seen = new Set<string>();
  res.segments.forEach((s, i) => {
    const chain = [s.a, ...[...(res.splits.get(i) ?? [])].sort((p, q) => p.t - q.t).map((p) => p.index), s.b];
    for (let k = 0; k < chain.length - 1; k++) {
      const [a, b] = [chain[k], chain[k + 1]];
      if (a === b || seen.has(pairKey(a, b))) continue;
      seen.add(pairKey(a, b));
      edges.push([a, b]);
    }
  });
  return edges;
}

/**
 * Resolve the breaklines against the collected vertices. MUTATES `acc` (crossing nodes are appended through the one
 * dedup grid, `pushVertex`) — call it before the triangulation, once. `surveyVertexCount` = how many of `acc`'s vertices
 * the survey points produced (they are collected first): it is what tells a measured Z from a breakline's.
 */
export function resolveBreaklines(
  breaklines: readonly Breakline[],
  acc: CollectedVertices,
  origin: LocalOrigin,
  surveyVertexCount: number,
): ResolvedBreaklines {
  const segments = segmentsOf(breaklines, acc, origin);
  const decisions = indexCrossingResolutions(breaklines, origin);
  const res = new Resolution(acc, segments, vertexOwnersOf(breaklines, acc, origin, surveyVertexCount), decisions);
  reportMergedBreaklineVertices(res, breaklines, origin);
  if (segments.length > 0) {
    const grid = createSegmentGrid(acc.positions);
    // Β3.6 — vertices before crossings: a rule may change an EXISTING vertex's Z, and a crossing interpolates from
    // its segments' end vertices, so those must be final first. (Crossing nodes are new vertices: never on this list.)
    resolveVerticesOnSegments(res, grid, acc.positions.length);
    resolveCrossings(res, grid);
  }
  return {
    edges: segments.length > 0 ? emitEdges(res) : [],
    conflicts: res.conflicts,
    unappliedResolutions: decisions.unapplied(),
  };
}
