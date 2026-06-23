/**
 * Column SECTION OUTLINE + reinforcement-mode classifier — shape SSoT
 * (ADR-460 — Multi-shape column reinforcement, Slice 1).
 *
 * ΕΝΑ σημείο που «καταλαβαίνει σχήμα»: παίρνει `ColumnParams` (οποιουδήποτε kind) και
 * παράγει το **section outline σε LOCAL mm** (κεντραρισμένο στο centroid, ίδιο σύστημα
 * συντεταγμένων με το rebar layout) + τον **detailing mode** + χαρακτηριστικά μεγέθη
 * (min πάχος, περίμετρος, εμβαδόν, bbox, άξονας τοιχώματος). Reuse:
 *   - `materializeColumnLocalPolygonMm` (column-geometry) — το ΙΔΙΟ footprint με 2Δ/3Δ
 *   - `polygonArea` / `polygonPerimeter` / `polygonBbox` (polygon-utils SSoT)
 *
 * Όλη η αλυσίδα οπλισμού (layout, ποσότητες, providers, 2Δ/3Δ, detail-sheet) χτίζεται
 * πάνω σε αυτό αντί για το παλιό σκαλάρ `width × depth` (rectangular-only). Pure —
 * μηδέν globals/React.
 *
 * @see ./column-rebar-layout.ts
 * @see docs/centralized-systems/reference/adrs/ADR-460-multi-shape-column-reinforcement.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { ColumnKind, ColumnParams } from '../../types/column-types';
import { materializeColumnLocalPolygonMm } from '../../geometry/column-geometry';
import { polygonArea, polygonPerimeter, polygonBbox } from '../../geometry/shared/polygon-utils';

/**
 * Τρόπος διευθέτησης οπλισμού — επιλέγεται από το σχήμα/αναλογία διατομής:
 *   - `perimeter` — ράβδοι στο inset περίγραμμα + στεφάνι που ακολουθεί το outline
 *                   (ορθογ., Γ, Τ, Ι, Π-μη-τοίχωμα, πολύγωνο, σύνθετο μη-επίμηκες).
 *   - `circular`  — ακτινικές ράβδοι σε κύκλο + δακτύλιος/σπείρα (κυκλική διατομή).
 *   - `wall`      — boundary elements (ζώνες άκρων) + κατανεμημένος οπλισμός κορμού
 *                   (τοίχωμα: shear-wall ή επίμηκες Γ/Τ/Π/σύνθετο, EC8 §5.4.3.4).
 */
export type ColumnReinforcementMode = 'perimeter' | 'circular' | 'wall';

/**
 * SSoT type-guard «η διατομή οπλίζεται ως **τοίχωμα**» (boundary elements +
 * κατανεμημένος κορμός, EC8 §5.4.3.4). ΕΝΑ σημείο για τον discriminant `mode==='wall'`
 * που μοιράζονται section-outline / compute / suggester / validator → μηδέν scatter.
 * Type-guard (`mode is 'wall'`) ώστε να διατηρείται το TypeScript narrowing.
 */
export function isWallReinforcementMode(
  mode: ColumnReinforcementMode | undefined,
): mode is 'wall' {
  return mode === 'wall';
}

/**
 * EC8 §5.1.2: στοιχείο θεωρείται **τοίχωμα** όταν ο λόγος επιμήκυνσης (μέγιστη
 * διάσταση διατομής / πάχος) ≥ 4. Πάνω από αυτό → boundary-element detailing.
 */
export const WALL_ELONGATION_THRESHOLD = 4;

/** Πλήρης περιγραφή διατομής για τον σχεδιασμό οπλισμού (LOCAL mm). */
export interface ColumnReinforcementSection {
  /** Τύπος διατομής (για rectangular fast-path + section label). */
  readonly kind: ColumnKind;
  /** Section outline σε LOCAL mm (centroid-centered, ίδιο με 2Δ/3Δ footprint). */
  readonly outlineMm: readonly Point2D[];
  /** Επιλεγμένος τρόπος διευθέτησης. */
  readonly mode: ColumnReinforcementMode;
  /** Κυκλική διατομή (δακτύλιος/σπείρα αντί στεφανιού). */
  readonly isCircular: boolean;
  /** Διάμετρος (mm) — μόνο για `isCircular`. */
  readonly diameterMm?: number;
  /** Ελάχιστο πάχος διατομής (mm) — χαρακτηριστική διάσταση για όρια βήματος/περίσφιγξης. */
  readonly minThicknessMm: number;
  /** Μέγιστη διάσταση διατομής (mm) — μήκος τοιχώματος / μεγάλη πλευρά. */
  readonly maxDimensionMm: number;
  /** Περίμετρος outline (mm). */
  readonly perimeterMm: number;
  /** Μικτό εμβαδόν διατομής Ac (mm²) — shape-correct (όχι width×depth). */
  readonly grossAreaMm2: number;
  /** Πλάτος bbox (local X, mm). */
  readonly bboxWidthMm: number;
  /** Βάθος bbox (local Y, mm). */
  readonly bboxDepthMm: number;
  /**
   * Μοναδιαίος άξονας επιμήκυνσης τοιχώματος σε LOCAL mm ({1,0} ή {0,1}) — μόνο για
   * `mode === 'wall'`· τα boundary elements μπαίνουν στα δύο άκρα κατά τον άξονα αυτόν.
   */
  readonly wallAxis?: Point2D;
}

/** Point2D → ψευδο-Point3D (z=0) για τα polygon-utils (που δουλεύουν σε XY). */
function toXY(p: readonly Point2D[]): { x: number; y: number; z: number }[] {
  return p.map((q) => ({ x: q.x, y: q.y, z: 0 }));
}

/**
 * Ανάλυση διατομής κολώνας → outline + mode + χαρακτηριστικά μεγέθη. SSoT entry
 * point για ΟΛΗ την αλυσίδα οπλισμού.
 */
export function resolveColumnReinforcementSection(params: ColumnParams): ColumnReinforcementSection {
  const outlineMm = materializeColumnLocalPolygonMm(params);
  const xy = toXY(outlineMm);
  const bbox = polygonBbox(xy);
  const bboxWidthMm = Math.max(0, bbox.max.x - bbox.min.x);
  const bboxDepthMm = Math.max(0, bbox.max.y - bbox.min.y);
  const minThicknessMm = Math.min(bboxWidthMm, bboxDepthMm);
  const maxDimensionMm = Math.max(bboxWidthMm, bboxDepthMm);

  const isCircular = params.kind === 'circular';
  const diameterMm = isCircular ? Math.max(0, params.width) : undefined;
  // Εμβαδόν: κυκλική → ακριβές π(d/2)² (το 32-γωνο outline υποεκτιμά)· αλλιώς shoelace.
  const grossAreaMm2 = isCircular
    ? Math.PI * (diameterMm! / 2) ** 2
    : polygonArea(xy);
  const perimeterMm = isCircular ? Math.PI * diameterMm! : polygonPerimeter(xy);

  const mode = resolveMode(params, bboxWidthMm, bboxDepthMm, isCircular);
  const wallAxis = isWallReinforcementMode(mode)
    ? (bboxWidthMm >= bboxDepthMm ? { x: 1, y: 0 } : { x: 0, y: 1 })
    : undefined;

  return {
    kind: params.kind,
    outlineMm,
    mode,
    isCircular,
    diameterMm,
    minThicknessMm,
    maxDimensionMm,
    perimeterMm,
    grossAreaMm2,
    bboxWidthMm,
    bboxDepthMm,
    wallAxis,
  };
}

/**
 * Classifier: `circular` → circular· `shear-wall` ή επίμηκες (λόγος ≥ {@link
 * WALL_ELONGATION_THRESHOLD}) Γ/Τ/Π/σύνθετο → wall· υπόλοιπα → perimeter. Το
 * ορθογώνιο μένει πάντα perimeter (μηδέν regression — επιμήκη ορθογώνια τοιχώματα
 * μοντελοποιούνται ως `shear-wall`).
 */
function resolveMode(
  params: ColumnParams,
  bboxWidthMm: number,
  bboxDepthMm: number,
  isCircular: boolean,
): ColumnReinforcementMode {
  if (isCircular) return 'circular';
  if (params.kind === 'shear-wall') return 'wall';
  if (params.kind === 'rectangular' || params.kind === 'polygon') return 'perimeter';
  const thickness = Math.max(1e-6, Math.min(bboxWidthMm, bboxDepthMm));
  const elongation = Math.max(bboxWidthMm, bboxDepthMm) / thickness;
  return elongation >= WALL_ELONGATION_THRESHOLD ? 'wall' : 'perimeter';
}
