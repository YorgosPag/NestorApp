/**
 * ADR-920 §14.10 Ε3 / §5 «Βέλη απορροής νερού» — **the water drop**: where does rain falling HERE run to? Pure.
 *
 * Steepest descent on the published TIN — the classical TIN flow tracing of hydrology (Jones, Wright & Maidment 1990):
 *   - **on a face** the ground is a plane, so water runs in ONE straight line, along `−∇z`, to the edge it leaves through;
 *   - **into a channel**: if the neighbour across that edge slopes BACK towards it, both faces drain into the edge — the drop
 *     follows the edge downhill to its lower vertex (a valley line, the way a real gully collects water);
 *   - **at a vertex** it takes the steepest way down among the faces around it and the edges leaving it;
 *   - it **stops** in a pit (no way down — water would pond), on flat ground, where it leaves the published surface, or at
 *     a step limit (never an endless loop).
 * 🔑 Indicative, and said so in the view: no infiltration, vegetation or drainage works — the shape of the ground only.
 *
 * @module lib/terrain/inspect/terrain-flow-path
 */

import { LISTING_TERRAIN_FLAT_GRADIENT_PCT } from '@/lib/terrain/publication/listing-terrain-config';

import { elevationAt, type TerrainInspectIndex } from './terrain-inspect-index';

type FlowEnd = 'pit' | 'flat' | 'leaves-surface' | 'step-limit';

interface FlowPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface FlowPath {
  readonly points: readonly FlowPoint[];
  /** Plan length of the path, metres. */
  readonly lengthM: number;
  /** Elevation lost from start to end, metres. */
  readonly dropM: number;
  readonly end: FlowEnd;
  /** Direction from the start to where the water ends, clockwise from north; `null` if it did not move. */
  readonly overallAzimuthDeg: number | null;
}

const FLAT_GRADIENT = LISTING_TERRAIN_FLAT_GRADIENT_PCT / 100;
const EPSILON = 1e-9;
const MAX_STEPS = 20_000;

type Step =
  | { readonly kind: 'face'; readonly at: FlowPoint; readonly triangle: number }
  | { readonly kind: 'vertex'; readonly vertex: number; readonly via?: FlowPoint }
  | { readonly kind: 'end'; readonly end: FlowEnd; readonly at?: FlowPoint };

interface VertexStar {
  readonly start: Int32Array;
  readonly list: Int32Array;
  readonly rim: Uint8Array;
}

const stars = new WeakMap<TerrainInspectIndex, VertexStar>();

/** The triangles around every vertex (CSR) and which vertices sit on the rim of the surface. */
function starOf(index: TerrainInspectIndex): VertexStar {
  const cached = stars.get(index);
  if (cached) return cached;
  const count = index.z.length;
  const start = new Int32Array(count + 1);
  index.triangles.forEach((tri) => tri.forEach((v) => { start[v + 1]++; }));
  for (let v = 0; v < count; v++) start[v + 1] += start[v];
  const fill = start.slice(0, count);
  const list = new Int32Array(start[count]);
  const rim = new Uint8Array(count);
  index.triangles.forEach((tri, t) => tri.forEach((v, e) => {
    list[fill[v]++] = t;
    if (index.adjacent[3 * t + e] < 0) { rim[v] = 1; rim[tri[(e + 1) % 3]] = 1; }
  }));
  const star = { start, list, rim };
  stars.set(index, star);
  return star;
}

const pointOf = (index: TerrainInspectIndex, v: number): FlowPoint => ({ x: index.xy[v][0], y: index.xy[v][1], z: index.z[v] });

/** Downhill unit direction of triangle `t`, or `null` when it is flat (or degenerate). */
function downhill(index: TerrainInspectIndex, t: number): { dx: number; dy: number; slope: number } | null {
  const plane = index.planes[t];
  if (plane === null) return null;
  const slope = Math.hypot(plane.a, plane.b);
  return slope < FLAT_GRADIENT ? null : { dx: -plane.a / slope, dy: -plane.b / slope, slope };
}

/** Where the ray from `p` along `d` leaves triangle `t`: the edge, the distance along the ray, the edge parameter. */
function exitOf(index: TerrainInspectIndex, t: number, p: FlowPoint, dx: number, dy: number) {
  const tri = index.triangles[t];
  let best: { edge: number; s: number; u: number } | null = null;
  for (let e = 0; e < 3; e++) {
    const [x0, y0] = index.xy[tri[e]];
    const [x1, y1] = index.xy[tri[(e + 1) % 3]];
    const ex = x1 - x0; const ey = y1 - y0;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < EPSILON) continue;
    const s = ((x0 - p.x) * ey - (y0 - p.y) * ex) / denom;
    const u = ((x0 - p.x) * dy - (y0 - p.y) * dx) / denom;
    if (s > EPSILON && u >= -EPSILON && u <= 1 + EPSILON && (best === null || s < best.s)) best = { edge: e, s, u };
  }
  return best;
}

/** Does the neighbour `n` across edge `a → b` of `t` drain back into that edge (a channel)? */
function drainsBack(index: TerrainInspectIndex, t: number, n: number, a: number, b: number): boolean {
  const flow = downhill(index, n);
  if (flow === null) return true;
  const [ax, ay] = index.xy[a];
  const [bx, by] = index.xy[b];
  const third = index.triangles[t].find((v) => v !== a && v !== b) ?? a;
  let nx = by - ay; let ny = -(bx - ax);
  if (nx * (index.xy[third][0] - ax) + ny * (index.xy[third][1] - ay) > 0) { nx = -nx; ny = -ny; }
  return flow.dx * nx + flow.dy * ny <= 0;
}

function stepFace(index: TerrainInspectIndex, p: FlowPoint, t: number): Step {
  const flow = downhill(index, t);
  if (flow === null) return { kind: 'end', end: 'flat' };
  const exit = exitOf(index, t, p, flow.dx, flow.dy);
  if (exit === null) return { kind: 'end', end: 'flat' };
  const tri = index.triangles[t];
  const a = tri[exit.edge];
  const b = tri[(exit.edge + 1) % 3];
  if (exit.u <= EPSILON) return { kind: 'vertex', vertex: a };
  if (exit.u >= 1 - EPSILON) return { kind: 'vertex', vertex: b };
  const x = p.x + exit.s * flow.dx;
  const y = p.y + exit.s * flow.dy;
  const at = { x, y, z: index.z[a] + exit.u * (index.z[b] - index.z[a]) };
  const n = index.adjacent[3 * t + exit.edge];
  if (n < 0) return { kind: 'end', end: 'leaves-surface', at };
  if (!drainsBack(index, t, n, a, b)) return { kind: 'face', at, triangle: n };
  if (index.z[a] === index.z[b]) return { kind: 'end', end: 'pit', at };
  return { kind: 'vertex', vertex: index.z[a] < index.z[b] ? a : b, via: at };
}

const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

/** Is the downhill direction of face `t` pointing INTO the face from its vertex `v`? */
function inWedge(index: TerrainInspectIndex, t: number, v: number, dx: number, dy: number): boolean {
  const [w1, w2] = index.triangles[t].filter((w) => w !== v);
  const [vx, vy] = index.xy[v];
  const e1x = index.xy[w1][0] - vx; const e1y = index.xy[w1][1] - vy;
  const e2x = index.xy[w2][0] - vx; const e2y = index.xy[w2][1] - vy;
  const sign = Math.sign(cross(e1x, e1y, e2x, e2y));
  return Math.sign(cross(e1x, e1y, dx, dy)) * sign >= 0 && Math.sign(cross(dx, dy, e2x, e2y)) * sign >= 0;
}

/** The steepest way down from vertex `v`: into a face, or along an edge to a lower vertex. */
function stepVertex(index: TerrainInspectIndex, v: number, visited: Set<number>): Step {
  if (visited.has(v)) return { kind: 'end', end: 'pit' };
  visited.add(v);
  const star = starOf(index);
  let best: { slope: number; step: Step } | null = null;
  for (let i = star.start[v]; i < star.start[v + 1]; i++) {
    const t = star.list[i];
    const flow = downhill(index, t);
    if (flow !== null && inWedge(index, t, v, flow.dx, flow.dy) && (best === null || flow.slope > best.slope)) {
      best = { slope: flow.slope, step: { kind: 'face', at: pointOf(index, v), triangle: t } };
    }
    for (const w of index.triangles[t]) {
      const run = Math.hypot(index.xy[w][0] - index.xy[v][0], index.xy[w][1] - index.xy[v][1]);
      const slope = run > EPSILON ? (index.z[v] - index.z[w]) / run : 0;
      if (slope >= FLAT_GRADIENT && (best === null || slope > best.slope)) best = { slope, step: { kind: 'vertex', vertex: w } };
    }
  }
  if (best !== null) return best.step;
  return { kind: 'end', end: star.rim[v] === 1 ? 'leaves-surface' : 'pit' };
}

function summaryOf(points: readonly FlowPoint[], end: FlowEnd): FlowPath {
  let lengthM = 0;
  for (let i = 1; i < points.length; i++) lengthM += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last.x - first.x; const dy = last.y - first.y;
  const moved = Math.hypot(dx, dy) > EPSILON;
  const azimuth = moved ? ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360 : null;
  return { points, lengthM, dropM: first.z - last.z, end, overallAzimuthDeg: azimuth };
}

/** The path of a drop released at (x, y), snapshot frame — `null` off the published surface. */
export function traceFlowPath(index: TerrainInspectIndex, x: number, y: number): FlowPath | null {
  const start = elevationAt(index, x, y);
  if (start === null) return null;
  const points: FlowPoint[] = [{ x, y, z: start.z }];
  const push = (p: FlowPoint): void => {
    const last = points[points.length - 1];
    if (Math.abs(last.x - p.x) > EPSILON || Math.abs(last.y - p.y) > EPSILON) points.push(p);
  };
  const visited = new Set<number>();
  let step: Step = { kind: 'face', at: points[0], triangle: start.triangle };
  for (let n = 0; n < MAX_STEPS; n++) {
    if (step.kind === 'end') {
      if (step.at) push(step.at);
      return summaryOf(points, step.end);
    }
    if (step.kind === 'face') {
      push(step.at);
      step = stepFace(index, step.at, step.triangle);
      continue;
    }
    if (step.via) push(step.via);
    push(pointOf(index, step.vertex));
    step = stepVertex(index, step.vertex, visited);
  }
  return summaryOf(points, 'step-limit');
}
