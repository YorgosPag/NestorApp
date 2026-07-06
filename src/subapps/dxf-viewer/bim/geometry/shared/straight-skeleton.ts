/**
 * Straight skeleton — wavefront simulation (pure SSoT, generic comp-geometry).
 *
 * ADR-417 Φ2: η Revit-correct γενίκευση της παραγωγής «νερών» στέγης για
 * **οποιοδήποτε** simple polygon (κυρτό Ή κοίλο — σχήματα Γ/Τ/Π). Κάθε ακμή του
 * πολυγώνου κινείται προς τα μέσα με σταθερή ταχύτητα (μοναδιαία)· οι κορυφές
 * κινούνται πάνω στις διχοτόμους. Δύο τύποι γεγονότων αλλάζουν την τοπολογία:
 *
 *   - **Edge event** — μια ακμή συρρικνώνεται σε μηδέν (δύο γειτονικές κορυφές
 *     συναντώνται) → κόμβος skeleton (κορφιάς/hip).
 *   - **Split event** — μια **κοίλη (reflex)** κορυφή φτάνει σε απέναντι ακμή και
 *     **σπάει** τον βρόχο σε δύο → κόμβος **λουκιού (valley)**.
 *
 * Η προσομοίωση παράγει τα εσωτερικά **τόξα** (`SkeletonArc`)· η συναρμολόγηση σε
 * όψεις ανά ακμή γίνεται στο `straight-skeleton-faces.ts`. Uniform speed (MVP,
 * ADR-417 Φ2): τα **ύψη** ανυψώνονται downstream με τις πραγματικές per-edge
 * κλίσεις (`roof-skeleton-solver.ts` → `roofZmm`). Καθαρά γεωμετρικό, zero deps.
 *
 * Reuse: `lineIntersectionPoint` (polygon-axis-projection) δεν χρειάζεται εδώ —
 * οι τομές λύνονται αναλυτικά στον χρόνο γεγονότος· `isPolygonCCW`/`shoelaceArea`
 * (polygon-utils) για winding· assembly delegate στο sibling.
 *
 * @see straight-skeleton-faces.ts — assembly τόξων → όψεις
 * @see bim/geometry/roof-skeleton-solver.ts — roof adapter (z-lift + ridge kind)
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10
 */

import { isPolygonCCW, projectPointTo2D, projectVerticesTo2D } from './polygon-utils';
import { assembleEdgeFaces, type SkeletonArc, type SkeletonEdgeFace, type SkPoint } from './straight-skeleton-faces';
import { translatePoint } from '../../../rendering/entities/shared/geometry-vector-utils';

export type { SkeletonArc, SkeletonEdgeFace, SkPoint } from './straight-skeleton-faces';

/** Αποτέλεσμα: όψεις ανά ακμή + εσωτερικά τόξα. `ok=false` → degenerate (fallback). */
export interface StraightSkeletonResult {
  readonly faces: readonly SkeletonEdgeFace[];
  readonly arcs: readonly SkeletonArc[];
  readonly ok: boolean;
}

// ─── Vector helpers (tiny, local — mirror roof-lower-envelope style) ───────────

const sub = (a: SkPoint, b: SkPoint): SkPoint => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: SkPoint, b: SkPoint): SkPoint => translatePoint(a, b);
const scale = (a: SkPoint, k: number): SkPoint => ({ x: a.x * k, y: a.y * k });
const dot = (a: SkPoint, b: SkPoint): number => a.x * b.x + a.y * b.y;
const cross = (a: SkPoint, b: SkPoint): number => a.x * b.y - a.y * b.x;

// ─── Mutable wavefront structures ─────────────────────────────────────────────

interface SkEdge {
  readonly index: number;
  readonly p: SkPoint; // σημείο πάνω στην ακμή (αρχική κορυφή start)
  readonly dir: SkPoint; // μοναδιαία διεύθυνση start→end
  readonly normal: SkPoint; // μοναδιαίο εσωτερικό κάθετο
}

interface SkVert {
  id: number;
  pos: SkPoint;
  t0: number;
  vel: SkPoint;
  origin: SkPoint; // pos − t0·vel (θέση στο t=0)
  prev: SkVert;
  next: SkVert;
  left: SkEdge;
  right: SkEdge;
  reflex: boolean;
  active: boolean;
}

type SkEvent =
  | { kind: 'edge'; t: number; point: SkPoint; va: SkVert; vb: SkVert }
  | { kind: 'split'; t: number; point: SkPoint; v: SkVert; opp: SkEdge };

const EPS = 1e-9;

/** Ταχύτητα κορυφής: λύνει `nL·vel = 1`, `nR·vel = 1` (διχοτόμος, convex & reflex). */
function vertexVelocity(nL: SkPoint, nR: SkPoint): SkPoint {
  const denom = cross(nL, nR);
  if (Math.abs(denom) < EPS) return projectPointTo2D(nL); // ευθεία γωνία (180°)
  return { x: (nR.y - nL.y) / denom, y: (nL.x - nR.x) / denom };
}

/** Κοίλη (reflex) κορυφή: δεξιά στροφή σε CCW πολύγωνο (`cross(leftDir,rightDir) < 0`). */
function isReflexCorner(left: SkEdge, right: SkEdge): boolean {
  return cross(left.dir, right.dir) < -EPS;
}

// ─── Initial LAV ──────────────────────────────────────────────────────────────

/** Καθαρίζει διπλές διαδοχικές κορυφές + εξασφαλίζει CCW σειρά. */
function normalizePolygon(polygon: readonly SkPoint[]): SkPoint[] {
  const pts = projectVerticesTo2D(polygon);
  const dedup: SkPoint[] = [];
  for (const p of pts) {
    const last = dedup[dedup.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > EPS) dedup.push(p);
  }
  if (dedup.length > 1) {
    const a = dedup[0];
    const b = dedup[dedup.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) <= EPS) dedup.pop();
  }
  const ring3 = dedup.map((p) => ({ x: p.x, y: p.y, z: 0 }));
  return isPolygonCCW(ring3) ? dedup : dedup.reverse();
}

/** Κατασκευή ακμών (διεύθυνση + εσωτερικό κάθετο για CCW = rotate +90°). */
function buildEdges(verts: readonly SkPoint[]): SkEdge[] {
  const n = verts.length;
  const edges: SkEdge[] = [];
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / len, y: dy / len };
    edges.push({ index: i, p: a, dir, normal: { x: -dir.y, y: dir.x } });
  }
  return edges;
}

/** Αρχικός βρόχος ενεργών κορυφών (LAV) + οι ακμές. */
function buildInitialLav(polygon: readonly SkPoint[]): { verts: SkVert[]; edges: SkEdge[] } | null {
  const ring = normalizePolygon(polygon);
  if (ring.length < 3) return null;
  const edges = buildEdges(ring);
  const n = ring.length;
  const verts: SkVert[] = ring.map((p, i) => {
    const left = edges[(i - 1 + n) % n];
    const right = edges[i];
    const vel = vertexVelocity(left.normal, right.normal);
    return {
      id: i, pos: projectPointTo2D(p), t0: 0, vel, origin: projectPointTo2D(p),
      prev: null as unknown as SkVert, next: null as unknown as SkVert,
      left, right, reflex: isReflexCorner(left, right), active: true,
    };
  });
  for (let i = 0; i < n; i++) {
    verts[i].prev = verts[(i - 1 + n) % n];
    verts[i].next = verts[(i + 1) % n];
  }
  return { verts, edges };
}

// ─── Event computation ────────────────────────────────────────────────────────

/** Edge event: ο χρόνος που η ακμή `va→vb` συρρικνώνεται σε σημείο. */
function computeEdgeEvent(va: SkVert, now: number): SkEvent | null {
  const vb = va.next;
  if (!vb.active || vb === va) return null;
  const A = sub(va.vel, vb.vel);
  const AA = dot(A, A);
  if (AA < 1e-12) return null; // παράλληλη κίνηση — καμία σύγκλιση
  const t = dot(A, sub(vb.origin, va.origin)) / AA;
  if (t < now - EPS) return null;
  return { kind: 'edge', t, point: add(va.origin, scale(va.vel, t)), va, vb };
}

/** Split events: κάθε απέναντι ακμή που μπορεί να «σπάσει» η reflex κορυφή `v`. */
function computeSplitEvents(v: SkVert, edges: readonly SkEdge[], now: number): SkEvent[] {
  const out: SkEvent[] = [];
  for (const e of edges) {
    if (e === v.left || e === v.right) continue;
    const denom = dot(e.normal, v.vel) - 1;
    if (denom > -EPS) continue; // δεν πλησιάζει την ακμή
    const t = dot(e.normal, sub(e.p, v.origin)) / denom;
    if (t < now - EPS) continue;
    out.push({ kind: 'split', t, point: add(v.origin, scale(v.vel, t)), v, opp: e });
  }
  return out;
}

/** Όλα τα αρχικά γεγονότα του LAV. */
function seedEvents(verts: readonly SkVert[], edges: readonly SkEdge[]): SkEvent[] {
  const events: SkEvent[] = [];
  for (const v of verts) {
    const e = computeEdgeEvent(v, 0);
    if (e) events.push(e);
    if (v.reflex) events.push(...computeSplitEvents(v, edges, 0));
  }
  return events;
}

// ─── Skeleton context (mutable run state) ─────────────────────────────────────

interface SkelCtx {
  readonly edges: SkEdge[];
  readonly events: SkEvent[];
  readonly arcs: SkeletonArc[];
  nextId: number;
}

/** Δημιουργία + ένταξη νέας κορυφής· υπολογίζει ταχύτητα/reflex/origin. */
function makeVertex(ctx: SkelCtx, pos: SkPoint, t: number, left: SkEdge, right: SkEdge): SkVert {
  const vel = vertexVelocity(left.normal, right.normal);
  return {
    id: ctx.nextId++, pos, t0: t, vel, origin: sub(pos, scale(vel, t)),
    prev: null as unknown as SkVert, next: null as unknown as SkVert,
    left, right, reflex: isReflexCorner(left, right), active: true,
  };
}

/** Καταγραφή τόξου (σύνορο όψεων left/right της κορυφής που κινήθηκε). */
function emitArc(ctx: SkelCtx, v: SkVert, to: SkPoint): void {
  ctx.arcs.push({
    a: projectPointTo2D(v.pos), b: projectPointTo2D(to),
    leftEdge: v.left.index, rightEdge: v.right.index, fromReflex: v.reflex,
  });
}

/** Νέα γεγονότα για μια ενεργή κορυφή (edge + τυχόν split). */
function scheduleVertex(ctx: SkelCtx, v: SkVert, now: number): void {
  const prevEdge = computeEdgeEvent(v.prev, now);
  if (prevEdge) ctx.events.push(prevEdge);
  const ownEdge = computeEdgeEvent(v, now);
  if (ownEdge) ctx.events.push(ownEdge);
  if (v.reflex) ctx.events.push(...computeSplitEvents(v, ctx.edges, now));
}

/** Κλείσιμο LAV μεγέθους ≤2: ένωση των δύο τελευταίων κορυφών σε κόμβο-κορυφή. */
function finalizeLav(ctx: SkelCtx, v: SkVert, t: number): void {
  const other = v.next;
  const peak = peakPoint(v, other, t);
  emitArc(ctx, v, peak);
  if (other !== v) emitArc(ctx, other, peak);
  v.active = false;
  other.active = false;
}

/** Σημείο συνάντησης δύο κορυφών (edge-event projection· fallback μέσος όρος). */
function peakPoint(a: SkVert, b: SkVert, t: number): SkPoint {
  const A = sub(a.vel, b.vel);
  const AA = dot(A, A);
  if (AA < 1e-12) return scale(add(a.pos, b.pos), 0.5);
  const tt = dot(A, sub(b.origin, a.origin)) / AA;
  const use = Number.isFinite(tt) && tt >= t - EPS ? tt : t;
  return add(a.origin, scale(a.vel, use));
}

// ─── Event handlers + main loop ───────────────────────────────────────────────

/** Χειρισμός edge event: ένωση `va,vb` → νέα κορυφή· κλείσιμο LAV αν χρειαστεί. */
function handleEdgeEvent(ctx: SkelCtx, ev: Extract<SkEvent, { kind: 'edge' }>): void {
  const { va, vb, t, point } = ev;
  emitArc(ctx, va, point);
  emitArc(ctx, vb, point);
  va.active = false;
  vb.active = false;
  const vc = makeVertex(ctx, point, t, va.left, vb.right);
  vc.prev = va.prev;
  vc.next = vb.next;
  va.prev.next = vc;
  vb.next.prev = vc;
  if (vc.next === vc || vc.prev === vc) { vc.active = false; return; } // peak ήδη
  if (vc.next === vc.prev) { finalizeLav(ctx, vc, t); return; } // size 2
  scheduleVertex(ctx, vc, t);
}

/** Βρίσκει τις τρέχουσες ενεργές κορυφές που οριοθετούν την ακμή `opp` στον βρόχο της `v`. */
function findOppBounds(v: SkVert, opp: SkEdge): { x: SkVert; y: SkVert } | null {
  let cur = v.next;
  for (let i = 0; i < 1e4 && cur !== v; i++, cur = cur.next) {
    if (cur.active && cur.right === opp && cur.next.active && cur.next !== v && cur !== v) {
      return { x: cur, y: cur.next };
    }
  }
  return null;
}

/** Έλεγχος ότι το σημείο `B` πέφτει εντός του τρέχοντος (στον χρόνο t) τμήματος `X→Y`. */
function hitWithinEdge(B: SkPoint, x: SkVert, y: SkVert, t: number): boolean {
  const xp = add(x.origin, scale(x.vel, t));
  const yp = add(y.origin, scale(y.vel, t));
  const d = sub(yp, xp);
  const dd = dot(d, d);
  if (dd < 1e-12) return false;
  const s = dot(sub(B, xp), d) / dd;
  return s > -1e-3 && s < 1 + 1e-3;
}

/** Χειρισμός split event: «σπάει» τον βρόχο σε δύο γύρω από την ακμή `opp`. */
function handleSplitEvent(ctx: SkelCtx, ev: Extract<SkEvent, { kind: 'split' }>): void {
  const { v, opp, t, point } = ev;
  const bounds = findOppBounds(v, opp);
  if (!bounds || !hitWithinEdge(point, bounds.x, bounds.y, t)) return; // stale/invalid
  const { x, y } = bounds;
  emitArc(ctx, v, point);
  v.active = false;
  const v1 = makeVertex(ctx, point, t, v.left, opp);
  const v2 = makeVertex(ctx, point, t, opp, v.right);
  v1.prev = v.prev; v.prev.next = v1; v1.next = y; y.prev = v1;
  v2.prev = x; x.next = v2; v2.next = v.next; v.next.prev = v2;
  for (const nv of [v1, v2]) {
    if (nv.next === nv.prev) finalizeLav(ctx, nv, t);
    else if (nv.next !== nv) scheduleVertex(ctx, nv, t);
    else nv.active = false;
  }
}

/** Έγκυρο (μη παρωχημένο) γεγονός; */
function isLive(ev: SkEvent): boolean {
  if (ev.kind === 'edge') return ev.va.active && ev.vb.active && ev.va.next === ev.vb;
  return ev.v.active;
}

/**
 * Υπολογίζει το straight skeleton ενός simple polygon (CCW ή CW — auto). Επιστρέφει
 * όψεις ανά ακμή + τόξα. `ok=false` σε degenerate/μη-σύγκλιση → ο caller κάνει
 * graceful fallback (lower-envelope). Pure / idempotent.
 */
export function computeStraightSkeleton(polygon: readonly SkPoint[]): StraightSkeletonResult {
  const ring = normalizePolygon(polygon);
  const init = buildInitialLav(ring);
  if (!init) return { faces: [], arcs: [], ok: false };
  const ctx: SkelCtx = {
    edges: init.edges, events: seedEvents(init.verts, init.edges),
    arcs: [], nextId: init.verts.length,
  };
  const maxIter = 16 * init.verts.length + 32;
  let iter = 0;
  while (ctx.events.length > 0) {
    if (iter++ > maxIter) return { faces: [], arcs: [], ok: false };
    // Pop earliest live event.
    let bestIdx = -1;
    for (let i = 0; i < ctx.events.length; i++) {
      if (bestIdx < 0 || ctx.events[i].t < ctx.events[bestIdx].t) bestIdx = i;
    }
    const ev = ctx.events.splice(bestIdx, 1)[0];
    if (!isLive(ev)) continue;
    if (ev.kind === 'edge') handleEdgeEvent(ctx, ev);
    else handleSplitEvent(ctx, ev);
  }
  const faces = assembleEdgeFaces(ring, ctx.arcs);
  return { faces, arcs: ctx.arcs, ok: faces.length === ring.length };
}
