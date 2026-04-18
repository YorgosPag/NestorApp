/**
 * GET /api/contacts/[contactId]/company-identity-impact-preview
 *
 * Read-only preview: how many records reference this contact.
 * Used for confirmation dialog before company identity field changes.
 *
 * @module api/contacts/[contactId]/company-identity-impact-preview
 * @enterprise ADR-278 — Company Identity Field Guard
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { previewCompanyIdentityImpact } from '@/lib/firestore/company-identity-impact-preview.service';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import type { CompanyIdentityImpactPreview } from '@/lib/firestore/company-identity-impact-preview.service';

// ============================================================================
// GET — Preview company identity impact
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

      const preview = await previewCompanyIdentityImpact(contactId);

      return apiSuccess(preview);
    }
  )
);
