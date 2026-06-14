/**
 * ADR-449 — Structural Finish Resolver (σοβάς κολόνας/δοκαριού): pure SSoT.
 *
 * Το ΚΕΝΤΡΟ του συστήματος. Για ένα στοιχείο (κολόνα/δοκάρι) δίνει τις
 * **εκτεθειμένες υπο-ακμές** ανά παρειά, ταξινομημένες interior/exterior, με
 * εμβαδά έτοιμα για BOQ. ΟΛΟΙ οι consumers (BOQ / 3D / 2D) διαβάζουν από εδώ —
 * μηδέν διπλασιασμός λογικής.
 *
 * Αλγόριθμος ανά ακμή E του footprint:
 *   1. covered = ⋃ coveredIntervals(E, wallFootprint)  (REUSE shared SSoT)
 *   2. exposed = exposedComplement(covered)            (τα μη-καλυμμένα κομμάτια)
 *   3. για κάθε exposed [t0,t1]: midpoint + outward normal → `classify` →
 *      interior/exterior → υλικό από spec → μήκος×scale → m.
 *
 * Pure: μηδέν globals/React/Firestore/scene. Η ταξινόμηση exterior/interior
 * εγχέεται ως callback `classify` (ο caller τη χτίζει από building footprint) →
 * ο resolver μένει 100% testable με stub classifier.
 *
 * Convention: το `coreFootprint` είναι **CCW** (όπως `ColumnGeometry.footprint` /
 * `BeamGeometry.outline`). Για CCW πολύγωνο η outward normal ακμής d=(dx,dy)
 * είναι (dy, −dx).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import type {
  StructuralFinishSpec,
  StructuralFinishFaces,
  FinishFaceSegment,
  FinishClassification,
} from './structural-finish-types';
import {
  coveredIntervals,
  exposedComplement,
  type Pt2,
} from '../geometry/shared/segment-polygon-coverage';

/** Συνάρτηση ταξινόμησης παρειάς (εγχέεται από caller — building-footprint based). */
export type FinishEdgeClassifier = (midpoint: Pt2, outwardNormal: Pt2) => FinishClassification;

interface FinishResolveInput {
  /** Κλειστό CCW footprint του πυρήνα (canvas units). */
  readonly coreFootprint: readonly Pt2[];
  /** mm — ύψος επιφάνειας σοβά (κολόνα ύψος / δοκάρι structural depth). */
  readonly heightMm: number;
  /** Per-element πρόθεση σοβά (υλικά + πάχος). */
  readonly spec: StructuralFinishSpec;
  /** Footprints τοίχων (ίδιες μονάδες) που καλύπτουν παρειές. */
  readonly obstacles: readonly (readonly Pt2[])[];
  /** Ταξινόμηση exposed υπο-ακμής σε interior/exterior. */
  readonly classify: FinishEdgeClassifier;
  /**
   * Πολλαπλασιαστής canvas-unit-μήκος → ΜΕΤΡΑ. Για κολόνα = `(1/s)·0.001` όπου
   * `s = mmToSceneUnits(sceneUnits)` (ίδια σύμβαση με `computeColumnGeometry`).
   */
  readonly unitToMeters: number;
  /** Ελάχιστο εκτεθειμένο μήκος (t-units 0..1) — φιλτράρει αριθμητικό noise. */
  readonly minExposedT?: number;
  /**
   * ADR-449 Slice 4 — προαιρετικό φίλτρο ακμής. Όταν επιστρέφει `false` για μια
   * ακμή `i` (a→b), η ακμή **αγνοείται πλήρως** (μηδέν segment, μηδέν εμβαδό).
   * Default = όλες οι ακμές μέσα (byte-for-byte για κολόνες). Το **δοκάρι** το
   * χρησιμοποιεί ώστε να κρατά μόνο τις πλάγιες όψεις (∥ άξονα) και να αποκλείει
   * σημασιολογικά τα **άκρα** (⊥ άξονα = δομική σύνδεση/frame-into, ποτέ σοβάς).
   */
  readonly includeEdge?: (a: Pt2, b: Pt2, index: number) => boolean;
  /**
   * ADR-449 Slice 7 — `true` όταν το `coreFootprint` είναι **τρύπα** (inner ring της
   * ένωσης = όψη δωματίου ενός δομικού πλαισίου). Τότε ο σοβάς πρέπει να εκτείνεται
   * **ΜΕΣΑ στο δωμάτιο** (όχι στο σώμα): το ring κρατιέται **CW** (αντί CCW) ώστε το
   * `(dy,−dx)` να δείχνει προς το εσωτερικό της τρύπας. Default `false` (solid → CCW,
   * byte-for-byte για κολόνες/δοκάρια/outer rings).
   */
  readonly holeRing?: boolean;
}

const MM_TO_M = 0.001;

/**
 * ADR-449 Slice 10 — ανοχή εγγύτητας (mm) για να θεωρηθεί ένα άκρο σοβά **junction**
 * (ακουμπά γειτονικό δομικό στοιχείο → square butt-join αντί 45° chamfer). Ίδιο μέγεθος
 * με το `STRUCTURAL_JOIN_TOL_MM` (scene) — flush «από κάναβο» συμβολές: το άκρο κάθεται
 * πάνω στην παρειά του γείτονα (drift ~sub-mm) → 10mm είναι robust margin.
 */
const JUNCTION_TOL_MM = 10;

const dist = (a: Pt2, b: Pt2): number => Math.hypot(b.x - a.x, b.y - a.y);
const lerp = (a: Pt2, b: Pt2, t: number): Pt2 => ({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });

/** Απόσταση σημείου `p` από το ευθύγραμμο τμήμα a→b (canvas units). */
function pointSegDistance(p: Pt2, a: Pt2, b: Pt2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-18) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * ADR-449 Slice 10 — `true` όταν το σημείο `p` βρίσκεται σε απόσταση ≤ `tol` από την
 * περίμετρο ΕΝΟΣ obstacle (γείτονα). Στις flush «από κάναβο» συμβολές το άκρο σοβά
 * κάθεται πάνω στην παρειά του γειτονικού στοιχείου → εγγύτητα ⇒ butt-join (square).
 */
function pointNearObstacle(p: Pt2, obstacles: readonly (readonly Pt2[])[], tol: number): boolean {
  if (tol <= 0) return false;
  for (const poly of obstacles) {
    for (let i = 0; i < poly.length; i++) {
      if (pointSegDistance(p, poly[i], poly[(i + 1) % poly.length]) <= tol) return true;
    }
  }
  return false;
}

/** Shoelace signed area· >0 = CCW (το convention όπου `(dy,−dx)` = outward normal). */
function signedArea(poly: readonly Pt2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/**
 * ADR-449 — κανονικοποιεί winding ώστε το `(dy,−dx)` να δείχνει στη σωστή φορά.
 * **Solid** (default): CCW → `(dy,−dx)` = outward (μακριά από το σώμα)· κολόνα ήδη CCW
 * (no-op), δοκάρι `buildOutlineRect` CW → reverse. **Hole** (`holeRing`): CW → `(dy,−dx)`
 * = προς το εσωτερικό της τρύπας (μέσα στο δωμάτιο, ο σοβάς της inner όψης πλαισίου).
 */
function orientRing(poly: readonly Pt2[], holeRing: boolean): readonly Pt2[] {
  const area = signedArea(poly);
  if (holeRing) return area > 0 ? [...poly].reverse() : poly; // ensure CW
  return area < 0 ? [...poly].reverse() : poly; // ensure CCW
}

/** Καλυμμένα διαστήματα της ακμής a→b από ΟΛΑ τα obstacles (ένωση πριν complement). */
function coveredByObstacles(a: Pt2, b: Pt2, obstacles: readonly (readonly Pt2[])[]): Array<[number, number]> {
  const all: Array<[number, number]> = [];
  for (const poly of obstacles) {
    for (const iv of coveredIntervals(a, b, poly)) all.push(iv);
  }
  return all;
}

/** Build ένα `FinishFaceSegment` από exposed [t0,t1] της ακμής a→b. */
function buildSegment(
  a: Pt2,
  b: Pt2,
  t0: number,
  t1: number,
  spec: StructuralFinishSpec,
  classify: FinishEdgeClassifier,
  unitToMeters: number,
  obstacles: readonly (readonly Pt2[])[],
  junctionTol: number,
): FinishFaceSegment {
  const pa = lerp(a, b, t0);
  const pb = lerp(a, b, t1);
  const mid = lerp(a, b, (t0 + t1) / 2);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const outwardNormal: Pt2 = { x: dy, y: -dx }; // CCW polygon → outward = (dy,−dx)
  const classification: FinishClassification = classify(mid, outwardNormal);
  const materialId = classification === 'exterior' ? spec.exteriorMaterialId : spec.interiorMaterialId;
  return {
    a: { x: pa.x, y: pa.y },
    b: { x: pb.x, y: pb.y },
    classification,
    materialId,
    thickness: spec.thickness,
    lengthM: dist(pa, pb) * unitToMeters,
    // ADR-449 Slice 10 — άκρο που ακουμπά γείτονα (obstacle) → junction → square butt-join.
    aJunction: pointNearObstacle(pa, obstacles, junctionTol),
    bJunction: pointNearObstacle(pb, obstacles, junctionTol),
  };
}

/**
 * Resolver SSoT. Επιστρέφει κενό σύνολο όταν spec ανενεργό ή footprint εκφυλισμένο.
 */
export function resolveStructuralFinishFaces(input: FinishResolveInput): StructuralFinishFaces {
  const { coreFootprint, heightMm, spec, obstacles, classify, unitToMeters } = input;
  const minT = input.minExposedT ?? 1e-6;
  const heightM = Math.max(0, heightMm) * MM_TO_M;
  const empty: StructuralFinishFaces = { segments: [], heightM, interiorAreaM2: 0, exteriorAreaM2: 0 };
  if (!spec.enabled || spec.thickness <= 0 || coreFootprint.length < 3 || heightM <= 0) return empty;

  // ADR-449 — normalise winding (solid→CCW outward· hole→CW προς το δωμάτιο).
  const footprint = orientRing(coreFootprint, input.holeRing ?? false);
  const segments: FinishFaceSegment[] = [];
  let interiorAreaM2 = 0;
  let exteriorAreaM2 = 0;
  const n = footprint.length;
  const includeEdge = input.includeEdge;
  // ADR-449 Slice 10 — junction proximity tol (canvas units). `unitToMeters = (1/s)·MM_TO_M`
  // → `s = MM_TO_M/unitToMeters` (canvas ανά mm) → `tol = JUNCTION_TOL_MM · s`.
  const junctionTol = JUNCTION_TOL_MM * (MM_TO_M / Math.max(unitToMeters, 1e-12));
  for (let i = 0; i < n; i++) {
    const a = footprint[i];
    const b = footprint[(i + 1) % n];
    if (includeEdge && !includeEdge(a, b, i)) continue; // π.χ. άκρα δοκαριού
    const covered = coveredByObstacles(a, b, obstacles);
    for (const [t0, t1] of exposedComplement(covered, minT)) {
      const seg = buildSegment(a, b, t0, t1, spec, classify, unitToMeters, obstacles, junctionTol);
      segments.push(seg);
      const area = seg.lengthM * heightM;
      if (seg.classification === 'exterior') exteriorAreaM2 += area;
      else interiorAreaM2 += area;
    }
  }
  return { segments, heightM, interiorAreaM2, exteriorAreaM2 };
}
