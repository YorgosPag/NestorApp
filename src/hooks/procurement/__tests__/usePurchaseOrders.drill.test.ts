/**
 * Tests for ADR-331 Phase F pure drill-down helpers.
 * applyAnalyticsDrill + isActiveDrill — no React, no network.
 */

import type { PurchaseOrder, AnalyticsDrillFilters } from '@/types/procurement';
import { applyAnalyticsDrill, isActiveDrill } from '@/hooks/procurement/usePurchaseOrders';

const EMPTY_DRILL: AnalyticsDrillFilters = {
  from: null,
  to: null,
  projectIds: [],
  supplierIds: [],
  categoryCodes: [],
  statuses: [],
};

function makeItem(categoryCode: string) {
  return {
    id: 'poi_001',
    description: 'Item',
    quantity: 1,
    unit: 'pcs',
    unitPrice: 100,
    total: 100,
    boqItemId: null as string | null,
    categoryCode,
    quantityReceived: 0,
    quantityRemaining: 1,
  };
}

function makePO(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: 'po_001',
    poNumber: 'PO-001',
    companyId: 'co_001',
    projectId: 'proj_001',
    buildingId: null,
    supplierId: 'sup_001',
    status: 'ordered',
    items: [makeItem('OIK-1')],
    currency: 'EUR',
    subtotal: 100,
    taxRate: 24,
    taxAmount: 24,
    total: 124,
    dateCreated: '2026-03-15T10:00:00.000Z',
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
    sourceQuoteId: null,
    appliedFaId: null,
    faDiscountPercent: null,
    faDiscountAmount: null,
    netTotal: null,
    createdBy: 'user_001',
    approvedBy: null,
    updatedAt: '2026-03-15T10:00:00.000Z',
    isDeleted: false,
    ...overrides,
  };
}

// ============================================================================
// isActiveDrill
// ============================================================================

describe('isActiveDrill', () => {
  it('returns false when all fields are null/empty', () => {
    expect(isActiveDrill(EMPTY_DRILL)).toBe(false);
  });

  it('returns true when from is set', () => {
    expect(isActiveDrill({ ...EMPTY_DRILL, from: '2026-01-01' })).toBe(true);
  });

  it('returns true when to is set', () => {
    expect(isActiveDrill({ ...EMPTY_DRILL, to: '2026-03-31' })).toBe(true);
  });

  it('returns true when projectIds non-empty', () => {
    expect(isActiveDrill({ ...EMPTY_DRILL, projectIds: ['proj_001'] })).toBe(true);
  });

  it('returns true when supplierIds non-empty', () => {
    expect(isActiveDrill({ ...EMPTY_DRILL, supplierIds: ['sup_001'] })).toBe(true);
  });

  it('returns true when categoryCodes non-empty', () => {
    expect(isActiveDrill({ ...EMPTY_DRILL, categoryCodes: ['OIK-1'] })).toBe(true);
  });

  it('returns true when statuses non-empty', () => {
    expect(isActiveDrill({ ...EMPTY_DRILL, statuses: ['ordered'] })).toBe(true);
  });
});

// ============================================================================
// applyAnalyticsDrill — dateCreated range
// ============================================================================

describe('applyAnalyticsDrill — dateCreated range', () => {
  it('includes PO inside range', () => {
    const po = makePO({ dateCreated: '2026-03-15T10:00:00.000Z' });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, from: '2026-03-01', to: '2026-03-31' });
    expect(result).toHaveLength(1);
  });

  it('excludes PO before from', () => {
    const po = makePO({ dateCreated: '2026-02-28T10:00:00.000Z' });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, from: '2026-03-01' });
    expect(result).toHaveLength(0);
  });

  it('excludes PO after to', () => {
    const po = makePO({ dateCreated: '2026-04-01T10:00:00.000Z' });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, to: '2026-03-31' });
    expect(result).toHaveLength(0);
  });

  it('includes PO on exact from boundary (inclusive)', () => {
    const po = makePO({ dateCreated: '2026-03-01T00:00:00.000Z' });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, from: '2026-03-01' });
    expect(result).toHaveLength(1);
  });

  it('includes PO on exact to boundary (inclusive)', () => {
    const po = makePO({ dateCreated: '2026-03-31T23:59:59.000Z' });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, to: '2026-03-31' });
    expect(result).toHaveLength(1);
  });
});

// ============================================================================
// applyAnalyticsDrill — projectIds
// ============================================================================

describe('applyAnalyticsDrill — projectIds', () => {
  it('includes PO when projectId matches', () => {
    const po = makePO({ projectId: 'proj_001' });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, projectIds: ['proj_001'] });
    expect(result).toHaveLength(1);
  });

  it('excludes PO when projectId does not match', () => {
    const po = makePO({ projectId: 'proj_002' });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, projectIds: ['proj_001'] });
    expect(result).toHaveLength(0);
  });

  it('includes PO when projectIds is empty (all projects)', () => {
    const po = makePO({ projectId: 'proj_999' });
    const result = applyAnalyticsDrill([po], EMPTY_DRILL);
    expect(result).toHaveLength(1);
  });

  it('includes PO when projectId matches any in array', () => {
    const po = makePO({ projectId: 'proj_002' });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, projectIds: ['proj_001', 'proj_002'] });
    expect(result).toHaveLength(1);
  });
});

// ============================================================================
// applyAnalyticsDrill — supplierIds
// ============================================================================

describe('applyAnalyticsDrill — supplierIds', () => {
  it('includes PO when supplierId matches', () => {
    const po = makePO({ supplierId: 'sup_001' });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, supplierIds: ['sup_001'] });
    expect(result).toHaveLength(1);
  });

  it('excludes PO when supplierId does not match', () => {
    const po = makePO({ supplierId: 'sup_002' });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, supplierIds: ['sup_001'] });
    expect(result).toHaveLength(0);
  });

  it('includes PO when supplierIds is empty (all suppliers)', () => {
    const po = makePO({ supplierId: 'sup_999' });
    const result = applyAnalyticsDrill([po], EMPTY_DRILL);
    expect(result).toHaveLength(1);
  });
});

// ============================================================================
// applyAnalyticsDrill — statuses
// ============================================================================

describe('applyAnalyticsDrill — statuses', () => {
  it('includes PO when status matches', () => {
    const po = makePO({ status: 'ordered' });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, statuses: ['ordered'] });
    expect(result).toHaveLength(1);
  });

  it('excludes PO when status does not match', () => {
    const po = makePO({ status: 'draft' });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, statuses: ['ordered'] });
    expect(result).toHaveLength(0);
  });

  it('includes PO when statuses is empty (all statuses)', () => {
    const po = makePO({ status: 'cancelled' });
    const result = applyAnalyticsDrill([po], EMPTY_DRILL);
    expect(result).toHaveLength(1);
  });

  it('includes PO when status matches any in array', () => {
    const po = makePO({ status: 'delivered' });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, statuses: ['ordered', 'delivered'] });
    expect(result).toHaveLength(1);
  });
});

// ============================================================================
// applyAnalyticsDrill — categoryCodes (OR match on items)
// ============================================================================

describe('applyAnalyticsDrill — categoryCodes', () => {
  it('includes PO when item categoryCode matches', () => {
    const po = makePO({ items: [makeItem('OIK-1')] });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, categoryCodes: ['OIK-1'] });
    expect(result).toHaveLength(1);
  });

  it('excludes PO when no item matches any categoryCode', () => {
    const po = makePO({ items: [makeItem('OIK-1')] });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, categoryCodes: ['OIK-2'] });
    expect(result).toHaveLength(0);
  });

  it('includes PO when at least one item matches filter (OR logic)', () => {
    const po = makePO({ items: [makeItem('OIK-1'), makeItem('OIK-2')] });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, categoryCodes: ['OIK-2', 'OIK-3'] });
    expect(result).toHaveLength(1);
  });

  it('excludes PO when no items match any of multiple categoryCodes', () => {
    const po = makePO({ items: [makeItem('OIK-1'), makeItem('OIK-2')] });
    const result = applyAnalyticsDrill([po], { ...EMPTY_DRILL, categoryCodes: ['OIK-3', 'OIK-4'] });
    expect(result).toHaveLength(0);
  });

  it('includes PO when categoryCodes is empty (all categories)', () => {
    const po = makePO({ items: [makeItem('OIK-5')] });
    const result = applyAnalyticsDrill([po], EMPTY_DRILL);
    expect(result).toHaveLength(1);
  });
});

// ============================================================================
// applyAnalyticsDrill — combinations & edge cases
// ============================================================================

describe('applyAnalyticsDrill — combinations', () => {
  it('returns all POs when drill is empty', () => {
    const pos = [makePO({ id: 'po_001' }), makePO({ id: 'po_002' }), makePO({ id: 'po_003' })];
    expect(applyAnalyticsDrill(pos, EMPTY_DRILL)).toHaveLength(3);
  });

  it('returns empty array for empty PO input', () => {
    expect(applyAnalyticsDrill([], { ...EMPTY_DRILL, projectIds: ['proj_001'] })).toHaveLength(0);
  });

  it('includes PO when all active filters match', () => {
    const po = makePO({
      dateCreated: '2026-03-15T10:00:00.000Z',
      projectId: 'proj_001',
      supplierId: 'sup_001',
      status: 'ordered',
      items: [makeItem('OIK-1')],
    });
    const drill: AnalyticsDrillFilters = {
      from: '2026-03-01',
      to: '2026-03-31',
      projectIds: ['proj_001'],
      supplierIds: ['sup_001'],
      statuses: ['ordered'],
      categoryCodes: ['OIK-1'],
    };
    expect(applyAnalyticsDrill([po], drill)).toHaveLength(1);
  });

  it('excludes PO when one filter fails in a multi-filter combination', () => {
    const po = makePO({
      dateCreated: '2026-03-15T10:00:00.000Z',
      projectId: 'proj_001',
      supplierId: 'sup_001',
      status: 'draft',
      items: [makeItem('OIK-1')],
    });
    const drill: AnalyticsDrillFilters = {
      from: '2026-03-01',
      to: '2026-03-31',
      projectIds: ['proj_001'],
      supplierIds: ['sup_001'],
      statuses: ['ordered'],
      categoryCodes: ['OIK-1'],
    };
    expect(applyAnalyticsDrill([po], drill)).toHaveLength(0);
  });

  it('filters multiple POs independently', () => {
    const included = makePO({ id: 'po_001', projectId: 'proj_001' });
    const excluded = makePO({ id: 'po_002', projectId: 'proj_002' });
    const result = applyAnalyticsDrill([included, excluded], { ...EMPTY_DRILL, projectIds: ['proj_001'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('po_001');
  });
});
