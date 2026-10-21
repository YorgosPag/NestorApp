/**
 * ADR-917 Φ4 — the ONE arithmetic of expense cost allocation: the proposal from a PO (exact, deterministic, in
 * cents), validation (one line per (project, code, PO), Σ ≤ net, taxonomy codes) and derived coverage («unknown» is
 * never «full»). All data is synthetic.
 */

import type { ExpenseCostAllocation } from '@/subapps/accounting/types/documents';
import type { PurchaseOrderItem } from '@/types/procurement';
import {
  allocatedProjectIdsOf,
  allocatedPurchaseOrderIdsOf,
  allocationCoverageOf,
  EXPENSE_ALLOCATION_MAX_LINES,
  expenseDocumentLabelOf,
  expenseNetAmountOf,
  normalizeAllocations,
  proposeAllocationsFromPurchaseOrder,
  validateAllocations,
} from '../expense-allocation';

const item = (categoryCode: string, total: number): PurchaseOrderItem => ({
  id: `poi_${categoryCode}_${total}`, description: 'x', quantity: 1, unit: 'pcs', unitPrice: total, total,
  boqItemId: null, categoryCode, quantityReceived: 0, quantityRemaining: 1,
});

const po = (items: PurchaseOrderItem[]) => ({ id: 'po_1', projectId: 'proj_1', items });

const line = (over: Partial<ExpenseCostAllocation> = {}): ExpenseCostAllocation => ({
  projectId: 'proj_1', costCode: 'OIK-3', netAmount: 100, purchaseOrderId: null, origin: 'manual', ...over,
});

const sumCents = (lines: readonly ExpenseCostAllocation[]) => lines.reduce((acc, l) => acc + Math.round(l.netAmount * 100), 0);

describe('proposal from the PO (SAP proportional distribution)', () => {
  it('splits the net amount by the PO line totals, per cost code, against THAT PO and project', () => {
    const proposal = proposeAllocationsFromPurchaseOrder(po([item('OIK-3', 600), item('OIK-5', 400)]), 500);
    expect(proposal).toEqual([
      { projectId: 'proj_1', costCode: 'OIK-3', netAmount: 300, purchaseOrderId: 'po_1', origin: 'po_proposal' },
      { projectId: 'proj_1', costCode: 'OIK-5', netAmount: 200, purchaseOrderId: 'po_1', origin: 'po_proposal' },
    ]);
  });

  it('🔴 the parts ALWAYS sum to the invoice exactly — the remainder cent goes by largest fraction', () => {
    const proposal = proposeAllocationsFromPurchaseOrder(po([item('OIK-3', 1), item('OIK-5', 1), item('OIK-7', 1)]), 100);
    expect(sumCents(proposal)).toBe(10000);
    expect(proposal.map(l => l.netAmount)).toEqual([33.34, 33.33, 33.33]);
  });

  it('is deterministic: the same PO + amount gives the same proposal, whatever the line order', () => {
    const a = proposeAllocationsFromPurchaseOrder(po([item('OIK-5', 1), item('OIK-3', 1), item('OIK-7', 1)]), 0.05);
    const b = proposeAllocationsFromPurchaseOrder(po([item('OIK-7', 1), item('OIK-3', 1), item('OIK-5', 1)]), 0.05);
    expect(a).toEqual(b);
    expect(sumCents(a)).toBe(5);
  });

  it('several lines of one code are ONE share', () => {
    const proposal = proposeAllocationsFromPurchaseOrder(po([item('OIK-3', 100), item('OIK-3', 100), item('OIK-5', 200)]), 40);
    expect(proposal.map(l => [l.costCode, l.netAmount])).toEqual([['OIK-3', 20], ['OIK-5', 20]]);
  });

  it('nothing to propose ⇒ [] (unknown or zero net, PO without priced lines, codes outside the taxonomy)', () => {
    expect(proposeAllocationsFromPurchaseOrder(po([item('OIK-3', 100)]), null)).toEqual([]);
    expect(proposeAllocationsFromPurchaseOrder(po([item('OIK-3', 100)]), 0)).toEqual([]);
    expect(proposeAllocationsFromPurchaseOrder(po([item('OIK-3', 0)]), 100)).toEqual([]);
    expect(proposeAllocationsFromPurchaseOrder(po([item('free text', 100)]), 100)).toEqual([]);
  });
});

describe('validation — judged against the document', () => {
  it('a valid set, and the empty set (clears the allocation), have no issues', () => {
    expect(validateAllocations([line({ netAmount: 60 }), line({ costCode: 'SOFT-PERMITS', netAmount: 40 })], 100)).toEqual([]);
    expect(validateAllocations([], null)).toEqual([]);
  });

  it('🔴 Σ > net is refused; Σ = net and Σ < net (partial) are allowed', () => {
    expect(validateAllocations([line({ netAmount: 100.01 })], 100)).toEqual([{ kind: 'exceeds_net', allocated: 100.01, netAmount: 100 }]);
    expect(validateAllocations([line({ netAmount: 100 })], 100)).toEqual([]);
    expect(validateAllocations([line({ netAmount: 30 })], 100)).toEqual([]);
  });

  it('🔴 an unknown net amount cannot be allocated (it would be a guess)', () => {
    expect(validateAllocations([line()], null)).toEqual([{ kind: 'net_unknown' }]);
  });

  it('🔴 one line per (project, code, PO) — a duplicate is refused, never merged', () => {
    expect(validateAllocations([line({ netAmount: 10 }), line({ netAmount: 20 })], 100)).toEqual([{ kind: 'duplicate', index: 1 }]);
    expect(validateAllocations([line({ netAmount: 10 }), line({ netAmount: 20, purchaseOrderId: 'po_1' })], 100)).toEqual([]);
  });

  it('codes outside the taxonomy and non-positive amounts are refused by index', () => {
    expect(validateAllocations([line({ costCode: 'ΤΣΙΜΕΝΤΟ' }), line({ costCode: 'OIK-5', netAmount: 0 })], 100)).toEqual([
      { kind: 'invalid_code', index: 0 },
      { kind: 'non_positive', index: 1 },
    ]);
  });

  it('caps the number of lines', () => {
    const many = Array.from({ length: EXPENSE_ALLOCATION_MAX_LINES + 1 }, (_, i) => line({ projectId: `p${i}`, netAmount: 1 }));
    expect(validateAllocations(many, 1000)).toEqual([{ kind: 'too_many', max: EXPENSE_ALLOCATION_MAX_LINES }]);
  });

  it('normalizes to cents — float noise never reaches the disk', () => {
    expect(normalizeAllocations([line({ netAmount: 0.1 + 0.2 })])[0].netAmount).toBe(0.3);
  });
});

describe('coverage is derived — «χωρίς κατανομή» ≠ 0 €', () => {
  it('none / partial / full / over against the net amount', () => {
    expect(allocationCoverageOf(100, undefined)).toEqual({ state: 'none', allocated: 0, unallocated: 100 });
    expect(allocationCoverageOf(100, [line({ netAmount: 40 })])).toEqual({ state: 'partial', allocated: 40, unallocated: 60 });
    expect(allocationCoverageOf(100, [line({ netAmount: 60 }), line({ netAmount: 40 })])).toEqual({ state: 'full', allocated: 100, unallocated: 0 });
    expect(allocationCoverageOf(90, [line({ netAmount: 100 })])).toEqual({ state: 'over', allocated: 100, unallocated: 0 });
  });

  it('🔴 an unknown net amount is never «full»', () => {
    expect(allocationCoverageOf(null, [line()])).toEqual({ state: 'unknown', allocated: 100, unallocated: null });
    expect(allocationCoverageOf(null, [])).toEqual({ state: 'none', allocated: 0, unallocated: null });
  });

  it('the net amount: confirmed, else extracted, else unknown (never 0)', () => {
    const extracted = { netAmount: 80 } as never;
    expect(expenseNetAmountOf({ confirmedNetAmount: 75, extractedData: extracted })).toBe(75);
    expect(expenseNetAmountOf({ confirmedNetAmount: null, extractedData: extracted })).toBe(80);
    expect(expenseNetAmountOf({ confirmedNetAmount: null, extractedData: { netAmount: null } as never })).toBeNull();
  });
});

describe('projections and naming', () => {
  it('the query field and the PO links are unique and sorted', () => {
    const lines = [line({ projectId: 'b', purchaseOrderId: 'po_2' }), line({ projectId: 'a', costCode: 'OIK-5', purchaseOrderId: 'po_1' }),
      line({ projectId: 'b', costCode: 'OIK-7' })];
    expect(allocatedProjectIdsOf(lines)).toEqual(['a', 'b']);
    expect(allocatedPurchaseOrderIdsOf(lines)).toEqual(['po_1', 'po_2']);
  });

  it('a document is named by issuer · number, else by its file', () => {
    const extractedData = { issuerName: 'ΤΣΙΜΕΝΤΑ ΑΕ', documentNumber: 'ΤΠ-17' } as never;
    expect(expenseDocumentLabelOf({ confirmedIssuerName: null, extractedData, fileName: 'f.pdf' })).toBe('ΤΣΙΜΕΝΤΑ ΑΕ · ΤΠ-17');
    expect(expenseDocumentLabelOf({ confirmedIssuerName: null, extractedData: {} as never, fileName: 'f.pdf' })).toBe('f.pdf');
  });
});
