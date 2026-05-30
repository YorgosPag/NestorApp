/**
 * ADR-396 v2 Phase 3 — Footprint region classifier (auto ταξινόμηση 3 στρώσεων).
 *
 * Παίρνει το περίγραμμα κτιρίου (`building-footprint.ts`, Φάση 2) + τις πλάκες
 * των ψηλότερων ορόφων και αποφασίζει **αυτόματα** ποια όρια παίρνουν μόνωση:
 *
 *   - **Στρ.1 — εξώτατο όριο** (ανά component): μόνωση ΜΟΝΟ αν το component έχει
 *     ≥1 τρύπα (περικλείει χώρο, `role: 'exterior'`). Ανοιχτό σχήμα χωρίς τρύπα
 *     (Π/L/μονός τοίχος) → `role: 'open-structure'`, καμία μόνωση (hole-gate).
 *   - **Στρ.2 — κάθε τρύπα**: **αίθριο** (ανοιχτό στον ουρανό → μόνωση γύρω) ή
 *     **κλειστό δωμάτιο** (έχει πλάκα από πάνω, Ή λείπουν δεδομένα → καμία μόνωση).
 *     Κανόνας (ADR-396 §3.1.2): τρύπα ΧΩΡΙΣ πλάκα από πάνω = αίθριο· ΜΕ πλάκα ή
 *     χωρίς δεδομένα = δωμάτιο.
 *   - **Στρ.3 — per-element χειροκίνητη παράκαμψη** (Revit-style): Φάση 4 + 6.
 *
 * Ο έλεγχος «έχει η τρύπα πλάκα από πάνω;» γίνεται με **γεωμετρική τομή** (ίδια
 * lib `polygon-clipping` με τη Φάση 2): εμβαδόν (τρύπα ∩ ένωση πλακών-από-πάνω) ÷
 * εμβαδόν τρύπας ≥ `ATRIUM_COVERAGE_THRESHOLD` → δωμάτιο· αλλιώς → αίθριο. Έτσι
 * χειρίζεται σωστά σχήματα Γ/Π, μερική κάλυψη και προβόλους.
 *
 * Pure SSoT — canvas-unit χώρος (ίδιος με `BuildingFootprintResult` &
 * `slab.params.outline.vertices`). Μηδέν globals / React / Firestore.
 *
 * ⚠️ Phase 3 = αυτόνομο module + tests· ΚΑΝΕΝΑ wiring στους consumers (Φάση 5).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.1.2
 */

import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Pair, Polygon, Ring } from 'polygon-clipping';

import type { Point3D } from '../types/bim-base';
import { ATRIUM_COVERAGE_THRESHOLD } from '../types/thermal-envelope-types';
import { polygonArea } from './shared/polygon-utils';
import type { BuildingFootprintResult, FootprintRing } from './building-footprint';
import type { SlabForZoneClassification } from './exposed-slab-classifier';
import { resolveSlabTopMm } from './exposed-slab-classifier';
import type { StoreyRef } from '../utils/bim-floor-utils';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/**
 * Ρόλος ενός ορίου ως προς τη μόνωση κελύφους.
 * - `exterior` — εξώτατο όριο component που **περικλείει χώρο** (έχει ≥1 τρύπα).
 * - `atrium` — ακάλυπτη τρύπα (μόνωση γύρω, προς το κενό).
 * - `interior-room` — τρύπα-δωμάτιο (σκεπασμένη ή χωρίς δεδομένα) — καμία μόνωση.
 * - `open-structure` — εξώτατο όριο **ανοιχτού** component (Π/L/μονός τοίχος, καμία
 *   τρύπα) — ΚΑΜΙΑ μόνωση (αλλιώς θα τύλιγε και την ανοιχτή πλευρά, ADR-396 §3 gate).
 */
export type RegionEnvelopeRole = 'exterior' | 'atrium' | 'interior-room' | 'open-structure';

/** Ένα δαχτυλίδι του περιγράμματος με την απόφαση μόνωσης. */
export interface ClassifiedFootprintRing {
  readonly ring: FootprintRing;
  readonly role: RegionEnvelopeRole;
  /** `exterior` + `atrium` = true · `interior-room` + `open-structure` = false. */
  readonly insulated: boolean;
  /** Ποσοστό (0..1) της τρύπας που σκεπάζεται από πλάκα ψηλότερου ορόφου (0 για outer). */
  readonly coverageAbove: number;
}

export interface FootprintClassificationResult {
  readonly rings: readonly ClassifiedFootprintRing[];
  readonly exterior: readonly ClassifiedFootprintRing[];
  readonly atria: readonly ClassifiedFootprintRing[];
  readonly interiorRooms: readonly ClassifiedFootprintRing[];
  /** Εξώτατα όρια ανοιχτών components (καμία τρύπα → καμία μόνωση). */
  readonly openStructures: readonly ClassifiedFootprintRing[];
}

/** Ελάχιστο σχήμα πλάκας για τον coverage έλεγχο (footprint σε canvas units). */
export interface SlabRegionFootprint {
  readonly polygon: readonly Point3D[];
}

/**
 * Πλάκα για το `selectSlabsAboveFloor` — δομικά συμβατή με `SlabEntity`:
 * `SlabForZoneClassification` (elevation resolution) + plan-view `outline`.
 */
export interface SlabForRegionCoverage extends SlabForZoneClassification {
  readonly params: SlabForZoneClassification['params'] & {
    readonly outline: { readonly vertices: readonly Point3D[] };
  };
}

// ============================================================================
// INTERNAL CONSTANTS
// ============================================================================

/** mm ανοχή: μια πλάκα είναι «πάνω» όταν το top-face της υπερβαίνει το όριο +snap. */
const ELEV_SNAP_MM = 10;
const AREA_EPS = 1e-9;

const EMPTY_RESULT: FootprintClassificationResult = {
  rings: [],
  exterior: [],
  atria: [],
  interiorRooms: [],
  openStructures: [],
};

// ============================================================================
// GEOMETRIC COVERAGE (polygon-clipping intersection)
// ============================================================================

/** `Point3D` ring → `polygon-clipping` Ring (translated κατά offset). */
function toRing(points: readonly Point3D[], ox: number, oy: number): Ring {
  return points.map((p): Pair => [p.x - ox, p.y - oy]);
}

/** Άθροισμα εμβαδών μιας `MultiPolygon` (outer − holes), σε canvas units². */
function multiPolygonArea(mp: MultiPolygon): number {
  let total = 0;
  for (const polygon of mp) {
    for (let i = 0; i < polygon.length; i++) {
      const verts: Point3D[] = polygon[i].map((pr: Pair) => ({ x: pr[0], y: pr[1], z: 0 }));
      const a = polygonArea(verts);
      total += i === 0 ? a : -a; // ring[0] = outer, υπόλοιπα = holes
    }
  }
  return Math.max(0, total);
}

/**
 * Ποσοστό (0..1) της τρύπας που σκεπάζεται από την ένωση των πλακών-από-πάνω.
 *
 * Precision guard (mirror `building-footprint.ts`): μετάφραση σε κοινό local
 * origin πριν το clipping (ακρίβεια polygon-clipping σε mm-scale ~χιλιάδες). Το
 * εμβαδόν είναι translation-invariant → δεν χρειάζεται επαναφορά.
 */
function computeHoleCoverage(
  hole: FootprintRing,
  slabsAbove: readonly SlabRegionFootprint[],
): number {
  const holeArea = hole.areaCanvas;
  if (holeArea <= AREA_EPS) return 0;
  const slabPolys = slabsAbove.filter((s) => s.polygon.length >= 3);
  if (slabPolys.length === 0) return 0;

  const holePts = hole.points.points;
  let ox = Infinity;
  let oy = Infinity;
  for (const p of holePts) {
    if (p.x < ox) ox = p.x;
    if (p.y < oy) oy = p.y;
  }
  for (const s of slabPolys) {
    for (const p of s.polygon) {
      if (p.x < ox) ox = p.x;
      if (p.y < oy) oy = p.y;
    }
  }

  const holeGeom: Polygon = [toRing(holePts, ox, oy)];
  const slabGeoms = slabPolys.map((s): Polygon => [toRing(s.polygon, ox, oy)]);
  const slabsUnion = polygonClipping.union(slabGeoms[0], ...slabGeoms.slice(1));
  const covered = polygonClipping.intersection(holeGeom, slabsUnion);

  return Math.min(1, multiPolygonArea(covered) / holeArea);
}

// ============================================================================
// PUBLIC ENTRY — classification
// ============================================================================

/**
 * Ταξινομεί τα όρια του περιγράμματος σε `exterior` / `atrium` / `interior-room` /
 * `open-structure`. Δουλεύει **ανά component** (`footprint.components`) ώστε να
 * εφαρμόσει τα 2 gates (ADR-396 §3, αποφάσεις Giorgio):
 *
 *   1. **Hole-gate:** εξώτατο όριο μονώνεται ΜΟΝΟ αν το component του έχει ≥1 τρύπα
 *      (περικλείει χώρο). Καμία τρύπα (Π/L/μονός τοίχος) → `open-structure`, καμία
 *      μόνωση — αλλιώς θα τύλιγε λάθος και την ανοιχτή πλευρά.
 *   2. **No-slab-data default:** όταν `slabsAbove` είναι ΚΕΝΟ (καθόλου δεδομένα),
 *      κάθε τρύπα = `interior-room` (όχι αίθριο) → μόνωση μόνο εξωτερικά (μηδέν
 *      regression vs παλιό σύστημα). Τα αίθρια ανιχνεύονται όταν δοθούν `slabsAbove`
 *      (Φάση 5C) και η κάλυψη είναι < threshold.
 *
 * @param footprint  - έξοδος `computeBuildingFootprint` (τρέχων όροφος).
 * @param slabsAbove - footprints πλακών οποιουδήποτε ψηλότερου ορόφου (canvas
 *                     units). Δες `selectSlabsAboveFloor` για το resolve. Κενό =
 *                     καμία ανίχνευση αίθριου (όλες οι τρύπες = δωμάτια).
 * @param options.coverageThreshold - override του `ATRIUM_COVERAGE_THRESHOLD`.
 */
export function classifyFootprintRegions(
  footprint: BuildingFootprintResult,
  slabsAbove: readonly SlabRegionFootprint[] = [],
  options?: { readonly coverageThreshold?: number },
): FootprintClassificationResult {
  if (footprint.components.length === 0) return EMPTY_RESULT;
  const threshold = options?.coverageThreshold ?? ATRIUM_COVERAGE_THRESHOLD;
  // Κανένα δεδομένο πλακών → δεν μπορούμε να ξεχωρίσουμε αίθριο από δωμάτιο →
  // ασφαλές default = δωμάτιο (μόνο εξωτερική περίμετρος, ADR-396 §3 / Φάση 5B).
  const noSlabData = slabsAbove.length === 0;

  const rings: ClassifiedFootprintRing[] = [];
  const exterior: ClassifiedFootprintRing[] = [];
  const atria: ClassifiedFootprintRing[] = [];
  const interiorRooms: ClassifiedFootprintRing[] = [];
  const openStructures: ClassifiedFootprintRing[] = [];

  for (const comp of footprint.components) {
    const enclosed = comp.holes.length > 0; // hole-gate: περικλείει χώρο;
    const outer: ClassifiedFootprintRing = {
      ring: comp.outer,
      role: enclosed ? 'exterior' : 'open-structure',
      insulated: enclosed,
      coverageAbove: 0,
    };
    rings.push(outer);
    (enclosed ? exterior : openStructures).push(outer);

    for (const hole of comp.holes) {
      const coverage = computeHoleCoverage(hole, slabsAbove);
      // Degenerate (μηδενικού εμβαδού) τρύπα → δωμάτιο. Κενά δεδομένα → δωμάτιο.
      const isRoom = noSlabData || hole.areaCanvas <= AREA_EPS || coverage >= threshold;
      const classified: ClassifiedFootprintRing = {
        ring: hole,
        role: isRoom ? 'interior-room' : 'atrium',
        insulated: !isRoom,
        coverageAbove: coverage,
      };
      rings.push(classified);
      (isRoom ? interiorRooms : atria).push(classified);
    }
  }

  return { rings, exterior, atria, interiorRooms, openStructures };
}

// ============================================================================
// PUBLIC ENTRY — slabs-above resolver (reuse elevation SSoT)
// ============================================================================

/**
 * Επιλέγει τις πλάκες που βρίσκονται **πάνω** από τον τρέχοντα όροφο (top-face >
 * `currentFloorTopMm` + snap) και επιστρέφει τα footprints τους — έτοιμα input
 * για το `classifyFootprintRegions`. «Πάνω» = οποιοσδήποτε ψηλότερος όροφος
 * (αίθριο = ανοιχτό στον ουρανό = καμία πλάκα πουθενά από πάνω).
 *
 * Reuse του ΙΔΙΟΥ elevation SSoT με το `classifyExposedSlab` (`resolveSlabTopMm`
 * → `getEntityAbsoluteElevation`, ADR-369). Pure — η εύρεση «ποιος είναι ο
 * τρέχων όροφος» μένει στον caller (Φάση 5).
 *
 * @param slabs            - πλάκες όλων των ορόφων (με `params.outline`).
 * @param floors           - StoreyRef λίστα (elevation σε ΜΕΤΡΑ).
 * @param currentFloorTopMm - απόλυτο υψόμετρο οροφής τρέχοντος ορόφου (mm).
 */
export function selectSlabsAboveFloor(
  slabs: readonly SlabForRegionCoverage[],
  floors: readonly StoreyRef[],
  currentFloorTopMm: number,
): SlabRegionFootprint[] {
  const result: SlabRegionFootprint[] = [];
  for (const slab of slabs) {
    const topMm = resolveSlabTopMm(slab, floors);
    if (topMm > currentFloorTopMm + ELEV_SNAP_MM) {
      result.push({ polygon: slab.params.outline.vertices });
    }
  }
  return result;
}
