/**
 * Wall validator (ADR-363 Phase 1).
 *
 * Pure function: zero React / DOM / Firestore deps. Validates dimensional
 * sanity (length, thickness, height) και επιστρέφει `BimValidation`. Mirrors
 * το stair-validator SSoT pattern (ADR-358 §5.9): hard errors block creation,
 * code violations are non-blocking (red badge στο property panel).
 *
 * Phase 1 scope (intentionally minimal):
 *   - **Hard errors** (block creation):
 *       · length < MIN_WALL_LENGTH_MM (degenerate wall)
 *       · thickness ≤ 0 OR thickness > MAX_WALL_THICKNESS_MM (unphysical)
 *       · height ≤ 0
 *       · DNA thickness mismatch (when dna set)
 *   - **Code violations** (non-blocking):
 *       · thickness < MIN_WALL_THICKNESS_MM (below structural minimum)
 *       · exterior wall thickness < 200 mm (ΝΟΚ ελάχιστο εξωτερικός φέρων)
 *
 * Full ΝΟΚ rules (max storey height, U-value, etc.) land Phase 1.5 via the
 * `gate-wall-checker` engine (ADR-186 pattern, parallel to gate-stair-checker).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3 §5.8
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation } from '../types/bim-base';
import {
  MIN_WALL_LENGTH_MM,
  MIN_WALL_THICKNESS_MM,
  MAX_WALL_THICKNESS_MM,
  type WallParams,
} from '../types/wall-types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

/** ΝΟΚ ελάχιστο πάχος εξωτερικού φέρων τοίχου (mm). */
const MIN_EXTERIOR_LOAD_BEARING_THICKNESS_MM = 200;

/** DNA totalThickness reconciliation tolerance (mm). */
const DNA_THICKNESS_TOLERANCE_MM = 0.01;

/** Result of a wall validation pass — hard errors are non-empty when invalid. */
export interface WallValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge in property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload για direct assignment στο `WallEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `WallParams` returning hard errors + non-blocking code violations.
 * Pure + idempotent: same input → same output. Side-effect free.
 *
 * `sceneUnits` — the scene coordinate unit (default `'mm'`). All mm-based
 * thresholds are scaled by `mmToSceneUnits(sceneUnits)` so that validation
 * works correctly whether params are in mm, cm, m, etc.
 */
export function validateWallParams(
  params: WallParams,
  sceneUnits: SceneUnits = 'mm',
): WallValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];
  const s = mmToSceneUnits(sceneUnits);

  validateGeometry(params, hardErrors, s);
  validateThickness(params, hardErrors, codeViolations, s);
  validateHeight(params, hardErrors);
  validateDnaConsistency(params, hardErrors, s);

  const violationKeys: string[] = [...codeViolations];
  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys,
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}

// ─── Internal checks ────────────────────────────────────────────────────────

function validateGeometry(params: WallParams, hardErrors: string[], s: number): void {
  const dx = params.end.x - params.start.x;
  const dy = params.end.y - params.start.y;
  const length = Math.hypot(dx, dy);
  if (length < MIN_WALL_LENGTH_MM * s) {
    hardErrors.push('wall.validation.hardErrors.lengthTooShort');
  }
}

function validateThickness(
  params: WallParams,
  hardErrors: string[],
  codeViolations: string[],
  s: number,
): void {
  if (params.thickness <= 0) {
    hardErrors.push('wall.validation.hardErrors.thicknessNonPositive');
    return;
  }
  if (params.thickness > MAX_WALL_THICKNESS_MM * s) {
    hardErrors.push('wall.validation.hardErrors.thicknessExceedsMax');
    return;
  }
  if (params.thickness < MIN_WALL_THICKNESS_MM * s) {
    codeViolations.push('wall.validation.codeViolations.thicknessBelowMin');
  }
  if (
    params.category === 'exterior' &&
    params.thickness < MIN_EXTERIOR_LOAD_BEARING_THICKNESS_MM * s
  ) {
    codeViolations.push('wall.validation.codeViolations.exteriorBelowNokMin');
  }
}

function validateHeight(params: WallParams, hardErrors: string[]): void {
  if (params.height <= 0) {
    hardErrors.push('wall.validation.hardErrors.heightNonPositive');
  }
}

function validateDnaConsistency(params: WallParams, hardErrors: string[], s: number): void {
  if (!params.dna) return;
  const dnaTotal = params.dna.totalThickness;
  if (Math.abs(dnaTotal - params.thickness) > DNA_THICKNESS_TOLERANCE_MM * s) {
    hardErrors.push('wall.validation.hardErrors.dnaThicknessMismatch');
  }
}
