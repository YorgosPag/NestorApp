/**
 * GET /api/procurement/vendor-invites?vendorContactId=X
 *
 * Returns all RFQ invites where the contact is invited as a vendor.
 * Powers the Vendor 360° contact tab (ADR-327 §18).
 *
 * Auth: withAuth | Rate: standard
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, badRequest } from '@/lib/api/define-route';
import { listVendorInvitesByVendor } from '@/subapps/procurement/services/vendor-invite-service';

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Unknown error',
  handler: async ({ req, auth }) => {
    const { searchParams } = new URL(req.url);
    const vendorContactId = searchParams.get('vendorContactId');

    if (!vendorContactId) badRequest('vendorContactId query param is required');

    const invites = await listVendorInvitesByVendor(auth.companyId, vendorContactId);
    return ok(invites);
  },
});
