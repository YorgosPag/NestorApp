import 'server-only';

/**
 * The ONE read of a project's cost sources (BOQ + purchase orders + budget lines + allocated expense documents)
 * → cost ledger.
 *
 * Shared by the project procurement KPIs, the `cost-ledger` route and the AI
 * `get_budget_variance` tool — three readers, one query set, one arithmetic.
 * Tenant fencing of the PROJECT is the caller's job (`requireProjectInTenant` /
 * ownership check); every query is additionally scoped by `companyId`.
 *
 * Expense documents (ADR-917 Φ4): those ALLOCATED to the project (`allocatedProjectIds` array-contains), plus a
 * COUNT of those matched to one of its POs that carry no allocation yet — «not allocated» is declared, never 0 €.
 *
 * @module services/project-cost/project-cost-ledger.server
 * @see ADR-917 §4 Δ3 · Γ1
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { normalizeBOQItem } from '@/services/measurements/boq-document-normalize';
import { fetchProjectPurchaseOrders } from '@/services/procurement/aggregators/project-purchase-orders';
import type { ReceivedExpenseDocument } from '@/subapps/accounting/types/documents';
import { computeCostLedger, type CostLedger } from './cost-ledger';
import { toLedgerExpenseDocument } from './cost-ledger-actuals';
import { toLedgerBudgetLine } from './project-budget-line-schema';
import { readProjectBudgetLines } from './project-budget-lines.server';

/** Firestore `in` accepts at most 30 values */
const IN_QUERY_LIMIT = 30;

type ExpenseSnapshot = FirebaseFirestore.QueryDocumentSnapshot;

const expenseOf = (doc: ExpenseSnapshot): ReceivedExpenseDocument => doc.data() as ReceivedExpenseDocument;

async function readAllocatedExpenseDocuments(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  projectId: string,
): Promise<ExpenseSnapshot[]> {
  // Literal collection: CHECK 3.91 must SEE the query to judge its index.
  const snapshot = await db
    .collection(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .where('allocatedProjectIds', 'array-contains', projectId)
    .get();
  return snapshot.docs;
}

/** Documents matched (suggested) to one of the project's POs, not rejected, with no allocation at all */
async function countAwaitingAllocation(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  purchaseOrderIds: readonly string[],
): Promise<number> {
  const chunks: string[][] = [];
  for (let i = 0; i < purchaseOrderIds.length; i += IN_QUERY_LIMIT) chunks.push(purchaseOrderIds.slice(i, i + IN_QUERY_LIMIT));
  const snapshots = await Promise.all(chunks.map(chunk => db
    .collection(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .where('suggestedPOId', 'in', chunk)
    .get()));
  return snapshots
    .flatMap(snapshot => snapshot.docs.map(expenseOf))
    .filter(document => document.status !== 'rejected' && (document.costAllocations ?? []).length === 0)
    .length;
}

export async function loadProjectCostLedger(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  projectId: string,
): Promise<CostLedger> {
  const [boqSnap, purchaseOrders, budgetLines, expenseDocs] = await Promise.all([
    db
      .collection(COLLECTIONS.BOQ_ITEMS)
      .where('companyId', '==', companyId)
      .where('projectId', '==', projectId)
      .get(),
    fetchProjectPurchaseOrders(db, companyId, projectId),
    readProjectBudgetLines(db, companyId, projectId),
    readAllocatedExpenseDocuments(db, companyId, projectId),
  ]);
  const awaitingAllocationCount = await countAwaitingAllocation(db, companyId, purchaseOrders.map(po => po.id));
  const boqItems = boqSnap.docs.map(d => normalizeBOQItem(d.id, d.data()));
  return computeCostLedger(boqItems, purchaseOrders, {
    budgetLines: budgetLines.map(toLedgerBudgetLine),
    expenseDocuments: expenseDocs.map(doc => toLedgerExpenseDocument(doc.id, expenseOf(doc), projectId)),
    awaitingAllocationCount,
  });
}
