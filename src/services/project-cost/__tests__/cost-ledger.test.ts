/**
 * ADR-917 §7 — anchors for the ONE budget-vs-actual arithmetic.
 * Each `it` names the mutation it exists to catch.
 */

import {
  computeCostLedger,
  hasBudgetOrCommitment,
  UNCATEGORIZED_COST_CODE,
  type LedgerBoqItem,
  type LedgerPurchaseOrder,
} from '../cost-ledger';
import type { PurchaseOrderItem, PurchaseOrderStatus } from '@/types/procurement';

function boq(id: string, categoryCode: string, overrides: Partial<LedgerBoqItem> = {}): LedgerBoqItem {
  return {
    id,
    categoryCode,
    title: `BOQ ${id}`,
    unit: 'm2',
    estimatedQuantity: 10,
    wasteFactor: 0,
    materialUnitCost: 5,
    laborUnitCost: 3,
    equipmentUnitCost: 2,
    ...overrides,
  };
}

function line(categoryCode: string, total: number, boqItemId: string | null = null): PurchaseOrderItem {
  return {
    id: `poi_${categoryCode}_${total}`,
    description: '',
    quantity: 1,
    unit: 'pcs',
    unitPrice: total,
    total,
    boqItemId,
    categoryCode,
    quantityReceived: 0,
    quantityRemaining: 1,
  };
}

let poSeq = 0;
function po(status: PurchaseOrderStatus, items: PurchaseOrderItem[], id = `po_${++poSeq}`): LedgerPurchaseOrder {
  return { id, poNumber: `PO-${id}`, status, items };
}

describe('computeCostLedger (ADR-917)', () => {
  it('A1 — budget per line = cost-engine total (10 × (5+3+2) = 100)', () => {
    const { rows } = computeCostLedger([boq('b1', 'OIK-2'), boq('b2', 'OIK-2')], []);
    expect(rows).toEqual([
      expect.objectContaining({ categoryCode: 'OIK-2', budget: 200, boqItemCount: 2 }),
    ]);
  });

  it('A2 — waste factor is clamped to 1 like cost-engine (a local copy would give 300)', () => {
    const { rows } = computeCostLedger([boq('b1', 'OIK-2', { wasteFactor: 2 })], []);
    expect(rows[0].budget).toBe(200);
  });

  it('A4 — a code with PO money but no BOQ reports boqItemCount 0 (no source ≠ 0 €)', () => {
    const { rows } = computeCostLedger([], [po('ordered', [line('OIK-5', 40)])]);
    expect(rows[0]).toEqual(expect.objectContaining({ categoryCode: 'OIK-5', boqItemCount: 0, committed: 40 }));
    expect(hasBudgetOrCommitment(rows[0])).toBe(true);
  });

  it('A5 — draft/approved go to pending, never to committed', () => {
    const { rows } = computeCostLedger([], [po('draft', [line('OIK-3', 10)]), po('approved', [line('OIK-3', 5)])]);
    expect(rows[0]).toEqual(expect.objectContaining({ pending: 15, committed: 0, delivered: 0 }));
    expect(hasBudgetOrCommitment(rows[0])).toBe(false);
  });

  it('delivered counts only delivered/closed; cancelled counts nowhere', () => {
    const { rows } = computeCostLedger([], [
      po('partially_delivered', [line('OIK-4', 10)]),
      po('closed', [line('OIK-4', 20)]),
      po('cancelled', [line('OIK-4', 99)]),
    ]);
    expect(rows[0]).toEqual(expect.objectContaining({ committed: 30, delivered: 20, pending: 0 }));
  });

  it('coverage counts existing BOQ lines once, attributed to the BOQ code', () => {
    const ledger = computeCostLedger(
      [boq('b1', 'OIK-2'), boq('b2', 'OIK-2')],
      [
        po('ordered', [line('OIK-2', 10, 'b1'), line('OIK-2', 10, 'b1'), line('OIK-2', 10, 'gone')]),
        po('draft', [line('OIK-2', 10, 'b2')]),
      ],
    );
    expect(ledger.coveredBoqItemCount).toBe(1);
    expect(ledger.boqItemCount).toBe(2);
    expect(ledger.rows[0].coveredBoqItemCount).toBe(1);
  });

  it('category filter applies to budget and commitments alike', () => {
    const { rows } = computeCostLedger(
      [boq('b1', 'OIK-1'), boq('b2', 'OIK-2')],
      [po('ordered', [line('OIK-1', 7), line('OIK-2', 9)])],
      { categoryFilter: ['OIK-2'] },
    );
    expect(rows.map(r => r.categoryCode)).toEqual(['OIK-2']);
    expect(rows[0]).toEqual(expect.objectContaining({ budget: 100, committed: 9 }));
  });

  it('lines without a code land in the uncategorized bucket', () => {
    const { rows } = computeCostLedger([boq('b1', '')], [po('ordered', [line('', 3)])]);
    expect(rows).toEqual([expect.objectContaining({ categoryCode: UNCATEGORIZED_COST_CODE, budget: 100, committed: 3 })]);
  });

  it('sources — one order with two lines under one code is ONE source with the summed amount', () => {
    const { rows } = computeCostLedger([], [po('ordered', [line('OIK-6', 10), line('OIK-6', 5)], 'po_a')]);
    expect(rows[0].sources.purchaseOrders).toEqual([
      { id: 'po_a', poNumber: 'PO-po_a', status: 'ordered', amount: 15 },
    ]);
  });

  it('sources — every BOQ line behind the budget is listed with its cost-engine amount', () => {
    const { rows } = computeCostLedger([boq('b1', 'OIK-2'), boq('b2', 'OIK-2')], []);
    expect(rows[0].sources.boqItems).toEqual([
      { id: 'b1', costCode: 'OIK-2', title: 'BOQ b1', amount: 100, priced: true },
      { id: 'b2', costCode: 'OIK-2', title: 'BOQ b2', amount: 100, priced: true },
    ]);
  });

  it('🔴 article codes roll up to their ΑΤΟΕ group — a BOQ article and a PO group line meet in ONE row', () => {
    const { rows } = computeCostLedger(
      [boq('b1', 'OIK-2.03'), boq('b2', 'OIK-2.07')],
      [po('ordered', [line('OIK-2', 30, 'b1')], 'po_a')],
    );
    expect(rows).toEqual([
      expect.objectContaining({ categoryCode: 'OIK-2', budget: 200, boqItemCount: 2, committed: 30, coveredBoqItemCount: 1 }),
    ]);
    expect(rows[0].sources.boqItems.map(s => s.costCode)).toEqual(['OIK-2.03', 'OIK-2.07']);
  });

  it('a group filter matches the articles under it', () => {
    const { rows } = computeCostLedger([boq('b1', 'OIK-10.20'), boq('b2', 'OIK-2.03')], [], { categoryFilter: ['OIK-10'] });
    expect(rows.map(r => r.categoryCode)).toEqual(['OIK-10']);
  });

  it('rows follow the ΑΤΟΕ catalogue order (OIK-2 before OIK-10), codes outside it last', () => {
    const { rows } = computeCostLedger([boq('b1', 'OIK-10.20'), boq('b2', ''), boq('b3', 'OIK-2.03')], []);
    expect(rows.map(r => r.categoryCode)).toEqual(['OIK-2', 'OIK-10', UNCATEGORIZED_COST_CODE]);
  });
});
