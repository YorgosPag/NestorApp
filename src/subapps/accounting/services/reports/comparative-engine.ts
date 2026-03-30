/**
 * @fileoverview Comparative Analysis Engine (Phase 2c)
 * @description Generic utilities for building 4-column comparative data
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q7 (Full comparative — current, YoY, previous, % change)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { ChangeMetric, ComparativeColumn } from '../../types/reports';

// ============================================================================
// CHANGE COMPUTATION
// ============================================================================

/** Compute absolute and percentage change between current and base values */
export function computeChange(current: number, base: number): ChangeMetric {
  const absolute = current - base;
  const percentage = base === 0 ? null : (absolute / Math.abs(base)) * 100;
  return { absolute, percentage };
}

// ============================================================================
// COMPARATIVE BUILDERS
// ============================================================================

/** Build a ComparativeColumn for a simple number */
export function buildNumericComparative(
  current: number,
  previous: number | null,
  yoy: number | null
): ComparativeColumn<number> {
  return {
    current,
    previousPeriod: previous,
    yearOverYear: yoy,
    changeFromPrevious: previous !== null ? computeChange(current, previous) : null,
    changeFromYoY: yoy !== null ? computeChange(current, yoy) : null,
  };
}

/**
 * Build a ComparativeColumn for complex types (arrays, objects)
 *
 * @param extractor — function to pull a numeric summary from T (for computing change metrics)
 */
export function buildComparative<T>(
  current: T,
  previous: T | null,
  yoy: T | null,
  extractor: (val: T) => number
): ComparativeColumn<T> {
  const currentNum = extractor(current);
  return {
    current,
    previousPeriod: previous,
    yearOverYear: yoy,
    changeFromPrevious: previous !== null
      ? computeChange(currentNum, extractor(previous))
      : null,
    changeFromYoY: yoy !== null
      ? computeChange(currentNum, extractor(yoy))
      : null,
  };
}
