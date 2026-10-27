/**
 * ADR-330 §5.1 S3.2 — anchors for the buyout model + the «Coverage» tab's view rules.
 * Each `it` names the mutation it exists to catch.
 */

import { computeCostLedger, type LedgerBoqItem, type LedgerPurchaseOrder } from '@/services/project-cost/cost-ledger';
import type { PurchaseOrderItem, PurchaseOrderStatus } from '@/types/procurement';
import {
  BUYOUT_OPEN_STATUSES,
  BUYOUT_STATUSES,
  deriveProjectBuyout,
  resolveBuyoutStatus,
  type BuyoutRfqRef,
} from '../project-buyout';
import {
  countInProgress,
  filterBuyoutItems,
  groupBuyoutItems,
  pruneSelection,
  toggleGroupSelection,
} from '@/components/projects/procurement/buyout/buyout-view';

function boq(id: string, categoryCode: string, overrides: Partial<LedgerBoqItem> = {}): LedgerBoqItem {
  return {
    id, categoryCode, title: `Εργασία ${id}`, unit: 'm2', estimatedQuantity: 10, wasteFactor: 0,
    materialUnitCost: 5, laborUnitCost: 3, equipmentUnitCost: 2, ...overrides,
  };
}

function poLine(boqItemId: string): PurchaseOrderItem {
  return {
    id: `poi_${boqItemId}`, description: '', quantity: 1, unit: 'pcs', unitPrice: 1, total: 1,
    boqItemId, categoryCode: 'OIK-2', quantityReceived: 0, quantityRemaining: 1,
  };
}

function po(id: string, status: PurchaseOrderStatus, boqIds: string[]): LedgerPurchaseOrder {
  return { id, poNumber: `PO-${id}`, status, items: boqIds.map(poLine) };
}

const rfq = (boqItemId: string, rfqId = 'rfq_1'): BuyoutRfqRef => ({ boqItemId, rfqId, rfqTitle: `RFQ ${rfqId}` });

function buyoutOf() {
  const ledger = computeCostLedger(
    [boq('b1', 'OIK-2'), boq('b2', 'OIK-2'), boq('b3', 'OIK-1'), boq('b4', 'OIK-1'), boq('b5', 'OIK-1', { materialUnitCost: 0, laborUnitCost: 0, equipmentUnitCost: 0 })],
    [po('p1', 'ordered', ['b1']), po('p2', 'draft', ['b2'])],
  );
  return deriveProjectBuyout(ledger, [rfq('b2'), rfq('b3'), rfq('gone')]);
}

describe('resolveBuyoutStatus — precedence committed > ordering > sourcing > uncovered', () => {
  it('a committed PO wins over a pending PO and an open RFQ', () => {
    expect(resolveBuyoutStatus([{ stage: 'pending' }, { stage: 'committed' }], 1)).toBe('committed');
  });
  it('a pending PO wins over an open RFQ', () => {
    expect(resolveBuyoutStatus([{ stage: 'pending' }], 2)).toBe('ordering');
  });
  it('an open RFQ alone ⇒ sourcing; nothing ⇒ uncovered', () => {
    expect(resolveBuyoutStatus([], 1)).toBe('sourcing');
    expect(resolveBuyoutStatus([], 0)).toBe('uncovered');
  });
});

describe('deriveProjectBuyout', () => {
  it('one item per counted line, each with the status its links give it', () => {
    const statusById = Object.fromEntries(buyoutOf().items.map(item => [item.id, item.status]));
    expect(statusById).toEqual({ b1: 'committed', b2: 'ordering', b3: 'sourcing', b4: 'uncovered', b5: 'uncovered' });
  });

  it('list total and covered count EQUAL the ledger numbers behind the overview card', () => {
    const buyout = buyoutOf();
    expect(buyout.items).toHaveLength(buyout.boqItemCount);
    expect(buyout.totals.committed.count).toBe(buyout.coveredBoqItemCount);
  });

  it('totals per status sum count and value; an RFQ for an unknown line adds nothing', () => {
    const { totals } = buyoutOf();
    expect(totals.committed).toEqual({ count: 1, amount: 100 });
    expect(totals.uncovered).toEqual({ count: 2, amount: 100 });
    expect(BUYOUT_STATUSES.reduce((sum, status) => sum + totals[status].count, 0)).toBe(5);
  });

  it('an unpriced line is declared «unpriced», never a silent 0 €', () => {
    expect(buyoutOf().items.find(item => item.id === 'b5')).toEqual(expect.objectContaining({ priced: false, amount: 0 }));
  });

  it('every covering document is named — the PO number and the RFQ title', () => {
    const b2 = buyoutOf().items.find(item => item.id === 'b2');
    expect(b2?.purchaseOrders).toEqual([{ poId: 'p2', poNumber: 'PO-p2', stage: 'pending' }]);
    expect(b2?.rfqs).toEqual([{ rfqId: 'rfq_1', rfqTitle: 'RFQ rfq_1' }]);
  });

  it('the overview card drills into everything that is NOT committed', () => {
    expect([...BUYOUT_OPEN_STATUSES].sort()).toEqual(['ordering', 'sourcing', 'uncovered']);
  });
});

describe('buyout view rules', () => {
  it('filter by status and by search (title or code)', () => {
    const { items } = buyoutOf();
    expect(filterBuyoutItems(items, ['uncovered'], '').map(item => item.id)).toEqual(['b4', 'b5']);
    expect(filterBuyoutItems(items, [], 'b3').map(item => item.id)).toEqual(['b3']);
  });

  it('groups by category in cost-code order with covered count and open €', () => {
    const groups = groupBuyoutItems(buyoutOf().items);
    expect(groups.map(group => [group.categoryCode, group.coveredCount, group.openAmount])).toEqual([
      ['OIK-1', 0, 200],
      ['OIK-2', 1, 100],
    ]);
  });

  it('group toggle selects only open work, and a second toggle clears it', () => {
    const [oik1, oik2] = groupBuyoutItems(buyoutOf().items);
    expect([...toggleGroupSelection(oik2, new Set())]).toEqual(['b2']);
    const all = toggleGroupSelection(oik1, new Set());
    expect(toggleGroupSelection(oik1, all).size).toBe(0);
  });

  it('a committed line can never stay selected; in-progress selections are counted for the warning', () => {
    const { items } = buyoutOf();
    expect([...pruneSelection(new Set(['b1', 'b2', 'gone']), items)]).toEqual(['b2']);
    expect(countInProgress(items, new Set(['b2', 'b3', 'b4']))).toBe(2);
  });
});
