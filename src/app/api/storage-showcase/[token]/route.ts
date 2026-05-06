/**
 * =============================================================================
 * GET /api/storage-showcase/[token] (ADR-315 + ADR-321 pattern)
 * =============================================================================
 *
 * Public (anonymous) — resolves the share via unified `shares` with
 * `entityType === 'storage_showcase'`, then builds the payload via
 * `buildStorageShowcaseSnapshot`.
 *
 * @module app/api/storage-showcase/[token]/route
 */

import { NextRequest } from 'next/server';
import { createPublicShowcasePayloadRoute } from '@/services/showcase-core';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { buildStorageShowcaseSnapshot } from '@/services/storage-showcase/snapshot-builder';
import { listEntityMedia } from '@/services/property-media/property-media.service';
import type { StorageShowcaseMedia, StorageShowcasePayload } from '@/types/storage-showcase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function loadStorageMedia(
  companyId: string,
  storageId: string,
  category: typeof FILE_CATEGORIES.PHOTOS | typeof FILE_CATEGORIES.FLOORPLANS,
): Promise<StorageShowcaseMedia[]> {
  const metas = await listEntityMedia({
    companyId,
    entityType: ENTITY_TYPES.STORAGE,
    entityId: storageId,
    category,
    limit: 30,
  });
  return metas
    .filter((m) => m.downloadUrl)
    .map<StorageShowcaseMedia>((m) => ({
      id: m.id,
      url: m.downloadUrl!,
      displayName: m.displayName || m.originalFilename || undefined,
      contentType: m.contentType || undefined,
    }));
}

const route = createPublicShowcasePayloadRoute<StorageShowcasePayload>({
  loggerName: 'StorageShowcasePublicApi',
  shareNotFoundMessage: 'Storage showcase link not found or deactivated',
  pdfUrlPath: () => null,
  resolveShare: async (token, adminDb) => {
    const snap = await adminDb
      .collection(COLLECTIONS.SHARES)
      .where('token', '==', token)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (snap.empty) return null;

    const d = snap.docs[0].data() as Record<string, unknown>;
    if (d.entityType !== 'storage_showcase') return null;

    const entityId = d.entityId as string | undefined;
    const companyId = d.companyId as string | undefined;
    const expiresAt = d.expiresAt as string | undefined;
    if (!entityId || !companyId || !expiresAt) return null;

    const showcaseMeta = (d.showcaseMeta ?? {}) as { pdfStoragePath?: string };
    return { entityId, companyId, expiresAt, pdfStoragePath: showcaseMeta.pdfStoragePath };
  },
  buildPayload: async ({ entityId, companyId, locale, expiresAt, pdfUrl, adminDb, logger }) => {
    const snapshot = await buildStorageShowcaseSnapshot(entityId, locale, adminDb, companyId);
    const [photos, floorplans] = await Promise.all([
      loadStorageMedia(companyId, entityId, FILE_CATEGORIES.PHOTOS).catch(() => []),
      loadStorageMedia(companyId, entityId, FILE_CATEGORIES.FLOORPLANS).catch(() => []),
    ]);

    logger.info('Storage showcase media loaded', {
      storageId: entityId,
      photoCount: photos.length,
      floorplanCount: floorplans.length,
    });

    return {
      storage: snapshot.storage,
      company: snapshot.company,
      photos,
      floorplans,
      pdfUrl,
      expiresAt,
    };
  },
});

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ token: string }> },
) {
  const { token } = await segmentData.params;
  return route.handle(request, token);
}
