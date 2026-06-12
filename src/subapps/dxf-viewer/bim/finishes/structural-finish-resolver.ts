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
}

const MM_TO_M = 0.001;

const dist = (a: Pt2, b: Pt2): number => Math.hypot(b.x - a.x, b.y - a.y);
const lerp = (a: Pt2, b: Pt2, t: number): Pt2 => ({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });

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

  const segments: FinishFaceSegment[] = [];
  let interiorAreaM2 = 0;
  let exteriorAreaM2 = 0;
  const n = coreFootprint.length;
  const includeEdge = input.includeEdge;
  for (let i = 0; i < n; i++) {
    const a = coreFootprint[i];
    const b = coreFootprint[(i + 1) % n];
    if (includeEdge && !includeEdge(a, b, i)) continue; // π.χ. άκρα δοκαριού
    const covered = coveredByObstacles(a, b, obstacles);
    for (const [t0, t1] of exposedComplement(covered, minT)) {
      const seg = buildSegment(a, b, t0, t1, spec, classify, unitToMeters);
      segments.push(seg);
      const area = seg.lengthM * heightM;
      if (seg.classification === 'exterior') exteriorAreaM2 += area;
      else interiorAreaM2 += area;
    }
  }
  return { segments, heightM, interiorAreaM2, exteriorAreaM2 };
}
