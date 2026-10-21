import 'server-only';

/**
 * Expense cost allocations — the ONE writer of `costAllocations` (ADR-917 Φ4 · §4 Γ1)
 *
 * What it guarantees, all inside ONE transaction:
 * - **Tenant**: the document, every project and every purchase order belong to the caller's company —
 *   a foreign or missing one is the same answer (no existence oracle).
 * - **Integrity**: a line billed against a PO names a PO of THE SAME project (an invoice of project A can never
 *   inflate project B through a PO of A); codes come from the taxonomy; Σ ≤ the document's net amount.
 * - **Compare-and-set** on `allocationRevision` — two people allocating never silently overwrite each other.
 * - **Same lines ⇒ `unchanged`**: no write, no revision bump, no history (idempotent replays).
 * - **One projection**: `allocatedProjectIds` (the query field) and `PurchaseOrder.linkedInvoiceIds` are written
 *   HERE and nowhere else, in the same transaction ⇒ they can never disagree with the lines.
 *
 * History (ADR-195) after the commit, from the same `previous` the transaction saw: on every affected PROJECT
 * (collection `expenseAllocations`) and on every PO that gained / lost the invoice.
 *
 * @module services/project-cost/expense-cost-allocations.server
 * @see ADR-917 §4 Γ1 · Ζ5
 */

import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';

import { PROJECT_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { diffTrackedFields } from '@/lib/audit/audit-diff';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { PurchaseOrder } from '@/types/procurement';
import type { ExpenseCostAllocation, ReceivedExpenseDocument } from '@/subapps/accounting/types/documents';
import {
  allocatedProjectIdsOf,
  allocatedPurchaseOrderIdsOf,
  allocationKeyOf,
  expenseDocumentLabelOf,
  expenseNetAmountOf,
  normalizeAllocations,
  validateAllocations,
  type AllocationIssue,
} from './expense-allocation';

// ============================================================================
// CONTRACT
// ============================================================================

interface ExpenseAllocationActor {
  readonly companyId: string;
  readonly uid: string;
  readonly name: string | null;
}

export interface ExpenseAllocationWrite {
  readonly actor: ExpenseAllocationActor;
  readonly documentId: string;
  readonly lines: readonly ExpenseCostAllocation[];
  /** The `allocationRevision` the caller saw; `0` ⇒ «I believe nothing is allocated yet» */
  readonly expectedRevision: number;
  readonly nowIso: string;
}

type AllocationReferenceProblem = 'project' | 'purchase_order' | 'purchase_order_project';

type ExpenseAllocationOutcome =
  | { readonly kind: 'changed'; readonly lines: ExpenseCostAllocation[]; readonly revision: number }
  | { readonly kind: 'unchanged'; readonly lines: ExpenseCostAllocation[]; readonly revision: number }
  | { readonly kind: 'conflict'; readonly currentRevision: number }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'not_allocatable'; readonly status: ReceivedExpenseDocument['status'] }
  | { readonly kind: 'invalid'; readonly issues: AllocationIssue[] }
  | { readonly kind: 'invalid_reference'; readonly problem: AllocationReferenceProblem; readonly id: string };

/** `rejected` carries no cost; `processing` has no figures yet */
const ALLOCATABLE_STATUSES: ReadonlySet<ReceivedExpenseDocument['status']> = new Set(['review', 'confirmed']);

// ============================================================================
// READS (all before any write — Firestore transaction rule)
// ============================================================================

interface ReadState {
  readonly document: ReceivedExpenseDocument;
  readonly purchaseOrders: ReadonlyMap<string, PurchaseOrder>;
  readonly projectNames: ReadonlyMap<string, string | null>;
}

type ReadResult = { readonly ok: true; readonly state: ReadState } | { readonly ok: false; readonly outcome: ExpenseAllocationOutcome };

const fail = (outcome: ExpenseAllocationOutcome): ReadResult => ({ ok: false, outcome });

async function readOwned<T>(tx: Transaction, db: Firestore, collection: string, id: string, companyId: string): Promise<T | null> {
  const snap = await tx.get(db.collection(collection).doc(id));
  const data = snap.exists ? (snap.data() as T & { companyId?: string | null }) : null;
  return data !== null && isPayloadOwnedByCompany(data, companyId) ? data : null;
}

/** Names of the projects that exist and are ours; the rest are `missing` (foreign ≡ absent) */
async function readProjects(
  tx: Transaction, db: Firestore, ids: readonly string[], companyId: string,
): Promise<{ readonly names: Map<string, string | null>; readonly missing: string[] }> {
  const names = new Map<string, string | null>();
  const missing: string[] = [];
  for (const id of ids) {
    const project = await readOwned<{ name?: string }>(tx, db, COLLECTIONS.PROJECTS, id, companyId);
    if (project === null) missing.push(id);
    else names.set(id, project.name ?? null);
  }
  return { names, missing };
}

async function readPurchaseOrders(
  tx: Transaction, db: Firestore, ids: readonly string[], companyId: string,
): Promise<Map<string, PurchaseOrder>> {
  const orders = new Map<string, PurchaseOrder>();
  for (const id of ids) {
    const po = await readOwned<PurchaseOrder>(tx, db, COLLECTIONS.PURCHASE_ORDERS, id, companyId);
    if (po !== null && !po.isDeleted) orders.set(id, { ...po, id });
  }
  return orders;
}

/** Every PO named by a NEW line exists, is ours, alive, and belongs to the line's project */
function referenceProblemOf(
  lines: readonly ExpenseCostAllocation[], orders: ReadonlyMap<string, PurchaseOrder>,
): ExpenseAllocationOutcome | null {
  for (const line of lines) {
    if (line.purchaseOrderId === null) continue;
    const po = orders.get(line.purchaseOrderId);
    if (po === undefined) return { kind: 'invalid_reference', problem: 'purchase_order', id: line.purchaseOrderId };
    if (po.projectId !== line.projectId) {
      return { kind: 'invalid_reference', problem: 'purchase_order_project', id: line.purchaseOrderId };
    }
  }
  return null;
}

async function readState(tx: Transaction, db: Firestore, write: ExpenseAllocationWrite, lines: readonly ExpenseCostAllocation[]): Promise<ReadResult> {
  const { companyId } = write.actor;
  const document = await readOwned<ReceivedExpenseDocument>(tx, db, COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS, write.documentId, companyId);
  if (document === null) return fail({ kind: 'not_found' });
  const previous = document.costAllocations ?? [];
  const projects = await readProjects(tx, db, allocatedProjectIdsOf([...previous, ...lines]), companyId);
  // A project of a PREVIOUS line that is gone must not block un-allocating it — only the NEW lines must resolve.
  const missingNew = projects.missing.find(id => lines.some(line => line.projectId === id));
  if (missingNew !== undefined) return fail({ kind: 'invalid_reference', problem: 'project', id: missingNew });
  const purchaseOrders = await readPurchaseOrders(tx, db, allocatedPurchaseOrderIdsOf([...previous, ...lines]), companyId);
  const problem = referenceProblemOf(lines, purchaseOrders);
  if (problem !== null) return fail(problem);
  const state = { document: { ...document, documentId: write.documentId }, purchaseOrders, projectNames: projects.names };
  return { ok: true, state };
}

// ============================================================================
// DECISION + WRITES
// ============================================================================

function sameLines(a: readonly ExpenseCostAllocation[], b: readonly ExpenseCostAllocation[]): boolean {
  if (a.length !== b.length) return false;
  const byKey = new Map(a.map(line => [allocationKeyOf(line), line]));
  return b.every(line => {
    const other = byKey.get(allocationKeyOf(line));
    return other !== undefined && other.netAmount === line.netAmount && other.origin === line.origin;
  });
}

function projectPurchaseOrderLinks(
  tx: Transaction, db: Firestore, write: ExpenseAllocationWrite,
  previous: readonly ExpenseCostAllocation[], lines: readonly ExpenseCostAllocation[], orders: ReadonlyMap<string, PurchaseOrder>,
): { added: string[]; removed: string[] } {
  const before = new Set(allocatedPurchaseOrderIdsOf(previous));
  const after = new Set(allocatedPurchaseOrderIdsOf(lines));
  const added = [...after].filter(id => !before.has(id));
  const removed = [...before].filter(id => !after.has(id) && orders.has(id));
  for (const id of added) {
    const po = orders.get(id);
    tx.update(db.collection(COLLECTIONS.PURCHASE_ORDERS).doc(id), {
      linkedInvoiceIds: FieldValue.arrayUnion(write.documentId),
      dateInvoiced: po?.dateInvoiced ?? write.nowIso,
      updatedAt: write.nowIso,
    });
  }
  for (const id of removed) {
    tx.update(db.collection(COLLECTIONS.PURCHASE_ORDERS).doc(id), {
      linkedInvoiceIds: FieldValue.arrayRemove(write.documentId),
      updatedAt: write.nowIso,
    });
  }
  return { added, removed };
}

interface Committed {
  readonly state: ReadState;
  readonly previous: ExpenseCostAllocation[];
  readonly lines: ExpenseCostAllocation[];
  readonly revision: number;
  readonly links: { added: string[]; removed: string[] };
}

type TransactionResult = { readonly committed: Committed } | { readonly outcome: ExpenseAllocationOutcome };

async function runAllocationTransaction(db: Firestore, write: ExpenseAllocationWrite, lines: ExpenseCostAllocation[]): Promise<TransactionResult> {
  return db.runTransaction(async (tx): Promise<TransactionResult> => {
    const read = await readState(tx, db, write, lines);
    if (!read.ok) return { outcome: read.outcome };
    const { document, purchaseOrders } = read.state;
    if (!ALLOCATABLE_STATUSES.has(document.status)) return { outcome: { kind: 'not_allocatable', status: document.status } };
    const issues = validateAllocations(lines, expenseNetAmountOf(document));
    if (issues.length > 0) return { outcome: { kind: 'invalid', issues } };
    const previous = document.costAllocations ?? [];
    const currentRevision = document.allocationRevision ?? 0;
    if (sameLines(previous, lines)) return { outcome: { kind: 'unchanged', lines: previous, revision: currentRevision } };
    if (currentRevision !== write.expectedRevision) return { outcome: { kind: 'conflict', currentRevision } };
    const revision = currentRevision + 1;
    tx.update(db.collection(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS).doc(write.documentId), {
      costAllocations: lines,
      allocatedProjectIds: allocatedProjectIdsOf(lines),
      allocationRevision: revision,
      updatedAt: write.nowIso,
    });
    const links = projectPurchaseOrderLinks(tx, db, write, previous, lines, purchaseOrders);
    return { committed: { state: read.state, previous, lines, revision, links } };
  });
}

/**
 * Sets the document's allocation to `lines` (`[]` clears it). Validation, references and CAS are judged inside the
 * transaction against what is stored NOW — never against what the caller believed.
 */
export async function writeExpenseCostAllocations(db: Firestore, write: ExpenseAllocationWrite): Promise<ExpenseAllocationOutcome> {
  const lines = normalizeAllocations(write.lines);
  const result = await runAllocationTransaction(db, write, lines);
  if ('outcome' in result) return result.outcome;
  await recordAllocationAudit(write, result.committed);
  return { kind: 'changed', lines: result.committed.lines, revision: result.committed.revision };
}

// ============================================================================
// HISTORY (ADR-195) — after the commit
// ============================================================================

function auditItemsFor(projectId: string, lines: readonly ExpenseCostAllocation[], committed: Committed) {
  const document = expenseDocumentLabelOf(committed.state.document);
  return lines
    .filter(line => line.projectId === projectId)
    .map(line => ({
      key: `${committed.state.document.documentId}|${allocationKeyOf(line)}`,
      document,
      costCode: line.costCode,
      purchaseOrder: line.purchaseOrderId === null ? '' : committed.state.purchaseOrders.get(line.purchaseOrderId)?.poNumber ?? '',
      netAmount: line.netAmount,
    }));
}

async function recordProjectAudit(write: ExpenseAllocationWrite, committed: Committed, projectId: string): Promise<void> {
  const def = { expenseAllocations: PROJECT_TRACKED_FIELDS.expenseAllocations };
  const changes = diffTrackedFields(
    { expenseAllocations: auditItemsFor(projectId, committed.previous, committed) },
    { expenseAllocations: auditItemsFor(projectId, committed.lines, committed) },
    def,
  );
  if (changes.length === 0) return;
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.PROJECT,
    entityId: projectId,
    entityName: committed.state.projectNames.get(projectId) ?? null,
    action: 'updated',
    changes,
    performedBy: write.actor.uid,
    performedByName: write.actor.name,
    companyId: write.actor.companyId,
  });
}

async function recordPurchaseOrderAudit(write: ExpenseAllocationWrite, poId: string, linked: boolean, committed: Committed): Promise<void> {
  const label = expenseDocumentLabelOf(committed.state.document);
  await EntityAuditService.recordChange({
    entityType: 'purchase_order',
    entityId: poId,
    entityName: committed.state.purchaseOrders.get(poId)?.poNumber ?? poId,
    action: linked ? 'linked' : 'unlinked',
    changes: [{
      field: 'linkedInvoiceIds',
      oldValue: linked ? null : label,
      newValue: linked ? label : null,
      label: 'Invoice Linked',
    }],
    performedBy: write.actor.uid,
    performedByName: write.actor.name,
    companyId: write.actor.companyId,
  });
}

async function recordAllocationAudit(write: ExpenseAllocationWrite, committed: Committed): Promise<void> {
  const projectIds = allocatedProjectIdsOf([...committed.previous, ...committed.lines]);
  await Promise.all([
    ...projectIds.map(projectId => recordProjectAudit(write, committed, projectId)),
    ...committed.links.added.map(poId => recordPurchaseOrderAudit(write, poId, true, committed)),
    ...committed.links.removed.map(poId => recordPurchaseOrderAudit(write, poId, false, committed)),
  ]);
}
