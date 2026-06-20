/**
 * Hatch pattern geometry (SSoT, ADR-507 Φ1a).
 *
 * `buildHatchLines()` παράγει τα παράλληλα ευθύγραμμα τμήματα μιας user-defined
 * γραμμοσκίασης, γεωμετρικά «κομμένα» στα όρια (boundary paths). ΜΙΑ γεωμετρία →
 * τρέφει ΚΑΙ τον `HatchRenderer` (canvas) ΚΑΙ τον `dxf-ascii-writer` σε lines-mode
 * (Τέκτονας — HATCH → exploded LINEs). Έτσι το canvas και το εξαγόμενο DXF δείχνουν
 * ΑΚΡΙΒΩΣ τις ίδιες γραμμές (full SSoT, όπως Revit).
 *
 * Χτίζει πάνω στο υπάρχον axis-aligned hatch SSoT (`polygon-hatch-utils`) — δεν
 * ξαναϋλοποιεί την παραγωγή απείρων γραμμών/clip-σε-bbox (N.12 dedup). Προσθέτει
 * μόνο το επιπλέον βήμα: clip του κάθε bbox-segment στο πραγματικό πολύγωνο, με
 * even-odd island rule.
 *
 * Όλες οι συντεταγμένες σε mm world coords.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 * @see bim/geometry/shared/polygon-hatch-utils.ts (buildAxisAlignedHatch SSoT)
 */

import type { Point3D } from '../../types/bim-base';
import {
  buildAxisAlignedHatch,
  type HatchDirection,
  type HatchLineSegment,
  type HatchPoint2D,
} from './polygon-hatch-utils';
import { polygonBbox, pointInPolygon } from './polygon-utils';
import { lerpPoint } from '../../../rendering/entities/shared/geometry-utils';
import { degToRad } from '../../../rendering/entities/shared/geometry-angle-utils';
import type { HatchIslandStyle } from '../../hatch/hatch-properties';

export type { HatchLineSegment, HatchPoint2D } from './polygon-hatch-utils';
export type { HatchIslandStyle } from '../../hatch/hatch-properties';

export interface BuildHatchLinesOptions {
  /** Κάθετη απόσταση γραμμών (mm). ≤ 0 → κενό αποτέλεσμα. */
  readonly spacingMm: number;
  /** Γωνία γραμμών σε μοίρες (CCW από +X). Προεπιλογή 0 (οριζόντιες). */
  readonly angleDeg?: number;
  /** Phase origin του μοτίβου. Προεπιλογή world {0,0}. */
  readonly origin?: HatchPoint2D;
  /** Διπλή (σταυρωτή) γραμμοσκίαση → προσθέτει 2ο set στις +90°. */
  readonly double?: boolean;
  /** Island rule. 'ignore' → μόνο το εξωτερικό path[0]· αλλιώς even-odd. */
  readonly islandStyle?: HatchIslandStyle;
}

const EPS = 1e-7;

/** Μοναδιαία κατεύθυνση από γωνία (μοίρες) — reuse degToRad SSoT. */
function unitFromAngle(angleDeg: number): HatchDirection {
  const r = degToRad(angleDeg);
  return { ux: Math.cos(r), uy: Math.sin(r) };
}

/** Σημείο πάνω στο segment σε παράμετρο t — reuse lerpPoint SSoT. */
function segPoint(seg: HatchLineSegment, t: number): HatchPoint2D {
  return lerpPoint(seg.start, seg.end, t);
}

/**
 * Παράμετρος `t ∈ (0,1)` πάνω στο segment `p0→p1` όπου τέμνει την ακμή `a→b`, ή
 * `null` αν δεν τέμνονται μέσα στα δύο τμήματα (ή είναι παράλληλα). Standard 2D
 * segment-segment intersection (Cramer).
 */
function segmentCrossParam(
  p0: HatchPoint2D, p1: HatchPoint2D, a: HatchPoint2D, b: HatchPoint2D,
): number | null {
  const rx = p1.x - p0.x, ry = p1.y - p0.y;
  const sx = b.x - a.x, sy = b.y - a.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < EPS) return null; // παράλληλα / collinear
  const t = ((a.x - p0.x) * sy - (a.y - p0.y) * sx) / denom;
  const u = ((a.x - p0.x) * ry - (a.y - p0.y) * rx) / denom;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return t;
}

/**
 * True όταν το point ανήκει στη γεμιζόμενη περιοχή.
 *   - 'ignore' → μόνο μέσα στο εξωτερικό path[0] (αγνοεί νησίδες)
 *   - 'normal'/'outer' → even-odd: μέσα σε μονό πλήθος paths
 */
function insideRegion(
  point: HatchPoint2D, paths: readonly Point3D[][], islandStyle: HatchIslandStyle,
): boolean {
  if (islandStyle === 'ignore') return pointInPolygon(point, paths[0]);
  let count = 0;
  for (const path of paths) if (pointInPolygon(point, path)) count += 1;
  return count % 2 === 1;
}

/** Κόψε ένα bbox-segment στα όρια — επιστρέφει τα υπο-τμήματα εντός περιοχής. */
function clipSegmentToRegion(
  seg: HatchLineSegment, paths: readonly Point3D[][], islandStyle: HatchIslandStyle,
): HatchLineSegment[] {
  const relevant = islandStyle === 'ignore' ? [paths[0]] : paths;
  const ts: number[] = [0, 1];
  for (const path of relevant) {
    const n = path.length;
    for (let i = 0; i < n; i += 1) {
      const a = path[i];
      const b = path[(i + 1) % n];
      const t = segmentCrossParam(seg.start, seg.end, a, b);
      if (t != null && t > EPS && t < 1 - EPS) ts.push(t);
    }
  }
  ts.sort((x, y) => x - y);
  const out: HatchLineSegment[] = [];
  for (let i = 0; i < ts.length - 1; i += 1) {
    const t0 = ts[i];
    const t1 = ts[i + 1];
    if (t1 - t0 < EPS) continue;
    const mid = segPoint(seg, (t0 + t1) / 2);
    if (insideRegion(mid, paths, islandStyle)) {
      out.push({ start: segPoint(seg, t0), end: segPoint(seg, t1) });
    }
  }
  return out;
}

/** Ένα set παράλληλων κομμένων γραμμών σε δεδομένη γωνία. */
function buildClippedSet(
  paths: readonly Point3D[][], spacingMm: number, angleDeg: number, islandStyle: HatchIslandStyle,
): HatchLineSegment[] {
  const allVerts = paths.flat();
  const bbox = polygonBbox(allVerts);
  const full = buildAxisAlignedHatch(bbox, spacingMm, unitFromAngle(angleDeg));
  const out: HatchLineSegment[] = [];
  for (const seg of full) out.push(...clipSegmentToRegion(seg, paths, islandStyle));
  return out;
}

/**
 * Παράγει τα τμήματα μιας user-defined γραμμοσκίασης, κομμένα στα `boundaryPaths`.
 * Phase origin: μεταφέρουμε τα όρια κατά `-origin`, χτίζουμε, ξανα-μεταφέρουμε κατά
 * `+origin` — έτσι οι γραμμές «κουμπώνουν» στο origin (default world 0 = συμβατό με
 * beam/floor-finish hatch). Επιστρέφει κενό για κενά όρια ή `spacing ≤ 0`.
 */
export function buildHatchLines(
  boundaryPaths: ReadonlyArray<ReadonlyArray<HatchPoint2D>>,
  opts: BuildHatchLinesOptions,
): HatchLineSegment[] {
  const { spacingMm, angleDeg = 0, origin = { x: 0, y: 0 }, double = false, islandStyle = 'normal' } = opts;
  if (spacingMm <= 0) return [];
  const usable = boundaryPaths.filter((p) => p.length >= 3);
  if (!usable.length) return [];

  const shifted: Point3D[][] = usable.map((path) =>
    path.map((v) => ({ x: v.x - origin.x, y: v.y - origin.y, z: 0 })),
  );

  const segments = buildClippedSet(shifted, spacingMm, angleDeg, islandStyle);
  if (double) segments.push(...buildClippedSet(shifted, spacingMm, angleDeg + 90, islandStyle));

  return segments.map((s) => ({
    start: { x: s.start.x + origin.x, y: s.start.y + origin.y },
    end: { x: s.end.x + origin.x, y: s.end.y + origin.y },
  }));
}
