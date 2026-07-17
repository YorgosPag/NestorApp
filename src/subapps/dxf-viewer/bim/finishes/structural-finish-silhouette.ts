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

import type { MultiPolygon } from 'polygon-clipping';
import { safeUnion } from '../geometry/shared/safe-polygon-boolean';
import { pairRingToPt2, pt2FootprintToClipPolygon } from '../geometry/shared/polygon-clipping-ring';
// ADR-049 SSoT — component-wise grid rounding (reuse· ΟΧΙ re-implement). Welds float-noise
// drift ώστε flush structural↔structural παρειές να συμπίπτουν ακριβώς πριν το boolean union.
import { snapToGrid } from '../../systems/grid/grid-snap';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { resolveStructuralFinishFaces, type FinishEdgeClassifier } from './structural-finish-resolver';
import type { StructuralFinishSpec, StructuralFinishFaces, FinishFaceSegment } from './structural-finish-types';
import { mergeCollinearFinishSegments } from './structural-finish-merge';
import { applyFinishOverrideEdges, type FinishOverrideEdge } from './structural-finish-attribution';

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

/**
 * ADR-449 Slice X1 — τοίχος-εμπόδιο με **κατακόρυφη έκταση** (building-relative mm).
 * Height-aware coverage: ο τοίχος αφαιρεί όψη ΜΟΝΟ στις ζώνες ύψους που επικαλύπτει
 * κατακόρυφα. Ένας **attached-top** τοίχος-στήριγμα (κορυφή = κάτω παρειά δοκαριού)
 * ΔΕΝ καλύπτει την πλάγια όψη δοκαριού **πάνω** του — ο adapter δίνει resolved top =
 * beam underside (ADR-449 Slice 8/8b· χωρίς αυτό οι ταυτόσημοι σε κάτοψη grid τοίχοι
 * «έτρωγαν» τη μία όψη δοκαριού → το «μία όψη μόνο» bug που νόμιζε ότι ήταν τοπολογικό).
 */
export interface WallObstacle {
  /** Footprint τοίχου (finished outline, plan/canvas units). */
  readonly footprint: readonly Pt2[];
  /** mm — κάτω όριο της κατακόρυφης έκτασης (building-relative). */
  readonly zBotMm: number;
  /** mm — άνω όριο (building-relative)· attached-top = beam underside (resolved). */
  readonly zTopMm: number;
}

export interface SilhouetteInput {
  /** Κολόνες + δοκάρια (core footprints + z-extents). */
  readonly members: readonly SilhouetteMember[];
  /** Τοίχοι-εμπόδια με κατακόρυφη έκταση → height-aware coverage ανά ζώνη. */
  readonly wallObstacles: readonly WallObstacle[];
  /** Per-element πρόθεση σοβά (υλικά + πάχος) — resolved default για τη σιλουέτα. */
  readonly spec: StructuralFinishSpec;
  /** Ταξινόμηση exposed υπο-ακμής σε interior/exterior (building-footprint based). */
  readonly classify: FinishEdgeClassifier;
  /** canvas-unit μήκος → ΜΕΤΡΑ (ίδια σύμβαση με τον resolver). */
  readonly unitToMeters: number;
  /**
   * ADR-449 PART B Slice B — per-face overrides (Revit «Paint») από τα element specs, σε
   * canvas units (ίδιος χώρος με τα members). Εφαρμόζονται στα blanket segments **ΠΡΙΝ** το
   * PART A merge (split στο σύνορο υλικού/χρώματος → merge ξαναενώνει τα same). Absent/κενό →
   * ομοιόμορφο κέλυφος (byte-for-byte).
   */
  readonly faceOverrideEdges?: readonly FinishOverrideEdge[];
}

const EPS = 1e-6;
const MM_TO_M = 0.001;
/** Ελάχιστο ύψος ζώνης (mm) — φιλτράρει εκφυλισμένες z-breakpoints. */
const MIN_BAND_MM = 1e-3;
/**
 * ADR-449 — weld tolerance (mm) για το flush structural↔structural union. Δύο μέλη που
 * κουμπώνουν παρειά-με-παρειά «από κάναβο» έχουν float-noise drift (~1e-12mm) στις κοινές
 * παρειές → η `polygon-clipping` δεν τα συγχωνεύει (sub-ULP) → ορατή ραφή σοβά στη θαμμένη
 * διεπαφή. Snap σε grid 1μm πριν το union ⇒ ακριβής σύμπτωση ⇒ ένα ενιαίο outline. 1μm:
 * «κολλάει» float drift + ό,τι είναι πρακτικά flush, ΠΟΤΕ πραγματικό κενό (≥ δέκατα mm).
 */
const WELD_TOL_MM = 1e-3;
/** Ανοχή (mm) κατακόρυφης επικάλυψης τοίχου↔ζώνης (mirror `WALL_BEAM_BAND_TOL_MM`). */
const WALL_BAND_TOL_MM = 1;


/**
 * Ένωση των footprints σε ΕΝΑ `MultiPolygon` (κενό όταν δεν υπάρχουν). Κάθε κορυφή
 * **snap-άρεται σε grid `weldQuantum`** (canvas units) μέσω του ADR-049 `snapToGrid` SSoT
 * πριν το union, ώστε flush structural↔structural διεπαφές (float-noise drift ~1e-12) να
 * συμπίπτουν ακριβώς και να συγχωνεύονται σε ΕΝΑ outline — αλλιώς η `polygon-clipping`
 * (sub-ULP) τα αφήνει χωριστά και ο σοβάς εμφανίζεται στη θαμμένη ραφή. `weldQuantum<=0` → no-op.
 */
function unionFootprints(footprints: readonly (readonly Pt2[])[], weldQuantum: number): MultiPolygon {
  const weld = (fp: readonly Pt2[]): readonly Pt2[] =>
    weldQuantum > 0 ? fp.map((p) => snapToGrid(p, weldQuantum)) : fp;
  const polys = footprints
    .filter((fp) => fp.length >= 3)
    .map((fp) => pt2FootprintToClipPolygon(weld(fp)));
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

/**
 * ADR-449 Slice X1 — footprints τοίχων που επικαλύπτονται **ΚΑΤΑΚΟΡΥΦΑ** με τη ζώνη
 * `[zBot, zTop]` (height-aware). Ένας attached-top τοίχος-στήριγμα (resolved top = κάτω
 * παρειά δοκαριού) βρίσκεται **κάτω** από τη ζώνη του δοκαριού → δεν περιλαμβάνεται →
 * η πλάγια όψη δοκαριού ΚΡΑΤΑ σοβά και στις 2 πλευρές (mirror `wallsOverlappingBeamBand`).
 */
function wallFootprintsInBand(
  walls: readonly WallObstacle[],
  zBotMm: number,
  zTopMm: number,
): (readonly Pt2[])[] {
  const out: (readonly Pt2[])[] = [];
  for (const w of walls) {
    if (w.zTopMm > zBotMm + WALL_BAND_TOL_MM && w.zBotMm < zTopMm - WALL_BAND_TOL_MM) out.push(w.footprint);
  }
  return out;
}

/** Ενιαίες faces μιας ζώνης: union outline → resolver ανά πολύγωνο, merged. */
function resolveBandFaces(
  input: SilhouetteInput,
  present: readonly SilhouetteMember[],
  heightMm: number,
  wallFootprints: readonly (readonly Pt2[])[],
): StructuralFinishFaces {
  const merged: FinishFaceSegment[] = [];
  let interiorAreaM2 = 0;
  let exteriorAreaM2 = 0;
  // ADR-449 — weld quantum σε canvas units: `unitToMeters = (1/s)·MM_TO_M` ⇒ `s = MM_TO_M/unitToMeters`
  // (canvas ανά mm) ⇒ `quantum = WELD_TOL_MM · s`. Έτσι το snap είναι sub-micron σε φυσικό μήκος.
  const weldQuantum = WELD_TOL_MM * (MM_TO_M / Math.max(input.unitToMeters, 1e-12));
  for (const poly of unionFootprints(present.map((m) => m.footprint), weldQuantum)) {
    // ADR-449 Slice 7 — ΟΛΑ τα rings: poly[0] = εξωτερικό περίγραμμα (solid)· poly[1..] =
    // τρύπες (όψεις δωματίου ενός δομικού πλαισίου) → σοβάς ΚΑΙ στις εσωτερικές πλευρές
    // (αλλιώς frame δοκαριών/κολώνων = σοβάς μόνο απ' έξω). `holeRing` → φορά προς το δωμάτιο.
    for (let ri = 0; ri < poly.length; ri++) {
      const ring = pairRingToPt2(poly[ri]);
      if (ring.length < 3) continue;
      const faces = resolveStructuralFinishFaces({
        coreFootprint: ring,
        heightMm,
        spec: input.spec,
        obstacles: wallFootprints,
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
  // ADR-449 PART B Slice B — per-face overrides (Revit «Paint») στο blanket ΠΡΙΝ το merge:
  // σπάει τα segments στα σύνορα υλικού/χρώματος (το union έχει αφαιρέσει την κοινή κορυφή δύο
  // collinear στοιχείων — γι' αυτό split, όχι μόνο stamp). Ο tol collinearity = weld quantum
  // (raw override-edges vs welded union — max drift ~quantum/2), με sub-mm floor.
  const attribTol = Math.max(weldQuantum, WELD_TOL_MM * MM_TO_M);
  const attributed = input.faceOverrideEdges?.length
    ? applyFinishOverrideEdges(merged, input.faceOverrideEdges, attribTol)
    : merged;
  // ADR-449 PART A — συγχώνευση διαδοχικών collinear-same-material όψεων ΠΡΙΝ το miter/draw/
  // extrude: εξαφανίζει τις κάθετες ραφές στις δομικές συμβολές μιας ευθείας (ενιαία «κουβέρτα»)·
  // γραμμή μένει ΜΟΝΟ σε γωνία ή αλλαγή υλικού/χρώματος. BOQ αμετάβλητο (Σ lengthM = ταυτότητα).
  const mergedSegs = mergeCollinearFinishSegments(attributed);
  return { segments: mergedSegs, heightM: heightMm * MM_TO_M, interiorAreaM2, exteriorAreaM2 };
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
    // ADR-449 Slice X1 — height-aware walls: μόνο όσοι επικαλύπτονται κατακόρυφα με τη
    // ζώνη κόβουν όψη (attached-top στήριγμα κάτω από δοκάρι → εκτός ζώνης δοκαριού).
    const wallFootprints = wallFootprintsInBand(input.wallObstacles, zBottomMm, zTopMm);
    const faces = resolveBandFaces(input, present, heightMm, wallFootprints);
    if (faces.segments.length === 0) continue;
    bands.push({ faces, zBottomMm, zTopMm });
  }
  return bands;
}
