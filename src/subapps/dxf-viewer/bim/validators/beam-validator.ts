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
 *       · ADR-475 — βέλος (serviceability): span/d_eff > K · basic (EC2 §7.4.2,
 *         d_eff = 0.9·h), K ανά συνθήκη στήριξης (αμφιέρειστη 1.0 / αμφίπακτη 1.5 /
 *         πρόβολος 0.4). Πιάνει οριακά ανεπαρκείς διατομές που το παλιό flat span/h
 *         άφηνε σιωπηλές. Με auto-διαστασιολόγηση (ADR-475) μόνο LOCKED ανεπαρκή.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation } from '../types/bim-base';
import {
  BASIC_SPAN_EFFECTIVE_DEPTH_LIMIT,
  MIN_BEAM_LENGTH_MM,
  MIN_BEAM_WIDTH_MM,
  type BeamParams,
} from '../types/beam-types';
import { getBeamSpanDepthRatio } from '../geometry/beam-geometry';
import { BEAM_EFFECTIVE_DEPTH_FACTOR } from '../structural/codes/suggest-reinforcement';
import { MIN_I_PLATE_THICKNESS_MM } from '../types/column-types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

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
 *
 * `sceneUnits` — the scene coordinate unit (default `'mm'`). Length thresholds
 * are scaled by `mmToSceneUnits(sceneUnits)` so validation works correctly in
 * meters/cm/inch scenes (mirrors wall-validator pattern).
 */
export function validateBeamParams(
  params: BeamParams,
  sceneUnits: SceneUnits = 'mm',
): BeamValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];
  const s = mmToSceneUnits(sceneUnits);

  validateDimensions(params, hardErrors, codeViolations);
  validateAxis(params, hardErrors, s);
  validateCurveControl(params, hardErrors);
  validateSlenderness(params, codeViolations);
  if (params.sectionKind === 'I-shape') {
    validateIShapeParams(params, hardErrors);
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
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

function validateAxis(params: BeamParams, hardErrors: string[], s: number): void {
  const dx = params.endPoint.x - params.startPoint.x;
  const dy = params.endPoint.y - params.startPoint.y;
  const chord = Math.hypot(dx, dy);
  if (chord < MIN_BEAM_LENGTH_MM * s) {
    hardErrors.push('beam.validation.hardErrors.lengthTooShort');
  }
}

function validateCurveControl(params: BeamParams, hardErrors: string[]): void {
  if (params.kind === 'curved' && !params.curveControl) {
    hardErrors.push('beam.validation.hardErrors.missingCurveControl');
  }
}

/**
 * ADR-363 Φ2 — I-shape διατομή δοκαριού (mirror column-validator). Hard errors:
 *   · tf/tw < MIN_I_PLATE_THICKNESS_MM (εκφυλισμένο πλάκα)
 *   · 2·tf ≥ depth (πέλματα επικαλύπτονται)
 *   · tw ≥ width (κορμός βγαίνει εκτός πέλματος)
 */
function validateIShapeParams(params: BeamParams, hardErrors: string[]): void {
  const tf = params.ishape?.flangeThickness;
  const tw = params.ishape?.webThickness;
  if (tf !== undefined && tf < MIN_I_PLATE_THICKNESS_MM) {
    hardErrors.push('beam.validation.hardErrors.invalidIShapePlateThickness');
  }
  if (tw !== undefined && tw < MIN_I_PLATE_THICKNESS_MM) {
    hardErrors.push('beam.validation.hardErrors.invalidIShapePlateThickness');
  }
  if (tf !== undefined && params.depth > 0 && 2 * tf >= params.depth) {
    hardErrors.push('beam.validation.hardErrors.invalidIShapeFlangeOverlap');
  }
  if (tw !== undefined && params.width > 0 && tw >= params.width) {
    hardErrors.push('beam.validation.hardErrors.invalidIShapeWebOverflow');
  }
}

/**
 * ADR-475 — EC2 §7.4.2 Table 7.4N structural-system factor K (conservative,
 * code-agnostic): αμφιέρειστη 1.0 · αμφίπακτη 1.5 · πρόβολος 0.4.
 */
function slendernessSystemFactor(params: BeamParams): number {
  switch (params.supportType) {
    case 'cantilever':
      return 0.4;
    case 'fixed':
      return 1.5;
    default:
      return 1.0;
  }
}

/**
 * ADR-475 — έλεγχος βέλους (serviceability) σε βάση ΕΝΕΡΓΟΥ βάθους d (=0.9·h), όχι
 * συνολικού h: `span/d_eff > K · basic` ⇒ code-violation. Πιάνει διατομές που το
 * παλιό flat `span/h > 20` άφηνε σιωπηλά ανεπαρκείς (π.χ. 500mm σε άνοιγμα 10m →
 * L/d=21.3). Με ενεργή auto-διαστασιολόγηση μόνο τα LOCKED ανεπαρκή φτάνουν εδώ.
 */
function validateSlenderness(params: BeamParams, codeViolations: string[]): void {
  if (params.depth <= 0) return;
  const ratioH = getBeamSpanDepthRatio(params); // span / h
  if (!Number.isFinite(ratioH)) return;
  const lOverDeff = ratioH / BEAM_EFFECTIVE_DEPTH_FACTOR; // span / d_eff
  const limit = BASIC_SPAN_EFFECTIVE_DEPTH_LIMIT * slendernessSystemFactor(params);
  if (lOverDeff > limit) {
    codeViolations.push(
      params.kind === 'cantilever'
        ? 'beam.validation.codeViolations.cantileverSpanDepthExceeded'
        : 'beam.validation.codeViolations.spanDepthExceeded',
    );
  }
}
