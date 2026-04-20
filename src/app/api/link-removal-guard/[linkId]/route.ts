/**
 * 🛡️ Link Removal Guard API
 *
 * GET /api/link-removal-guard/{linkId}
 *
 * Checks if a contact link can be safely removed by verifying
 * the contact has no active dependencies within the linked entity's scope.
 *
 * @module api/link-removal-guard/[linkId]
 * @enterprise ADR-226 — Deletion Guard (Phase 2)
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { hasPermission } from '@/lib/auth/permissions';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { checkLinkRemovalDependencies } from '@/lib/firestore/deletion-link-guard';
import { isValidEntityType, type DependencyCheckResult } from '@/config/deletion-registry';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// GET — Pre-check before contact link removal
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<DependencyCheckResult>>(
    async (
      request: NextRequest,
      ctx: AuthContext,
      cache: PermissionCache
    ) => {
      const db = getAdminFirestore();
      if (!db) {
        throw new ApiError(503, 'Firestore not available', 'DB_UNAVAILABLE');
      }

      // ── Extract linkId from URL ──
      const url = new URL(request.url);
      const segments = url.pathname.split('/').filter(Boolean);
      const linkId = segments[segments.length - 1];

      if (!linkId) {
        throw new ApiError(400, 'Missing linkId', 'INVALID_PARAMS');
      }

      // ── Permission check ──
      const permitted = await hasPermission(ctx, 'crm:contacts:delete', {}, cache);
      if (!permitted) {
        throw new ApiError(403, 'Δεν έχετε δικαίωμα αφαίρεσης σύνδεσης.', 'FORBIDDEN');
      }

      // ── Read the contact link document ──
      const linkDoc = await db.collection(COLLECTIONS.CONTACT_LINKS).doc(linkId).get();
      if (!linkDoc.exists) {
        throw new ApiError(404, 'Η σύνδεση δεν βρέθηκε.', 'LINK_NOT_FOUND');
      }

      const linkData = linkDoc.data()!;
      const sourceContactId = linkData.sourceContactId as string;
      const targetEntityType = linkData.targetEntityType as string;
      const targetEntityId = linkData.targetEntityId as string;

      if (!sourceContactId || !targetEntityType || !targetEntityId) {
        // Incomplete link data — allow removal (nothing to guard)
        return apiSuccess<DependencyCheckResult>({
          allowed: true, dependencies: [], totalDependents: 0, message: 'Η αφαίρεση επιτρέπεται.',
        });
      }

      if (!isValidEntityType(targetEntityType)) {
        // Unknown entity type — allow removal (no registry config)
        return apiSuccess<DependencyCheckResult>({
          allowed: true, dependencies: [], totalDependents: 0, message: 'Η αφαίρεση επιτρέπεται.',
        });
      }

      // ── Run compound dependency check ──
      const result = await checkLinkRemovalDependencies(
        db, sourceContactId, targetEntityType, targetEntityId, ctx.companyId
      );

      return apiSuccess(result, result.message);
    }
  )
);
