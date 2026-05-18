/**
 * Slab validator (ADR-363 Phase 3).
 *
 * Pure function — zero React / DOM / Firestore deps. Mirrors wall/opening
 * validator SSoT pattern: hard errors block creation, code violations are
 * non-blocking (red badge).
 *
 * Phase 3 scope:
 *   - **Hard errors** (block creation):
 *       · vertices.length < MIN_POLYGON_VERTICES (3)
 *       · polygon self-intersecting
 *       · thickness ≤ 0
 *       · area = 0 (degenerate)
 *   - **Code violations** (non-blocking):
 *       · thickness < MIN_SLAB_THICKNESS_MM (100mm)
 *       · bbox max dimension > MAX_FREE_SPAN_WARNING_M (5m) — crude span check
 *       · ceiling/roof kind με elevation = 0 (typically > 0)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 */

import { Timestamp } from 'firebase/firestore';
import type { BimValidation } from '../types/bim-base';
import {
  MAX_FREE_SPAN_WARNING_M,
  MIN_POLYGON_VERTICES,
  MIN_SLAB_THICKNESS_MM,
  type SlabParams,
} from '../types/slab-types';
import { getSlabMaxBboxDimensionM } from '../geometry/slab-geometry';
import {
  isPolygonSelfIntersecting,
  polygonArea,
} from '../geometry/shared/polygon-utils';

/** Result of a slab validation pass — hard errors non-empty when invalid. */
export interface SlabValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge στο property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload για direct assignment στο `SlabEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `SlabParams`. Operates purely σε params — geometry re-derivable.
 */
export function validateSlabParams(params: SlabParams): SlabValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  validateOutline(params, hardErrors);
  validateThickness(params, hardErrors, codeViolations);
  validateSpan(params, codeViolations);
  validateElevation(params, codeViolations);

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: Timestamp.now(),
  };

  return { hardErrors, codeViolations, bimValidation };
}

// ─── Internal checks ────────────────────────────────────────────────────────

function validateOutline(params: SlabParams, hardErrors: string[]): void {
  const verts = params.outline.vertices;
  if (verts.length < MIN_POLYGON_VERTICES) {
    hardErrors.push('slab.validation.hardErrors.tooFewVertices');
    return;
  }
  if (isPolygonSelfIntersecting(verts)) {
    hardErrors.push('slab.validation.hardErrors.selfIntersecting');
  }
  const areaMm2 = polygonArea(verts);
  if (areaMm2 <= 1e-3) {
    hardErrors.push('slab.validation.hardErrors.zeroArea');
  }
}

function validateThickness(
  params: SlabParams,
  hardErrors: string[],
  codeViolations: string[],
): void {
  if (params.thickness <= 0) {
    hardErrors.push('slab.validation.hardErrors.nonPositiveThickness');
    return;
  }
  if (params.thickness < MIN_SLAB_THICKNESS_MM) {
    codeViolations.push('slab.validation.codeViolations.thicknessTooThin');
  }
}

function validateSpan(params: SlabParams, codeViolations: string[]): void {
  if (params.outline.vertices.length < MIN_POLYGON_VERTICES) return;
  const maxDimM = getSlabMaxBboxDimensionM(params);
  if (maxDimM > MAX_FREE_SPAN_WARNING_M) {
    codeViolations.push('slab.validation.codeViolations.maxFreeSpanExceeded');
  }
}

function validateElevation(params: SlabParams, codeViolations: string[]): void {
  if ((params.kind === 'ceiling' || params.kind === 'roof') && params.elevation === 0) {
    codeViolations.push('slab.validation.codeViolations.ceilingRoofAtZeroElevation');
  }
}
