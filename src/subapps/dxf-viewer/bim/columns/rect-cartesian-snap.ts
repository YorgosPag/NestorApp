/**
 * ADR-398 §3.15 «Cartesian Magnet» — καρτεσιανό snap κολώνας ΜΕΣΑ σε ορθογώνιο (pure SSoT).
 *
 * Αδελφό δίδυμο του Polar Magnet (§3.13): όπως ο δίσκος = πολικό σύστημα, το ορθογώνιο
 * (πλάκα/πέδιλο/δωμάτιο) = **καρτεσιανό** σύστημα. cursor εντός ορθογωνίου → πλέγμα από
 * nice-offsets των ακμών + **9 κομβικά σημεία** (4 γωνίες με cover, 4 μέσα ακμών, κέντρο)·
 * η κολώνα κουμπώνει σε αυτά, με live **4 dx/dy dims** προς τις ακμές. Δουλεύει σε **λοξά**
 * ορθογώνια κι αυτά (local u/v άξονες· ίσιο = γωνία 0° → ίδιος κώδικας).
 *
 * **FULL SSoT — μηδέν νέα math:** `adaptiveDistanceStep`/`quantizeMagnitude` (offsets), `calculateDistance`,
 * `GhostFaceDimension` shape (4 dims → render μέσω του υπάρχοντος `paintStraightDimension`). Pure — zero
 * React/DOM/store. Μονάδες: scene units.
 *
 * **Αποφάσεις (Giorgio 2026-06-22):** offsets Both (nice-absolute default· Shift→κλάσματα W/H)· cover
 * γωνιών = cover+ημι-διαγώνιος (`clearanceScene`)· 4 dims· λοξά+ίσια ΕΝΑ κώδικα· precedence κέντρο >
 * 9-point > grid∩ > §3.11 edge (στο χείλος → `null`).
 *
 * @see ./polar-disk-snap.ts — το πολικό αδελφό (ίδιο pattern: resolver + grid + findContaining)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.15
 */

import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { adaptiveDistanceStep } from '../../systems/tracking/adaptive-distance-snap';
import { calculateDistance } from '../../rendering/entities/shared/geometry-vector-utils';
import type { GhostFaceDimension } from '../framing/ghost-face-dim-references';
import { rectLocalToWorld, type RectFrame } from '../framing/rect-frame';
import { COLUMN_SNAP_COVER_MM, COLUMN_SNAP_CENTER_CAPTURE_PX } from './polar-disk-snap';
import { snapAlongToEnds, alignZone, type PlacementAlignmentGuide } from './column-tangent-snap';

export type { RectFrame };

/** Κλάσματα διάστασης (Shift mode) — σε local συντεταγμένες (κέντρο=0): −half/2, 0, +half/2. */
const HALF_FRACTIONS: readonly number[] = [-0.5, 0, 0.5];

/** Επιλογές rect snap — ίδιο σχήμα με τον δίσκο (zoom + Shift fractions + edge clearance). */
export interface RectCartesianSnapOptions {
  readonly worldPerPixel: number;
  readonly shiftFractions?: boolean;
  readonly clearanceScene?: number;
  /**
   * ADR-398 §3.20d — ακτίνα κυκλικού ghost (scene units). >0 → quadrant-to-edge alignment: το ακραίο
   * τεταρτημόριο της κυκλικής κολόνας κουμπώνει σε πλευρά ±halfW/±halfV + γραμμή(ές)-οδηγός. `undefined`/0
   * → καμία (μη-κυκλικό ghost, μηδέν regression).
   */
  readonly circleRadiusScene?: number;
}

/** Αποτέλεσμα rect snap: θέση + local συντεταγμένες + flags + dist (nearest-wins). */
export interface RectCartesianSnap {
  readonly position: Point2D;
  readonly localX: number;
  readonly localY: number;
  readonly isCenter: boolean;
  readonly isNode: boolean;
  readonly dist: number;
  /**
   * ADR-398 §3.20d — γραμμή(ές)-οδηγός ευθυγράμμισης όταν κυκλικό ghost κουμπώνει σε πλευρά: ένας οδηγός
   * ανά άξονα (u/v) που κουμπώνει· **δύο** στη γωνία (u-edge + v-edge ταυτόχρονα). `undefined` αλλιώς.
   */
  readonly guides?: readonly PlacementAlignmentGuide[];
}

/** Το ορατό πλέγμα για τον overlay painter (§3.15 A6). */
export interface RectGrid {
  readonly center: Point2D;
  readonly u: Point2D;
  readonly v: Point2D;
  readonly halfW: number;
  readonly halfV: number;
  /** Local offsets κατά u (γραμμές πλέγματος + κόμβοι). */
  readonly xs: readonly number[];
  /** Local offsets κατά v. */
  readonly ys: readonly number[];
}

/** Επέλεξε από `candidates` την τιμή με τη μικρότερη απόσταση από `target` (+ flag «κόμβος»). */
function nearest(target: number, candidates: readonly { value: number; node: boolean }[]): { value: number; node: boolean } {
  let best = candidates[0];
  let bestD = Math.abs(target - best.value);
  for (let i = 1; i < candidates.length; i++) {
    const d = Math.abs(target - candidates[i].value);
    if (d < bestD) { bestD = d; best = candidates[i]; }
  }
  return best;
}

/**
 * Υποψήφια local offsets ενός άξονα (κέντρο=0): **κόμβοι** {−(half−cover), 0, +(half−cover)} +
 * **πλέγμα** (nice-absolute multiples του step ή κλάσματα half) εντός [−maxHalf, +maxHalf].
 */
function axisCandidates(half: number, clearance: number, step: number, useFractions: boolean): { value: number; node: boolean }[] {
  const maxHalf = half - clearance;
  const out: { value: number; node: boolean }[] = [
    { value: 0, node: true },
    { value: -maxHalf, node: true },
    { value: maxHalf, node: true },
  ];
  if (useFractions) {
    for (const f of HALF_FRACTIONS) if (f !== 0) out.push({ value: f * half, node: false });
  } else if (step > 0) {
    for (let p = step; p <= maxHalf + 1e-6; p += step) {
      out.push({ value: p, node: false });
      out.push({ value: -p, node: false });
    }
  }
  return out;
}

const local = (p: Readonly<Point2D>, c: Readonly<Point2D>, axis: Readonly<Point2D>): number =>
  (p.x - c.x) * axis.x + (p.y - c.y) * axis.y;

/**
 * ADR-398 §3.20d — **quadrant-to-edge** (2D): εφαρμόζει το 1D `snapAlongToEnds` SSoT **ξεχωριστά** σε u
 * και v ώστε το ακραίο τεταρτημόριο της κυκλικής κολόνας (κέντρο ∓R) να αγγίζει την πλευρά `±half`. Κάθε
 * άξονας που κουμπώνει σε **πλευρά** (όχι μέσον) → κουμπωμένο local + ένας **οδηγός = όλη η πλευρά** (full
 * edge μέσω `rectLocalToWorld`). Δύο άξονες → δύο οδηγοί (γωνία). `radius < half` ανά άξονα (αλλιώς ο κύκλος
 * δεν χωρά → κανένας οδηγός εκείνου του άξονα). `x`/`y` = `null` όταν δεν κουμπώνει (κρατά το grid snap).
 */
function rectQuadrantEdges(
  rect: Readonly<RectFrame>, lx: number, ly: number, radius: number, zone: number,
): { x: number | null; y: number | null; guides: PlacementAlignmentGuide[] } {
  const guides: PlacementAlignmentGuide[] = [];
  let x: number | null = null;
  let y: number | null = null;
  if (radius < rect.halfW) {
    const q = snapAlongToEnds(lx, -rect.halfW, rect.halfW, radius, zone);
    if (q.guideAlong !== null && Math.abs(q.guideAlong) > 1e-6) { // πλευρά (όχι μέσον=0)
      x = q.along;
      guides.push({ a: rectLocalToWorld(rect, q.guideAlong, -rect.halfV), b: rectLocalToWorld(rect, q.guideAlong, rect.halfV) });
    }
  }
  if (radius < rect.halfV) {
    const q = snapAlongToEnds(ly, -rect.halfV, rect.halfV, radius, zone);
    if (q.guideAlong !== null && Math.abs(q.guideAlong) > 1e-6) {
      y = q.along;
      guides.push({ a: rectLocalToWorld(rect, -rect.halfW, q.guideAlong), b: rectLocalToWorld(rect, rect.halfW, q.guideAlong) });
    }
  }
  return { x, y, guides };
}

/**
 * Καρτεσιανό snap κολώνας μέσα στο ορθογώνιο: κέντρο (εντός capture) ή 9-point / grid∩ (snap localX,
 * localY ανεξάρτητα). `null` όταν ο cursor είναι **εκτός** της cover-ζώνης (κοντά στο χείλος) → ο caller
 * πέφτει στο §3.11 edge. Pure. Μονάδες: scene units.
 */
export function resolveRectCartesianSnap(
  cursor: Readonly<Point2D>,
  rect: Readonly<RectFrame>,
  sceneUnits: SceneUnits,
  opts: Readonly<RectCartesianSnapOptions>,
): RectCartesianSnap | null {
  const f = mmToSceneUnits(sceneUnits);
  const clearance = opts.clearanceScene ?? COLUMN_SNAP_COVER_MM * f;
  const maxHalfW = rect.halfW - clearance;
  const maxHalfV = rect.halfV - clearance;
  if (!(maxHalfW > 0) || !(maxHalfV > 0)) return null;

  const lx = local(cursor, rect.center, rect.u);
  const ly = local(cursor, rect.center, rect.v);
  if (Math.abs(lx) > maxHalfW || Math.abs(ly) > maxHalfV) return null; // χείλος → §3.11 edge

  const wpp = opts.worldPerPixel;
  const centerCapture = wpp > 0 ? wpp * COLUMN_SNAP_CENTER_CAPTURE_PX : 0;
  if (Math.abs(lx) <= centerCapture && Math.abs(ly) <= centerCapture) {
    return { position: { x: rect.center.x, y: rect.center.y }, localX: 0, localY: 0, isCenter: true, isNode: true, dist: calculateDistance(cursor, rect.center) };
  }

  const step = adaptiveDistanceStep(wpp);
  const sx = nearest(lx, axisCandidates(rect.halfW, clearance, step, !!opts.shiftFractions));
  const sy = nearest(ly, axisCandidates(rect.halfV, clearance, step, !!opts.shiftFractions));
  // ADR-398 §3.20d — κυκλικό ghost: το quadrant-to-edge alignment υπερισχύει ανά άξονα (μαγνήτης πλευράς) +
  // οδηγός. Κρατά το grid snap στους άξονες που δεν κουμπώνουν σε πλευρά. Reuse 1D `snapAlongToEnds` SSoT.
  const q = opts.circleRadiusScene && opts.circleRadiusScene > 0
    ? rectQuadrantEdges(rect, lx, ly, opts.circleRadiusScene, alignZone(wpp, f))
    : null;
  const fx = q?.x ?? sx.value;
  const fy = q?.y ?? sy.value;
  const position = rectLocalToWorld(rect, fx, fy);
  return {
    position,
    localX: fx,
    localY: fy,
    isCenter: fx === 0 && fy === 0,
    isNode: (q?.x != null || sx.node) && (q?.y != null || sy.node),
    dist: calculateDistance(cursor, position),
    ...(q && q.guides.length ? { guides: q.guides } : {}),
  };
}

/** Ο δίσκος-ισοδύναμο: το ορθογώνιο που **περιέχει** τον cursor (μικρότερο, εντός των ορίων)· `null` αν κανένα. */
export function findRectContaining(cursor: Readonly<Point2D>, rects: readonly RectFrame[]): RectFrame | null {
  let best: RectFrame | null = null;
  let bestArea = Infinity;
  for (const r of rects) {
    const lx = Math.abs(local(cursor, r.center, r.u));
    const ly = Math.abs(local(cursor, r.center, r.v));
    const area = r.halfW * r.halfV;
    if (lx <= r.halfW && ly <= r.halfV && area < bestArea) { bestArea = area; best = r; }
  }
  return best;
}

/** Το ορατό πλέγμα (xs/ys local offsets) για τον overlay painter. ΙΔΙΟ candidate SSoT με το snap. */
export function buildRectGrid(
  rect: Readonly<RectFrame>,
  sceneUnits: SceneUnits,
  opts: Readonly<RectCartesianSnapOptions>,
): RectGrid {
  const f = mmToSceneUnits(sceneUnits);
  const clearance = opts.clearanceScene ?? COLUMN_SNAP_COVER_MM * f;
  const step = adaptiveDistanceStep(opts.worldPerPixel);
  const xs = axisCandidates(rect.halfW, clearance, step, !!opts.shiftFractions).map((c) => c.value).sort((a, b) => a - b);
  const ys = axisCandidates(rect.halfV, clearance, step, !!opts.shiftFractions).map((c) => c.value).sort((a, b) => a - b);
  return { center: rect.center, u: rect.u, v: rect.v, halfW: rect.halfW, halfV: rect.halfV, xs, ys };
}

/** Distinct render-slots από το υπάρχον `kind` union (cosmetic· 4 straight length dims). */
const DIM_KINDS: readonly GhostFaceDimension['kind'][] = ['leftGap', 'rightGap', 'centerToCenter', 'radius'];

/**
 * Τα **4** καρτεσιανά dx/dy listening dims (προς −u/+u/−v/+v ακμή). Reuse `GhostFaceDimension` shape →
 * render μέσω του υπάρχοντος straight-dim SSoT. `valueScene` = απόσταση κολώνας→ακμή κατά τον άξονα.
 */
export function resolveRectCartesianDims(rect: Readonly<RectFrame>, columnPt: Readonly<Point2D>): GhostFaceDimension[] {
  const lx = local(columnPt, rect.center, rect.u);
  const ly = local(columnPt, rect.center, rect.v);
  const edges: { value: number; edgeLocal: { x: number; y: number } }[] = [
    { value: rect.halfW + lx, edgeLocal: { x: -rect.halfW, y: ly } }, // προς −u ακμή
    { value: rect.halfW - lx, edgeLocal: { x: rect.halfW, y: ly } },  // προς +u ακμή
    { value: rect.halfV + ly, edgeLocal: { x: lx, y: -rect.halfV } }, // προς −v ακμή
    { value: rect.halfV - ly, edgeLocal: { x: lx, y: rect.halfV } },  // προς +v ακμή
  ];
  return edges.map((e, i) => {
    const p2 = rectLocalToWorld(rect, e.edgeLocal.x, e.edgeLocal.y);
    return {
      kind: DIM_KINDS[i],
      p1: { x: columnPt.x, y: columnPt.y },
      p2,
      dimLineRef: { x: (columnPt.x + p2.x) / 2, y: (columnPt.y + p2.y) / 2 },
      valueScene: e.value,
    };
  });
}
