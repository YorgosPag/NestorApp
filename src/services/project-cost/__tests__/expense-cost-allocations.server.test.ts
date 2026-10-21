/**
 * @jest-environment node
 *
 * ADR-917 Φ4 — the ONE writer of `costAllocations` on the fake Firestore: tenant fence on document / project / PO,
 * a PO line must name a PO of THE SAME project, compare-and-set, idempotent replays, `allocatedProjectIds` and
 * `PurchaseOrder.linkedInvoiceIds` written in the same transaction (never disagreeing with the lines), history on
 * the project and the PO, and the ledger reads what was written. All data is synthetic.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { ExpenseCostAllocation } from '@/subapps/accounting/types/documents';
import { writeExpenseCostAllocations, type ExpenseAllocationWrite } from '../expense-cost-allocations.server';
import { loadProjectCostLedger } from '../project-cost-ledger.server';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') },
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EntityAuditService } = require('@/services/entity-audit.service') as { EntityAuditService: { recordChange: jest.Mock } };

const COMPANY = 'comp_alfa';
const OTHER = 'comp_beta';
const DOC = 'expdoc_1';

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;

const line = (over: Partial<ExpenseCostAllocation> = {}): ExpenseCostAllocation => ({
  projectId: 'proj_1', costCode: 'OIK-3', netAmount: 600, purchaseOrderId: 'po_1', origin: 'po_proposal', ...over,
});

function write(over: Partial<ExpenseAllocationWrite> = {}) {
  return writeExpenseCostAllocations(db(), {
    actor: { companyId: COMPANY, uid: 'user_1', name: 'acc@example.test' },
    documentId: DOC,
    lines: [line()],
    expectedRevision: 0,
    nowIso: '2026-10-21T09:00:00.000Z',
    ...over,
  });
}

const purchaseOrder = (projectId: string, companyId = COMPANY) => ({
  companyId, projectId, poNumber: 'PO-0042', status: 'ordered', isDeleted: false, linkedInvoiceIds: [], dateInvoiced: null,
  items: [{ id: 'poi_1', categoryCode: 'OIK-3', total: 1000, boqItemId: null, quantity: 1, unitPrice: 1000 }],
});

beforeEach(() => {
  fake = new FakeFirestore();
  EntityAuditService.recordChange.mockClear();
  fake.seed(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS, DOC, {
    companyId: COMPANY, status: 'confirmed', fileName: 'inv.pdf', confirmedNetAmount: 1000, confirmedIssuerName: 'ΑΛΦΑ',
    extractedData: { netAmount: 1000, documentNumber: '17' },
  });
  fake.seed(COLLECTIONS.PROJECTS, 'proj_1', { companyId: COMPANY, name: 'Έργο 1' });
  fake.seed(COLLECTIONS.PROJECTS, 'proj_2', { companyId: COMPANY, name: 'Έργο 2' });
  fake.seed(COLLECTIONS.PROJECTS, 'proj_x', { companyId: OTHER, name: 'Ξένο' });
  fake.seed(COLLECTIONS.PURCHASE_ORDERS, 'po_1', purchaseOrder('proj_1'));
  fake.seed(COLLECTIONS.PURCHASE_ORDERS, 'po_2', purchaseOrder('proj_2'));
  fake.seed(COLLECTIONS.PURCHASE_ORDERS, 'po_x', purchaseOrder('proj_1', OTHER));
});

const stored = () => fake.getAllDocs(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS)[DOC];
const linkedOf = (poId: string) => fake.getAllDocs(COLLECTIONS.PURCHASE_ORDERS)[poId].linkedInvoiceIds;

describe('write + projections in ONE transaction', () => {
  it('stores the lines, revision 1, the query field — and links the PO, with history on project and PO', async () => {
    const outcome = await write();
    expect(outcome).toEqual({ kind: 'changed', lines: [line()], revision: 1 });
    expect(stored()).toEqual(expect.objectContaining({ costAllocations: [line()], allocatedProjectIds: ['proj_1'], allocationRevision: 1 }));
    expect(linkedOf('po_1')).toEqual([DOC]);
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'project', entityId: 'proj_1', entityName: 'Έργο 1',
      changes: [expect.objectContaining({ field: 'expenseAllocations', op: 'added' })],
    }));
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'purchase_order', entityId: 'po_1', action: 'linked',
    }));
  });

  it('🔴 moving the line off the PO un-links it (arrayRemove) — the projection never disagrees', async () => {
    await write();
    await write({ lines: [line({ purchaseOrderId: null, origin: 'manual' })], expectedRevision: 1 });
    expect(linkedOf('po_1')).toEqual([]);
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'po_1', action: 'unlinked' }));
  });

  it('`[]` clears the allocation and the query field', async () => {
    await write();
    const outcome = await write({ lines: [], expectedRevision: 1 });
    expect(outcome).toEqual({ kind: 'changed', lines: [], revision: 2 });
    expect(stored()).toEqual(expect.objectContaining({ costAllocations: [], allocatedProjectIds: [] }));
  });

  it('🔴 a replay of the same lines is `unchanged`: no write, no bump, no history, no second link', async () => {
    await write();
    EntityAuditService.recordChange.mockClear();
    const outcome = await write({ expectedRevision: 0 });
    expect(outcome).toEqual({ kind: 'unchanged', lines: [line()], revision: 1 });
    expect(linkedOf('po_1')).toEqual([DOC]);
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  it('🔴 a stale revision is `conflict` — nothing changes', async () => {
    await write();
    const outcome = await write({ lines: [line({ netAmount: 500 })], expectedRevision: 0 });
    expect(outcome).toEqual({ kind: 'conflict', currentRevision: 1 });
    expect(stored().costAllocations).toEqual([line()]);
  });
});

describe('references and the document — judged inside the transaction', () => {
  it('🔴 a PO of ANOTHER project of ours is refused (an invoice of A never inflates B)', async () => {
    const outcome = await write({ lines: [line({ purchaseOrderId: 'po_2' })] });
    expect(outcome).toEqual({ kind: 'invalid_reference', problem: 'purchase_order_project', id: 'po_2' });
    expect(stored().costAllocations).toBeUndefined();
  });

  it('🔴 a foreign PO and a foreign project read as absent', async () => {
    expect(await write({ lines: [line({ purchaseOrderId: 'po_x' })] }))
      .toEqual({ kind: 'invalid_reference', problem: 'purchase_order', id: 'po_x' });
    expect(await write({ lines: [line({ projectId: 'proj_x', purchaseOrderId: null })] }))
      .toEqual({ kind: 'invalid_reference', problem: 'project', id: 'proj_x' });
  });

  it('🔴 a foreign document is `not_found` (same as missing)', async () => {
    expect(await write({ actor: { companyId: OTHER, uid: 'u', name: null } })).toEqual({ kind: 'not_found' });
    expect(await write({ documentId: 'nope' })).toEqual({ kind: 'not_found' });
  });

  it('🔴 Σ > net is `invalid`; a rejected document is `not_allocatable`', async () => {
    expect(await write({ lines: [line({ netAmount: 1000.01 })] }))
      .toEqual({ kind: 'invalid', issues: [{ kind: 'exceeds_net', allocated: 1000.01, netAmount: 1000 }] });
    fake.seed(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS, DOC, { companyId: COMPANY, status: 'rejected', extractedData: { netAmount: 1 } });
    expect(await write()).toEqual({ kind: 'not_allocatable', status: 'rejected' });
  });
});

describe('the ledger reads what the writer wrote (ONE loader)', () => {
  it('confirmed invoice against the project PO ⇒ invoiced, no double count; another project sees nothing', async () => {
    await write({ lines: [line(), line({ projectId: 'proj_2', costCode: 'SOFT-LEGAL', netAmount: 100, purchaseOrderId: null, origin: 'manual' })] });
    const ledger1 = await loadProjectCostLedger(db(), COMPANY, 'proj_1');
    expect(ledger1.rows.find(r => r.categoryCode === 'OIK-3')).toEqual(expect.objectContaining({ committed: 1000, invoiced: 600, overbilled: 0 }));
    const ledger2 = await loadProjectCostLedger(db(), COMPANY, 'proj_2');
    // proj_2 has its own PO on OIK-3 (committed, nothing invoiced) — the invoice of proj_1 never reaches it
    expect(ledger2.rows.map(r => [r.categoryCode, r.committed, r.invoiced, r.directCost]))
      .toEqual([['OIK-3', 1000, 0, 0], ['SOFT-LEGAL', 0, 100, 100]]);
    expect(ledger2.expenses.partiallyAllocatedDocumentCount).toBe(1);
  });

  it('🔴 a document matched to the project PO but not allocated is DECLARED awaiting allocation', async () => {
    fake.seed(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS, 'expdoc_2', {
      companyId: COMPANY, status: 'review', suggestedPOId: 'po_1', extractedData: { netAmount: 50 },
    });
    fake.seed(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS, 'expdoc_3', {
      companyId: COMPANY, status: 'rejected', suggestedPOId: 'po_1', extractedData: { netAmount: 50 },
    });
    const ledger = await loadProjectCostLedger(db(), COMPANY, 'proj_1');
    expect(ledger.expenses.awaitingAllocationCount).toBe(1);
  });
});
