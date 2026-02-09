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

// ============================================================================
// FIRESTORE SANITIZATION (CRITICAL — per MEMORY.md)
// ============================================================================

/**
 * Αντικατάσταση `undefined` → `null` σε object (shallow)
 *
 * **ΚΡΙΣΙΜΟ**: Firestore αποδέχεται `null` αλλά **ΑΠΟΡΡΙΠΤΕΙ** `undefined`.
 * Αυτή η function ΠΡΕΠΕΙ να καλείται σε κάθε write operation.
 *
 * @param data - Object to sanitize
 * @returns Sanitized copy (no undefined values)
 */
export function sanitizeForFirestore<T extends Record<string, unknown>>(data: T): T {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      sanitized[key] = null;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // Recursive sanitization for nested objects
      sanitized[key] = sanitizeForFirestore(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

// ============================================================================
// DATE/TIME HELPERS
// ============================================================================

/**
 * Τρέχον ISO 8601 timestamp
 */
export function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Τρέχουσα ISO 8601 ημερομηνία (date only, χωρίς time)
 */
export function isoToday(): string {
  return new Date().toISOString().split('T')[0];
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
