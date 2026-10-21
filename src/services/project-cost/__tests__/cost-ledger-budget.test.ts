/**
 * ADR-917 §7 Α9–Α12 — anchors for budget resolution (Φ3α).
 * Each `it` names the mutation it exists to catch.
 */

import { computeCostLedger, type LedgerBoqItem, type LedgerBudgetLine } from '../cost-ledger';

const UNPRICED = { materialUnitCost: 0, laborUnitCost: 0, equipmentUnitCost: 0 } as const;

function boq(id: string, categoryCode: string, overrides: Partial<LedgerBoqItem> = {}): LedgerBoqItem {
  return {
    id,
    categoryCode,
    title: id,
    unit: 'm2',
    estimatedQuantity: 10,
    wasteFactor: 0,
    materialUnitCost: 5,
    laborUnitCost: 3,
    equipmentUnitCost: 2,
    ...overrides,
  };
}

function budgetLine(costCode: string, amount: number): LedgerBudgetLine {
  return { id: `pbl_${costCode}`, costCode, amount, note: null };
}

function rowOf(boqItems: LedgerBoqItem[], budgetLines: LedgerBudgetLine[] = []) {
  const { rows } = computeCostLedger(boqItems, [], { budgetLines });
  return rows[0];
}

describe('cost ledger — budget resolution (ADR-917 Φ3α)', () => {
  it('Α9 🔴 unpriced lines are NOT a 0 € budget — no source, and the count says why (mutation: hasUnitPrice → true)', () => {
    const row = rowOf([boq('b1', 'OIK-2', UNPRICED), boq('b2', 'OIK-2', UNPRICED)]);
    expect(row).toEqual(expect.objectContaining({ budgetSource: null, boqItemCount: 2, unpricedBoqItemCount: 2 }));
    expect(row.sources.boqItems.every(source => !source.priced && source.amount === 0)).toBe(true);
  });

  it('Α9 partially priced code: budget = the priced lines, the unpriced ones are counted apart', () => {
    const row = rowOf([boq('b1', 'OIK-2'), boq('b2', 'OIK-2', UNPRICED)]);
    expect(row).toEqual(expect.objectContaining({ budgetSource: 'boq', budget: 100, unpricedBoqItemCount: 1 }));
  });

  it('Α10 🔴 allowance + draft take-off: budget = allowance, the BOQ is estimate accuracy, NOT added (mutation: sum)', () => {
    const row = rowOf([boq('b1', 'OIK-2', { status: 'draft' })], [budgetLine('OIK-2', 150)]);
    expect(row).toEqual(expect.objectContaining({ budgetSource: 'allowance', budget: 150, boqAmount: 100, estimateDelta: -50 }));
  });

  it('Α10 allowance without any priced BOQ: no estimate accuracy to report', () => {
    const row = rowOf([boq('b1', 'OIK-2', UNPRICED)], [budgetLine('OIK-2', 150)]);
    expect(row).toEqual(expect.objectContaining({ budgetSource: 'allowance', budget: 150, estimateDelta: null }));
  });

  it('Α11 🔴 a fully priced signed-off baseline replaces the allowance', () => {
    const row = rowOf([boq('b1', 'OIK-2', { status: 'approved' })], [budgetLine('OIK-2', 150)]);
    expect(row).toEqual(expect.objectContaining({ budgetSource: 'boq', budget: 100, estimateDelta: null }));
  });

  it('Α11 🔴 ONE unpriced signed-off line keeps the allowance standing (mutation: yield on first frozen line)', () => {
    const row = rowOf(
      [boq('b1', 'OIK-2', { status: 'approved' }), boq('b2', 'OIK-2', { status: 'locked', ...UNPRICED })],
      [budgetLine('OIK-2', 150)],
    );
    expect(row).toEqual(expect.objectContaining({ budgetSource: 'allowance', budget: 150, frozenUnpricedBoqItemCount: 1 }));
  });

  it('Α12 🔴 a 2nd-level soft line rolls up into its group — one row, summed', () => {
    const { rows } = computeCostLedger([], [], {
      budgetLines: [budgetLine('SOFT-PERMITS', 1000), budgetLine('SOFT-PERMITS.TEE', 250)],
    });
    expect(rows).toEqual([expect.objectContaining({ categoryCode: 'SOFT-PERMITS', budgetSource: 'soft', budget: 1250 })]);
    expect(rows[0].sources.budgetLines).toHaveLength(2);
  });

  it('Α12 order: ΑΤΟΕ by catalogue → soft by declared order → OTHER', () => {
    const { rows } = computeCostLedger([boq('b1', 'OIK-10.20'), boq('b2', ''), boq('b3', 'OIK-2.03')], [], {
      budgetLines: [budgetLine('SOFT-CONTINGENCY', 1), budgetLine('SOFT-LAND', 1)],
    });
    expect(rows.map(row => row.categoryCode)).toEqual(['OIK-2', 'OIK-10', 'SOFT-LAND', 'SOFT-CONTINGENCY', 'OTHER']);
  });

  it('the category filter applies to budget lines too', () => {
    const { rows } = computeCostLedger([], [], {
      budgetLines: [budgetLine('SOFT-LAND', 5), budgetLine('OIK-2', 9)],
      categoryFilter: ['OIK-2'],
    });
    expect(rows.map(row => row.categoryCode)).toEqual(['OIK-2']);
  });
});
