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
import type { RectFrame } from '../framing/rect-frame';

export type { RectFrame };

/** Structural cover (mm) — default όταn ο caller δεν δίνει `clearanceScene`. */
const RECT_COVER_MM = 50;
/** Ακτίνα capture (px) γύρω από το κέντρο για το center snap (zoom-σταθερό, mirror polar). */
const CENTER_CAPTURE_PX = 12;
/** Κλάσματα διάστασης (Shift mode) — σε local συντεταγμένες (κέντρο=0): −half/2, 0, +half/2. */
const HALF_FRACTIONS: readonly number[] = [-0.5, 0, 0.5];

/** Επιλογές rect snap — ίδιο σχήμα με τον δίσκο (zoom + Shift fractions + edge clearance). */
export interface RectCartesianSnapOptions {
  readonly worldPerPixel: number;
  readonly shiftFractions?: boolean;
  readonly clearanceScene?: number;
}

/** Αποτέλεσμα rect snap: θέση + local συντεταγμένες + flags + dist (nearest-wins). */
export interface RectCartesianSnap {
  readonly position: Point2D;
  readonly localX: number;
  readonly localY: number;
  readonly isCenter: boolean;
  readonly isNode: boolean;
  readonly dist: number;
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

const toWorld = (rect: Readonly<RectFrame>, x: number, y: number): Point2D => ({
  x: rect.center.x + x * rect.u.x + y * rect.v.x,
  y: rect.center.y + x * rect.u.y + y * rect.v.y,
});

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
  const clearance = opts.clearanceScene ?? RECT_COVER_MM * f;
  const maxHalfW = rect.halfW - clearance;
  const maxHalfV = rect.halfV - clearance;
  if (!(maxHalfW > 0) || !(maxHalfV > 0)) return null;

  const lx = local(cursor, rect.center, rect.u);
  const ly = local(cursor, rect.center, rect.v);
  if (Math.abs(lx) > maxHalfW || Math.abs(ly) > maxHalfV) return null; // χείλος → §3.11 edge

  const wpp = opts.worldPerPixel;
  const centerCapture = wpp > 0 ? wpp * CENTER_CAPTURE_PX : 0;
  if (Math.abs(lx) <= centerCapture && Math.abs(ly) <= centerCapture) {
    return { position: { x: rect.center.x, y: rect.center.y }, localX: 0, localY: 0, isCenter: true, isNode: true, dist: calculateDistance(cursor, rect.center) };
  }

  const step = adaptiveDistanceStep(wpp);
  const sx = nearest(lx, axisCandidates(rect.halfW, clearance, step, !!opts.shiftFractions));
  const sy = nearest(ly, axisCandidates(rect.halfV, clearance, step, !!opts.shiftFractions));
  const position = toWorld(rect, sx.value, sy.value);
  return {
    position,
    localX: sx.value,
    localY: sy.value,
    isCenter: sx.value === 0 && sy.value === 0,
    isNode: sx.node && sy.node,
    dist: calculateDistance(cursor, position),
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
  const clearance = opts.clearanceScene ?? RECT_COVER_MM * f;
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
    const p2 = toWorld(rect, e.edgeLocal.x, e.edgeLocal.y);
    return {
      kind: DIM_KINDS[i],
      p1: { x: columnPt.x, y: columnPt.y },
      p2,
      dimLineRef: { x: (columnPt.x + p2.x) / 2, y: (columnPt.y + p2.y) / 2 },
      valueScene: e.value,
    };
  });
}
