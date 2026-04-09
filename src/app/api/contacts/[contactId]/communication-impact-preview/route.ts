/**
 * GET /api/contacts/[contactId]/communication-impact-preview
 *
 * Read-only preview: how many records reference this contact.
 * Used for confirmation dialog before communication field changes.
 *
 * Supports ALL contact types (individual, company, service).
 * The engine filters applicable dependencies per contact type.
 *
 * @module api/contacts/[contactId]/communication-impact-preview
 * @enterprise ADR-280, ADR-145 — Contact Dependency SSoT
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { previewCommunicationImpact } from '@/lib/firestore/communication-impact-preview.service';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import type { CommunicationImpactPreview } from '@/lib/firestore/communication-impact-preview.service';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { ContactType } from '@/types/contacts';

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

      // Fetch contact type for SSoT engine filtering
      const db = getAdminFirestore();
      const contactDoc = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
      const contactType = (contactDoc.data()?.type as ContactType) ?? 'company';

      const preview = await previewCommunicationImpact(contactId, contactType);

      return apiSuccess(preview);
    }
  )
);
