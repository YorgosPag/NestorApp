/**
 * =============================================================================
 * PROCUREMENT FORMAT HELPERS — thin wrappers around centralized Intl formatters
 * =============================================================================
 *
 * Shared across PurchaseOrder* / Supplier* components. Avoids duplicated
 * `new Intl.NumberFormat(...)` / `toLocaleDateString(...)` calls that bypass
 * the `@/lib/intl-utils` SSoT (ADR-314 Phase A + intl-formatting module).
 *
 * @module components/procurement/utils/procurement-format
 */

import { formatCurrency, formatDate } from '@/lib/intl-utils';

/** Format a monetary amount as EUR with 2 fractional digits (procurement convention). */
export function formatPOCurrency(amount: number): string {
  return formatCurrency(amount, 'EUR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a monetary amount as EUR rounded to integer (KPI / summary display). */
export function formatPOCurrencyRounded(amount: number): string {
  return formatCurrency(amount, 'EUR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Format an ISO date string, returning an em-dash placeholder for `null`. */
export function formatPODate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return formatDate(iso);
}
