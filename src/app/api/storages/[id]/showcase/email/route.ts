/**
 * POST /api/storages/[id]/showcase/email (ADR-315 + ADR-321 pattern)
 *
 * Thin forward to `createShowcaseEmailRoute` (showcase-core). Owns only the
 * storage-specific `loadEmail` hook: tenant re-check, snapshot build, email
 * compose via `buildStorageShowcaseEmail`.
 *
 * Auth + rate limit + Mailgun send + audit-trail fire-and-forget all live in
 * the core factory.
 *
 * @module app/api/storages/[id]/showcase/email/route
 */

import { NextRequest } from 'next/server';
import { createShowcaseEmailRoute } from '@/services/showcase-core';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { buildStorageShowcaseSnapshot } from '@/services/storage-showcase/snapshot-builder';
import { loadStorageShowcasePdfLabels } from '@/services/storage-showcase/labels';
import { buildStorageShowcaseEmail } from '@/services/email-templates/storage-showcase-email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const route = createShowcaseEmailRoute({
  entityType: ENTITY_TYPES.STORAGE,
  loggerName: 'StorageShowcaseEmailRoute',
  auditLabel: 'Αποστολή Παρουσίασης Αποθήκης',
  loadEmail: async ({ entityId, ctx, locale, body, adminDb }) => {
    const companyId = ctx.companyId!;

    const storageDoc = await adminDb.collection(COLLECTIONS.STORAGE).doc(entityId).get();
    if (!storageDoc.exists) throw new ApiError(404, 'Storage not found');
    const storageData = (storageDoc.data() ?? {}) as Record<string, unknown>;
    if ((storageData.companyId as string | undefined) !== companyId) {
      throw new ApiError(403, 'Tenant mismatch');
    }

    const snapshot = await buildStorageShowcaseSnapshot(entityId, locale, adminDb, companyId);
    const labels = loadStorageShowcasePdfLabels(locale);

    const built = buildStorageShowcaseEmail({
      snapshot,
      labels,
      shareUrl: body.shareUrl,
      personalMessage: body.personalMessage,
    });

    return {
      built,
      auditEntityName: snapshot.storage.name,
      mediaCounts: { photos: 0, floorplans: 0 },
    };
  },
});

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> },
) {
  const { id } = await segmentData.params;
  return route.handle(request, id);
}
