/* eslint-disable no-restricted-syntax */
/**
 * =============================================================================
 * Supplier Metrics — Calculation Unit Tests (ADR-267)
 * =============================================================================
 *
 * Tests for supplier performance metric calculations.
 * Since the calculation helpers are private in supplier-metrics-service.ts,
 * we re-implement and test the pure logic functions directly.
 *
 * Covers: on-time rate, lead time, cancellation rate, category breakdown,
 *         committed spend, price trends.
 *
 * @module tests/procurement/supplier-metrics
 * @see ADR-267 Phase C, Feature 3
 */

import {
  PO_COMMITTED_STATUSES,
  type PurchaseOrder,
  type PurchaseOrderStatus,
  type PurchaseOrderItem,
} from '@/types/procurement';

// ─── Pure Calculation Functions (mirrored from supplier-metrics-service) ─

function sumTotal(pos: PurchaseOrder[]): number {
  return pos
    .filter(po => PO_COMMITTED_STATUSES.has(po.status))
    .reduce((sum, po) => sum + po.total, 0);
}

function calcOnTimeRate(pos: PurchaseOrder[]): number {
  const withBothDates = pos.filter(po => po.dateDelivered && po.dateNeeded);
  if (withBothDates.length === 0) return 0;
  const onTime = withBothDates.filter(po => po.dateDelivered! <= po.dateNeeded!);
  return Math.round((onTime.length / withBothDates.length) * 100);
}

function calcAverageLeadTime(pos: PurchaseOrder[]): number | null {
  const withBothDates = pos.filter(po => po.dateOrdered && po.dateDelivered);
  if (withBothDates.length === 0) return null;
  const totalDays = withBothDates.reduce((sum, po) => {
    const ordered = new Date(po.dateOrdered!).getTime();
    const delivered = new Date(po.dateDelivered!).getTime();
    return sum + (delivered - ordered) / (1000 * 60 * 60 * 24);
  }, 0);
  return Math.round(totalDays / withBothDates.length);
}

function calcCancellationRate(
  allPOs: PurchaseOrder[],
  cancelled: PurchaseOrder[]
): number {
  if (allPOs.length === 0) return 0;
  return Math.round((cancelled.length / allPOs.length) * 100);
}

interface CategorySpendLocal {
  categoryCode: string;
  totalSpend: number;
  orderCount: number;
}

function buildCategoryBreakdown(pos: PurchaseOrder[]): CategorySpendLocal[] {
  const map = new Map<string, { spend: number; count: number }>();
  for (const po of pos) {
    if (!PO_COMMITTED_STATUSES.has(po.status)) continue;
    for (const item of po.items) {
      const entry = map.get(item.categoryCode) ?? { spend: 0, count: 0 };
      entry.spend += item.total;
      entry.count++;
      map.set(item.categoryCode, entry);
    }
  }
  return Array.from(map.entries())
    .map(([code, data]) => ({
      categoryCode: code,
      totalSpend: data.spend,
      orderCount: data.count,
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

// ─── Test Data Factory ─────────────────────────────────────────────────

function makePO(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: 'po_001',
    poNumber: 'PO-0001',
    companyId: 'comp_1',
    projectId: 'proj_1',
    buildingId: null,
    supplierId: 'supp_1',
    status: 'ordered' as PurchaseOrderStatus,
    items: [],
    currency: 'EUR',
    subtotal: 1000,
    taxRate: 24,
    taxAmount: 240,
    total: 1240,
    dateCreated: '2026-01-01',
    dateNeeded: null,
    dateOrdered: null,
    dateDelivered: null,
    dateInvoiced: null,
    deliveryAddress: null,
    paymentTermsDays: null,
    paymentDueDate: null,
    linkedInvoiceIds: [],
    supplierNotes: null,
    internalNotes: null,
    attachments: [],
    cancellationReason: null,
    cancellationComment: null,
    createdBy: 'user_1',
    approvedBy: null,
    updatedAt: '2026-01-01',
    isDeleted: false,
    ...overrides,
  } as PurchaseOrder;
}

function makeItem(overrides: Partial<PurchaseOrderItem> = {}): PurchaseOrderItem {
  return {
    id: 'poi_001',
    description: 'Cement',
    quantity: 100,
    unit: 'σακ',
    unitPrice: 10,
    total: 1000,
    boqItemId: null,
    categoryCode: 'OIK-2',
    quantityReceived: 0,
    quantityRemaining: 100,
    ...overrides,
  };
}

// ============================================================================
// sumTotal
// ============================================================================

describe('sumTotal', () => {
  it('sums only committed statuses (ordered, partially_delivered, delivered, closed)', () => {
    const pos = [
      makePO({ status: 'ordered', total: 1000 }),
      makePO({ status: 'delivered', total: 2000 }),
      makePO({ status: 'draft', total: 500 }),       // excluded
      makePO({ status: 'cancelled', total: 300 }),    // excluded
    ];
    expect(sumTotal(pos)).toBe(3000);
  });

  it('returns 0 for empty array', () => {
    expect(sumTotal([])).toBe(0);
  });

  it('returns 0 when all POs are draft/cancelled', () => {
    const pos = [
      makePO({ status: 'draft', total: 1000 }),
      makePO({ status: 'cancelled', total: 2000 }),
    ];
    expect(sumTotal(pos)).toBe(0);
  });
});

// ============================================================================
// calcOnTimeRate
// ============================================================================

describe('calcOnTimeRate', () => {
  it('100% when all deliveries are on time', () => {
    const pos = [
      makePO({ dateDelivered: '2026-01-10', dateNeeded: '2026-01-15' }),
      makePO({ dateDelivered: '2026-01-15', dateNeeded: '2026-01-15' }), // exact
    ];
    expect(calcOnTimeRate(pos)).toBe(100);
  });

  it('0% when all deliveries are late', () => {
    const pos = [
      makePO({ dateDelivered: '2026-01-20', dateNeeded: '2026-01-15' }),
      makePO({ dateDelivered: '2026-02-01', dateNeeded: '2026-01-10' }),
    ];
    expect(calcOnTimeRate(pos)).toBe(0);
  });

  it('50% when half are on time', () => {
    const pos = [
      makePO({ dateDelivered: '2026-01-10', dateNeeded: '2026-01-15' }), // on time
      makePO({ dateDelivered: '2026-01-20', dateNeeded: '2026-01-15' }), // late
    ];
    expect(calcOnTimeRate(pos)).toBe(50);
  });

  it('returns 0 when no POs have both dates', () => {
    const pos = [
      makePO({ dateDelivered: '2026-01-10', dateNeeded: null }),
      makePO({ dateDelivered: null, dateNeeded: '2026-01-15' }),
    ];
    expect(calcOnTimeRate(pos)).toBe(0);
  });

  it('ignores POs without dateNeeded', () => {
    const pos = [
      makePO({ dateDelivered: '2026-01-10', dateNeeded: null }),
    ];
    expect(calcOnTimeRate(pos)).toBe(0);
  });
});

// ============================================================================
// calcAverageLeadTime
// ============================================================================

describe('calcAverageLeadTime', () => {
  it('calculates average days from order to delivery', () => {
    const pos = [
      makePO({ dateOrdered: '2026-01-01', dateDelivered: '2026-01-11' }), // 10 days
      makePO({ dateOrdered: '2026-01-01', dateDelivered: '2026-01-21' }), // 20 days
    ];
    expect(calcAverageLeadTime(pos)).toBe(15); // avg(10, 20)
  });

  it('returns null when no POs have both dates', () => {
    const pos = [
      makePO({ dateOrdered: '2026-01-01', dateDelivered: null }),
    ];
    expect(calcAverageLeadTime(pos)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(calcAverageLeadTime([])).toBeNull();
  });
});

// ============================================================================
// calcCancellationRate
// ============================================================================

describe('calcCancellationRate', () => {
  it('calculates percentage of cancelled POs', () => {
    const all = [makePO(), makePO(), makePO(), makePO()]; // 4 total
    const cancelled = [makePO({ status: 'cancelled' })]; // 1 cancelled
    expect(calcCancellationRate(all, cancelled)).toBe(25);
  });

  it('returns 0 for no cancellations', () => {
    const all = [makePO(), makePO()];
    expect(calcCancellationRate(all, [])).toBe(0);
  });

  it('returns 100 when all are cancelled', () => {
    const all = [makePO(), makePO()];
    expect(calcCancellationRate(all, all)).toBe(100);
  });

  it('returns 0 for empty input', () => {
    expect(calcCancellationRate([], [])).toBe(0);
  });
});

// ============================================================================
// buildCategoryBreakdown
// ============================================================================

describe('buildCategoryBreakdown', () => {
  it('groups spend by ΑΤΟΕ category code', () => {
    const pos = [
      makePO({
        status: 'ordered',
        items: [
          makeItem({ categoryCode: 'OIK-2', total: 5000 }),
          makeItem({ categoryCode: 'OIK-3', total: 3000 }),
        ],
      }),
      makePO({
        status: 'delivered',
        items: [
          makeItem({ categoryCode: 'OIK-2', total: 2000 }),
        ],
      }),
    ];
    const result = buildCategoryBreakdown(pos);

    expect(result).toHaveLength(2);
    // Sorted by totalSpend descending
    expect(result[0].categoryCode).toBe('OIK-2');
    expect(result[0].totalSpend).toBe(7000);
    expect(result[0].orderCount).toBe(2);
    expect(result[1].categoryCode).toBe('OIK-3');
    expect(result[1].totalSpend).toBe(3000);
  });

  it('excludes non-committed POs', () => {
    const pos = [
      makePO({
        status: 'draft',
        items: [makeItem({ total: 5000 })],
      }),
    ];
    expect(buildCategoryBreakdown(pos)).toEqual([]);
  });

  it('returns empty for no items', () => {
    const pos = [makePO({ status: 'ordered', items: [] })];
    expect(buildCategoryBreakdown(pos)).toEqual([]);
  });
});

// ============================================================================
// Price Trend Logic
// ============================================================================

describe('Price trend grouping logic', () => {
  /** Mirror the monthly grouping from getSupplierPriceTrend */
  function buildMonthlyPrices(
    orderedPOs: Array<{ dateOrdered: string; items: Array<{ unitPrice: number; quantity: number }> }>
  ): Array<{ month: string; averageUnitPrice: number; totalQuantity: number }> {
    const monthly = new Map<string, { prices: number[]; quantities: number[] }>();
    for (const po of orderedPOs) {
      const month = po.dateOrdered.slice(0, 7);
      for (const item of po.items) {
        const entry = monthly.get(month) ?? { prices: [], quantities: [] };
        entry.prices.push(item.unitPrice);
        entry.quantities.push(item.quantity);
        monthly.set(month, entry);
      }
    }
    return Array.from(monthly.entries())
      .map(([month, data]) => ({
        month,
        averageUnitPrice: data.prices.reduce((s, p) => s + p, 0) / data.prices.length,
        totalQuantity: data.quantities.reduce((s, q) => s + q, 0),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  it('groups prices by month and computes average', () => {
    const pos = [
      { dateOrdered: '2026-01-15', items: [{ unitPrice: 10, quantity: 50 }] },
      { dateOrdered: '2026-01-20', items: [{ unitPrice: 12, quantity: 30 }] },
      { dateOrdered: '2026-02-10', items: [{ unitPrice: 15, quantity: 100 }] },
    ];
    const result = buildMonthlyPrices(pos);

    expect(result).toHaveLength(2);
    expect(result[0].month).toBe('2026-01');
    expect(result[0].averageUnitPrice).toBe(11); // avg(10, 12)
    expect(result[0].totalQuantity).toBe(80); // 50 + 30
    expect(result[1].month).toBe('2026-02');
    expect(result[1].averageUnitPrice).toBe(15);
  });

  it('sorts by month ascending', () => {
    const pos = [
      { dateOrdered: '2026-03-01', items: [{ unitPrice: 20, quantity: 10 }] },
      { dateOrdered: '2026-01-01', items: [{ unitPrice: 10, quantity: 10 }] },
    ];
    const result = buildMonthlyPrices(pos);
    expect(result[0].month).toBe('2026-01');
    expect(result[1].month).toBe('2026-03');
  });
});
