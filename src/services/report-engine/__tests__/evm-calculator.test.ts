/* eslint-disable no-restricted-syntax */
/**
 * =============================================================================
 * EVM Calculator — Unit Tests (ADR-265)
 * =============================================================================
 *
 * Pure-function tests for Earned Value Management calculations.
 * Covers: BAC, AC, EV, PV, CPI, SPI, EAC, TCPI, traffic lights, S-curve.
 *
 * @module tests/report-engine/evm-calculator
 * @see ADR-265 §8.5 (Earned Value Management)
 */

import type { BOQItem } from '@/types/boq';
import type { ConstructionPhase } from '@/types/building/construction';
import type { BuildingMilestone } from '@/types/building/milestone';

// ─── Mocks ─────────────────────────────────────────────────────────────

jest.mock('@/services/measurements/cost-engine', () => ({
  computeItemCost: jest.fn((item: BOQItem) => {
    const unitCost = item.materialUnitCost + item.laborUnitCost + item.equipmentUnitCost;
    const grossQty = item.estimatedQuantity * (1 + (item.wasteFactor ?? 0));
    return { totalCost: grossQty * unitCost };
  }),
  computeGrossQuantity: jest.fn((net: number, waste: number) => net * (1 + waste)),
}));

jest.mock('@/utils/collection-utils', () => ({
  sumBy: jest.fn(<T>(arr: T[], fn: (item: T) => number) =>
    arr.reduce((sum, item) => sum + fn(item), 0),
  ),
}));

import {
  getTrafficLight,
  computeBudgetAtCompletion,
  computeActualCost,
  computeEarnedValue,
  computePlannedValue,
  generateSCurveData,
  computeEVM,
} from '../evm-calculator';

// ─── Test Data Factory ─────────────────────────────────────────────────

function makeBOQItem(overrides: Partial<BOQItem> = {}): BOQItem {
  return {
    id: 'boq_test1',
    buildingId: 'bld_1',
    companyId: 'comp_1',
    projectId: 'proj_1',
    categoryId: 'cat_1',
    categoryCode: 'OIK-1',
    name: 'Test BOQ Item',
    unit: 'm²',
    estimatedQuantity: 100,
    actualQuantity: null,
    materialUnitCost: 10,
    laborUnitCost: 5,
    equipmentUnitCost: 2,
    wasteFactor: 0.05,
    linkedPhaseId: 'phase_1',
    linkedTaskId: null,
    linkedContractorId: null,
    linkedInvoiceId: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as BOQItem;
}

function makePhase(overrides: Partial<ConstructionPhase> = {}): ConstructionPhase {
  return {
    id: 'phase_1',
    buildingId: 'bld_1',
    companyId: 'comp_1',
    name: 'Phase 1',
    code: 'P1',
    order: 1,
    status: 'in_progress',
    progress: 50,
    plannedStartDate: '2026-01-01',
    plannedEndDate: '2026-06-30',
    actualStartDate: '2026-01-01',
    actualEndDate: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as ConstructionPhase;
}

// ============================================================================
// getTrafficLight
// ============================================================================

describe('getTrafficLight', () => {
  it('returns green for index >= 0.95', () => {
    expect(getTrafficLight(0.95)).toBe('green');
    expect(getTrafficLight(1.0)).toBe('green');
    expect(getTrafficLight(1.5)).toBe('green');
  });

  it('returns amber for index 0.85-0.94', () => {
    expect(getTrafficLight(0.85)).toBe('amber');
    expect(getTrafficLight(0.90)).toBe('amber');
    expect(getTrafficLight(0.94)).toBe('amber');
  });

  it('returns red for index < 0.85', () => {
    expect(getTrafficLight(0.84)).toBe('red');
    expect(getTrafficLight(0.5)).toBe('red');
    expect(getTrafficLight(0)).toBe('red');
  });

  it('handles negative indices as red', () => {
    expect(getTrafficLight(-0.5)).toBe('red');
  });
});

// ============================================================================
// computeBudgetAtCompletion
// ============================================================================

describe('computeBudgetAtCompletion', () => {
  it('sums total cost of all BOQ items', () => {
    const items = [
      makeBOQItem({ estimatedQuantity: 100, materialUnitCost: 10, laborUnitCost: 5, equipmentUnitCost: 2, wasteFactor: 0 }),
      makeBOQItem({ id: 'boq_2', estimatedQuantity: 50, materialUnitCost: 20, laborUnitCost: 0, equipmentUnitCost: 0, wasteFactor: 0 }),
    ];
    // Item 1: 100 * (10+5+2) = 1700
    // Item 2: 50 * 20 = 1000
    const bac = computeBudgetAtCompletion(items);
    expect(bac).toBe(2700);
  });

  it('returns 0 for empty items array', () => {
    expect(computeBudgetAtCompletion([])).toBe(0);
  });

  it('accounts for waste factor', () => {
    const items = [
      makeBOQItem({ estimatedQuantity: 100, materialUnitCost: 10, laborUnitCost: 0, equipmentUnitCost: 0, wasteFactor: 0.10 }),
    ];
    // 100 * 1.10 * 10 = 1100
    expect(computeBudgetAtCompletion(items)).toBeCloseTo(1100, 2);
  });
});

// ============================================================================
// computeActualCost
// ============================================================================

describe('computeActualCost', () => {
  it('computes actual cost only for items with actualQuantity', () => {
    const items = [
      makeBOQItem({ actualQuantity: 80, wasteFactor: 0 }),
      makeBOQItem({ id: 'boq_2', actualQuantity: null }),
    ];
    // Only first item: grossActual = 80 * 1.0 = 80, unitCost = 17, AC = 80 * 17 = 1360
    expect(computeActualCost(items)).toBe(1360);
  });

  it('returns 0 when no items have actual measurements', () => {
    const items = [
      makeBOQItem({ actualQuantity: null }),
      makeBOQItem({ id: 'boq_2', actualQuantity: null }),
    ];
    expect(computeActualCost(items)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(computeActualCost([])).toBe(0);
  });
});

// ============================================================================
// computeEarnedValue
// ============================================================================

describe('computeEarnedValue', () => {
  it('computes EV = sum of (progress% × phaseBudget)', () => {
    const items = [
      makeBOQItem({ linkedPhaseId: 'phase_1', estimatedQuantity: 100, materialUnitCost: 10, laborUnitCost: 0, equipmentUnitCost: 0, wasteFactor: 0 }),
    ];
    const phases = [makePhase({ id: 'phase_1', progress: 50 })];
    // phaseBudget = 100 * 10 = 1000, EV = 50% * 1000 = 500
    expect(computeEarnedValue(phases, items)).toBe(500);
  });

  it('handles multiple phases correctly', () => {
    const items = [
      makeBOQItem({ id: 'boq_1', linkedPhaseId: 'phase_1', estimatedQuantity: 100, materialUnitCost: 10, laborUnitCost: 0, equipmentUnitCost: 0, wasteFactor: 0 }),
      makeBOQItem({ id: 'boq_2', linkedPhaseId: 'phase_2', estimatedQuantity: 200, materialUnitCost: 5, laborUnitCost: 0, equipmentUnitCost: 0, wasteFactor: 0 }),
    ];
    const phases = [
      makePhase({ id: 'phase_1', progress: 100 }),
      makePhase({ id: 'phase_2', progress: 25 }),
    ];
    // Phase 1: 100% * 1000 = 1000
    // Phase 2: 25% * 1000 = 250
    expect(computeEarnedValue(phases, items)).toBe(1250);
  });

  it('returns 0 for empty phases', () => {
    expect(computeEarnedValue([], [makeBOQItem()])).toBe(0);
  });

  it('returns 0 when progress is 0', () => {
    const items = [makeBOQItem({ linkedPhaseId: 'phase_1', wasteFactor: 0 })];
    const phases = [makePhase({ id: 'phase_1', progress: 0 })];
    expect(computeEarnedValue(phases, items)).toBe(0);
  });
});

// ============================================================================
// computePlannedValue
// ============================================================================

describe('computePlannedValue', () => {
  it('computes PV based on elapsed fraction', () => {
    const items = [
      makeBOQItem({ linkedPhaseId: 'phase_1', estimatedQuantity: 100, materialUnitCost: 10, laborUnitCost: 0, equipmentUnitCost: 0, wasteFactor: 0 }),
    ];
    // Phase: Jan 1 to Jun 30 (181 days), asOf = Apr 1 (~90 days in)
    const phases = [makePhase({ id: 'phase_1', plannedStartDate: '2026-01-01', plannedEndDate: '2026-06-30' })];
    const asOfDate = new Date('2026-04-01');
    const pv = computePlannedValue(phases, items, asOfDate);
    // elapsed ≈ 90/181 ≈ 0.497, PV ≈ 0.497 * 1000 ≈ 497
    expect(pv).toBeGreaterThan(490);
    expect(pv).toBeLessThan(510);
  });

  it('returns full budget when asOfDate is past phase end', () => {
    const items = [
      makeBOQItem({ linkedPhaseId: 'phase_1', estimatedQuantity: 100, materialUnitCost: 10, laborUnitCost: 0, equipmentUnitCost: 0, wasteFactor: 0 }),
    ];
    const phases = [makePhase({ id: 'phase_1', plannedStartDate: '2026-01-01', plannedEndDate: '2026-06-30' })];
    const asOfDate = new Date('2027-01-01');
    expect(computePlannedValue(phases, items, asOfDate)).toBe(1000);
  });

  it('returns 0 when asOfDate is before phase start', () => {
    const items = [
      makeBOQItem({ linkedPhaseId: 'phase_1', estimatedQuantity: 100, materialUnitCost: 10, laborUnitCost: 0, equipmentUnitCost: 0, wasteFactor: 0 }),
    ];
    const phases = [makePhase({ id: 'phase_1', plannedStartDate: '2026-06-01', plannedEndDate: '2026-12-31' })];
    const asOfDate = new Date('2026-01-01');
    expect(computePlannedValue(phases, items, asOfDate)).toBe(0);
  });
});

// ============================================================================
// generateSCurveData
// ============================================================================

describe('generateSCurveData', () => {
  it('returns empty array for no phases', () => {
    expect(generateSCurveData([], [], [])).toEqual([]);
  });

  it('generates monthly data points', () => {
    const items = [makeBOQItem({ linkedPhaseId: 'phase_1', wasteFactor: 0 })];
    const phases = [makePhase({
      id: 'phase_1',
      plannedStartDate: '2026-01-01',
      plannedEndDate: '2026-03-31',
    })];
    const milestones: BuildingMilestone[] = [];

    const data = generateSCurveData(phases, items, milestones);
    expect(data.length).toBeGreaterThanOrEqual(3); // Jan, Feb, Mar, possibly Apr
    expect(data[0]).toHaveProperty('date');
    expect(data[0]).toHaveProperty('plannedValue');
    expect(data[0]).toHaveProperty('earnedValue');
    expect(data[0]).toHaveProperty('actualCost');
  });

  it('has non-decreasing planned values over time', () => {
    const items = [makeBOQItem({ linkedPhaseId: 'phase_1', wasteFactor: 0 })];
    const phases = [makePhase({
      id: 'phase_1',
      plannedStartDate: '2026-01-01',
      plannedEndDate: '2026-06-30',
    })];

    const data = generateSCurveData(phases, items, []);
    for (let i = 1; i < data.length; i++) {
      expect(data[i].plannedValue).toBeGreaterThanOrEqual(data[i - 1].plannedValue);
    }
  });
});

// ============================================================================
// computeEVM (orchestrator)
// ============================================================================

describe('computeEVM', () => {
  it('computes complete EVM metrics', () => {
    const items = [
      makeBOQItem({
        linkedPhaseId: 'phase_1',
        estimatedQuantity: 100,
        actualQuantity: 60,
        materialUnitCost: 10,
        laborUnitCost: 0,
        equipmentUnitCost: 0,
        wasteFactor: 0,
      }),
    ];
    const phases = [makePhase({
      id: 'phase_1',
      progress: 50,
      plannedStartDate: '2026-01-01',
      plannedEndDate: '2026-12-31',
    })];

    const result = computeEVM(items, phases, [], new Date('2026-07-01'));

    expect(result.budgetAtCompletion).toBe(1000); // 100 * 10
    expect(result.earnedValue).toBe(500); // 50% * 1000
    expect(result.actualCost).toBe(600); // 60 * 10
    expect(result.costVariance).toBe(-100); // EV - AC = 500 - 600
    expect(result.cpi).toBeCloseTo(0.833, 2); // 500/600
    expect(result.cpiHealth).toBe('red'); // <0.85
    expect(result.spiHealth).toBeDefined();
    expect(result.sCurveData).toBeDefined();
    expect(result.sCurveData.length).toBeGreaterThan(0);
  });

  it('handles zero actual cost (CPI = 0)', () => {
    const items = [makeBOQItem({ linkedPhaseId: 'phase_1', actualQuantity: null, wasteFactor: 0 })];
    const phases = [makePhase({ id: 'phase_1', progress: 50 })];

    const result = computeEVM(items, phases, [], new Date('2026-04-01'));
    expect(result.cpi).toBe(0);
    expect(result.actualCost).toBe(0);
  });

  it('handles zero planned value (SPI = 0)', () => {
    const items = [makeBOQItem({ linkedPhaseId: 'phase_1', wasteFactor: 0 })];
    const phases = [makePhase({
      id: 'phase_1',
      progress: 0,
      plannedStartDate: '2027-01-01',
      plannedEndDate: '2027-12-31',
    })];

    const result = computeEVM(items, phases, [], new Date('2026-04-01'));
    expect(result.spi).toBe(0);
    expect(result.plannedValue).toBe(0);
  });

  it('caps TCPI at 99.99', () => {
    const items = [
      makeBOQItem({
        linkedPhaseId: 'phase_1',
        estimatedQuantity: 100,
        actualQuantity: 100,
        materialUnitCost: 10,
        laborUnitCost: 0,
        equipmentUnitCost: 0,
        wasteFactor: 0,
      }),
    ];
    // AC = BAC = 1000, so denominator = BAC - AC = 0 → TCPI capped
    const phases = [makePhase({ id: 'phase_1', progress: 10 })];
    const result = computeEVM(items, phases, [], new Date('2026-07-01'));
    expect(result.toCompletePI).toBe(99.99);
  });

  it('EAC = BAC when CPI = 0 (no actual cost)', () => {
    const items = [makeBOQItem({ linkedPhaseId: 'phase_1', actualQuantity: null, wasteFactor: 0 })];
    const phases = [makePhase({ id: 'phase_1', progress: 50 })];
    const result = computeEVM(items, phases, [], new Date('2026-04-01'));
    // CPI = 0, so EAC falls back to BAC
    expect(result.estimateAtCompletion).toBe(result.budgetAtCompletion);
  });

  it('handles empty items (BAC = 0)', () => {
    const phases = [makePhase({ id: 'phase_1', progress: 50 })];
    const result = computeEVM([], phases, [], new Date('2026-04-01'));
    expect(result.budgetAtCompletion).toBe(0);
    expect(result.earnedValue).toBe(0);
    expect(result.actualCost).toBe(0);
    expect(result.cpi).toBe(0);
    expect(result.spi).toBe(0);
  });

  it('handles phase with start === end date', () => {
    const items = [
      makeBOQItem({ linkedPhaseId: 'phase_1', estimatedQuantity: 100, materialUnitCost: 10, laborUnitCost: 0, equipmentUnitCost: 0, wasteFactor: 0 }),
    ];
    const phases = [makePhase({
      id: 'phase_1',
      plannedStartDate: '2026-06-15',
      plannedEndDate: '2026-06-15', // same day — edge case
      progress: 50,
    })];
    // elapsed fraction when start === end → should be 1 if asOf >= start, 0 otherwise
    const result = computeEVM(items, phases, [], new Date('2026-06-15'));
    // Should not crash, PV should be full budget (elapsed = 1)
    expect(result.plannedValue).toBe(1000);
  });

  it('schedule variance is positive when ahead of schedule', () => {
    const items = [
      makeBOQItem({ linkedPhaseId: 'phase_1', estimatedQuantity: 100, materialUnitCost: 10, laborUnitCost: 0, equipmentUnitCost: 0, wasteFactor: 0, actualQuantity: 80 }),
    ];
    const phases = [makePhase({
      id: 'phase_1',
      progress: 80, // 80% done
      plannedStartDate: '2026-01-01',
      plannedEndDate: '2026-12-31',
    })];
    // EV = 80% * 1000 = 800
    // PV at midyear ≈ 50% * 1000 = 500
    // SV = EV - PV = 800 - 500 = 300 (ahead of schedule)
    const result = computeEVM(items, phases, [], new Date('2026-07-01'));
    expect(result.scheduleVariance).toBeGreaterThan(0);
    expect(result.spi).toBeGreaterThan(1);
    expect(result.spiHealth).toBe('green');
  });
});
