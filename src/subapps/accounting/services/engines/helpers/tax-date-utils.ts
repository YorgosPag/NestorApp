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
  // Ημερολογιακός υπολογισμός σε UTC: το `new Date('YYYY-MM-DD')` είναι μεσάνυχτα UTC, το `new Date(y, 0, 0)`
  // τοπικά — η ανάμειξη έδινε μία μέρα λιγότερη σε ζώνες δυτικά του Γκρίνουιτς.
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const ms = Date.UTC(year!, month! - 1, day!) - Date.UTC(year!, 0, 1);
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Δίσεκτο έτος;
 *
 * Κανόνας: div 4 AND (NOT div 100) OR div 400
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Πόσο από τη χρήση έχει περάσει σε μια ημερομηνία αναφοράς, και ο συντελεστής αναγωγής σε ολόκληρο έτος. */
export interface YearToDateProgress {
  /** Τελευταία ημέρα που μετρά (`YYYY-MM-DD`): η ημερομηνία αναφοράς, ή το τέλος της χρήσης αν έκλεισε. */
  readonly cutoff: string;
  /** ημέρες έτους / ημέρες που πέρασαν· 1 για κλεισμένη χρήση (τα πραγματικά ΕΙΝΑΙ τα ετήσια). */
  readonly factor: number;
}

/**
 * SSoT της αναγωγής «έως σήμερα → ετήσιο» (IAS 34 εκτίμηση ετήσιου, πρόβλεψη φόρου).
 *
 * Κλεισμένη χρήση ⇒ συντελεστής 1. ⚠️ Πριν (2026-10-14) ο `estimateTax` αναγόταν με την ημέρα-του-έτους της
 * ΣΗΜΕΡΙΝΗΣ ημερομηνίας και για παρελθόντα έτη: τον Μάρτιο, το πλήρες 2025 φούσκωνε ×6. Χρήση που δεν άρχισε ⇒ 1
 * (δεν υπάρχει τίποτα να αναχθεί).
 */
export function yearToDateProgress(fiscalYear: number, asOf: string): YearToDateProgress {
  const start = `${fiscalYear}-01-01`;
  const end = `${fiscalYear}-12-31`;
  const day = asOf.slice(0, 10);
  if (day >= end) return { cutoff: end, factor: 1 };
  if (day < start) return { cutoff: day, factor: 1 };
  const daysInYear = isLeapYear(fiscalYear) ? 366 : 365;
  return { cutoff: day, factor: daysInYear / Math.max(1, getDayOfYear(day)) };
}
