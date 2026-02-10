/**
 * @fileoverview Accounting Subapp — Format Utilities
 * @description Thin wrappers over centralized intl-utils with accounting-specific defaults
 *   (e.g. always 2 decimal places for currency).
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-10
 * @updated 2026-02-10 — Delegated to @/lib/intl-utils (zero duplicates)
 * @compliance CLAUDE.md Enterprise Standards — zero duplicates, centralized utilities
 */

import {
  formatCurrency as centralFormatCurrency,
  formatDate as centralFormatDate,
} from '@/lib/intl-utils';

/**
 * Format a number as EUR currency — accounting standard (always 2 decimals).
 */
export function formatCurrency(amount: number): string {
  return centralFormatCurrency(amount, 'EUR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format an ISO date string as DD/MM/YYYY.
 * Delegates to centralized formatDate from intl-utils.
 */
export function formatDate(iso: string): string {
  return centralFormatDate(iso);
}

/**
 * Format a nullable currency amount, returning '—' for null values.
 */
export function formatCurrencyOrDash(amount: number | null): string {
  if (amount === null) return '—';
  return formatCurrency(amount);
}
