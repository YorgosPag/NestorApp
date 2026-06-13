/**
 * ADR-449 Slice 7 — Merged Structural Silhouette (ενιαίος σοβάς στις συμβολές): pure SSoT.
 *
 * Το per-element μοντέλο (Slices 1-6) υπολόγιζε τον σοβά κάθε κολόνας/δοκαριού
 * **ανεξάρτητα** με **τοπική** μεταχείριση γωνίας → στις συμβολές κολόνα↔δοκάρι ο σοβάς
 * δεν ενώνεται (Πρόβλημα Β) και ο σοβάς δοκαριού προεξέχει του υποκείμενου τοίχου
 * (Πρόβλημα Α). Revit-grade λύση: **ΕΝΙΑΙΑ ΣΙΛΟΥΕΤΑ** — ανά ζώνη ύψους ενώνουμε
 * (`safeUnion`) τα δομικά cores (κολόνες + δοκάρια) σε ΕΝΑ outline και τρέχουμε τον
 * ΥΠΑΡΧΟΝΤΑ resolver πάνω του (τοίχοι = obstacles):
 *
 *   - **Β λύνεται:** ΕΝΑ outline → οι γωνίες κλείνουν με συνεπή miter (μηδέν ασυνέχεια).
 *   - **Α λύνεται:** ο τοίχος ως obstacle αφαιρεί το τμήμα του outline που καλύπτεται
 *     (flush διεπαφή → dilation join-tol) → μηδέν προεξέχων σοβάς πάνω από τον τοίχο →
 *     η όψη του τοίχου συνεχίζεται ομοεπίπεδα.
 *
 * Pure: μηδέν globals/React/THREE/scene. REUSE-only geometry (`safeUnion` +
 * `resolveStructuralFinishFaces`) — μηδέν νέα boolean/offset λογική. Το output
 * (`SilhouetteBand[]`) το διαβάζει ο 3D builder. BOQ ΑΜΕΤΑΒΛΗΤΟ (per-element).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §3.septies
 */

import type { MultiPolygon, Pair, Polygon } from 'polygon-clipping';
import { safeUnion } from '../geometry/shared/safe-polygon-boolean';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { resolveStructuralFinishFaces, type FinishEdgeClassifier } from './structural-finish-resolver';
import type { StructuralFinishSpec, StructuralFinishFaces, FinishFaceSegment } from './structural-finish-types';

/** Ένα δομικό στοιχείο που συνεισφέρει το core footprint του στη σιλουέτα. */
export interface SilhouetteMember {
  /** Core footprint (plan/canvas units, CCW ή CW — ο resolver normalise-άρει). */
  readonly footprint: readonly Pt2[];
  /** mm — κάτω όριο της κατακόρυφης έκτασης του στοιχείου (building-relative). */
  readonly zBotMm: number;
  /** mm — άνω όριο (building-relative). */
  readonly zTopMm: number;
}

/** Μία κατακόρυφη ζώνη ενιαίου σοβά: faces + το z-διάστημα (building-relative mm). */
export interface SilhouetteBand {
  readonly faces: StructuralFinishFaces;
  readonly zBottomMm: number;
  readonly zTopMm: number;
}

export interface SilhouetteInput {
  /** Κολόνες + δοκάρια (core footprints + z-extents). */
  readonly members: readonly SilhouetteMember[];
  /** Footprints τοίχων (finished outline) — ΗΔΗ dilated κατά join-tol από τον caller. */
  readonly wallObstacles: readonly (readonly Pt2[])[];
  /** Per-element πρόθεση σοβά (υλικά + πάχος) — resolved default για τη σιλουέτα. */
  readonly spec: StructuralFinishSpec;
  /** Ταξινόμηση exposed υπο-ακμής σε interior/exterior (building-footprint based). */
  readonly classify: FinishEdgeClassifier;
  /** canvas-unit μήκος → ΜΕΤΡΑ (ίδια σύμβαση με τον resolver). */
  readonly unitToMeters: number;
}

const EPS = 1e-6;
const MM_TO_M = 0.001;
/** Ελάχιστο ύψος ζώνης (mm) — φιλτράρει εκφυλισμένες z-breakpoints. */
const MIN_BAND_MM = 1e-3;

/** Shoelace signed area· >0 = CCW. */
function signedArea(fp: readonly Pt2[]): number {
  let s = 0;
  for (let i = 0; i < fp.length; i++) {
    const a = fp[i];
    const b = fp[(i + 1) % fp.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/**
 * Pt2[] footprint → κλειστό polygon-clipping `Polygon` (ένα ring), **κανονικοποιημένο
 * σε CCW**. ΚΡΙΣΙΜΟ: η `polygon-clipping` είναι winding-sensitive — ένα **CW** ring (π.χ.
 * το beam `buildOutlineRect` outline, signed-area<0) ερμηνεύεται ως **τρύπα** → το `safeUnion`
 * δεν θα ένωνε το δοκάρι με την κολώνα (ο σοβάς έβγαινε λάθος, εντός σώματος). CCW → solid.
 */
function footprintToPolygon(fp: readonly Pt2[]): Polygon {
  const ccw = signedArea(fp) < 0 ? [...fp].reverse() : fp;
  const ring: Pair[] = ccw.map((p) => [p.x, p.y]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push([first[0], first[1]]);
  return [ring];
}

/** polygon-clipping outer ring → Pt2[] (αφαιρεί τη διπλή κορυφή κλεισίματος). */
function outerRingToPts(ring: readonly Pair[]): Pt2[] {
  const n = ring.length;
  const pts: Pt2[] = [];
  const closed = n > 1 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1];
  const lim = closed ? n - 1 : n;
  for (let i = 0; i < lim; i++) pts.push({ x: ring[i][0], y: ring[i][1] });
  return pts;
}

/** Ένωση των footprints σε ΕΝΑ `MultiPolygon` (κενό όταν δεν υπάρχουν). */
function unionFootprints(footprints: readonly (readonly Pt2[])[]): MultiPolygon {
  const polys = footprints.filter((fp) => fp.length >= 3).map(footprintToPolygon);
  if (polys.length === 0) return [];
  if (polys.length === 1) return [polys[0]]; // ένα footprint → MultiPolygon χωρίς clipping
  return safeUnion(polys[0], ...polys.slice(1));
}

/** Sorted unique z-breakpoints (κάτω/άνω όρια όλων των μελών). */
function bandBreakpoints(members: readonly SilhouetteMember[]): number[] {
  const set = new Set<number>();
  for (const m of members) {
    if (m.zTopMm - m.zBotMm > MIN_BAND_MM) {
      set.add(m.zBotMm);
      set.add(m.zTopMm);
    }
  }
  return [...set].sort((a, b) => a - b);
}

/** Μέλη που υπάρχουν στο z = `mid` (κάτω συμπεριλαμβανόμενο, άνω αποκλειόμενο). */
function membersAt(members: readonly SilhouetteMember[], mid: number): SilhouetteMember[] {
  return members.filter((m) => m.zBotMm - EPS <= mid && mid < m.zTopMm - EPS);
}

/** Ενιαίες faces μιας ζώνης: union outline → resolver ανά πολύγωνο, merged. */
function resolveBandFaces(input: SilhouetteInput, present: readonly SilhouetteMember[], heightMm: number): StructuralFinishFaces {
  const merged: FinishFaceSegment[] = [];
  let interiorAreaM2 = 0;
  let exteriorAreaM2 = 0;
  for (const poly of unionFootprints(present.map((m) => m.footprint))) {
    // ADR-449 Slice 7 — ΟΛΑ τα rings: poly[0] = εξωτερικό περίγραμμα (solid)· poly[1..] =
    // τρύπες (όψεις δωματίου ενός δομικού πλαισίου) → σοβάς ΚΑΙ στις εσωτερικές πλευρές
    // (αλλιώς frame δοκαριών/κολώνων = σοβάς μόνο απ' έξω). `holeRing` → φορά προς το δωμάτιο.
    for (let ri = 0; ri < poly.length; ri++) {
      const ring = outerRingToPts(poly[ri]);
      if (ring.length < 3) continue;
      const faces = resolveStructuralFinishFaces({
        coreFootprint: ring,
        heightMm,
        spec: input.spec,
        obstacles: input.wallObstacles,
        classify: input.classify,
        unitToMeters: input.unitToMeters,
        holeRing: ri > 0,
      });
      merged.push(...faces.segments);
      interiorAreaM2 += faces.interiorAreaM2;
      exteriorAreaM2 += faces.exteriorAreaM2;
    }
  }
  // ADR-449 Slice 7 — big-player σύμβαση (Revit/ArchiCAD): immutable δομικός πυρήνας +
  // **additive-outward** σοβάς (ΠΟΤΕ recess/bury). Στενότερο δοκάρι από τοίχο → ο additive
  // σοβάς πέφτει φυσικά ομοεπίπεδος· ίδιο πλάτος → ειλικρινώς proud (η ευθυγράμμιση είναι
  // ευθύνη διαστάσεων του αρχιτέκτονα, όχι auto-recess). Οι γωνίες (Β) λύνονται από το union.
  return { segments: merged, heightM: heightMm * MM_TO_M, interiorAreaM2, exteriorAreaM2 };
}

/**
 * SSoT: δομικά μέλη + τοίχοι → ενιαίες ζώνες σοβά. Σπάει το ύψος σε z-bands (όπου το
 * σύνολο των παρόντων στοιχείων είναι σταθερό)· ανά band ενώνει τα cores σε ΕΝΑ outline
 * και τρέχει τον resolver (τοίχοι = obstacles) → coplanar + connected σοβάς εγγενώς.
 * Κενό array όταν ο σοβάς είναι ανενεργός ή δεν υπάρχουν δομικά μέλη.
 */
export function computeStructuralSilhouetteBands(input: SilhouetteInput): SilhouetteBand[] {
  if (!input.spec.enabled || input.spec.thickness <= 0) return [];
  const breaks = bandBreakpoints(input.members);
  const bands: SilhouetteBand[] = [];
  for (let i = 0; i < breaks.length - 1; i++) {
    const zBottomMm = breaks[i];
    const zTopMm = breaks[i + 1];
    const heightMm = zTopMm - zBottomMm;
    if (heightMm <= MIN_BAND_MM) continue;
    const present = membersAt(input.members, (zBottomMm + zTopMm) / 2);
    if (present.length === 0) continue;
    const faces = resolveBandFaces(input, present, heightMm);
    if (faces.segments.length === 0) continue;
    bands.push({ faces, zBottomMm, zTopMm });
  }
  return bands;
}
