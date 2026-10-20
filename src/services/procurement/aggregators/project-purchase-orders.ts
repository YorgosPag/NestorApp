import 'server-only';

/**
 * All live purchase orders of ONE project — the read shared by the project-scoped
 * aggregators (basic stats, BOQ coverage / cost ledger).
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
