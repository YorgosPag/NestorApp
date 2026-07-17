/**
 * ADR-449 / ADR-534 Φ5 — Οριζόντιος σοβάς: **primitives εμποδίων & finished outlines**.
 *
 * N.7.1 EXTRACT (2026-07-17): αποσπάστηκε αυτούσιο από το `structural-finish-scene-horizontal.ts`
 * (είχε φτάσει 481/500 και το Φ5 πρόσθετε τη soffit/top-cap πλάκας) — **μετακίνηση, όχι trim**.
 * Καθαρή γεωμετρία: bbox, κατακόρυφο span, γνήσια κάλυψη σε επίπεδο, finished outline / plaster
 * envelope μέλους. Μηδέν coupling με τα source types (κολόνα/δοκάρι/πλάκα) → μηδέν κυκλική εξάρτηση.
 *
 * Pure: μηδέν globals/React/THREE/scene.
 *
 * @see ./structural-finish-scene-horizontal.ts — ο μοναδικός consumer (adapter)
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import { isFinishActive, type StructuralFinishSpec } from './structural-finish-types';
import { computeFinishedOutline } from './structural-finish-horizontal';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { dilatePolygonOutward } from '../geometry/shared/polygon-dilate';
import { toPt2 } from './structural-finish-scene';

/** Κατακόρυφη έκταση [zBot, zTop] σε building-relative mm. */
export interface ZExtent {
  readonly zBotMm: number;
  readonly zTopMm: number;
}

/** Axis-aligned plan bounding box (canvas units). */
export interface Bbox {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** Footprint (plan) + z-span ενός εμποδίου κάλυψης / finished outline μέλους. */
export interface PlanObstacle extends ZExtent {
  readonly footprint: readonly Pt2[];
  readonly bbox: Bbox;
  /**
   * ADR-534 Φ5 Απόφαση Δ — id για **self-exclusion ανά επίπεδο**. Μια πλάκα που είναι
   * finish-member καλύπτει (span-wise) το ΔΙΚΟ της επίπεδο (soffit ή top) → χωρίς id δεν
   * μπορούμε να την εξαιρέσουμε από τα εμπόδιά της → θα έσβηνε τον εαυτό της (bug 100928
   * σε slab μορφή). Absent για κολόνες/δοκάρια/τοίχους (δεν έχουν αυτό το πρόβλημα).
   */
  readonly id?: string;
}

export function bboxOf(pts: readonly { x: number; y: number }[]): Bbox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

export function bboxOverlap(a: Bbox, b: Bbox): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

/** `true` όταν η κατακόρυφη έκταση [zBot,zTop] φτάνει το επίπεδο `planeZ` (± tol). */
export function spanReachesPlane(ext: ZExtent, planeZmm: number, tolMm: number): boolean {
  return ext.zBotMm <= planeZmm + tolMm && ext.zTopMm >= planeZmm - tolMm;
}

/**
 * Footprints obstacles που (α) φτάνουν κατακόρυφα το επίπεδο & (β) bbox-overlap το core.
 * `excludeIds` (ADR-534 Φ5 Απόφαση Δ) — παραλείπει εμπόδια με αυτά τα ids: μια finish-member
 * πλάκα καλύπτει span-wise το δικό της επίπεδο· εξαιρείται ώστε να μη σβήσει τον εαυτό της.
 * Non-member coplanar πλάκα (π.χ. `ground`) **δεν** έχει id εδώ → εξακολουθεί να καλύπτει.
 */
export function coversAtPlane(
  obstacles: readonly PlanObstacle[],
  planeZmm: number,
  coreBbox: Bbox,
  tolMm: number,
  excludeIds?: ReadonlySet<string>,
): (readonly Pt2[])[] {
  const out: (readonly Pt2[])[] = [];
  for (const o of obstacles) {
    if (excludeIds && o.id !== undefined && excludeIds.has(o.id)) continue;
    if (spanReachesPlane(o, planeZmm, tolMm) && bboxOverlap(coreBbox, o.bbox)) out.push(o.footprint);
  }
  return out;
}

export function beamZExtent(p: { topElevation: number; zOffset?: number; depth: number }): ZExtent {
  const zTopMm = p.topElevation + (p.zOffset ?? 0);
  return { zBotMm: zTopMm - p.depth, zTopMm };
}

export function toPlanObstacle(footprint: readonly { x: number; y: number }[], ext: ZExtent): PlanObstacle {
  const fp = footprint.map(toPt2);
  return { footprint: fp, bbox: bboxOf(fp), ...ext };
}

/** Έγκυρο footprint (≥3 σημεία) ενός μέλους → Pt2[], αλλιώς `null`. */
export function coresOf(verts: readonly { x: number; y: number }[] | undefined): Pt2[] | null {
  return verts && verts.length >= 3 ? verts.map(toPt2) : null;
}

/** Finished outline ενός μέλους ως `PlanObstacle` (core + z) — ή `null` αν εκφυλισμένο. */
export function finishedObstacleOf(
  core: Pt2[] | null,
  lateralObstacles: readonly (readonly Pt2[])[],
  spec: StructuralFinishSpec | undefined,
  s: number,
  ext: ZExtent,
): PlanObstacle | null {
  if (!core) return null;
  const thick = isFinishActive(spec) ? spec.thickness : 0;
  const ring = computeFinishedOutline(core, lateralObstacles, thick, s);
  return { footprint: ring, bbox: bboxOf(ring), ...ext };
}

/** Plaster envelope ενός γείτονα = core dilated έξω κατά το πάχος του (ΟΧΙ boolean). */
export function plasterEnvelope(core: Pt2[] | null, spec: StructuralFinishSpec | undefined, s: number): Pt2[] | null {
  if (!core || core.length < 3) return null;
  const thick = isFinishActive(spec) ? spec.thickness : 0;
  return thick > 0 ? dilatePolygonOutward(core, thick * s) : core;
}

/**
 * ADR-534 Φ7b — cover διεσταλμένο έξω κατά `margin` (canvas units). Το ενιαίο top-cap χτίζεται στο
 * **finished** (διεσταλμένο κατά το πάχος) outline των μελών· η καλύπτουσα πλάκα/δοκάρι έχει outline
 * = ο δομικός **πυρήνας** → η αφαίρεση άφηνε ένα περιμετρικό δαχτυλίδι ~πάχος (το «hup»: plaster
 * frame πάνω σε κάθε τοίχο/κολόνα κάτω από πλάκα). Διαστέλλοντας τον cover κατά το ίδιο πάχος,
 * καταπίνει το frame → μηδέν cap όπου υπάρχει κάλυψη άνωθεν (εκτεθειμένα parapets: κανένας cover →
 * αμετάβλητο πλήρες cap). `margin ≤ 0` ή εκφυλισμένο footprint → ο cover ως έχει.
 */
export function dilatedCover(o: PlanObstacle, margin: number): PlanObstacle {
  if (margin <= 0 || o.footprint.length < 3) return o;
  const fp = dilatePolygonOutward([...o.footprint], margin);
  return { ...o, footprint: fp, bbox: bboxOf(fp) };
}
