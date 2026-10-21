/**
 * Limits of a project budget line — ONE place for the server schema and the editor (ADR-917 Φ3β · Φ3γ).
 *
 * Pure and dependency-free, so the client reads them without pulling the id generators of the schema.
 *
 * @module services/project-cost/budget-line-limits
 */

/** Upper bound of one line — a typo guard (a trillion euros), not a business rule */
export const BUDGET_LINE_MAX_AMOUNT = 1_000_000_000_000;
export const BUDGET_LINE_NOTE_MAX = 500;

/** Euros → cents precision; float noise (the client's or the server's) never reaches the disk */
export function normalizeBudgetAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}
