/**
 * ADR-398 §3.15 — `RectFrame`: ορθογώνιο ως local πλαίσιο (κέντρο + μοναδιαίοι άξονες u/v + ημι-εκτάσεις).
 *
 * Leaf (μόνο `Point2D` + geometry) ώστε να το μοιράζονται **χωρίς cycle**: ο pure resolver
 * (`bim/columns/rect-cartesian-snap`), ο collector (`member-snap-targets`) και το `scene-snap-targets`.
 * Δουλεύει για **λοξά** ορθογώνια κι αυτά (οι άξονες προέρχονται από τις κορυφές· ίσιο = u=(1,0)).
 *
 * @see ../columns/rect-cartesian-snap.ts — Cartesian Magnet resolver (consumer)
 */

import type { Point2D } from '../../rendering/types/Types';
import { calculateDistance } from '../../rendering/entities/shared/geometry-vector-utils';
import { degToRad } from '../../rendering/entities/shared/geometry-angle-utils';

/** Ορθογώνιο ως local πλαίσιο. `u` = άξονας πλάτους, `v` = άξονας ύψους (μοναδιαία). Scene units. */
export interface RectFrame {
  readonly center: Point2D;
  readonly u: Point2D;
  readonly v: Point2D;
  readonly halfW: number;
  readonly halfV: number;
}

/**
 * Χτίσε `RectFrame` από τις 4 κορυφές (σειρά περιμέτρου, π.χ. `rectangleCorners`). Κέντρο = μέσο
 * διαγωνίου· u/v από τις δύο ακμές που ξεκινούν από την κορυφή 0. `null` σε εκφυλισμένο.
 */
export function rectFrameFromCorners(corners: readonly Point2D[]): RectFrame | null {
  if (corners.length < 4) return null;
  const [c0, c1, , c3] = corners;
  const c2 = corners[2];
  const width = calculateDistance(c0, c1);
  const height = calculateDistance(c0, c3);
  if (!(width > 1e-6) || !(height > 1e-6)) return null;
  return {
    center: { x: (c0.x + c2.x) / 2, y: (c0.y + c2.y) / 2 },
    u: { x: (c1.x - c0.x) / width, y: (c1.y - c0.y) / width },
    v: { x: (c3.x - c0.x) / height, y: (c3.y - c0.y) / height },
    halfW: width / 2,
    halfV: height / 2,
  };
}

/** Local (x κατά u, y κατά v) → world. **Κοινό SSoT** για snap/grid-fill/painter (μηδέν διπλό `center+x·u+y·v`). */
export function rectLocalToWorld(rect: Readonly<RectFrame>, x: number, y: number): Point2D {
  return {
    x: rect.center.x + x * rect.u.x + y * rect.v.x,
    y: rect.center.y + x * rect.u.y + y * rect.v.y,
  };
}

/**
 * World → local (προβολή στους μοναδιαίους άξονες u/v γύρω από το `center`). Αντίστροφο του
 * `rectLocalToWorld` (rigid transform → διατηρεί αποστάσεις). ΕΝΑ SSoT για snap σε **λοξό** ορθογώνιο:
 * φέρε τον cursor στο τοπικό πλαίσιο, τρέξε την axis-aligned λογική, γύρνα το αποτέλεσμα πίσω.
 */
export function rectWorldToLocal(rect: Readonly<RectFrame>, p: Readonly<Point2D>): Point2D {
  const dx = p.x - rect.center.x;
  const dy = p.y - rect.center.y;
  return { x: dx * rect.u.x + dy * rect.u.y, y: dx * rect.v.x + dy * rect.v.y };
}

/** Local **κατεύθυνση** (κατά u/v) → world κατεύθυνση (μόνο περιστροφή, χωρίς μετατόπιση κέντρου). */
export function rectDirToWorld(rect: Readonly<RectFrame>, d: Readonly<Point2D>): Point2D {
  return { x: d.x * rect.u.x + d.y * rect.v.x, y: d.x * rect.u.y + d.y * rect.v.y };
}

/**
 * `true` όταν το footprint είναι **πραγματικό ορθογώνιο** (4 κορυφές — ανοικτό ή κλειστό 5 — με ορθές
 * γωνίες u⊥v). Πολύγωνα Γ/Τ/Π (≥6 κορυφές), κύκλοι (πολλές κορυφές) και μη-ορθογώνια τετράπλευρα → `false`.
 * ΕΝΑ SSoT για «είναι box;» — μοιράζεται από το column HUD (aligned-dim path) και το pill-suppression.
 */
export function isRectFootprint(fp: readonly Point2D[]): boolean {
  if (fp.length < 4 || fp.length > 5) return false;
  const r = rectFrameFromCorners(fp);
  if (!r) return false;
  if (Math.abs(r.u.x * r.v.x + r.u.y * r.v.y) >= 1e-6) return false; // ορθή γωνία στην κορυφή 0
  // Η 3η κορυφή πρέπει να ΚΛΕΙΝΕΙ το ορθογώνιο: c2 ≈ c1 + c3 − c0 (αλλιώς τραπέζιο/παραλληλόγραμμο).
  const [c0, c1, c2, c3] = fp;
  const ex = c1.x + c3.x - c0.x;
  const ey = c1.y + c3.y - c0.y;
  const tol = 1e-6 * (1 + Math.abs(ex) + Math.abs(ey));
  return Math.abs(c2.x - ex) <= tol && Math.abs(c2.y - ey) <= tol;
}

/**
 * ADR-508 §column-hud — **Οριζόμενο (oriented) περιβάλλον ορθογώνιο** ενός ΟΠΟΙΟΥΔΗΠΟΤΕ footprint
 * (Γ/Τ/Π/Ι/πολύγωνο), προβάλλοντας τις κορυφές στους άξονες u=(cosθ,sinθ) / v=(−sinθ,cosθ) της
 * `rotationDeg` (CCW). Επιστρέφει `RectFrame` (κέντρο = μέσο του oriented bbox, ημι-εκτάσεις κατά u/v)
 * ώστε το HUD να τοποθετεί ∠γωνία/ύψος και τη διάμετρο πολυγώνου στο ΣΩΣΤΟ πλαίσιο (rotation-aware),
 * όχι σε axis-aligned bbox. `null` σε άδειο footprint. Reuse του `rectLocalToWorld` για placement.
 */
export function orientedRectFrame(footprint: readonly Point2D[], rotationDeg: number): RectFrame | null {
  if (footprint.length < 3) return null;
  const rad = degToRad(rotationDeg);
  const u: Point2D = { x: Math.cos(rad), y: Math.sin(rad) };
  const v: Point2D = { x: -Math.sin(rad), y: Math.cos(rad) };
  const o = footprint[0];
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const p of footprint) {
    const du = p.x - o.x, dv = p.y - o.y;
    const pu = du * u.x + dv * u.y;
    const pv = du * v.x + dv * v.y;
    if (pu < minU) minU = pu;
    if (pu > maxU) maxU = pu;
    if (pv < minV) minV = pv;
    if (pv > maxV) maxV = pv;
  }
  const midU = (minU + maxU) / 2, midV = (minV + maxV) / 2;
  return {
    center: { x: o.x + midU * u.x + midV * v.x, y: o.y + midU * u.y + midV * v.y },
    u, v, halfW: (maxU - minU) / 2, halfV: (maxV - minV) / 2,
  };
}

/** Μία ακμή footprint με το **εξωτερικό** μοναδιαίο κάθετο (winding-aware) + μήκος (scene units). */
export interface FootprintEdge {
  readonly p1: Point2D;
  readonly p2: Point2D;
  /** Μοναδιαίο κάθετο που δείχνει προς το ΕΞΩΤΕΡΙΚΟ της ακμής (μακριά από το υλικό). */
  readonly nx: number;
  readonly ny: number;
  /** Μήκος ακμής σε scene units. */
  readonly lengthScene: number;
}

/**
 * ADR-508 §column-hud — Οι ακμές ενός footprint με το **εξωτερικό** κάθετο κάθε ακμής, winding-aware:
 * το πρόσημο του 2D shoelace δίνει τη φορά (CCW→interior αριστερά· εξωτερικό = (dy,−dx)), οπότε το
 * κάθετο δείχνει σωστά «έξω» ακόμη και σε flipY-reversed winding ΚΑΙ σε κοίλες ακμές (Γ/Τ/Π: το
 * εξωτερικό μιας εσωτερικής ακμής δείχνει μέσα στην εγκοπή = κενός χώρος). SSoT για το per-edge
 * dimensioning του live HUD — μηδέν per-shape mapping (κάθε παράμετρος = μήκος ακμής). `<3` → `[]`.
 */
export function footprintEdges(footprint: readonly Point2D[]): FootprintEdge[] {
  const n = footprint.length;
  if (n < 3) return [];
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const a = footprint[i], b = footprint[(i + 1) % n];
    area2 += a.x * b.y - b.x * a.y;
  }
  const s = area2 >= 0 ? 1 : -1; // CCW→+1
  const edges: FootprintEdge[] = [];
  for (let i = 0; i < n; i++) {
    const p1 = footprint[i], p2 = footprint[(i + 1) % n];
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (!(len > 1e-9)) continue;
    // Εξωτερικό κάθετο: για CCW = (dy,−dx)· s το διορθώνει για CW winding.
    const nx = (s * dy) / len, ny = (s * -dx) / len;
    edges.push({ p1, p2, nx, ny, lengthScene: len });
  }
  return edges;
}
