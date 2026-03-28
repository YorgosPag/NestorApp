/**
 * GET /api/procurement/supplier-metrics/comparison
 *
 * Returns all suppliers ranked by performance metrics.
 *
 * Auth: withAuth | Rate: standard
 * @see ADR-267 Phase C (Supplier Comparison)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';
import { getSupplierComparison } from '@/services/procurement/supplier-metrics-service';

async function handleGet(
  _request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  try {
    const comparison = await getSupplierComparison(ctx.companyId);

    return NextResponse.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export const GET = withStandardRateLimit(withAuth(handleGet));
