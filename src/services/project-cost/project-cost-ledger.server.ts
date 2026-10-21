import 'server-only';

/**
 * The ONE read of a project's cost sources (BOQ + purchase orders + budget lines) → cost ledger.
 *
 * Shared by the project procurement KPIs, the `cost-ledger` route and the AI
 * `get_budget_variance` tool — three readers, one query pair, one arithmetic.
 * Tenant fencing of the PROJECT is the caller's job (`requireProjectInTenant` /
 * ownership check); both queries are additionally scoped by `companyId`.
 *
 * @module services/project-cost/project-cost-ledger.server
 * @see ADR-917 §4 Δ3
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { normalizeBOQItem } from '@/services/measurements/boq-document-normalize';
import { fetchProjectPurchaseOrders } from '@/services/procurement/aggregators/project-purchase-orders';
import { computeCostLedger, type CostLedger } from './cost-ledger';
import { toLedgerBudgetLine } from './project-budget-line-schema';
import { readProjectBudgetLines } from './project-budget-lines.server';

export async function loadProjectCostLedger(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  projectId: string,
): Promise<CostLedger> {
  const [boqSnap, purchaseOrders, budgetLines] = await Promise.all([
    db
      .collection(COLLECTIONS.BOQ_ITEMS)
      .where('companyId', '==', companyId)
      .where('projectId', '==', projectId)
      .get(),
    fetchProjectPurchaseOrders(db, companyId, projectId),
    readProjectBudgetLines(db, companyId, projectId),
  ]);
  const boqItems = boqSnap.docs.map(d => normalizeBOQItem(d.id, d.data()));
  return computeCostLedger(boqItems, purchaseOrders, { budgetLines: budgetLines.map(toLedgerBudgetLine) });
}
