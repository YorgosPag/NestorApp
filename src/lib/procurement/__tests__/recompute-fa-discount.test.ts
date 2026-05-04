/**
 * Unit tests for the pure helpers behind ADR-330 Phase 5.5 server-side
 * Framework Agreement discount validation.
 *
 * Locks the math + override semantics that make the API tamper-proof: a
 * client cannot inflate `faDiscountPercent`, swap `appliedFaId` to a richer
 * agreement, or skip the discount entirely — `computeFaDiscountFields`
 * ignores any client-side values and recomputes from the agreements list.
 *
 * The Firestore-loading wrapper `loadAndComputeFaDiscount` is exercised at
 * integration level via the API route handlers and is not unit-tested here.
 *
 * @module lib/procurement/__tests__/recompute-fa-discount
 * @enterprise ADR-330 Phase 5.5 (server-side validation)
 */

import {
  computeFaDiscountFields,
  computeGrossTotal,
} from '../recompute-fa-discount-pure';
import type { FrameworkAgreement } from '@/subapps/procurement/types/framework-agreement';

// ============================================================================
// FIXTURES
// ============================================================================

function tsFromIso(iso: string): { seconds: number } {
  return { seconds: Math.floor(new Date(iso).getTime() / 1000) };
}

function makeFa(overrides: Partial<FrameworkAgreement>): FrameworkAgreement {
  const baseFrom = tsFromIso('2026-01-01T00:00:00Z');
  const baseUntil = tsFromIso('2027-01-01T00:00:00Z');
  return {
    id: 'fa_default',
    companyId: 'co_test',
    agreementNumber: 'FA-001',
    title: 'Default Test FA',
    description: null,
    vendorContactId: 'sup_1',
    status: 'active',
    validFrom: baseFrom as unknown as FrameworkAgreement['validFrom'],
    validUntil: baseUntil as unknown as FrameworkAgreement['validUntil'],
    applicableProjectIds: null,
    applicableMaterialIds: null,
    applicableAtoeCategoryCodes: null,
    currency: 'EUR',
    totalCommitment: null,
    discountType: 'flat',
    flatDiscountPercent: 10,
    volumeBreakpoints: [],
    isDeleted: false,
    createdAt: baseFrom as unknown as FrameworkAgreement['createdAt'],
    updatedAt: baseFrom as unknown as FrameworkAgreement['updatedAt'],
    createdBy: 'user_1',
    ...overrides,
  };
}

const EMPTY_FIELDS = {
  appliedFaId: null,
  faDiscountPercent: null,
  faDiscountAmount: null,
  netTotal: null,
};

// ============================================================================
// computeGrossTotal
// ============================================================================

describe('computeGrossTotal', () => {
  it('returns 0 for empty items', () => {
    expect(computeGrossTotal([], 24)).toBe(0);
  });

  it('computes subtotal + tax for a single item at 24%', () => {
    expect(computeGrossTotal([{ quantity: 10, unitPrice: 100 }], 24)).toBe(1240);
  });

  it('rounds tax + total to 2 decimals (cents)', () => {
    expect(computeGrossTotal([{ quantity: 3, unitPrice: 33.33 }], 24)).toBe(123.99);
  });

  it('handles 0% tax rate', () => {
    expect(computeGrossTotal([{ quantity: 5, unitPrice: 20 }], 0)).toBe(100);
  });

  it('sums multiple items', () => {
    const items = [
      { quantity: 2, unitPrice: 50 },
      { quantity: 3, unitPrice: 100 },
    ];
    expect(computeGrossTotal(items, 13)).toBe(452);
  });
});

// ============================================================================
// computeFaDiscountFields — null/empty paths
// ============================================================================

describe('computeFaDiscountFields — null paths', () => {
  it('returns empty fields when supplierId is missing', () => {
    expect(computeFaDiscountFields([makeFa({})], null, 'p_1', 1000)).toEqual(EMPTY_FIELDS);
    expect(computeFaDiscountFields([makeFa({})], undefined, 'p_1', 1000)).toEqual(EMPTY_FIELDS);
    expect(computeFaDiscountFields([makeFa({})], '', 'p_1', 1000)).toEqual(EMPTY_FIELDS);
  });

  it('returns empty fields when projectId is missing', () => {
    expect(computeFaDiscountFields([makeFa({})], 'sup_1', null, 1000)).toEqual(EMPTY_FIELDS);
    expect(computeFaDiscountFields([makeFa({})], 'sup_1', undefined, 1000)).toEqual(EMPTY_FIELDS);
  });

  it('returns empty fields when grossTotal is non-positive', () => {
    expect(computeFaDiscountFields([makeFa({})], 'sup_1', 'p_1', 0)).toEqual(EMPTY_FIELDS);
    expect(computeFaDiscountFields([makeFa({})], 'sup_1', 'p_1', -50)).toEqual(EMPTY_FIELDS);
  });

  it('returns empty fields when no agreements provided', () => {
    expect(computeFaDiscountFields([], 'sup_1', 'p_1', 1000)).toEqual(EMPTY_FIELDS);
  });

  it('returns empty fields when no FA matches the supplier', () => {
    const fa = makeFa({ id: 'fa_1', vendorContactId: 'sup_OTHER' });
    expect(computeFaDiscountFields([fa], 'sup_1', 'p_1', 1000)).toEqual(EMPTY_FIELDS);
  });

  it('returns empty fields when matching FA is not active', () => {
    const fa = makeFa({ id: 'fa_1', vendorContactId: 'sup_1', status: 'expired' });
    expect(computeFaDiscountFields([fa], 'sup_1', 'p_1', 1000)).toEqual(EMPTY_FIELDS);
  });

  it('returns empty fields when matching FA is soft-deleted', () => {
    const fa = makeFa({ id: 'fa_1', vendorContactId: 'sup_1', isDeleted: true });
    expect(computeFaDiscountFields([fa], 'sup_1', 'p_1', 1000)).toEqual(EMPTY_FIELDS);
  });
});

// ============================================================================
// computeFaDiscountFields — discount math
// ============================================================================

describe('computeFaDiscountFields — flat discount', () => {
  it('applies flat 10% discount on a 1000 EUR PO', () => {
    const fa = makeFa({
      id: 'fa_1',
      vendorContactId: 'sup_1',
      discountType: 'flat',
      flatDiscountPercent: 10,
    });
    expect(computeFaDiscountFields([fa], 'sup_1', 'p_1', 1000)).toEqual({
      appliedFaId: 'fa_1',
      faDiscountPercent: 10,
      faDiscountAmount: 100,
      netTotal: 900,
    });
  });

  it('applies flat 0% (no-op FA) and still records appliedFaId', () => {
    const fa = makeFa({
      id: 'fa_zero',
      vendorContactId: 'sup_1',
      discountType: 'flat',
      flatDiscountPercent: 0,
    });
    expect(computeFaDiscountFields([fa], 'sup_1', 'p_1', 500)).toEqual({
      appliedFaId: 'fa_zero',
      faDiscountPercent: 0,
      faDiscountAmount: 0,
      netTotal: 500,
    });
  });
});

describe('computeFaDiscountFields — volume breakpoints', () => {
  it('applies the highest threshold ≤ grossTotal', () => {
    const fa = makeFa({
      id: 'fa_vol',
      vendorContactId: 'sup_1',
      discountType: 'volume',
      flatDiscountPercent: null,
      volumeBreakpoints: [
        { thresholdEur: 0, discountPercent: 0 },
        { thresholdEur: 1000, discountPercent: 5 },
        { thresholdEur: 5000, discountPercent: 10 },
        { thresholdEur: 10000, discountPercent: 15 },
      ],
    });
    expect(computeFaDiscountFields([fa], 'sup_1', 'p_1', 7500)).toEqual({
      appliedFaId: 'fa_vol',
      faDiscountPercent: 10,
      faDiscountAmount: 750,
      netTotal: 6750,
    });
  });

  it('returns 0% discount when grossTotal is below all thresholds', () => {
    const fa = makeFa({
      id: 'fa_vol',
      vendorContactId: 'sup_1',
      discountType: 'volume',
      volumeBreakpoints: [
        { thresholdEur: 1000, discountPercent: 5 },
      ],
    });
    expect(computeFaDiscountFields([fa], 'sup_1', 'p_1', 500)).toEqual({
      appliedFaId: 'fa_vol',
      faDiscountPercent: 0,
      faDiscountAmount: 0,
      netTotal: 500,
    });
  });
});

describe('computeFaDiscountFields — project scope', () => {
  it('applies FA when applicableProjectIds includes the project', () => {
    const fa = makeFa({
      id: 'fa_scoped',
      vendorContactId: 'sup_1',
      applicableProjectIds: ['p_1', 'p_2'],
      flatDiscountPercent: 15,
    });
    expect(computeFaDiscountFields([fa], 'sup_1', 'p_1', 1000)).toEqual({
      appliedFaId: 'fa_scoped',
      faDiscountPercent: 15,
      faDiscountAmount: 150,
      netTotal: 850,
    });
  });

  it('does NOT apply FA when project is outside applicableProjectIds', () => {
    const fa = makeFa({
      id: 'fa_scoped',
      vendorContactId: 'sup_1',
      applicableProjectIds: ['p_OTHER'],
      flatDiscountPercent: 15,
    });
    expect(computeFaDiscountFields([fa], 'sup_1', 'p_1', 1000)).toEqual(EMPTY_FIELDS);
  });

  it('applies FA across all projects when applicableProjectIds is null', () => {
    const fa = makeFa({
      id: 'fa_global',
      vendorContactId: 'sup_1',
      applicableProjectIds: null,
      flatDiscountPercent: 5,
    });
    expect(computeFaDiscountFields([fa], 'sup_1', 'p_1', 200)).toEqual({
      appliedFaId: 'fa_global',
      faDiscountPercent: 5,
      faDiscountAmount: 10,
      netTotal: 190,
    });
  });
});

describe('computeFaDiscountFields — picks first matching FA when multiple exist', () => {
  it('uses the first active FA returned by resolveActiveFa, not the most generous', () => {
    // resolveActiveFa returns the first match — there is no "best" FA selection.
    const faA = makeFa({ id: 'fa_A', vendorContactId: 'sup_1', flatDiscountPercent: 5 });
    const faB = makeFa({ id: 'fa_B', vendorContactId: 'sup_1', flatDiscountPercent: 20 });
    const result = computeFaDiscountFields([faA, faB], 'sup_1', 'p_1', 1000);
    // The first matching agreement wins by spec — locks current behaviour.
    expect(result.appliedFaId).toBe('fa_A');
    expect(result.faDiscountPercent).toBe(5);
  });
});
