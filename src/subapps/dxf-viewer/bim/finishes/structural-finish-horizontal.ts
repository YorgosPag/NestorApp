/**
 * ADR-449 Slice 11 — Horizontal Structural Finish faces (σοβάς ΟΡΙΖΟΝΤΙΩΝ όψεων): pure SSoT.
 *
 * Το περιμετρικό finish (Slices 1-X2) καλύπτει μόνο τις **κατακόρυφες** πλευρικές
 * όψεις (band prisms από ακμές footprint). Εδώ προσθέτουμε τις **εκτεθειμένες
 * οριζόντιες** όψεις, adjacency-driven (Revit «exposed faces get finish»):
 *   - **Κολόνα — καπάκι (top cap)**: εκτεθειμένο όταν ΔΕΝ υπάρχει πλάκα/δοκάρι από
 *     πάνω που να καλύπτει το footprint. Μπει πλάκα/δοκάρι → re-derive → εξαφανίζεται.
 *   - **Κολόνα — βάση (base cap, pilotis)**: εκτεθειμένη όταν η βάση δεν κάθεται σε
 *     στάθμη/θεμελίωση ΚΑΙ καμία πλάκα/πέδιλο από κάτω.
 *   - **Δοκάρι — πάνω όψη**: εκτεθειμένη όταν καμία πλάκα από πάνω.
 *   - **Δοκάρι — κάτω όψη (soffit)**: εκτεθειμένη όταν κανένας τοίχος από κάτω.
 *
 * Η «παρουσία κάλυψης» είναι **ΓΕΩΜΕΤΡΙΚΗ** (footprint overlap στο σωστό z· ίδιο μοτίβο
 * με τα κατακόρυφα `obstacles`) — associative, ΟΧΙ stored flag: η εκτεθειμένη επιφάνεια
 * = `coreFootprint − ⋃ coverFootprints` (`safeDifference`) → **partial coverage** (μισή
 * πλάκα → μισό καπάκι) δωρεάν. Pure: μηδέν globals/THREE/scene — η σκηνή δίνει τα
 * cover footprints (scene adapter), εδώ μόνο γεωμετρία.
 *
 * Convention: `coreFootprint`/`coverFootprints` σε plan space (canvas units, ίδια με τον
 * resolver). Το `zMm` είναι η **δομική** οριζόντια όψη (building-relative mm)· ο 3Δ builder
 * τοποθετεί τον σοβά ΠΑΝΩ της (`up`) ή ΚΑΤΩ της (`down`) κατά `thicknessMm`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import type { MultiPolygon, Pair, Polygon } from 'polygon-clipping';
import { safeDifference, safeUnion } from '../geometry/shared/safe-polygon-boolean';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import type { FinishClassification, StructuralFinishSpec } from './structural-finish-types';
import { resolveStructuralFinishFaces } from './structural-finish-resolver';
import { computeMiteredOuter, segOffsetVec } from './structural-finish-outline-geometry';

const MM_TO_M = 0.001;

/** «Πάνω» (καπάκι/δοκάρι-πάνω) ή «κάτω» (soffit/βάση κολόνας) από τη δομική όψη. */
export type HorizontalFaceDirection = 'up' | 'down';

/** Μία εκτεθειμένη οριζόντια περιοχή: outer ring + (προαιρετικές) τρύπες (μερική κάλυψη). */
export interface HorizontalFinishPolygon {
  readonly outer: readonly Pt2[];
  readonly holes: readonly (readonly Pt2[])[];
}

/** DERIVED — η εκτεθειμένη οριζόντια όψη σοβά ενός στοιχείου (ποτέ stored). */
export interface HorizontalFinishFace {
  /** Disjoint εκτεθειμένες περιοχές (μετά την αφαίρεση των καλυμμένων). */
  readonly polygons: readonly HorizontalFinishPolygon[];
  /** mm — η ΔΟΜΙΚΗ οριζόντια όψη (building-relative). Ο σοβάς πάει up/down κατά thickness. */
  readonly zMm: number;
  /** mm — πάχος σοβά (από το spec). */
  readonly thicknessMm: number;
  /** Πάνω από τη δομική όψη (`up`) ή κάτω (`down`). */
  readonly direction: HorizontalFaceDirection;
  readonly classification: FinishClassification;
  /** Resolved υλικό (interior→interiorMaterialId, exterior→exteriorMaterialId). */
  readonly materialId: string;
  /** m² — συνολικό εκτεθειμένο εμβαδό (για BOQ). */
  readonly areaM2: number;
}

export interface HorizontalFaceInput {
  /** Κλειστό footprint του πυρήνα (canvas units· winding-agnostic). */
  readonly coreFootprint: readonly Pt2[];
  /** Footprints στοιχείων που καλύπτουν την όψη (πλάκες/δοκάρια/τοίχοι στο σωστό z). */
  readonly coverFootprints: readonly (readonly Pt2[])[];
  /** mm — δομική οριζόντια όψη (building-relative). */
  readonly zMm: number;
  readonly direction: HorizontalFaceDirection;
  readonly spec: StructuralFinishSpec;
  readonly classification: FinishClassification;
  /** Πολλαπλασιαστής canvas-unit-μήκος → ΜΕΤΡΑ (ίδια σύμβαση με τον resolver). */
  readonly unitToMeters: number;
  /** m² — ελάχιστο εμβαδό περιοχής (φιλτράρει slivers). Default 1e-6. */
  readonly minAreaM2?: number;
}

/** Shoelace signed area (canvas units²)· >0 = CCW. */
function signedArea(ring: readonly Pt2[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/**
 * Pt2[] → polygon-clipping `Polygon` (ένα ring, **CCW**). Η `polygon-clipping` είναι
 * winding-sensitive (CW → τρύπα) — γι' αυτό κανονικοποιούμε CCW πριν το boolean op.
 */
function footprintToClip(fp: readonly Pt2[]): Polygon {
  const ccw = signedArea(fp) < 0 ? [...fp].reverse() : fp;
  const ring: Pair[] = ccw.map((p) => [p.x, p.y]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push([first[0], first[1]]);
  return [ring];
}

/** polygon-clipping ring → Pt2[] (αφαιρεί τη διπλή κορυφή κλεισίματος). */
function ringToPts(ring: readonly Pair[]): Pt2[] {
  const n = ring.length;
  const closed = n > 1 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1];
  const lim = closed ? n - 1 : n;
  const pts: Pt2[] = [];
  for (let i = 0; i < lim; i++) pts.push({ x: ring[i][0], y: ring[i][1] });
  return pts;
}

/** Εκτεθειμένη επιφάνεια = core − ⋃ covers. Καμία κάλυψη → ο πυρήνας αυτούσιος. */
function exposedRegions(core: readonly Pt2[], covers: readonly (readonly Pt2[])[]): MultiPolygon {
  const corePoly = footprintToClip(core);
  const coverPolys = covers.filter((c) => c.length >= 3).map(footprintToClip);
  if (coverPolys.length === 0) return [corePoly];
  return safeDifference(corePoly, ...coverPolys);
}

/** polygon-clipping `Polygon` → `HorizontalFinishPolygon` (poly[0]=outer, poly[1..]=holes). */
function toHorizontalPolygon(poly: Polygon): HorizontalFinishPolygon {
  return {
    outer: ringToPts(poly[0] ?? []),
    holes: poly.slice(1).map(ringToPts),
  };
}

/** Καθαρό εμβαδό (canvas units²) ενός polygon = |outer| − Σ|holes|. */
function netArea(poly: HorizontalFinishPolygon): number {
  let a = Math.abs(signedArea(poly.outer));
  for (const h of poly.holes) a -= Math.abs(signedArea(h));
  return Math.max(0, a);
}

/**
 * Pure SSoT: εκτεθειμένη οριζόντια όψη σοβά ή `null` (ανενεργό spec / εκφυλισμένο
 * footprint / πλήρως καλυμμένη). Εμβαδά σε m² μέσω `unitToMeters²`.
 */
export function computeHorizontalFinishFace(input: HorizontalFaceInput): HorizontalFinishFace | null {
  const { coreFootprint, coverFootprints, spec, classification, unitToMeters } = input;
  if (!spec.enabled || spec.thickness <= 0 || coreFootprint.length < 3) return null;

  const minAreaM2 = input.minAreaM2 ?? 1e-6;
  const areaScale = unitToMeters * unitToMeters; // canvas units² → m²
  const polygons: HorizontalFinishPolygon[] = [];
  let areaM2 = 0;
  for (const poly of exposedRegions(coreFootprint, coverFootprints)) {
    if (!poly.length) continue;
    const hp = toHorizontalPolygon(poly);
    if (hp.outer.length < 3) continue;
    const m2 = netArea(hp) * areaScale;
    if (m2 < minAreaM2) continue;
    polygons.push(hp);
    areaM2 += m2;
  }
  if (polygons.length === 0 || areaM2 < minAreaM2) return null;

  const materialId = classification === 'exterior' ? spec.exteriorMaterialId : spec.interiorMaterialId;
  return {
    polygons,
    zMm: input.zMm,
    thicknessMm: spec.thickness,
    direction: input.direction,
    classification,
    materialId,
    areaM2,
  };
}

/** m³ ισοδύναμο (area × thickness) — βοηθητικό για debugging/BOQ sanity (όχι BOQ μονάδα). */
export function horizontalFaceVolumeM3(face: HorizontalFinishFace): number {
  return face.areaM2 * face.thicknessMm * MM_TO_M;
}

/** Outer ring του μεγαλύτερου polygon μιας MultiPolygon. `null` αν κενή. */
function largestOuterRing(mp: MultiPolygon): Pt2[] | null {
  let best: Pt2[] | null = null;
  let bestArea = -Infinity;
  for (const poly of mp) {
    if (!poly.length) continue;
    const ring = ringToPts(poly[0]);
    const a = Math.abs(signedArea(ring));
    if (a > bestArea) { bestArea = a; best = ring; }
  }
  return best;
}

/**
 * ADR-449 Slice 11 — **finished outline** ενός δομικού στοιχείου: το core footprint
 * μεγεθυμένο προς τα έξω κατά `thicknessMm` **ΜΟΝΟ στις εκτεθειμένες ακμές** (όπως
 * ακριβώς ο κάθετος σοβάς — ίδιος resolver + `computeMiteredOuter`). Οι ακμές που
 * καλύπτονται από γείτονα (`obstacles`: κολόνα/δοκάρι/τοίχος στη συμβολή) ΔΕΝ
 * μετατοπίζονται → η οριζόντια όψη (soffit/cap) σταματά **flush** στο πρόσωπο του
 * γείτονα αντί να προεξέχει/διεισδύει. Έτσι το οριζόντιο finish ευθυγραμμίζεται
 * ΑΚΡΙΒΩΣ με το πρόσωπο του κάθετου σοβά σε κάθε εκτεθειμένη πλευρά.
 *
 * `s` = mmToSceneUnits (canvas units ανά mm). Κανένα exposed segment (όλα καλυμμένα) →
 * επιστρέφει το core αυτούσιο.
 */
export function computeFinishedOutline(
  core: readonly Pt2[],
  obstacles: readonly (readonly Pt2[])[],
  thicknessMm: number,
  s: number,
): Pt2[] {
  if (core.length < 3 || thicknessMm <= 0) return [...core];
  const spec: StructuralFinishSpec = {
    enabled: true, thickness: thicknessMm, interiorMaterialId: '', exteriorMaterialId: '',
  };
  const faces = resolveStructuralFinishFaces({
    coreFootprint: core, heightMm: 1, spec, obstacles,
    classify: () => 'interior', unitToMeters: 1,
  });
  const segs = faces.segments;
  if (segs.length === 0) return [...core];
  const offsets = segs.map((seg) => segOffsetVec(seg, seg.thickness * s));
  const { aOuter, bOuter, aCore, bCore } = computeMiteredOuter(segs, offsets, true);
  const quads = segs.map((_, i) => [aCore[i], bCore[i], bOuter[i], aOuter[i]]);
  const merged = safeUnion(footprintToClip(core), ...quads.map((q) => footprintToClip(q)));
  return largestOuterRing(merged) ?? [...core];
}
