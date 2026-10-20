/**
 * SPEC-242C — the portfolio rollup: unit documents → project summary → portfolio,
 * with missing measurements kept as `null` all the way up.
 */

import {
  readUnitFinancials,
  rollUpPortfolio,
  rollUpProject,
  type UnitFinancials,
} from '../portfolio-rollup';

const unit = (overrides: Partial<UnitFinancials> = {}): UnitFinancials => ({
  salePrice: 100_000,
  isSold: false,
  collected: 0,
  costOfMoney: null,
  collectionDays: null,
  npv: 0,
  timeCost: 0,
  ...overrides,
});

describe('readUnitFinancials', () => {
  it('reads price from direct fields first, then `commercial`; sold = sold|reserved|contracted', () => {
    expect(readUnitFinancials({ salePrice: 1, price: 2, status: 'reserved' })).toMatchObject({ salePrice: 1, isSold: true });
    expect(readUnitFinancials({ commercial: { salePrice: 3 }, status: 'available' })).toMatchObject({ salePrice: 3, isSold: false });
  });

  it('without a payment summary every payment metric is absent, not zero', () => {
    expect(readUnitFinancials({ salePrice: 5 })).toEqual(unit({ salePrice: 5 }));
  });

  it('reads the payment summary from `commercial` first; non-positive samples do not count', () => {
    const data = {
      commercial: { paymentSummary: { totalPaid: 40, costOfMoney: 4.5, wacp: 200, npv: 7, timeCost: 3 } },
      paymentSummary: { totalPaid: 999 },
    };
    expect(readUnitFinancials(data)).toMatchObject({ collected: 40, costOfMoney: 4.5, collectionDays: 200, npv: 7, timeCost: 3 });
    expect(readUnitFinancials({ paymentSummary: { costOfMoney: 0, avgCollectionDays: -1 } }))
      .toMatchObject({ costOfMoney: null, collectionDays: null });
  });
});

describe('rollUpProject', () => {
  it('a project with no units is noData with null metrics — not Critical, not 0%', () => {
    const { summary } = rollUpProject('p0', 'Κενό', []);
    expect(summary).toMatchObject({
      totalProperties: 0, costOfMoney: null, avgCollectionDays: null, healthStatus: 'noData', healthDrivers: [],
    });
  });

  it('averages only the units that report a metric', () => {
    const { summary } = rollUpProject('p1', 'Α', [
      unit({ isSold: true, costOfMoney: 2 }),
      unit({ isSold: true, costOfMoney: 4 }),
      unit({ isSold: true }),
    ]);
    expect(summary.costOfMoney).toBe(3);
    expect(summary.avgCollectionDays).toBeNull();
    expect(summary).toMatchObject({ soldProperties: 3, healthStatus: 'good', healthDrivers: ['costOfMoney'] });
  });
});

describe('rollUpPortfolio', () => {
  it('weights averages by value over reporting projects only — a silent project adds no weight', () => {
    const reporting = rollUpProject('a', 'A', [unit({ salePrice: 300, costOfMoney: 6 })]);
    const alsoReporting = rollUpProject('b', 'B', [unit({ salePrice: 100, costOfMoney: 2 })]);
    const silent = rollUpProject('c', 'C', [unit({ salePrice: 1_000_000 })]);
    const portfolio = rollUpPortfolio([reporting, alsoReporting, silent], 3, 'now');
    expect(portfolio.weightedAvgCostOfMoney).toBe(5);
    expect(portfolio.weightedAvgCollectionDays).toBeNull();
    expect(portfolio).toMatchObject({ activeProjects: 3, totalProperties: 3, totalPortfolioValue: 1_000_400 });
  });

  it('totals add up, outstanding = value − collected', () => {
    const rollup = rollUpProject('a', 'A', [
      unit({ salePrice: 200, collected: 50, npv: 10, timeCost: 4 }),
      unit({ salePrice: 100, collected: 25, npv: 5, timeCost: 1 }),
    ]);
    expect(rollUpPortfolio([rollup], 1, 'now')).toMatchObject({
      totalPortfolioValue: 300, totalCollected: 75, totalOutstanding: 225, totalNPV: 15, totalTimeCost: 5,
    });
  });
});
