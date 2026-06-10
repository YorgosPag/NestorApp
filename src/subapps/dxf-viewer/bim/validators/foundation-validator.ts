/**
 * Foundation validator (ADR-436, Slice 1).
 *
 * Pure function — zero React / DOM / Firestore deps. Mirrors το column/slab
 * validator SSoT pattern: hard errors block creation, code violations are
 * non-blocking (red badge). i18n keys only — μηδέν hardcoded strings (N.11).
 *
 * Hard errors (block creation):
 *   · pad:            width ≤ 0, length ≤ 0
 *   · strip/tie-beam: width ≤ 0, μηδενικού μήκους άξονας (start == end)
 *   · all:            thickness ≤ 0
 *
 * Code violations (non-blocking):
 *   · διάσταση < MIN_FOUNDATION_DIMENSION_MM
 *   · πάχος < MIN_FOUNDATION_THICKNESS_MM
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation } from '../types/bim-base';
import {
  MIN_FOUNDATION_DIMENSION_MM,
  MIN_FOUNDATION_THICKNESS_MM,
  type FoundationParams,
} from '../types/foundation-types';

/** Result of a foundation validation pass — hard errors non-empty when invalid. */
export interface FoundationValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge στο property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload για direct assignment στο `FoundationEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `FoundationParams`. Operates purely σε params — geometry re-derivable.
 */
export function validateFoundationParams(params: FoundationParams): FoundationValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  validateWidth(params, hardErrors, codeViolations);
  validateKindSpecific(params, hardErrors, codeViolations);
  validateThickness(params, hardErrors, codeViolations);

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}

// ─── Internal checks ────────────────────────────────────────────────────────

function validateWidth(
  params: FoundationParams,
  hardErrors: string[],
  codeViolations: string[],
): void {
  if (params.width <= 0) {
    hardErrors.push('foundation.validation.hardErrors.nonPositiveWidth');
  } else if (params.width < MIN_FOUNDATION_DIMENSION_MM) {
    codeViolations.push('foundation.validation.codeViolations.widthTooSmall');
  }
}

function validateKindSpecific(
  params: FoundationParams,
  hardErrors: string[],
  codeViolations: string[],
): void {
  if (params.kind === 'pad') {
    if (params.length <= 0) {
      hardErrors.push('foundation.validation.hardErrors.nonPositiveLength');
    } else if (params.length < MIN_FOUNDATION_DIMENSION_MM) {
      codeViolations.push('foundation.validation.codeViolations.lengthTooSmall');
    }
    return;
  }
  // strip / tie-beam: degenerate axis (start == end) → no length.
  const dx = params.end.x - params.start.x;
  const dy = params.end.y - params.start.y;
  if (Math.hypot(dx, dy) < 1e-6) {
    hardErrors.push('foundation.validation.hardErrors.zeroLengthAxis');
  }
}

function validateThickness(
  params: FoundationParams,
  hardErrors: string[],
  codeViolations: string[],
): void {
  if (params.thicknessMm <= 0) {
    hardErrors.push('foundation.validation.hardErrors.nonPositiveThickness');
  } else if (params.thicknessMm < MIN_FOUNDATION_THICKNESS_MM) {
    codeViolations.push('foundation.validation.codeViolations.thicknessTooSmall');
  }
}
