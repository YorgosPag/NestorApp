/**
 * Column validator (ADR-363 Phase 4 + Phase 8 extension).
 *
 * Pure function — zero React / DOM / Firestore deps. Mirrors slab/opening
 * validator SSoT pattern: hard errors block creation, code violations are
 * non-blocking (red badge).
 *
 * Phase 4 scope:
 *   - **Hard errors** (block creation):
 *       · width ≤ 0
 *       · depth ≤ 0 (μη circular/polygon)
 *       · height ≤ 0
 *       · L-shape: armLength/armWidth ≤ 0 ή > αντίστοιχη bbox διάσταση
 *       · T-shape: webThickness/flangeLength ≤ 0 ή > αντίστοιχη bbox διάσταση
 *   - **Code violations** (non-blocking):
 *       · width < MIN_COLUMN_DIMENSION_MM (250mm Eurocode, εκτός shear-wall)
 *       · depth < MIN_COLUMN_DIMENSION_MM (250mm Eurocode, εκτός shear-wall/circular/polygon)
 *       · slenderness > MAX_SLENDERNESS_RATIO (30 Eurocode crude check)
 *
 * Phase 8 extension (polygon / shear-wall / I-shape):
 *   - **Hard errors**:
 *       · polygon: sides ∉ [3,12] ή μη ακέραιος
 *       · I-shape: flangeThickness/webThickness < MIN_I_PLATE_THICKNESS_MM (5mm)
 *       · I-shape: 2·tf ≥ depth (flanges overlap) ή web ≥ flange (degenerate)
 *   - **Code violations**:
 *       · shear-wall: thickness (=depth) < MIN_SHEAR_WALL_THICKNESS_MM (150mm
 *         Eurocode 8 §5.4.2.4) — relaxed από το 250mm column minimum.
 *       · shear-wall: length/thickness < SHEAR_WALL_MIN_ASPECT_RATIO (4) —
 *         κάτω από αυτό = κανονική κολώνα, ο user πρέπει να αλλάξει kind.
 *
 * Phase 2 extension «από περίγραμμα» (U-shape / composite — polygon-backed τοιχία ΟΣ):
 *   - **Hard errors**:
 *       · composite / U-shape(polygon): polygon < 3 κορυφές ή εκφυλισμένο εμβαδόν
 *       · U-shape(παραμετρικό): legThickness/baseThickness ≤ 0 ή εκτός bbox
 *   - **Code violations**:
 *       · U-shape: ελάχιστο πάχος μέλους < MIN_SHEAR_WALL_THICKNESS_MM (Eurocode 8)
 *       · width/depth relaxed (τοιχώματα — όπως shear-wall)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation } from '../types/bim-base';
import {
  MAX_SLENDERNESS_RATIO,
  MIN_COLUMN_DIMENSION_MM,
  MIN_POLYGON_SIDES,
  MAX_POLYGON_SIDES,
  MIN_SHEAR_WALL_THICKNESS_MM,
  SHEAR_WALL_MIN_ASPECT_RATIO,
  MIN_I_PLATE_THICKNESS_MM,
  MIN_SECTION_CORNER_ANGLE_DEG,
  type ColumnParams,
} from '../types/column-types';
import { getColumnSlenderness } from '../geometry/column-geometry';
import { polygonArea, minPolygonInteriorAngleDeg } from '../geometry/shared/polygon-utils';
import { resolveStructuralCode, type StructuralCodeId } from '../structural/codes';
import { resolveActiveColumnReinforcement } from '../structural/section-context';
import { computeColumnReinforcementQuantities } from '../structural/reinforcement/column-reinforcement-compute';
import { resolveColumnReinforcementSection } from '../structural/reinforcement/column-section-outline';

/** Result of a column validation pass — hard errors non-empty when invalid. */
export interface ColumnValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge στο property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload για direct assignment στο `ColumnEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `ColumnParams`. Operates purely σε params — geometry re-derivable.
 * `codeId` (ADR-456) επιλέγει τον κανονισμό για τους ελέγχους ποσοστού οπλισμού
 * (default = Ευρωκώδικες). Όταν δεν έχει οριστεί οπλισμός, ο έλεγχος παραλείπεται.
 */
export function validateColumnParams(
  params: ColumnParams,
  codeId?: StructuralCodeId,
): ColumnValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  validateDimensions(params, hardErrors, codeViolations);
  validateHeight(params, hardErrors);
  validateVariantParams(params, hardErrors, codeViolations);
  validateSlenderness(params, codeViolations);
  validateReinforcementRatio(params, codeId, codeViolations);

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}

// ─── Internal checks ────────────────────────────────────────────────────────

function validateDimensions(
  params: ColumnParams,
  hardErrors: string[],
  codeViolations: string[],
): void {
  if (params.width <= 0) {
    hardErrors.push('column.validation.hardErrors.nonPositiveWidth');
  } else if (params.width < MIN_COLUMN_DIMENSION_MM && !isRelaxedWidth(params)) {
    codeViolations.push('column.validation.codeViolations.widthTooSmall');
  }

  // Circular + polygon have a single planar dimension (diameter / circumscribed Ø);
  // depth is ignored in geometry and must not trigger a code violation.
  if (params.kind === 'circular' || params.kind === 'polygon') return;

  if (params.depth <= 0) {
    hardErrors.push('column.validation.hardErrors.nonPositiveDepth');
  } else if (params.depth < MIN_COLUMN_DIMENSION_MM && !isRelaxedDepth(params)) {
    codeViolations.push('column.validation.codeViolations.depthTooSmall');
  }
}

/**
 * shear-wall reuses ColumnParams.width (= wall length); standard 250mm minimum
 * is irrelevant — code-grade walls can be as wide as the user wants.
 */
function isRelaxedWidth(params: ColumnParams): boolean {
  // shear-wall + τοιχία ΟΣ (U-shape/composite) είναι τοιχώματα: το 250mm column
  // minimum δεν ισχύει — διέπονται από Eurocode 8 §5.4.2.4 (150mm).
  return params.kind === 'shear-wall' || params.kind === 'U-shape' || params.kind === 'composite';
}

/**
 * shear-wall depth = thickness; Eurocode 8 §5.4.2.4 minimum is 150mm, enforced
 * separately in `validateVariantParams`.
 */
function isRelaxedDepth(params: ColumnParams): boolean {
  return params.kind === 'shear-wall' || params.kind === 'U-shape' || params.kind === 'composite';
}

function validateHeight(params: ColumnParams, hardErrors: string[]): void {
  if (params.height <= 0) {
    hardErrors.push('column.validation.hardErrors.nonPositiveHeight');
  }
}

function validateVariantParams(
  params: ColumnParams,
  hardErrors: string[],
  codeViolations: string[],
): void {
  if (params.kind === 'L-shape' && params.lshape) {
    const { armLength, armWidth } = params.lshape;
    if (armLength !== undefined && (armLength <= 0 || armLength > params.depth)) {
      hardErrors.push('column.validation.hardErrors.invalidLshapeArm');
    }
    if (armWidth !== undefined && (armWidth <= 0 || armWidth > params.width)) {
      hardErrors.push('column.validation.hardErrors.invalidLshapeArm');
    }
  }
  if (params.kind === 'T-shape' && params.tshape) {
    const { webThickness, flangeLength } = params.tshape;
    if (webThickness !== undefined && (webThickness <= 0 || webThickness > params.width)) {
      hardErrors.push('column.validation.hardErrors.invalidTshapeWeb');
    }
    if (flangeLength !== undefined && (flangeLength <= 0 || flangeLength > params.width)) {
      hardErrors.push('column.validation.hardErrors.invalidTshapeFlange');
    }
  }
  if (params.kind === 'polygon') {
    validatePolygonParams(params, hardErrors);
  }
  if (params.kind === 'shear-wall') {
    validateShearWallParams(params, codeViolations);
  }
  if (params.kind === 'I-shape') {
    validateIShapeParams(params, hardErrors);
  }
  if (params.kind === 'U-shape') {
    validateUshapeParams(params, hardErrors, codeViolations);
  }
  if (params.kind === 'composite') {
    validateCompositeParams(params, hardErrors, codeViolations);
  }
}

function validatePolygonParams(params: ColumnParams, hardErrors: string[]): void {
  const sides = params.polygon?.sides;
  if (sides === undefined) return;
  if (!Number.isInteger(sides) || sides < MIN_POLYGON_SIDES || sides > MAX_POLYGON_SIDES) {
    hardErrors.push('column.validation.hardErrors.invalidPolygonSides');
  }
}

/**
 * Eurocode 8 §5.4.2.4 thresholds for ductile RC shear walls.
 *   - thickness (= depth) ≥ 150mm.
 *   - aspect ratio (length / thickness) ≥ 4 to qualify as a wall (below this
 *     it behaves as a regular column and the user should switch kind).
 */
function validateShearWallParams(params: ColumnParams, codeViolations: string[]): void {
  if (params.depth > 0 && params.depth < MIN_SHEAR_WALL_THICKNESS_MM) {
    codeViolations.push('column.validation.codeViolations.shearWallThicknessTooSmall');
  }
  if (params.width > 0 && params.depth > 0) {
    const aspect = params.width / params.depth;
    if (aspect < SHEAR_WALL_MIN_ASPECT_RATIO) {
      codeViolations.push('column.validation.codeViolations.shearWallAspectRatioBelow');
    }
  }
}

/**
 * I-shape (steel double-T) sanity rules. Steel sections degenerate if plates
 * are too thin, if flanges overlap (2·tf ≥ h), or if the web is wider than the
 * flange it joins. These are geometry-validity checks, not Eurocode limits —
 * material design checks live downstream in section-design libraries.
 */
function validateIShapeParams(params: ColumnParams, hardErrors: string[]): void {
  const tf = params.ishape?.flangeThickness;
  const tw = params.ishape?.webThickness;
  if (tf !== undefined && tf < MIN_I_PLATE_THICKNESS_MM) {
    hardErrors.push('column.validation.hardErrors.invalidIShapePlateThickness');
  }
  if (tw !== undefined && tw < MIN_I_PLATE_THICKNESS_MM) {
    hardErrors.push('column.validation.hardErrors.invalidIShapePlateThickness');
  }
  if (tf !== undefined && params.depth > 0 && 2 * tf >= params.depth) {
    hardErrors.push('column.validation.hardErrors.invalidIShapeFlangeOverlap');
  }
  if (tw !== undefined && params.width > 0 && tw >= params.width) {
    hardErrors.push('column.validation.hardErrors.invalidIShapeWebOverflow');
  }
}

/**
 * U-shape (Π/κανάλι τοιχείο ΟΣ) — ADR-363 Phase 2.
 * Polygon-backed (explicit polygon) → έλεγχος εγκυρότητας πολυγώνου. Παραμετρικό
 * → πάχη ποδιού/βάσης εντός bbox + Eurocode 8 §5.4.2.4 ελάχιστο πάχος 150mm.
 */
function validateUshapeParams(
  params: ColumnParams,
  hardErrors: string[],
  codeViolations: string[],
): void {
  const u = params.ushape;
  if (u?.polygon) {
    if (u.polygon.length < 3 || Math.abs(polygonArea(u.polygon.map((p) => ({ ...p, z: 0 })))) <= 0) {
      hardErrors.push('column.validation.hardErrors.invalidCompositePolygon');
    }
    return;
  }
  const { legThickness, baseThickness } = u ?? {};
  if (legThickness !== undefined && (legThickness <= 0 || 2 * legThickness > params.width)) {
    hardErrors.push('column.validation.hardErrors.invalidUshapeLeg');
  }
  if (baseThickness !== undefined && (baseThickness <= 0 || baseThickness > params.depth)) {
    hardErrors.push('column.validation.hardErrors.invalidUshapeBase');
  }
  const legEff = legThickness ?? params.width / 4;
  const baseEff = baseThickness ?? params.depth / 3;
  if (Math.min(legEff, baseEff) < MIN_SHEAR_WALL_THICKNESS_MM) {
    codeViolations.push('column.validation.codeViolations.shearWallThicknessTooSmall');
  }
}

/**
 * Composite (αυθαίρετη σύνθετη διατομή) — ADR-363 Phase 2 + 449 free reshape. ΠΑΝΤΑ polygon-backed:
 * hard error αν <3 κορυφές ή εκφυλισμένο εμβαδόν. Code violation (non-blocking) αν το free per-corner
 * reshape έφτιαξε αιχμηρή «σφήνα» (ελάχιστη γωνία κορυφής < `MIN_SECTION_CORNER_ANGLE_DEG`) —
 * γεωμετρικά έγκυρη αλλά μη-κατασκευάσιμη (οπλισμός/συμπύκνωση), βλ. απάντηση στατικής.
 */
function validateCompositeParams(
  params: ColumnParams,
  hardErrors: string[],
  codeViolations: string[],
): void {
  const poly = params.composite?.polygon;
  if (!poly || poly.length < 3 || Math.abs(polygonArea(poly.map((p) => ({ ...p, z: 0 })))) <= 0) {
    hardErrors.push('column.validation.hardErrors.invalidCompositePolygon');
    return;
  }
  if (minPolygonInteriorAngleDeg(poly) < MIN_SECTION_CORNER_ANGLE_DEG) {
    codeViolations.push('column.validation.codeViolations.sectionAngleTooAcute');
  }
}

function validateSlenderness(params: ColumnParams, codeViolations: string[]): void {
  const ratio = getColumnSlenderness(params);
  if (ratio > MAX_SLENDERNESS_RATIO && Number.isFinite(ratio)) {
    codeViolations.push('column.validation.codeViolations.maxSlendernessExceeded');
  }
}

/**
 * ADR-456/460 — έλεγχος ποσοστού διαμήκους οπλισμού ρ = As/Ac έναντι των ορίων του
 * επιλεγμένου κανονισμού (ρ_min/ρ_max), για **οποιοδήποτε σχήμα** διατομής. Το Ac
 * (+ χαρακτηριστικά μεγέθη + mode) προκύπτουν shape-correct από το section outline
 * (ADR-460). No-op όταν δεν έχει οριστεί οπλισμός ή εκφυλισμένη διατομή.
 */
function validateReinforcementRatio(
  params: ColumnParams,
  codeId: StructuralCodeId | undefined,
  codeViolations: string[],
): void {
  if (params.width <= 0 || params.depth <= 0) return;
  const provider = resolveStructuralCode(codeId);
  // ADR-456/460 (Giorgio 2026-06-16) — auto-mode ⇒ ο έλεγχος ρ τρέχει στο φρέσκο
  // (real-time) design της τρέχουσας γεωμετρίας, όχι σε παγωμένο stored.
  const r = resolveActiveColumnReinforcement(params, provider);
  if (!r) return;

  const section = resolveColumnReinforcementSection(params);
  if (section.grossAreaMm2 <= 0) return;
  const ctx = {
    widthMm: section.bboxWidthMm,
    depthMm: section.bboxDepthMm,
    heightMm: params.height,
    grossAreaMm2: section.grossAreaMm2,
    minThicknessMm: section.minThicknessMm,
    maxDimensionMm: section.maxDimensionMm,
    perimeterMm: section.perimeterMm,
    mode: section.mode,
  };
  const { ratio } = computeColumnReinforcementQuantities(ctx, r, undefined, section);
  const limits = provider.columnReinforcementLimits(ctx, r.longitudinal.diameterMm);

  if (ratio < limits.minRatio) {
    codeViolations.push('column.validation.codeViolations.reinforcementRatioBelowMin');
  } else if (ratio > limits.maxRatio) {
    codeViolations.push('column.validation.codeViolations.reinforcementRatioAboveMax');
  }
}
