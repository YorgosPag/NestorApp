/**
 * ADR-619 v2 — «Γραμμή ανάβασης» (walkline / path-of-travel) tracer για ένα
 * ΚΛΕΙΣΤΟ ΟΡΘΟΓΩΝΙΟ πολύγωνο-κλιμακοστάσιο (το «λούκι» / corridor).
 *
 * Το πολύγωνο ΔΕΝ είναι η σκάλα — είναι το ΟΡΙΟ του διαδρόμου ανάβασης. Ο tracer:
 *   1. Ζευγαρώνει τις ΑΝΤΙΠΑΡΑΛΛΗΛΕΣ ακμές (τοίχους) κάθε ευθύγραμμου τμήματος
 *      διαδρόμου (σταθερή απόσταση = πλάτος w) — αγνοεί τις ΚΟΝΤΕΣ κάθετες ακμές
 *      (καπάκια αρχής/τέλους/πλατύσκαλου).
 *   2. Για κάθε ζεύγος: κεντρική γραμμή = offset w/2 από τον έναν τοίχο προς τον
 *      άλλο, κομμένη στην ΕΠΙΚΑΛΥΨΗ των δύο τοίχων.
 *   3. Σε κάθε ΣΤΡΟΦΗ (κοίλη/reflex κορυφή = εσωτερική γωνία): τόξο ακτίνας w/2 με
 *      κέντρο την reflex κορυφή, που ΕΝΩΝΕΙ τα άκρα των γειτονικών κεντρικών
 *      γραμμών (εφαπτόμενα σημεία) → συνεχής walkline (ευθείες + τόξα, χωρίς κενά).
 *
 * Καθαρές συναρτήσεις· επαναχρησιμοποιεί τα vector SSoT (`geometry-vector-utils`)
 * + `perp` (`stair-geometry-shared`). ΜΗΔΕΝ crash — ο caller (classifier) κάνει
 * fallback όταν `traceCorridorWalkline` επιστρέψει `null`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-619-stair-from-region.md
 */

import type { Point2D, Point3D } from '../../../rendering/types/Types';
import type { Vec2 } from './stair-geometry-shared';
import { perp } from './stair-geometry-shared';
import { pointInPolygon } from '../shared/polygon-utils';
import {
  calculateDistance,
  dotProduct,
  getUnitVector,
  pointOnCircle,
  vectorAngle,
} from '../../../rendering/entities/shared/geometry-vector-utils';

// ─── Walkline representation (ευθεία ή τόξο) ──────────────────────────────────

/** Ευθύγραμμο τμήμα walkline. */
export interface WalklineLine {
  readonly type: 'line';
  readonly start: Point2D;
  readonly end: Point2D;
}

/** Κυκλικό τόξο walkline (winder). `deltaAngle` = προσημασμένη ΜΙΚΡΗ γωνία (≤π). */
export interface WalklineArc {
  readonly type: 'arc';
  readonly center: Point2D;
  readonly radius: number;
  readonly startAngle: number;
  readonly deltaAngle: number;
}

export type WalklineSegment = WalklineLine | WalklineArc;

/** Αποτέλεσμα trace: συνεχής walkline + μετρήσεις. */
export interface CorridorWalkline {
  readonly segments: readonly WalklineSegment[];
  readonly length: number;
  readonly width: number;
  readonly basePoint: Point2D;
  readonly topPoint: Point2D;
  readonly direction: Vec2;
}

// ─── Internal edge / corridor-segment structures ──────────────────────────────

interface Edge {
  readonly p0: Point2D;
  readonly p1: Point2D;
  readonly dir: Vec2;
  readonly len: number;
}

interface CorridorSegment {
  readonly a: Point2D;
  readonly b: Point2D;
  readonly width: number;
  /** Δείκτες των δύο ακμών-τοίχων (για greedy «κάθε ακμή μία φορά»). */
  readonly i: number;
  readonly j: number;
}

const ANTIPARALLEL_DOT = -0.999;
const NORMALIZED_REFLEX_SIN = -0.01;

// ─── Public: segment length + point-at ────────────────────────────────────────

/** Μήκος ενός walkline segment (scene units). */
export function walklineSegmentLength(seg: WalklineSegment): number {
  return seg.type === 'line'
    ? calculateDistance(seg.start, seg.end)
    : seg.radius * Math.abs(seg.deltaAngle);
}

/** Σημείο σε τοπική απόσταση `local` (0..len) πάνω σε ένα walkline segment. */
export function pointOnWalklineSegment(seg: WalklineSegment, local: number): Point2D {
  const len = walklineSegmentLength(seg);
  if (seg.type === 'line') {
    if (len <= 0) return { x: seg.start.x, y: seg.start.y };
    const t = local / len;
    return {
      x: seg.start.x + (seg.end.x - seg.start.x) * t,
      y: seg.start.y + (seg.end.y - seg.start.y) * t,
    };
  }
  const frac = len > 0 ? local / len : 0;
  return pointOnCircle(seg.center, seg.radius, seg.startAngle + seg.deltaAngle * frac);
}

/** Συνολικό μήκος walkline. */
export function walklineTotalLength(segments: readonly WalklineSegment[]): number {
  let total = 0;
  for (const s of segments) total += walklineSegmentLength(s);
  return total;
}

/**
 * Δειγματοληψία `count` σημείων κατά ΜΗΚΟΣ ΤΟΞΟΥ πάνω στα πρώτα `targetLength` της
 * walkline (από την ΒΑΣΗ). Ισαπέχοντα (step = targetLength/(count−1)).
 */
export function sampleWalklineByLength(
  segments: readonly WalklineSegment[],
  targetLength: number,
  count: number,
): Point2D[] {
  const lens = segments.map(walklineSegmentLength);
  const step = count > 1 ? targetLength / (count - 1) : 0;
  const out: Point2D[] = [];
  let segIdx = 0;
  let acc = 0;
  for (let k = 0; k < count; k++) {
    const target = k === count - 1 ? targetLength : k * step;
    while (segIdx < segments.length - 1 && acc + lens[segIdx] < target - 1e-9) {
      acc += lens[segIdx];
      segIdx += 1;
    }
    const local = Math.max(0, Math.min(target - acc, lens[segIdx] ?? 0));
    out.push(pointOnWalklineSegment(segments[segIdx], local));
  }
  return out;
}

// ─── Edges + corridor pairing ─────────────────────────────────────────────────

function buildEdges(ring: readonly Point2D[]): Edge[] {
  const n = ring.length;
  const edges: Edge[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = ring[i];
    const p1 = ring[(i + 1) % n];
    const len = calculateDistance(p0, p1);
    if (len <= 0) continue;
    edges.push({ p0, p1, dir: getUnitVector(p0, p1), len });
  }
  return edges;
}

/** Προβολή σημείου κατά μήκος `origin + t·dir`. */
function projAlong(pt: Point2D, origin: Point2D, dir: Vec2): number {
  return (pt.x - origin.x) * dir.x + (pt.y - origin.y) * dir.y;
}

/**
 * Ζεύγος αντιπαράλληλων τοίχων `ei`(i),`ej`(j) → κεντρική γραμμή (offset w/2,
 * κομμένη στην επικάλυψη). `null` όταν δεν είναι υποψήφιο ζεύγος (μη-αντιπαράλληλα /
 * μη-παράλληλα / χωρίς επικάλυψη). Η ΤΕΛΙΚΗ αποδοχή (φίλτρο ελάχιστου w) γίνεται
 * στο `findCorridorSegments` — εδώ επιστρέφεται ΚΑΘΕ γεωμετρικά έγκυρο ζεύγος.
 */
function pairToCenterline(ei: Edge, ej: Edge, i: number, j: number, eps: number): CorridorSegment | null {
  if (dotProduct(ei.dir, ej.dir) > ANTIPARALLEL_DOT) return null;
  const p = perp(ei.dir);
  const d0 = (ej.p0.x - ei.p0.x) * p.x + (ej.p0.y - ei.p0.y) * p.y;
  const d1 = (ej.p1.x - ei.p0.x) * p.x + (ej.p1.y - ei.p0.y) * p.y;
  if (Math.abs(d0 - d1) > eps) return null;
  const width = Math.abs((d0 + d1) / 2);
  if (width < eps) return null;
  const aLo = Math.min(projAlong(ei.p0, ei.p0, ei.dir), projAlong(ei.p1, ei.p0, ei.dir));
  const aHi = Math.max(projAlong(ei.p0, ei.p0, ei.dir), projAlong(ei.p1, ei.p0, ei.dir));
  const bLo = Math.min(projAlong(ej.p0, ei.p0, ei.dir), projAlong(ej.p1, ei.p0, ei.dir));
  const bHi = Math.max(projAlong(ej.p0, ei.p0, ei.dir), projAlong(ej.p1, ei.p0, ei.dir));
  const lo = Math.max(aLo, bLo);
  const hi = Math.min(aHi, bHi);
  if (hi - lo <= eps) return null;
  const sign = d0 + d1 >= 0 ? 1 : -1;
  const c0: Point2D = { x: ei.p0.x + p.x * sign * (width / 2), y: ei.p0.y + p.y * sign * (width / 2) };
  return {
    a: { x: c0.x + ei.dir.x * lo, y: c0.y + ei.dir.y * lo },
    b: { x: c0.x + ei.dir.x * hi, y: c0.y + ei.dir.y * hi },
    width,
    i,
    j,
  };
}

/** Μήκος κεντρικής γραμμής ενός υποψήφιου ζεύγους (επικάλυψη των δύο τοίχων). */
function centerlineLength(c: CorridorSegment): number {
  return Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y);
}

/** True όταν το ΜΕΣΟΝ της κεντρικής γραμμής πέφτει ΜΕΣΑ στο πολύγωνο. */
function centerlineInside(c: CorridorSegment, ring: readonly Point3D[]): boolean {
  return pointInPolygon({ x: (c.a.x + c.b.x) / 2, y: (c.a.y + c.b.y) / 2 }, ring);
}

/**
 * Ζεύγη διαδρόμου. (1) κάθε γεωμετρικά έγκυρο αντιπαράλληλο ζεύγος με επικάλυψη·
 * (2) ΚΡΑΤΑ μόνο όσα η κεντρική τους γραμμή περνά ΜΕΣΑ από το πολύγωνο — έτσι
 * απορρίπτονται ΚΑΙ τα «ανοίγματα» (π.χ. στόμιο σχήματος Π: οι εξωτερικοί τοίχοι
 * ζευγαρώνουν κατά μήκος αλλά η κεντρική γραμμή περνά ΕΞΩ) ΚΑΙ οι εγκοπές/jogs (bite
 * από τον τοίχο = κοίλο κομμάτι ΕΞΩ)· (3) πλάτος διαδρόμου = το πλάτος του ΜΑΚΡΥΤΕΡΟΥ
 * έγκυρου ζεύγους — κράτα όσα ταιριάζουν σε αυτό. Greedy κατά ΦΘΙΝΟΝ μήκος: κάθε ακμή
 * μία φορά, προτεραιότητα στα μακρύτερα (κύρια) τμήματα. Σε απλό ορθογώνιο → ΜΑΚΡΥΣ
 * άξονας· σε ζωγραφισμένη-στο-χέρι περιοχή με μικρή εγκοπή → ΠΑΝΤΑ ο διάδρομος (όχι η
 * εγκοπή), αποτρέποντας τη μικροσκοπική/εκτός-θέσης σκάλα.
 */
function findCorridorSegments(
  edges: readonly Edge[],
  ring: readonly Point3D[],
  eps: number,
): CorridorSegment[] {
  const candidates: CorridorSegment[] = [];
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const seg = pairToCenterline(edges[i], edges[j], i, j, eps);
      if (seg && centerlineInside(seg, ring)) candidates.push(seg);
    }
  }
  if (candidates.length === 0) return [];
  const ordered = [...candidates].sort((p, q) => centerlineLength(q) - centerlineLength(p));
  const wRef = ordered[0].width; // πλάτος του μακρύτερου εσωτερικού ζεύγους = διάδρομος
  const wtol = Math.max(eps, wRef * 0.1);
  const used = new Set<number>();
  const segs: CorridorSegment[] = [];
  for (const c of ordered) {
    if (Math.abs(c.width - wRef) > wtol) continue;
    if (used.has(c.i) || used.has(c.j)) continue;
    segs.push(c);
    used.add(c.i);
    used.add(c.j);
  }
  return segs;
}

// ─── Reflex (inner-corner) vertices = arc centers ─────────────────────────────

/** Κοίλες (reflex) κορυφές CCW δακτυλίου = εσωτερικές γωνίες στροφών. */
function reflexVertices(ring: readonly Point2D[]): Point2D[] {
  const n = ring.length;
  const out: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n];
    const cur = ring[i];
    const next = ring[(i + 1) % n];
    const ax = cur.x - prev.x;
    const ay = cur.y - prev.y;
    const bx = next.x - cur.x;
    const by = next.y - cur.y;
    const cross = ax * by - ay * bx;
    const denom = Math.hypot(ax, ay) * Math.hypot(bx, by);
    if (denom > 0 && cross / denom < NORMALIZED_REFLEX_SIN) out.push({ x: cur.x, y: cur.y });
  }
  return out;
}

// ─── Chain assembly (segments + arcs) ─────────────────────────────────────────

interface EndRef {
  readonly segIdx: number;
  readonly point: Point2D;
  readonly other: Point2D;
  readonly reflex: Point2D | null;
}

/** Αντιστοιχεί ένα άκρο κεντρικής γραμμής σε reflex κορυφή (εφαπτόμενο σημείο). */
function matchReflex(point: Point2D, width: number, reflexes: readonly Point2D[], eps: number): Point2D | null {
  for (const r of reflexes) {
    if (Math.abs(calculateDistance(r, point) - width / 2) < Math.max(eps, width * 0.05)) return r;
  }
  return null;
}

function buildEndRefs(segs: readonly CorridorSegment[], reflexes: readonly Point2D[], eps: number): EndRef[] {
  const refs: EndRef[] = [];
  segs.forEach((s, segIdx) => {
    refs.push({ segIdx, point: s.a, other: s.b, reflex: matchReflex(s.a, s.width, reflexes, eps) });
    refs.push({ segIdx, point: s.b, other: s.a, reflex: matchReflex(s.b, s.width, reflexes, eps) });
  });
  return refs;
}

/** Τόξο winder με κέντρο `center` από `from` σε `to` (μικρή προσημασμένη γωνία). */
function makeArc(center: Point2D, from: Point2D, to: Point2D): WalklineArc {
  const startAngle = vectorAngle({ x: from.x - center.x, y: from.y - center.y });
  const endAngle = vectorAngle({ x: to.x - center.x, y: to.y - center.y });
  const raw = endAngle - startAngle;
  const deltaAngle = Math.atan2(Math.sin(raw), Math.cos(raw));
  return { type: 'arc', center, radius: calculateDistance(center, from), startAngle, deltaAngle };
}

/**
 * Ενώνει τις κεντρικές γραμμές σε ΣΥΝΕΧΗ walkline: ξεκινά από ένα ελεύθερο άκρο
 * (cap), προχωρά segment→arc→segment μέχρι το άλλο cap.
 */
function assembleChain(
  segs: readonly CorridorSegment[],
  refs: readonly EndRef[],
  eps: number,
): WalklineSegment[] | null {
  const capEnds = refs.filter((r) => r.reflex === null);
  if (capEnds.length < 1) return null;
  const out: WalklineSegment[] = [];
  const visited = new Set<number>();
  let entry: EndRef | undefined = capEnds[0];
  while (entry && !visited.has(entry.segIdx)) {
    visited.add(entry.segIdx);
    out.push({ type: 'line', start: entry.point, end: entry.other });
    const exitReflex = refs.find(
      (r) => r.segIdx === entry!.segIdx && calculateDistance(r.point, entry!.other) < eps,
    )?.reflex;
    if (!exitReflex) break;
    const next = refs.find(
      (r) => r.segIdx !== entry!.segIdx && !visited.has(r.segIdx)
        && r.reflex && calculateDistance(r.reflex, exitReflex) < eps,
    );
    if (!next) break;
    out.push(makeArc(exitReflex, entry.other, next.point));
    entry = next;
  }
  return out.length > 0 ? out : null;
}

// ─── Orientation (base = closest to first drawn vertex) ────────────────────────

function reverseSegment(seg: WalklineSegment): WalklineSegment {
  if (seg.type === 'line') return { type: 'line', start: seg.end, end: seg.start };
  return {
    type: 'arc',
    center: seg.center,
    radius: seg.radius,
    startAngle: seg.startAngle + seg.deltaAngle,
    deltaAngle: -seg.deltaAngle,
  };
}

function reverseWalkline(segments: readonly WalklineSegment[]): WalklineSegment[] {
  return segments.map(reverseSegment).reverse();
}

function walklineEndpoints(segments: readonly WalklineSegment[]): { base: Point2D; top: Point2D } {
  const first = segments[0];
  const last = segments[segments.length - 1];
  const base = first.type === 'line' ? first.start : pointOnWalklineSegment(first, 0);
  const top = last.type === 'line'
    ? last.end
    : pointOnWalklineSegment(last, walklineSegmentLength(last));
  return { base, top };
}

/** Μοναδιαία εφαπτομένη στην ΒΑΣΗ (αρχή του πρώτου segment). */
function startDirection(segments: readonly WalklineSegment[], base: Point2D): Vec2 {
  const first = segments[0];
  const probe = pointOnWalklineSegment(first, Math.min(walklineSegmentLength(first), 1e-3));
  const dir = getUnitVector(base, probe);
  return dir.x === 0 && dir.y === 0 ? getUnitVector(base, pointOnWalklineSegment(first, walklineSegmentLength(first))) : dir;
}

// ─── Public entry ─────────────────────────────────────────────────────────────

/**
 * Ιχνηλατεί τη walkline ενός ΚΑΘΑΡΟΥ (deduped/CCW/simplified) ορθογώνιου
 * corridor-πολυγώνου. `firstVertex` = η ΠΡΩΤΗ κορυφή σχεδίασης (για επιλογή βάσης).
 * Επιστρέφει `null` όταν δεν βρεθεί ζεύγος διαδρόμου (→ ο caller κάνει fallback).
 */
export function traceCorridorWalkline(
  ring: readonly Point2D[],
  firstVertex: Point2D,
  eps: number,
): CorridorWalkline | null {
  const edges = buildEdges(ring);
  const ring3D: Point3D[] = ring.map((p) => ({ x: p.x, y: p.y, z: 0 }));
  const segs = findCorridorSegments(edges, ring3D, eps);
  if (segs.length === 0) return null;
  const reflexes = reflexVertices(ring);
  const refs = buildEndRefs(segs, reflexes, eps);
  const chain = assembleChain(segs, refs, eps);
  if (!chain || chain.length === 0) return null;

  const { base: base0, top: top0 } = walklineEndpoints(chain);
  const flip = calculateDistance(top0, firstVertex) < calculateDistance(base0, firstVertex);
  const segments = flip ? reverseWalkline(chain) : chain;
  const { base, top } = walklineEndpoints(segments);
  const width = Math.min(...segs.map((s) => s.width));
  return {
    segments,
    length: walklineTotalLength(segments),
    width,
    basePoint: base,
    topPoint: top,
    direction: startDirection(segments, base),
  };
}
