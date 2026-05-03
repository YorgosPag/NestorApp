/**
 * @related ADR-186 §8 Q7 — Hybrid validation (hard block + soft warning)
 *
 * Phase 2 form validation thresholds. Single source of truth — both the
 * client-side form validator AND any future server-side guard MUST read
 * from here. Adjusting limits = single edit.
 *
 * Hybrid rules:
 *   - Hard range  : value < hardMin OR value > hardMax → block save
 *   - Soft range  : softMin <= value <= softMax → no warning
 *   - Outside soft, inside hard → warning + audit log on save
 */

export interface NumericLimits {
  readonly hardMin: number;
  readonly hardMax: number;
  readonly softMin: number;
  readonly softMax: number;
}

export interface IntegerLimits {
  readonly hardMin: number;
  readonly hardMax: number;
}

export interface Phase2ValidationLimits {
  readonly sd: NumericLimits;
  readonly coveragePct: NumericLimits;
  readonly maxHeight: NumericLimits;
  readonly frontagesCount: IntegerLimits;
}

export const PHASE2_VALIDATION_LIMITS: Phase2ValidationLimits = {
  sd: { hardMin: 0, hardMax: 10, softMin: 0.4, softMax: 5 },
  coveragePct: { hardMin: 0, hardMax: 100, softMin: 0, softMax: 85 },
  maxHeight: { hardMin: 0, hardMax: 100, softMin: 0, softMax: 30 },
  frontagesCount: { hardMin: 1, hardMax: 4 },
} as const;
