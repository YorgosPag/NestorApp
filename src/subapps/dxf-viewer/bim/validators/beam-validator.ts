/**
 * Beam validator (ADR-363 Phase 5).
 *
 * Pure function — zero React / DOM / Firestore deps. Mirrors column/slab
 * validator SSoT pattern: hard errors block creation, code violations are
 * non-blocking (red badge).
 *
 * Phase 5 scope:
 *   - **Hard errors** (block creation):
 *       · width ≤ 0
 *       · depth ≤ 0
 *       · length < MIN_BEAM_LENGTH_MM (200mm degenerate guard)
 *       · curved kind χωρίς curveControl
 *       · degenerate axis (start ≡ end για straight/cantilever)
 *   - **Code violations** (non-blocking):
 *       · width < MIN_BEAM_WIDTH_MM (150mm Eurocode minimum)
 *       · span/depth ratio > MAX_SPAN_DEPTH_RATIO (20 — slender beam)
 *       · cantilever-specific: span/depth ratio > MAX_CANTILEVER_SPAN_DEPTH_RATIO
 *         (10 — halved threshold για cantilevers)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 */

import { Timestamp } from 'firebase/firestore';
import type { BimValidation } from '../types/bim-base';
import {
  MAX_CANTILEVER_SPAN_DEPTH_RATIO,
  MAX_SPAN_DEPTH_RATIO,
  MIN_BEAM_LENGTH_MM,
  MIN_BEAM_WIDTH_MM,
  type BeamParams,
} from '../types/beam-types';
import { getBeamSpanDepthRatio } from '../geometry/beam-geometry';

/** Result of a beam validation pass — hard errors non-empty when invalid. */
export interface BeamValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge στο property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload για direct assignment στο `BeamEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `BeamParams`. Operates purely σε params — geometry re-derivable.
 */
export function validateBeamParams(params: BeamParams): BeamValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  validateDimensions(params, hardErrors, codeViolations);
  validateAxis(params, hardErrors);
  validateCurveControl(params, hardErrors);
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
  params: BeamParams,
  hardErrors: string[],
  codeViolations: string[],
): void {
  if (params.width <= 0) {
    hardErrors.push('beam.validation.hardErrors.nonPositiveWidth');
  } else if (params.width < MIN_BEAM_WIDTH_MM) {
    codeViolations.push('beam.validation.codeViolations.widthTooSmall');
  }

  if (params.depth <= 0) {
    hardErrors.push('beam.validation.hardErrors.nonPositiveDepth');
  }
}

function validateAxis(params: BeamParams, hardErrors: string[]): void {
  const dx = params.endPoint.x - params.startPoint.x;
  const dy = params.endPoint.y - params.startPoint.y;
  const chord = Math.hypot(dx, dy);
  if (chord < MIN_BEAM_LENGTH_MM) {
    hardErrors.push('beam.validation.hardErrors.lengthTooShort');
  }
}

function validateCurveControl(params: BeamParams, hardErrors: string[]): void {
  if (params.kind === 'curved' && !params.curveControl) {
    hardErrors.push('beam.validation.hardErrors.missingCurveControl');
  }
}

function validateSlenderness(params: BeamParams, codeViolations: string[]): void {
  if (params.depth <= 0) return;
  const ratio = getBeamSpanDepthRatio(params);
  if (!Number.isFinite(ratio)) return;
  const isCantilever = params.kind === 'cantilever';
  const threshold = isCantilever ? MAX_CANTILEVER_SPAN_DEPTH_RATIO : MAX_SPAN_DEPTH_RATIO;
  if (ratio > threshold) {
    codeViolations.push(
      isCantilever
        ? 'beam.validation.codeViolations.cantileverSpanDepthExceeded'
        : 'beam.validation.codeViolations.spanDepthExceeded',
    );
  }
}
