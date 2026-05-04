/**
 * chart-utils — Shared helpers for the spend analytics chart components.
 *
 * - `formatEurShort` compact axis-tick formatter (€ short form).
 * - `buildPurchaseOrdersUrl` SSoT drill-down URL builder; reuses
 *   `serializeFilterArray` from `@/lib/url-filters/multi-value`.
 * - `readClickedRow` typed Recharts onClick payload reader (no `any`).
 * - `truncateLabel` short axis label truncation.
 *
 * @see ADR-331 §2.7 (drill-down) · §4 D5
 */

import { serializeFilterArray } from '@/lib/url-filters/multi-value';
import type { SpendAnalyticsFilters } from '@/services/procurement/aggregators/spendAnalyticsAggregator';

const PO_LIST_PATH = '/procurement/purchase-orders';

export function formatEurShort(n: number): string {
  if (!Number.isFinite(n)) return '0€';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K€`;
  return `${n.toFixed(0)}€`;
}

export type PurchaseOrdersUrlOverride = Partial<
  Pick<SpendAnalyticsFilters, 'projectId' | 'supplierId' | 'categoryCode'>
>;

export function buildPurchaseOrdersUrl(
  filters: SpendAnalyticsFilters,
  overrides: PurchaseOrdersUrlOverride,
): string {
  const params = new URLSearchParams();
  params.set('from', filters.from);
  params.set('to', filters.to);
  const arrays: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['projectId', overrides.projectId ?? filters.projectId],
    ['supplierId', overrides.supplierId ?? filters.supplierId],
    ['categoryCode', overrides.categoryCode ?? filters.categoryCode],
    ['status', filters.status],
  ];
  for (const [key, values] of arrays) {
    const serialized = serializeFilterArray(values);
    if (serialized) params.set(key, serialized);
  }
  return `${PO_LIST_PATH}?${params.toString()}`;
}

export function readClickedRowKey(payload: unknown, key: string): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function truncateLabel(label: string, max: number = 20): string {
  if (label.length <= max) return label;
  return `${label.slice(0, Math.max(1, max - 1))}…`;
}
