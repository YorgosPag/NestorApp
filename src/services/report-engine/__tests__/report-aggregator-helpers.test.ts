/* eslint-disable no-restricted-syntax */
/**
 * =============================================================================
 * Report Aggregator Helpers — Unit Tests (ADR-265)
 * =============================================================================
 *
 * Pure-function tests for report data transformation helpers.
 * Covers: buildNameMap, buildRevenueByProject, buildPricePerSqm,
 *         buildBOQVariance, buildTopBuyers, computeCompleteness
 *
 * @module tests/report-engine/report-aggregator-helpers
 * @see ADR-265 (Enterprise Reports System)
 */

import type { UnitDoc, BOQItemDoc } from '../report-aggregator.types';
import {
  buildNameMap,
  buildRevenueByProject,
  buildPricePerSqm,
  buildBOQVariance,
  buildTopBuyers,
  computeCompleteness,
  buildOverdueInstallments,
} from '../report-aggregator.helpers';

// ─── Test Data Factories ───────────────────────────────────────────────

/** Helper: create a minimal owners array from a display name */
function makeOwners(name: string) {
  return [{ contactId: `c_${name}`, name, ownershipPct: 100, role: 'buyer' as const, paymentPlanId: null }];
}

function makeUnitDoc(overrides: Partial<UnitDoc> = {}): UnitDoc {
  return {
    project: 'proj_1',
    buildingId: 'bld_1',
    commercialStatus: 'sold',
    commercial: {
      finalPrice: 100000,
      owners: makeOwners('buyer_1'),
      paymentSummary: null,
    },
    areas: { gross: 80 },
    ...overrides,
  } as UnitDoc;
}

function makeBOQItemDoc(overrides: Partial<BOQItemDoc> = {}): BOQItemDoc {
  return {
    buildingId: 'bld_1',
    estimatedQuantity: 100,
    actualQuantity: null,
    materialUnitCost: 10,
    laborUnitCost: 5,
    equipmentUnitCost: 2,
    ...overrides,
  } as BOQItemDoc;
}

// ============================================================================
// buildNameMap
// ============================================================================

describe('buildNameMap', () => {
  it('maps IDs to names', () => {
    const items = [
      { id: 'p1', name: 'Project Alpha' },
      { id: 'p2', name: 'Project Beta' },
    ];
    const map = buildNameMap(items);
    expect(map).toEqual({ p1: 'Project Alpha', p2: 'Project Beta' });
  });

  it('uses ID as fallback when name is undefined', () => {
    const items = [{ id: 'p1' }];
    const map = buildNameMap(items);
    expect(map).toEqual({ p1: 'p1' });
  });

  it('returns empty object for empty input', () => {
    expect(buildNameMap([])).toEqual({});
  });
});

// ============================================================================
// buildRevenueByProject
// ============================================================================

describe('buildRevenueByProject', () => {
  const projectNames: Record<string, string> = {
    proj_1: 'Sunrise Tower',
    proj_2: 'Marina Bay',
  };

  it('sums revenue from sold units by project name', () => {
    const units = [
      makeUnitDoc({ project: 'proj_1', commercial: { finalPrice: 100000, owners: makeOwners('b1'), paymentSummary: null } }),
      makeUnitDoc({ project: 'proj_1', commercial: { finalPrice: 200000, owners: makeOwners('b2'), paymentSummary: null } }),
      makeUnitDoc({ project: 'proj_2', commercial: { finalPrice: 150000, owners: makeOwners('b3'), paymentSummary: null } }),
    ];
    const result = buildRevenueByProject(units, projectNames);
    expect(result['Sunrise Tower']).toBe(300000);
    expect(result['Marina Bay']).toBe(150000);
  });

  it('skips non-sold units', () => {
    const units = [
      makeUnitDoc({ commercialStatus: 'for_sale' }),
      makeUnitDoc({ commercialStatus: 'reserved' }),
    ];
    expect(buildRevenueByProject(units, projectNames)).toEqual({});
  });

  it('skips units without finalPrice', () => {
    const units = [
      makeUnitDoc({ commercial: { finalPrice: 0, owners: makeOwners('b1'), paymentSummary: null } }),
    ];
    expect(buildRevenueByProject(units, projectNames)).toEqual({});
  });

  it('returns empty for empty units', () => {
    expect(buildRevenueByProject([], projectNames)).toEqual({});
  });
});

// ============================================================================
// buildPricePerSqm
// ============================================================================

describe('buildPricePerSqm', () => {
  const buildingNames: Record<string, string> = { bld_1: 'Block A', bld_2: 'Block B' };

  it('calculates average price per m² by building', () => {
    const units = [
      makeUnitDoc({ buildingId: 'bld_1', commercial: { finalPrice: 80000, owners: makeOwners('b'), paymentSummary: null }, areas: { gross: 80 } }),
      makeUnitDoc({ buildingId: 'bld_1', commercial: { finalPrice: 120000, owners: makeOwners('b'), paymentSummary: null }, areas: { gross: 120 } }),
    ];
    const result = buildPricePerSqm(units, buildingNames);
    // Total: 200000 / 200 = 1000 €/m²
    expect(result).toEqual([{ building: 'Block A', pricePerSqm: 1000 }]);
  });

  it('skips non-sold units', () => {
    const units = [makeUnitDoc({ commercialStatus: 'for_sale' })];
    expect(buildPricePerSqm(units, buildingNames)).toEqual([]);
  });

  it('skips units with zero or missing area', () => {
    const units = [makeUnitDoc({ areas: { gross: 0 } })];
    expect(buildPricePerSqm(units, buildingNames)).toEqual([]);
  });
});

// ============================================================================
// buildBOQVariance
// ============================================================================

describe('buildBOQVariance', () => {
  const buildingNames: Record<string, string> = { bld_1: 'Block A' };

  it('computes estimated vs actual BOQ costs by building', () => {
    const items = [
      makeBOQItemDoc({ buildingId: 'bld_1', estimatedQuantity: 100, actualQuantity: 120, materialUnitCost: 10, laborUnitCost: 0, equipmentUnitCost: 0 }),
    ];
    const result = buildBOQVariance(items, buildingNames);
    // estimated: 100 * 10 = 1000
    // actual: 120 * 10 = 1200
    expect(result).toEqual([{ building: 'Block A', estimated: 1000, actual: 1200 }]);
  });

  it('uses estimatedQuantity as fallback when actualQuantity is null', () => {
    const items = [
      makeBOQItemDoc({ estimatedQuantity: 50, actualQuantity: null, materialUnitCost: 20, laborUnitCost: 0, equipmentUnitCost: 0 }),
    ];
    const result = buildBOQVariance(items, buildingNames);
    expect(result[0].estimated).toBe(1000);
    expect(result[0].actual).toBe(1000); // fallback to estimated
  });

  it('sums all cost components', () => {
    const items = [
      makeBOQItemDoc({ estimatedQuantity: 10, actualQuantity: 10, materialUnitCost: 5, laborUnitCost: 3, equipmentUnitCost: 2 }),
    ];
    const result = buildBOQVariance(items, buildingNames);
    // unitCost = 5+3+2 = 10, estimated = 10*10 = 100, actual = 10*10 = 100
    expect(result[0].estimated).toBe(100);
    expect(result[0].actual).toBe(100);
  });
});

// ============================================================================
// buildTopBuyers
// ============================================================================

describe('buildTopBuyers', () => {
  it('returns top 10 buyers sorted by totalValue', () => {
    const units = Array.from({ length: 12 }, (_, i) =>
      makeUnitDoc({
        commercial: { finalPrice: (i + 1) * 10000, owners: makeOwners(`buyer_${i}`), paymentSummary: null },
      }),
    );
    const contacts = units.map((_, i) => ({ id: `buyer_${i}`, displayName: `Buyer ${i}` }));
    const result = buildTopBuyers(units, contacts);
    expect(result).toHaveLength(10);
    expect(result[0].totalValue).toBeGreaterThan(result[1].totalValue);
  });

  it('aggregates multiple units per buyer', () => {
    const units = [
      makeUnitDoc({ commercial: { finalPrice: 50000, owners: makeOwners('buyer_A'), paymentSummary: null } }),
      makeUnitDoc({ commercial: { finalPrice: 30000, owners: makeOwners('buyer_A'), paymentSummary: null } }),
    ];
    const contacts = [{ id: 'buyer_A', displayName: 'Αλέξανδρος' }];
    const result = buildTopBuyers(units, contacts);
    expect(result[0].totalValue).toBe(80000);
    expect(result[0].unitCount).toBe(2);
  });

  it('skips non-sold units', () => {
    const units = [makeUnitDoc({ commercialStatus: 'for_sale' })];
    expect(buildTopBuyers(units, [])).toEqual([]);
  });
});

// ============================================================================
// computeCompleteness
// ============================================================================

describe('computeCompleteness', () => {
  it('returns 100% when all fields are filled', () => {
    const contacts = [
      { displayName: 'John', email: 'j@test.com', phone: '123', addresses: [{ city: 'Athens' }] },
    ];
    expect(computeCompleteness(contacts)).toBe(100);
  });

  it('returns 0% for empty contacts array', () => {
    expect(computeCompleteness([])).toBe(0);
  });

  it('calculates partial completeness correctly', () => {
    const contacts = [
      { displayName: 'John', email: undefined, phone: undefined, addresses: [] },
    ];
    // 1 out of 4 fields = 25%
    expect(computeCompleteness(contacts)).toBe(25);
  });

  it('averages across multiple contacts', () => {
    const contacts = [
      { displayName: 'A', email: 'a@t.com', phone: '1', addresses: [{ city: 'X' }] }, // 4/4
      { displayName: 'B', email: undefined, phone: undefined, addresses: [] }, // 1/4
    ];
    // Total: 5 / 8 = 62.5% → rounded to 63%
    expect(computeCompleteness(contacts)).toBe(63);
  });
});

// ============================================================================
// buildOverdueInstallments
// ============================================================================

describe('buildOverdueInstallments', () => {
  it('extracts overdue installments from units with payment summary', () => {
    const units = [
      makeUnitDoc({
        commercial: {
          finalPrice: 100000,
          owners: makeOwners('b1'),
          paymentSummary: { overdueInstallments: 2, remainingAmount: 25000 },
        },
      }),
      makeUnitDoc({
        commercial: {
          finalPrice: 50000,
          owners: makeOwners('b2'),
          paymentSummary: { overdueInstallments: 0, remainingAmount: 0 },
        },
      }),
    ];
    const result = buildOverdueInstallments(units);
    // Only first unit has overdue > 0
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(25000);
    expect(result[0].status).toBe('due');
  });

  it('returns empty for units without overdue', () => {
    const units = [
      makeUnitDoc({
        commercial: {
          finalPrice: 100000,
          owners: makeOwners('b1'),
          paymentSummary: { overdueInstallments: 0, remainingAmount: 0 },
        },
      }),
    ];
    expect(buildOverdueInstallments(units)).toEqual([]);
  });

  it('returns empty for units without payment summary', () => {
    const units = [
      makeUnitDoc({
        commercial: { finalPrice: 100000, owners: makeOwners('b1'), paymentSummary: null },
      }),
    ];
    expect(buildOverdueInstallments(units)).toEqual([]);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge cases — buildRevenueByProject', () => {
  it('uses project ID as fallback when not in names map', () => {
    const units = [
      makeUnitDoc({ project: 'unknown_proj', commercial: { finalPrice: 50000, owners: makeOwners('b'), paymentSummary: null } }),
    ];
    const result = buildRevenueByProject(units, {});
    expect(result['unknown_proj']).toBe(50000);
  });
});

describe('Edge cases — buildPricePerSqm', () => {
  it('handles multiple buildings correctly', () => {
    const units = [
      makeUnitDoc({ buildingId: 'bld_1', commercial: { finalPrice: 100000, owners: makeOwners('b'), paymentSummary: null }, areas: { gross: 100 } }),
      makeUnitDoc({ buildingId: 'bld_2', commercial: { finalPrice: 200000, owners: makeOwners('b'), paymentSummary: null }, areas: { gross: 100 } }),
    ];
    const names = { bld_1: 'A', bld_2: 'B' };
    const result = buildPricePerSqm(units, names);
    expect(result).toHaveLength(2);
    const a = result.find(r => r.building === 'A');
    const b = result.find(r => r.building === 'B');
    expect(a?.pricePerSqm).toBe(1000);
    expect(b?.pricePerSqm).toBe(2000);
  });
});

describe('Edge cases — buildTopBuyers', () => {
  it('handles units with missing owners', () => {
    const units = [
      makeUnitDoc({ commercial: { finalPrice: 50000, owners: undefined, paymentSummary: null } }),
    ];
    // Should not crash — formatOwnerNames([]) returns null, fallback to 'unknown'
    const result = buildTopBuyers(units, []);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});
