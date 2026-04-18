/**
 * @fileoverview Accounting Subapp — Math Utilities (SSoT)
 * @description Canonical rounding + math helpers shared across accounting engines.
 *   Replaces 5+ duplicated `roundToTwo` implementations (tax-engine, depreciation-engine,
 *   vat-engine `roundToTwoDecimals`, accounting-efka-operations, test files).
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-04-18
 * @see ADR-314 SSoT Discovery — Phase C.5 residuals
 * @compliance CLAUDE.md Enterprise Standards — SSoT, zero duplicates
 */

/**
 * Στρογγυλοποίηση σε 2 δεκαδικά ψηφία (banker-safe με Number.EPSILON).
 *
 * Canonical implementation — all accounting engines MUST import from here.
 * Do NOT re-declare locally.
 */
export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
