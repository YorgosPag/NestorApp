/**
 * @fileoverview Firestore Helpers — Accounting Repository Utilities
 * @description Sanitization, date helpers, and Firestore-safe operations
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see MEMORY.md — Firestore NEVER write undefined values
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { FiscalQuarter } from '../../types/common';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// FIRESTORE SANITIZATION (re-exported from centralized location — ADR-214)
// ============================================================================

export { sanitizeForFirestore } from '@/utils/firestore-sanitize';

// ============================================================================
// DATE/TIME HELPERS
// ============================================================================

/**
 * Τρέχον ISO 8601 timestamp
 */
export function isoNow(): string {
  return nowISO();
}

/**
 * Τρέχουσα ISO 8601 ημερομηνία (date only, χωρίς time)
 */
export function isoToday(): string {
  return nowISO().split('T')[0];
}

/**
 * Υπολογισμός τριμήνου από ημερομηνία
 *
 * @param date - ISO 8601 date string
 * @returns FiscalQuarter (1-4)
 */
export function getQuarterFromDate(date: string): FiscalQuarter {
  const month = parseInt(date.substring(5, 7), 10);
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

/**
 * Υπολογισμός φορολογικού έτους από ημερομηνία
 *
 * Στην Ελλάδα, fiscal year = calendar year.
 *
 * @param date - ISO 8601 date string
 * @returns Φορολογικό έτος
 */
export function getFiscalYearFromDate(date: string): number {
  return parseInt(date.substring(0, 4), 10);
}
