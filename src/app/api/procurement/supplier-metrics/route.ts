/**
 * GET /api/procurement/supplier-metrics?supplierId=X
 *
 * Returns performance metrics for a single supplier.
 * Optional: ?categoryCode=OIK-2 for price trend data.
 *
 * Auth: withAuth | Rate: standard
 * @see ADR-267 Phase C (Supplier Metrics)
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, badRequest } from '@/lib/api/define-route';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  calculateSupplierMetrics,
  getSupplierPriceTrend,
} from '@/services/procurement/supplier-metrics-service';

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Unknown error',
  handler: async ({ req, auth }) => {
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('supplierId');

    if (!supplierId) badRequest('supplierId query param is required');

    // Fetch supplier name
    const db = getAdminFirestore();
    const contactSnap = await db
      .collection(COLLECTIONS.CONTACTS)
      .doc(supplierId)
      .get();

    const contactData = contactSnap.data();
    const supplierName = contactData
      ? String(contactData.displayName ?? contactData.companyName ?? supplierId)
      : supplierId;

    const metrics = await calculateSupplierMetrics(
      auth.companyId,
      supplierId,
      supplierName
    );

    // Optional price trend
    const categoryCode = searchParams.get('categoryCode');
    const priceTrend = categoryCode
      ? await getSupplierPriceTrend(auth.companyId, supplierId, categoryCode)
      : null;

    return ok({ metrics, priceTrend });
  },
});
