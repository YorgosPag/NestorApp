/**
 * Tests for ADR-331 Phase E chart utility helpers.
 * buildPurchaseOrdersUrl, formatEurShort, readClickedRowKey, truncateLabel.
 */

import {
  buildPurchaseOrdersUrl,
  formatEurShort,
  readClickedRowKey,
  truncateLabel,
} from '@/app/procurement/analytics/_components/chart-utils';

const BASE_FILTERS = {
  from: '2026-01-01',
  to: '2026-03-31',
  projectId: [] as string[],
  supplierId: [] as string[],
  categoryCode: [] as string[],
  status: [] as string[],
};

// ============================================================================
// buildPurchaseOrdersUrl
// ============================================================================

describe('buildPurchaseOrdersUrl', () => {
  it('always includes from and to params', () => {
    const url = new URL(buildPurchaseOrdersUrl(BASE_FILTERS, {}), 'http://x');
    expect(url.searchParams.get('from')).toBe('2026-01-01');
    expect(url.searchParams.get('to')).toBe('2026-03-31');
  });

  it('omits empty array params', () => {
    const url = new URL(buildPurchaseOrdersUrl(BASE_FILTERS, {}), 'http://x');
    expect(url.searchParams.get('projectId')).toBeNull();
    expect(url.searchParams.get('supplierId')).toBeNull();
    expect(url.searchParams.get('categoryCode')).toBeNull();
    expect(url.searchParams.get('status')).toBeNull();
  });

  it('serializes filter arrays as comma-separated', () => {
    const filters = { ...BASE_FILTERS, projectId: ['proj_001', 'proj_002'] };
    const url = new URL(buildPurchaseOrdersUrl(filters, {}), 'http://x');
    expect(url.searchParams.get('projectId')).toBe('proj_001,proj_002');
  });

  it('override.projectId takes precedence over filters.projectId', () => {
    const filters = { ...BASE_FILTERS, projectId: ['proj_001'] };
    const url = new URL(buildPurchaseOrdersUrl(filters, { projectId: ['proj_002'] }), 'http://x');
    expect(url.searchParams.get('projectId')).toBe('proj_002');
  });

  it('override.supplierId takes precedence over filters.supplierId', () => {
    const filters = { ...BASE_FILTERS, supplierId: ['sup_001'] };
    const url = new URL(buildPurchaseOrdersUrl(filters, { supplierId: ['sup_override'] }), 'http://x');
    expect(url.searchParams.get('supplierId')).toBe('sup_override');
  });

  it('override.categoryCode takes precedence over filters.categoryCode', () => {
    const filters = { ...BASE_FILTERS, categoryCode: ['OIK-1'] };
    const url = new URL(buildPurchaseOrdersUrl(filters, { categoryCode: ['OIK-2'] }), 'http://x');
    expect(url.searchParams.get('categoryCode')).toBe('OIK-2');
  });

  it('points to /procurement/purchase-orders', () => {
    const url = new URL(buildPurchaseOrdersUrl(BASE_FILTERS, {}), 'http://x');
    expect(url.pathname).toBe('/procurement/purchase-orders');
  });

  it('includes status from filters (no status override)', () => {
    const filters = { ...BASE_FILTERS, status: ['ordered', 'delivered'] };
    const url = new URL(buildPurchaseOrdersUrl(filters, {}), 'http://x');
    expect(url.searchParams.get('status')).toBe('ordered,delivered');
  });

  it('falls back to filters array when override is absent', () => {
    const filters = { ...BASE_FILTERS, supplierId: ['sup_001'] };
    const url = new URL(buildPurchaseOrdersUrl(filters, {}), 'http://x');
    expect(url.searchParams.get('supplierId')).toBe('sup_001');
  });
});

// ============================================================================
// formatEurShort
// ============================================================================

describe('formatEurShort', () => {
  it('formats zero as 0€', () => {
    expect(formatEurShort(0)).toBe('0€');
  });

  it('formats sub-1k as plain integer €', () => {
    expect(formatEurShort(500)).toBe('500€');
  });

  it('formats 1000 as 1K€', () => {
    expect(formatEurShort(1000)).toBe('1K€');
  });

  it('formats 1500 as 2K€ (rounds up)', () => {
    expect(formatEurShort(1500)).toBe('2K€');
  });

  it('formats 1M as 1.0M€', () => {
    expect(formatEurShort(1_000_000)).toBe('1.0M€');
  });

  it('formats 2.5M as 2.5M€', () => {
    expect(formatEurShort(2_500_000)).toBe('2.5M€');
  });

  it('returns 0€ for non-finite inputs', () => {
    expect(formatEurShort(Infinity)).toBe('0€');
    expect(formatEurShort(NaN)).toBe('0€');
  });
});

// ============================================================================
// readClickedRowKey
// ============================================================================

describe('readClickedRowKey', () => {
  it('returns value when key exists and is a non-empty string', () => {
    expect(readClickedRowKey({ supplierId: 'sup_001' }, 'supplierId')).toBe('sup_001');
  });

  it('returns null for null payload', () => {
    expect(readClickedRowKey(null, 'key')).toBeNull();
  });

  it('returns null for non-object payload', () => {
    expect(readClickedRowKey('string', 'key')).toBeNull();
    expect(readClickedRowKey(42, 'key')).toBeNull();
  });

  it('returns null when key is missing from object', () => {
    expect(readClickedRowKey({ other: 'val' }, 'key')).toBeNull();
  });

  it('returns null when value is not a string', () => {
    expect(readClickedRowKey({ key: 123 }, 'key')).toBeNull();
    expect(readClickedRowKey({ key: null }, 'key')).toBeNull();
  });

  it('returns null when value is an empty string', () => {
    expect(readClickedRowKey({ key: '' }, 'key')).toBeNull();
  });
});

// ============================================================================
// truncateLabel
// ============================================================================

describe('truncateLabel', () => {
  it('returns label unchanged when shorter than max', () => {
    expect(truncateLabel('short', 20)).toBe('short');
  });

  it('returns label unchanged when equal to max', () => {
    const label = 'a'.repeat(20);
    expect(truncateLabel(label, 20)).toBe(label);
  });

  it('truncates label longer than max and appends ellipsis', () => {
    const label = 'a'.repeat(21);
    expect(truncateLabel(label, 20)).toBe('a'.repeat(19) + '…');
  });

  it('uses default max of 20', () => {
    const label = 'x'.repeat(25);
    expect(truncateLabel(label)).toBe('x'.repeat(19) + '…');
  });

  it('respects custom max', () => {
    expect(truncateLabel('hello world', 5)).toBe('hell…');
  });

  it('keeps at least 1 char before ellipsis when max=1', () => {
    expect(truncateLabel('abc', 1)).toBe('a…');
  });
});
