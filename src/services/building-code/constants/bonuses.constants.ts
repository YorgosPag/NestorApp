/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Constants for ΝΟΚ bonus calculations (ν.4067/2012).
 * Phase 1: A1 urban incentives, A3 nZEB, A5 minimum coverage.
 */

import type { A1Scenario } from '@/services/building-code/types/bonus.types';

/** A1 coverage reduction percentages per scenario (α=10%, β=15%, γ=20%, δ=25%). */
export const BONUS_A1_COVERAGE_REDUCTION: Record<A1Scenario, number> = {
  A1a: 0.10,
  A1b: 0.15,
  A1c: 0.20,
  A1d: 0.25,
} as const;

/** A5: minimum coverage floor (m²) — ν.4067/2012, Άρθρο 15 §7. */
export const BONUS_A5_MIN_COVERAGE_M2 = 120;

/** A5: maximum coverage percentage when applying floor — capped at 70%. */
export const BONUS_A5_MAX_COVERAGE_PCT = 70;

/** A3 nZEB: +5% ΣΔ for energy class A. */
export const NZEB_SD_5PCT = 0.05;

/** A3 nZEB: +10% ΣΔ for energy class A+. */
export const NZEB_SD_10PCT = 0.10;
