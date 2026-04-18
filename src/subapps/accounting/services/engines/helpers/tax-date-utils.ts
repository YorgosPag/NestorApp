/**
 * @fileoverview Tax Date Utils — Calendar helpers for tax projections
 * @description Day-of-year + leap-year helpers για real-time tax estimation.
 *   Extracted from tax-engine.ts (SRP split, ADR-314 Phase C.5).
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-04-18
 * @see ADR-ACC-009 Tax Engine
 */

/**
 * Ημέρα του έτους (1-366) για ένα ISO date string.
 *
 * Χρησιμοποιείται για projections: progressRatio = dayOfYear / daysInYear
 */
export function getDayOfYear(date: string): number {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Δίσεκτο έτος;
 *
 * Κανόνας: div 4 AND (NOT div 100) OR div 400
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
