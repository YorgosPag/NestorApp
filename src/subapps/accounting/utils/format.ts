/**
 * @fileoverview Accounting Subapp — Centralized Format Utilities
 * @description Single source of truth for currency formatting across the accounting subapp.
 *   Previously duplicated in 29+ files — now centralized here.
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-10
 * @compliance CLAUDE.md Enterprise Standards — zero duplicates, centralized utilities
 */

/**
 * Format a number as EUR currency using Greek locale.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
}

/**
 * Format a nullable currency amount, returning '—' for null values.
 * Used by Documents page for extracted data that may be null.
 */
export function formatCurrencyOrDash(amount: number | null): string {
  if (amount === null) return '—';
  return formatCurrency(amount);
}
