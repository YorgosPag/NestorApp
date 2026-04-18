/**
 * GET /api/contacts/[contactId]/address-impact-preview
 *
 * Read-only preview: how many records reference this contact.
 * Used for confirmation dialog before HQ address changes.
 *
 * @module api/contacts/[contactId]/address-impact-preview
 * @enterprise ADR-277 — Address Impact Guard
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { previewAddressImpact } from '@/lib/firestore/address-impact-preview.service';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import type { AddressImpactPreview } from '@/lib/firestore/address-impact-preview.service';

// ============================================================================
// GET — Preview address impact
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth(
    async (
      _request: NextRequest,
      _ctx: AuthContext,
      _cache: PermissionCache,
      segmentData?: { params: Promise<{ contactId: string }> }
    ) => {
      const { contactId } = await segmentData!.params;

      const preview = await previewAddressImpact(contactId);

      return apiSuccess(preview);
    }
  )
);
