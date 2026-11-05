/**
 * SSoT — «ποια τοποθέτηση της εικόνας υποβάθρου κάνει τα γνωστά μήκη του σχεδίου να μετρούν σωστά;»
 *
 * 🔴 **Γιατί υπάρχει (ADR-929 Φ5.2, 2026-11-05).** Η απάντηση ζούσε μέσα στο `useCalibration` ως
 * `scaleFactor = realDistMm / dWorld`, δηλαδή με **κρυφή υπόθεση** ότι μία μονάδα σκηνής είναι ένα
 * χιλιοστό. Σε σκηνή σε μέτρα η εικόνα έβγαινε **1000×** μεγάλη (ADR-929 §6.1 #1, επιβεβαιωμένο ζωντανά
 * στο nestorconstruct.gr). Επιπλέον η κλίμακα εφαρμοζόταν γύρω από την αρχή της εικόνας, άρα το σημείο
 * που έδειξε ο χρήστης «πηδούσε». Εδώ η απάντηση είναι **καθαρή** συνάρτηση, με τις μονάδες ρητές.
 *
 * 🔑 **Η γεωμετρία** (`raster-scene-mapping.ts`): `σκηνή = T · R · S(sx, sy) · A · p`. Η περιστροφή δεν
 * αλλάζει μήκη, άρα ένα τμήμα εικόνας `(dx, dy)` σε pixel έχει στη σκηνή μήκος `√((sx·dx)² + (sy·dy)²)`.
 *
 * - **Μία αναφορά** (Revit «Resize graphically», ArchiCAD «Define graphically»): ενιαία κλίμακα.
 * - **Δύο αναφορές, κατά προσέγγιση σε διαφορετικούς άξονες της εικόνας**: χωριστή κλίμακα X/Y — λύνεται
 *   γραμμικά ως προς `sx²`, `sy²`. Αυτό διορθώνει το τέντωμα 1–2% του σαρωτή σε έναν άξονα, που ο Revit
 *   και το ArchiCAD **δεν** διορθώνουν (ενιαία κλίμακα μόνο).
 * - **Δύο αναφορές, ίδιος άξονας**: ενιαία κλίμακα ελαχίστων τετραγώνων + υπόλοιπο ανά αναφορά — ο
 *   έλεγχος «μέτρα μια δεύτερη διάσταση» του Bluebeam, αλλά αυτόματος.
 * - **Άγκυρα**: το πρώτο σημείο της πρώτης αναφοράς μένει στη θέση του (Revit: κλιμάκωση γύρω από το
 *   πρώτο κλικ).
 * - **Ευθυγράμμιση** (προαιρετική): περιστροφή ώστε η πρώτη αναφορά να γίνει οριζόντια **ή** κατακόρυφη —
 *   ό,τι είναι πλησιέστερο. Η παλιά επιλογή έκανε **πάντα** την αναφορά οριζόντια, δηλαδή στρεφόταν η
 *   εικόνα κατά 90° όταν ο χρήστης έδειχνε κατακόρυφη διάσταση.
 *
 * ΚΑΘΑΡΟ (pure) — μηδέν React/store/DOM. Αποτυχία = ρητός λόγος, ποτέ σιωπηλό `NaN` (ADR-929 αρχή 4).
 *
 * @module subapps/dxf-viewer/floorplan-background/geometry/calibration-solve
 * @see ./raster-scene-mapping.ts — η ΜΟΝΗ αντιστοίχιση pixel ↔ σκηνή (Δ3)
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md — §6.6 Φ5.2
 */

import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { normalizeAngleDeg, RADIANS_TO_DEGREES } from '../../rendering/entities/shared/geometry-angle-utils';
import type { BackgroundTransform } from '../providers/types';
import { rasterPixelToScene, sceneToRasterPixel, type RasterPlacement } from './raster-scene-mapping';

/** Τα κατώφλια της βαθμονόμησης — ΜΙΑ δήλωση, τη διαβάζουν και ο επιλυτής και το UI. */
export const CALIBRATION_LIMITS = {
  /** Κάτω από αυτό το μήκος (pixel εικόνας) η αναφορά δεν μετρά τίποτα αξιόπιστα. */
  minReferencePx: 2,
  /**
   * Πόσο «ορθογώνιες ως προς τους άξονες της εικόνας» πρέπει να είναι δύο αναφορές για χωριστή κλίμακα
   * X/Y: ορίζουσα κανονικοποιημένη στο [0, 1] (1 = η μία καθαρά οριζόντια, η άλλη καθαρά κατακόρυφη).
   * Δύο λοξές κάθετες (45° / 135°) δίνουν 0 — δεν χωρίζουν τους άξονες, άρα ενιαία κλίμακα.
   */
  perAxisMinConditioning: 0.5,
  /** Ανισοτροπία πάνω από αυτό είναι πιθανότερα λάθος αναφορά παρά τέντωμα σαρωτή (~1–2%). */
  anisotropyWarnRel: 0.03,
  /** Υπόλοιπο αναφοράς πάνω από αυτό ⇒ προειδοποίηση (Bluebeam: < 1%). */
  residualWarnRel: 0.01,
} as const;

/** Μία γνωστή απόσταση πάνω στην εικόνα. */
export interface CalibrationReferenceInput {
  /** Άκρα σε φυσικά pixel της εικόνας (Y προς τα κάτω). */
  readonly a: Point2D;
  readonly b: Point2D;
  /** Το πραγματικό μήκος, σε χιλιοστά. */
  readonly lengthMm: number;
}

export type CalibrationReferences =
  | readonly [CalibrationReferenceInput]
  | readonly [CalibrationReferenceInput, CalibrationReferenceInput];

export interface CalibrationSolveInput {
  /** Η τρέχουσα τοποθέτηση — από εκεί παίρνει η άγκυρα τη θέση της στη σκηνή. */
  readonly placement: RasterPlacement;
  readonly references: CalibrationReferences;
  /** Οι μονάδες της σκηνής στην οποία κάθεται η εικόνα (`resolveSceneUnits`). */
  readonly sceneUnits: SceneUnits;
  /** Περιστροφή ώστε η πρώτη αναφορά να γίνει οριζόντια ή κατακόρυφη. */
  readonly alignToAxis: boolean;
}

export type CalibrationScaleMode = 'uniform' | 'per-axis';

export interface CalibrationSolution {
  readonly transform: BackgroundTransform;
  readonly mode: CalibrationScaleMode;
  /** `|sx/sy − 1|` — 0 στην ενιαία κλίμακα. */
  readonly anisotropyRel: number;
  /** Ανά αναφορά: `μετρημένο / δοσμένο − 1` με τη λυμένη τοποθέτηση. */
  readonly residualsRel: readonly number[];
  readonly mmPerPixelX: number;
  readonly mmPerPixelY: number;
}

export type CalibrationSolveFailure =
  | 'degenerate-placement'
  | 'degenerate-reference'
  | 'inconsistent-references';

export type CalibrationSolveResult =
  | { readonly ok: true; readonly solution: CalibrationSolution }
  | { readonly ok: false; readonly reason: CalibrationSolveFailure };

interface AxisScales {
  readonly sx: number;
  readonly sy: number;
  readonly mode: CalibrationScaleMode;
}

interface ReferenceDelta {
  readonly dx: number;
  readonly dy: number;
  /** Πραγματικό μήκος σε μονάδες σκηνής. */
  readonly length: number;
}

function deltaOf(ref: CalibrationReferenceInput, mmToScene: number): ReferenceDelta {
  return { dx: ref.b.x - ref.a.x, dy: ref.b.y - ref.a.y, length: ref.lengthMm * mmToScene };
}

function isUsable(d: ReferenceDelta): boolean {
  return Number.isFinite(d.length) && d.length > 0
    && Math.hypot(d.dx, d.dy) >= CALIBRATION_LIMITS.minReferencePx;
}

/** Ενιαία κλίμακα ελαχίστων τετραγώνων: `s = Σ Lᵢ·dᵢ / Σ dᵢ²` (με μία αναφορά: `L / d`). */
function uniformScale(deltas: readonly ReferenceDelta[]): AxisScales {
  let num = 0;
  let den = 0;
  for (const d of deltas) {
    const px = Math.hypot(d.dx, d.dy);
    num += d.length * px;
    den += px * px;
  }
  const s = num / den;
  return { sx: s, sy: s, mode: 'uniform' };
}

/** Πόσο χωρίζουν οι δύο αναφορές τους άξονες της εικόνας — κανονικοποιημένη ορίζουσα στο [0, 1]. */
function axisConditioning(p: ReferenceDelta, q: ReferenceDelta): number {
  const [px2, py2, qx2, qy2] = [p.dx * p.dx, p.dy * p.dy, q.dx * q.dx, q.dy * q.dy];
  const norm = (px2 + py2) * (qx2 + qy2);
  return norm > 0 ? Math.abs(px2 * qy2 - py2 * qx2) / norm : 0;
}

/** Χωριστή κλίμακα: `Lᵢ² = sx²·dxᵢ² + sy²·dyᵢ²` — γραμμικό σύστημα 2×2 ως προς `sx²`, `sy²`. */
function perAxisScale(p: ReferenceDelta, q: ReferenceDelta): AxisScales | null {
  const [px2, py2, qx2, qy2] = [p.dx * p.dx, p.dy * p.dy, q.dx * q.dx, q.dy * q.dy];
  const det = px2 * qy2 - py2 * qx2;
  const lp = p.length * p.length;
  const lq = q.length * q.length;
  const sx2 = (lp * qy2 - py2 * lq) / det;
  const sy2 = (px2 * lq - lp * qx2) / det;
  if (!(sx2 > 0) || !(sy2 > 0)) return null;
  return { sx: Math.sqrt(sx2), sy: Math.sqrt(sy2), mode: 'per-axis' };
}

function solveScales(deltas: readonly ReferenceDelta[]): AxisScales | null {
  if (deltas.length === 2) {
    const [p, q] = deltas;
    if (axisConditioning(p, q) >= CALIBRATION_LIMITS.perAxisMinConditioning) return perAxisScale(p, q);
  }
  return uniformScale(deltas);
}

/** Η γωνία (μοίρες) της πρώτης αναφοράς στη σκηνή, με τις νέες κλίμακες και την τρέχουσα περιστροφή. */
function sceneAngleDeg(d: ReferenceDelta, scales: AxisScales, rotationDeg: number): number {
  // Η σύμβαση `cad-y-up` αναποδογυρίζει το Y της εικόνας πριν την κλίμακα (`A`).
  const local = Math.atan2(-d.dy * scales.sy, d.dx * scales.sx) * RADIANS_TO_DEGREES;
  return local + rotationDeg;
}

/** Περιστροφή που φέρνει την αναφορά στον πλησιέστερο άξονα (0°/90°/180°/270°). */
function alignedRotation(d: ReferenceDelta, scales: AxisScales, rotationDeg: number): number {
  const angle = sceneAngleDeg(d, scales, rotationDeg);
  const nearestAxis = Math.round(angle / 90) * 90;
  return normalizeAngleDeg(rotationDeg - (angle - nearestAxis));
}

/** Μετατόπιση ώστε το pixel-άγκυρα να μείνει στο ίδιο σημείο της σκηνής. */
function anchoredTransform(
  placement: RasterPlacement,
  anchorPixel: Point2D,
  scaled: Omit<BackgroundTransform, 'translateX' | 'translateY'>,
): BackgroundTransform {
  const target = rasterPixelToScene(anchorPixel, placement);
  const origin = rasterPixelToScene(anchorPixel, {
    naturalBounds: placement.naturalBounds,
    transform: { ...scaled, translateX: 0, translateY: 0 },
  });
  return { ...scaled, translateX: target.x - origin.x, translateY: target.y - origin.y };
}

function residualsOf(deltas: readonly ReferenceDelta[], scales: AxisScales): number[] {
  return deltas.map((d) => Math.hypot(d.dx * scales.sx, d.dy * scales.sy) / d.length - 1);
}

/**
 * Λύνει τη βαθμονόμηση. Η νέα τοποθέτηση **αντικαθιστά** την κλίμακα (δεν πολλαπλασιάζει την παλιά):
 * οι αναφορές είναι σε pixel της εικόνας, άρα η απάντηση δεν εξαρτάται από το πού βρισκόταν πριν.
 */
export function solveCalibration(input: CalibrationSolveInput): CalibrationSolveResult {
  const { placement, references, sceneUnits, alignToAxis } = input;
  const mmToScene = mmToSceneUnits(sceneUnits);
  const deltas = references.map((ref) => deltaOf(ref, mmToScene));
  if (!deltas.every(isUsable)) return { ok: false, reason: 'degenerate-reference' };
  // Εκφυλισμένη τοποθέτηση (π.χ. `scaleX = 0`): η άγκυρα δεν έχει αξιόπιστη θέση στη σκηνή.
  if (!sceneToRasterPixel({ x: 0, y: 0 }, placement)) return { ok: false, reason: 'degenerate-placement' };

  const scales = solveScales(deltas);
  if (!scales) return { ok: false, reason: 'inconsistent-references' };

  const current = placement.transform.rotation;
  const rotation = alignToAxis ? alignedRotation(deltas[0], scales, current) : current;
  const transform = anchoredTransform(placement, references[0].a, { scaleX: scales.sx, scaleY: scales.sy, rotation });
  return {
    ok: true,
    solution: {
      transform,
      mode: scales.mode,
      anisotropyRel: Math.abs(scales.sx / scales.sy - 1),
      residualsRel: residualsOf(deltas, scales),
      mmPerPixelX: scales.sx / mmToScene,
      mmPerPixelY: scales.sy / mmToScene,
    },
  };
}

/** Χρειάζεται ο άνθρωπος να κοιτάξει ξανά; (ανισοτροπία ή υπόλοιπο πάνω από το κατώφλι). */
export function calibrationNeedsReview(solution: CalibrationSolution): boolean {
  return solution.anisotropyRel > CALIBRATION_LIMITS.anisotropyWarnRel
    || solution.residualsRel.some((r) => Math.abs(r) > CALIBRATION_LIMITS.residualWarnRel);
}
