/**
 * Column validator (ADR-363 Phase 4).
 *
 * Pure function — zero React / DOM / Firestore deps. Mirrors slab/opening
 * validator SSoT pattern: hard errors block creation, code violations are
 * non-blocking (red badge).
 *
 * Phase 4 scope:
 *   - **Hard errors** (block creation):
 *       · width ≤ 0
 *       · depth ≤ 0 (μη circular)
 *       · height ≤ 0
 *       · L-shape: armLength/armWidth ≤ 0 ή > αντίστοιχη bbox διάσταση
 *       · T-shape: webThickness/flangeLength ≤ 0 ή > αντίστοιχη bbox διάσταση
 *   - **Code violations** (non-blocking):
 *       · width < MIN_COLUMN_DIMENSION_MM (250mm Eurocode)
 *       · depth < MIN_COLUMN_DIMENSION_MM (250mm Eurocode, μη circular)
 *       · slenderness > MAX_SLENDERNESS_RATIO (30 Eurocode crude check)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

import { Timestamp } from 'firebase/firestore';
import type { BimValidation } from '../types/bim-base';
import {
  MAX_SLENDERNESS_RATIO,
  MIN_COLUMN_DIMENSION_MM,
  type ColumnParams,
} from '../types/column-types';
import { getColumnSlenderness } from '../geometry/column-geometry';

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
 */
export function validateColumnParams(params: ColumnParams): ColumnValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  validateDimensions(params, hardErrors, codeViolations);
  validateHeight(params, hardErrors);
  validateVariantParams(params, hardErrors);
  validateSlenderness(params, codeViolations);

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: Timestamp.now(),
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
  } else if (params.width < MIN_COLUMN_DIMENSION_MM) {
    codeViolations.push('column.validation.codeViolations.widthTooSmall');
  }

  if (params.kind === 'circular') return;

  if (params.depth <= 0) {
    hardErrors.push('column.validation.hardErrors.nonPositiveDepth');
  } else if (params.depth < MIN_COLUMN_DIMENSION_MM) {
    codeViolations.push('column.validation.codeViolations.depthTooSmall');
  }
}

function validateHeight(params: ColumnParams, hardErrors: string[]): void {
  if (params.height <= 0) {
    hardErrors.push('column.validation.hardErrors.nonPositiveHeight');
  }
}

function validateVariantParams(params: ColumnParams, hardErrors: string[]): void {
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
}

function validateSlenderness(params: ColumnParams, codeViolations: string[]): void {
  const ratio = getColumnSlenderness(params);
  if (ratio > MAX_SLENDERNESS_RATIO && Number.isFinite(ratio)) {
    codeViolations.push('column.validation.codeViolations.maxSlendernessExceeded');
  }
}
