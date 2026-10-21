import 'server-only';

/**
 * Live purchase orders WITHOUT a date window — the reads behind every inception-to-date
 * figure (project KPIs, cost ledger, analytics budget-vs-actual, ADR-917 Δ4).
 *
 * ⚠️ Not `procurement-repository.listPurchaseOrders`: that one pages (`limit 100`),
 * which would silently truncate a sum. Aggregates need every order.
 *
 * @module services/procurement/aggregators/project-purchase-orders
 * @see ADR-917 §2 (extracted when the cost ledger landed — CHECK 3.28 twin)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { PurchaseOrder } from '@/types/procurement';

export async function fetchProjectPurchaseOrders(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  projectId: string,
): Promise<PurchaseOrder[]> {
  const snap = await db
    .collection(COLLECTIONS.PURCHASE_ORDERS)
    .where('companyId', '==', companyId)
    .where('isDeleted', '==', false)
    .where('projectId', '==', projectId)
    .get();
  return snap.docs.map(d => d.data() as PurchaseOrder);
}

/**
 * All live purchase orders of the company — for budget-vs-actual, which compares a
 * whole-life budget and therefore must not see only the orders of a date window
 * (ADR-917 §2 Δ3). Equality filters only ⇒ no composite index.
 */
export async function fetchCompanyPurchaseOrders(
  db: FirebaseFirestore.Firestore,
  companyId: string,
): Promise<PurchaseOrder[]> {
  const snap = await db
    .collection(COLLECTIONS.PURCHASE_ORDERS)
    .where('companyId', '==', companyId)
    .where('isDeleted', '==', false)
    .get();
  return snap.docs.map(d => d.data() as PurchaseOrder);
}
