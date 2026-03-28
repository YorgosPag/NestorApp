/**
 * GET /api/procurement/supplier-metrics?supplierId=X
 *
 * Returns performance metrics for a single supplier.
 * Optional: ?categoryCode=OIK-2 for price trend data.
 *
 * Auth: withAuth | Rate: standard
 * @see ADR-267 Phase C (Supplier Metrics)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import {
  calculateSupplierMetrics,
  getSupplierPriceTrend,
} from '@/services/procurement/supplier-metrics-service';

async function handleGet(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');

    if (!supplierId) {
      return NextResponse.json(
        { success: false, error: 'supplierId query param is required' },
        { status: 400 }
      );
    }

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
      ctx.companyId,
      supplierId,
      supplierName
    );

    // Optional price trend
    const categoryCode = searchParams.get('categoryCode');
    const priceTrend = categoryCode
      ? await getSupplierPriceTrend(ctx.companyId, supplierId, categoryCode)
      : null;

    return NextResponse.json({
      success: true,
      data: { metrics, priceTrend },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export const GET = withStandardRateLimit(withAuth(handleGet));
