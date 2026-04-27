/**
 * GET /api/procurement/vendor-invites?vendorContactId=X
 *
 * Returns all RFQ invites where the contact is invited as a vendor.
 * Powers the Vendor 360° contact tab (ADR-327 §18).
 *
 * Auth: withAuth | Rate: standard
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';
import { listVendorInvitesByVendor } from '@/subapps/procurement/services/vendor-invite-service';

async function handleGet(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const vendorContactId = searchParams.get('vendorContactId');

    if (!vendorContactId) {
      return NextResponse.json(
        { success: false, error: 'vendorContactId query param is required' },
        { status: 400 }
      );
    }

    const invites = await listVendorInvitesByVendor(ctx.companyId, vendorContactId);

    return NextResponse.json({ success: true, data: invites });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export const GET = withStandardRateLimit(withAuth(handleGet));
