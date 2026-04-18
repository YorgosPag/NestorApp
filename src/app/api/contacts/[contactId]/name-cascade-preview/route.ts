/**
 * GET /api/contacts/[contactId]/name-cascade-preview
 *
 * Dry-run preview: how many records would be affected by a name change.
 * Read-only — no Firestore writes. Used for confirmation dialogs.
 *
 * @module api/contacts/[contactId]/name-cascade-preview
 * @enterprise ADR-249 — Name Cascade Safety, ADR-145 — Contact Dependency SSoT
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { previewContactNameCascade } from '@/lib/firestore/cascade-contact-name.service';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import type { NameCascadePreview } from '@/lib/firestore/cascade-contact-name.service';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { ContactType } from '@/types/contacts';

// ============================================================================
// GET — Preview name cascade impact
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

      // Fetch contact type for SSoT engine filtering
      const db = getAdminFirestore();
      const contactDoc = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
      const contactType = (contactDoc.data()?.type as ContactType) ?? 'individual';

      const preview = await previewContactNameCascade(contactId, contactType);

      return apiSuccess(preview);
    }
  )
);
