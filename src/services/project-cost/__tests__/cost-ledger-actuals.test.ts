/**
 * ADR-917 Φ4 — anchors for the ACTUALS of the ONE ledger: invoiced from confirmed expense documents, direct cost
 * (no PO), the double-count rule Α3 (a PO-billed invoice is already in the PO) and over-billing (only the excess
 * enters the projection), «in review» shown never summed, completeness declared. Each `it` names its mutation.
 * All data is synthetic.
 */

import type { PurchaseOrderItem, PurchaseOrderStatus } from '@/types/procurement';
import type { ReceivedExpenseDocument } from '@/subapps/accounting/types/documents';
import { computeCostLedger, type LedgerExpenseDocument, type LedgerPurchaseOrder } from '../cost-ledger';
import { toLedgerExpenseDocument } from '../cost-ledger-actuals';
import { toCostLedgerView } from '../cost-ledger-view';

const poLine = (categoryCode: string, total: number): PurchaseOrderItem => ({
  id: `poi_${categoryCode}_${total}`, description: '', quantity: 1, unit: 'pcs', unitPrice: total, total,
  boqItemId: null, categoryCode, quantityReceived: 0, quantityRemaining: 1,
});

const po = (id: string, status: PurchaseOrderStatus, items: PurchaseOrderItem[]): LedgerPurchaseOrder =>
  ({ id, poNumber: `PO-${id}`, status, items });

const invoice = (
  id: string,
  allocations: LedgerExpenseDocument['allocations'],
  over: Partial<LedgerExpenseDocument> = {},
): LedgerExpenseDocument => ({ id, label: `Τιμολόγιο ${id}`, status: 'confirmed', coverage: 'full', allocations, ...over });

const row = (ledger: ReturnType<typeof computeCostLedger>, code: string) => ledger.rows.find(r => r.categoryCode === code);
const viewRow = (ledger: ReturnType<typeof computeCostLedger>, code: string) =>
  toCostLedgerView('proj_1', ledger, { includeSources: false }).rows.find(r => r.costCode === code);

describe('Α3 — an invoice billed against a PO is NOT added on top of the PO', () => {
  it('🔴 committed 1000 + invoice 600 against it ⇒ projected stays 1000, invoiced 600', () => {
    const ledger = computeCostLedger([], [po('po_1', 'ordered', [poLine('OIK-3', 1000)])], {
      expenseDocuments: [invoice('e1', [{ costCode: 'OIK-3', netAmount: 600, purchaseOrderId: 'po_1' }])],
    });
    expect(row(ledger, 'OIK-3')).toEqual(expect.objectContaining({ committed: 1000, invoiced: 600, directCost: 0, overbilled: 0 }));
    expect(viewRow(ledger, 'OIK-3')?.projected).toBe(1000);
  });

  it('🔴 the same holds for a PO still pending (draft / approved) — it is in «pending» already', () => {
    const ledger = computeCostLedger([], [po('po_1', 'approved', [poLine('OIK-3', 500)])], {
      expenseDocuments: [invoice('e1', [{ costCode: 'OIK-3', netAmount: 500, purchaseOrderId: 'po_1' }])],
    });
    expect(viewRow(ledger, 'OIK-3')?.projected).toBe(500);
  });
});

describe('direct cost — invoiced with no PO enters the projection', () => {
  it('🔴 a notary invoice of 300 with no PO ⇒ invoiced 300, direct 300, projected 300', () => {
    const ledger = computeCostLedger([], [], {
      expenseDocuments: [invoice('e1', [{ costCode: 'SOFT-LEGAL', netAmount: 300, purchaseOrderId: null }])],
    });
    expect(row(ledger, 'SOFT-LEGAL')).toEqual(expect.objectContaining({ invoiced: 300, directCost: 300 }));
    expect(viewRow(ledger, 'SOFT-LEGAL')?.projected).toBe(300);
  });

  it('a 2nd-level code rolls up into its group row', () => {
    const ledger = computeCostLedger([], [], {
      expenseDocuments: [invoice('e1', [{ costCode: 'SOFT-PERMITS.TEE', netAmount: 80, purchaseOrderId: null }])],
    });
    expect(row(ledger, 'SOFT-PERMITS')?.invoiced).toBe(80);
  });
});

describe('over-billing — only the excess over the PO on that code is new cost', () => {
  it('🔴 PO 1000 on OIK-3, invoices 700 + 500 against it ⇒ overbilled 200, projected 1200', () => {
    const ledger = computeCostLedger([], [po('po_1', 'ordered', [poLine('OIK-3', 1000)])], {
      expenseDocuments: [
        invoice('e1', [{ costCode: 'OIK-3', netAmount: 700, purchaseOrderId: 'po_1' }]),
        invoice('e2', [{ costCode: 'OIK-3', netAmount: 500, purchaseOrderId: 'po_1' }]),
      ],
    });
    expect(row(ledger, 'OIK-3')).toEqual(expect.objectContaining({ invoiced: 1200, overbilled: 200 }));
    expect(viewRow(ledger, 'OIK-3')?.projected).toBe(1200);
  });

  it('🔴 compared per (PO, code): spare room on another code of the PO does not absorb it', () => {
    const ledger = computeCostLedger([], [po('po_1', 'ordered', [poLine('OIK-3', 100), poLine('OIK-5', 900)])], {
      expenseDocuments: [invoice('e1', [{ costCode: 'OIK-3', netAmount: 150, purchaseOrderId: 'po_1' }])],
    });
    expect(row(ledger, 'OIK-3')?.overbilled).toBe(50);
    expect(row(ledger, 'OIK-5')?.overbilled).toBe(0);
  });

  it('🔴 an invoice against a cancelled PO is all new cost (the PO carries nothing)', () => {
    const ledger = computeCostLedger([], [po('po_1', 'cancelled', [poLine('OIK-3', 1000)])], {
      expenseDocuments: [invoice('e1', [{ costCode: 'OIK-3', netAmount: 400, purchaseOrderId: 'po_1' }])],
    });
    expect(viewRow(ledger, 'OIK-3')?.projected).toBe(400);
  });
});

describe('what counts — confirmed only; review shown, declared, never summed', () => {
  it('🔴 a document in review sums nothing, but stays on the drill-down and in the completeness', () => {
    const ledger = computeCostLedger([], [], {
      expenseDocuments: [invoice('e1', [{ costCode: 'OIK-3', netAmount: 900, purchaseOrderId: null }], { status: 'review' })],
    });
    expect(row(ledger, 'OIK-3')).toEqual(expect.objectContaining({ invoiced: 0, directCost: 0 }));
    expect(row(ledger, 'OIK-3')?.sources.expenseDocuments).toEqual([expect.objectContaining({ id: 'e1', counted: false, amount: 900 })]);
    expect(ledger.expenses).toEqual(expect.objectContaining({ countedDocumentCount: 0, inReviewDocumentCount: 1 }));
  });

  it('rejected / processing documents are ignored entirely', () => {
    const ledger = computeCostLedger([], [], {
      expenseDocuments: [
        invoice('e1', [{ costCode: 'OIK-3', netAmount: 9, purchaseOrderId: null }], { status: 'rejected' }),
        invoice('e2', [{ costCode: 'OIK-3', netAmount: 9, purchaseOrderId: null }], { status: 'processing' }),
      ],
    });
    expect(ledger.rows).toEqual([]);
    expect(ledger.expenses.inReviewDocumentCount).toBe(0);
  });

  it('partly allocated counted documents and those awaiting allocation are DECLARED', () => {
    const ledger = computeCostLedger([], [], {
      expenseDocuments: [invoice('e1', [{ costCode: 'OIK-3', netAmount: 10, purchaseOrderId: null }], { coverage: 'partial' })],
      awaitingAllocationCount: 3,
    });
    expect(ledger.expenses).toEqual({
      countedDocumentCount: 1, inReviewDocumentCount: 0, partiallyAllocatedDocumentCount: 1, awaitingAllocationCount: 3,
    });
  });

  it('the code filter applies to actuals like to every other source', () => {
    const ledger = computeCostLedger([], [], {
      categoryFilter: ['OIK-5'],
      expenseDocuments: [invoice('e1', [{ costCode: 'OIK-3', netAmount: 10, purchaseOrderId: null }])],
    });
    expect(ledger.rows).toEqual([]);
  });

  it('two lines of one document on one code are ONE source, summed in cents', () => {
    const ledger = computeCostLedger([], [po('po_1', 'ordered', [poLine('OIK-3', 1000)])], {
      expenseDocuments: [invoice('e1', [
        { costCode: 'OIK-3.01', netAmount: 0.1, purchaseOrderId: 'po_1' },
        { costCode: 'OIK-3.02', netAmount: 0.2, purchaseOrderId: 'po_1' },
      ])],
    });
    expect(row(ledger, 'OIK-3')?.sources.expenseDocuments).toEqual([expect.objectContaining({ id: 'e1', amount: 0.3 })]);
    expect(row(ledger, 'OIK-3')?.invoiced).toBe(0.3);
  });
});

describe('view totals + the stored-document mapping', () => {
  it('totals carry invoiced and direct cost over every code', () => {
    const ledger = computeCostLedger([], [], {
      expenseDocuments: [invoice('e1', [
        { costCode: 'OIK-3', netAmount: 100, purchaseOrderId: null },
        { costCode: 'SOFT-LEGAL', netAmount: 50, purchaseOrderId: null },
      ])],
    });
    const { totals, isEmpty } = toCostLedgerView('proj_1', ledger, { includeSources: false });
    expect(totals).toEqual(expect.objectContaining({ invoiced: 150, directCost: 150 }));
    expect(isEmpty).toBe(false);
  });

  it('🔴 «nothing invoiced yet» is null, never 0 € — on the row and in the totals', () => {
    const ledger = computeCostLedger([], [po('po_1', 'ordered', [poLine('OIK-3', 1000)])], {
      expenseDocuments: [invoice('e1', [{ costCode: 'OIK-3', netAmount: 900, purchaseOrderId: 'po_1' }], { status: 'review' })],
    });
    const view = toCostLedgerView('proj_1', ledger, { includeSources: false });
    expect(view.rows.find(r => r.costCode === 'OIK-3')?.invoiced).toBeNull();
    expect(view.totals.invoiced).toBeNull();
  });

  it('a stored document maps to the lines of THIS project only, with its whole-document coverage', () => {
    const stored = {
      status: 'confirmed', fileName: 'f.pdf', confirmedNetAmount: 100, confirmedIssuerName: 'ΑΛΦΑ',
      extractedData: { netAmount: 100, documentNumber: '7' },
      costAllocations: [
        { projectId: 'proj_1', costCode: 'OIK-3', netAmount: 60, purchaseOrderId: null, origin: 'manual' },
        { projectId: 'proj_2', costCode: 'OIK-3', netAmount: 40, purchaseOrderId: null, origin: 'manual' },
      ],
    } as unknown as ReceivedExpenseDocument;
    expect(toLedgerExpenseDocument('e1', stored, 'proj_1')).toEqual({
      id: 'e1', label: 'ΑΛΦΑ · 7', status: 'confirmed', coverage: 'full',
      allocations: [{ costCode: 'OIK-3', netAmount: 60, purchaseOrderId: null }],
    });
  });
});
