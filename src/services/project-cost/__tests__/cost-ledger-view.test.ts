/**
 * ADR-917 §7 — anchors for the wire shape every ledger reader receives.
 * Each `it` names the mutation it exists to catch.
 */

import { computeCostLedger, type LedgerBoqItem, type LedgerBudgetLine, type LedgerPurchaseOrder } from '../cost-ledger';
import { toCostLedgerView } from '../cost-ledger-view';
import type { PurchaseOrderItem, PurchaseOrderStatus } from '@/types/procurement';

function boq(id: string, categoryCode: string): LedgerBoqItem {
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
  };
}

function po(id: string, status: PurchaseOrderStatus, categoryCode: string, total: number): LedgerPurchaseOrder {
  const item: PurchaseOrderItem = {
    id: `poi_${id}`,
    description: '',
    quantity: 1,
    unit: 'pcs',
    unitPrice: total,
    total,
    boqItemId: null,
    categoryCode,
    quantityReceived: 0,
    quantityRemaining: 1,
  };
  return { id, poNumber: id, status, items: [item] };
}

function view(boqItems: LedgerBoqItem[], orders: LedgerPurchaseOrder[], includeSources = true) {
  return toCostLedgerView('p1', computeCostLedger(boqItems, orders), { includeSources });
}

describe('toCostLedgerView (ADR-917 Φ2)', () => {
  it('A4 — a code without BOQ has budget null, never 0 (and no variance)', () => {
    const { rows } = view([], [po('a', 'ordered', 'OIK-5', 40)]);
    expect(rows[0]).toEqual(expect.objectContaining({ costCode: 'OIK-5', budget: null, variance: null, projected: 40 }));
  });

  it('projected = committed + pending; variance = projected − budget (positive = over)', () => {
    const { rows } = view([boq('b1', 'OIK-2')], [po('a', 'ordered', 'OIK-2', 80), po('b', 'draft', 'OIK-2', 50)]);
    expect(rows[0]).toEqual(expect.objectContaining({ budget: 100, committed: 80, pending: 50, projected: 130, variance: 30 }));
  });

  it('totals compare like with like — unbudgeted money is reported apart, not added to projected', () => {
    const { totals, completeness } = view(
      [boq('b1', 'OIK-2')],
      [po('a', 'ordered', 'OIK-2', 60), po('b', 'ordered', 'OIK-9', 25)],
    );
    expect(totals).toEqual(expect.objectContaining({ budget: 100, projected: 60, variance: -40, unbudgetedProjected: 25 }));
    expect(completeness.codesWithoutBudget).toBe(1);
  });

  it('no BOQ at all ⇒ total budget and coverage are null, not 0', () => {
    const { totals, completeness } = view([], [po('a', 'ordered', 'OIK-1', 10)]);
    expect(totals.budget).toBeNull();
    expect(totals.variance).toBeNull();
    expect(completeness.coveragePct).toBeNull();
  });

  it('nothing recorded ⇒ isEmpty, no rows (a chart of zeros would lie)', () => {
    const ledger = view([], [po('a', 'cancelled', 'OIK-1', 10)]);
    expect(ledger.isEmpty).toBe(true);
    expect(ledger.rows).toEqual([]);
  });

  it('a pending-only code is shown (its money is projected, unlike the legacy chart filter)', () => {
    const { rows } = view([], [po('a', 'approved', 'OIK-3', 15)]);
    expect(rows).toEqual([expect.objectContaining({ costCode: 'OIK-3', pending: 15, projected: 15 })]);
  });

  it('figures-only view drops the per-document sources (AI context)', () => {
    const { rows } = view([boq('b1', 'OIK-2')], [], false);
    expect(rows[0].sources).toBeUndefined();
  });
});

describe('toCostLedgerView (ADR-917 Φ3α)', () => {
  const unpriced = (id: string, code: string): LedgerBoqItem => ({
    ...boq(id, code), materialUnitCost: 0, laborUnitCost: 0, equipmentUnitCost: 0,
  });
  const line = (costCode: string, amount: number): LedgerBudgetLine => ({ id: `pbl_${costCode}`, costCode, amount, note: null });

  it('Α9 an unpriced-only code is SHOWN with budget null and counted in completeness (not hidden, not 0 €)', () => {
    const ledgerView = toCostLedgerView('p1', computeCostLedger([unpriced('b1', 'OIK-2')], []), { includeSources: false });
    expect(ledgerView.isEmpty).toBe(false);
    expect(ledgerView.rows[0]).toEqual(expect.objectContaining({ budget: null, budgetSource: null, unpricedBoqItemCount: 1 }));
    expect(ledgerView.totals.budget).toBeNull();
    expect(ledgerView.completeness.unpricedBoqItemCount).toBe(1);
  });

  it('soft cost is part of the budget AND reported apart; allowance codes are counted', () => {
    const ledger = computeCostLedger([boq('b1', 'OIK-2')], [], {
      budgetLines: [line('SOFT-PERMITS', 40), line('OIK-3', 70)],
    });
    const { totals, completeness } = toCostLedgerView('p1', ledger, { includeSources: false });
    expect(totals).toEqual(expect.objectContaining({ budget: 210, softBudget: 40 }));
    expect(completeness.allowanceCodes).toBe(1);
  });

  it('Α13 🔴 land in exchange is valued in kind on the HARD budget and stays OUT of every total', () => {
    const ledger = computeCostLedger([boq('b1', 'OIK-2')], [], { budgetLines: [line('SOFT-LEGAL', 50)] });
    const ledgerView = toCostLedgerView('p1', ledger, { includeSources: false, bartexPercentage: 40 });
    expect(ledgerView.landExchange).toEqual({ bartexPercentage: 40, inKindValue: 40, basis: 'current-hard-budget' });
    expect(ledgerView.totals.budget).toBe(150);
  });

  it('no αντιπαροχή ⇒ no in-kind figure', () => {
    const ledgerView = toCostLedgerView('p1', computeCostLedger([boq('b1', 'OIK-2')], []), { includeSources: false });
    expect(ledgerView.landExchange).toBeNull();
  });
});
