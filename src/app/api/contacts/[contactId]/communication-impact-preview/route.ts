/**
 * GET /api/contacts/[contactId]/communication-impact-preview
 *
 * Read-only preview: how many records reference this contact.
 * Used for confirmation dialog before communication field changes.
 *
 * @module api/contacts/[contactId]/communication-impact-preview
 * @enterprise ADR-280 — Communication Field Impact Detection
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { previewCommunicationImpact } from '@/lib/firestore/communication-impact-preview.service';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import type { CommunicationImpactPreview } from '@/lib/firestore/communication-impact-preview.service';

// ============================================================================
// GET — Preview communication impact
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<CommunicationImpactPreview>>(
    async (
      _request: NextRequest,
      _ctx: AuthContext,
      _cache: PermissionCache,
      segmentData?: { params: Promise<{ contactId: string }> }
    ) => {
      const { contactId } = await segmentData!.params;

      const preview = await previewCommunicationImpact(contactId);

      return apiSuccess(preview);
    }
  )
);
