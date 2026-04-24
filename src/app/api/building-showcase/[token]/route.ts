/**
 * =============================================================================
 * GET /api/building-showcase/[token] (ADR-320 + ADR-321 Phase 2)
 * =============================================================================
 *
 * Thin forward to `createPublicShowcasePayloadRoute` (showcase-core). Public
 * (anonymous) — resolves the share via unified `shares` with
 * `entityType === 'building_showcase'`, then delegates payload assembly to
 * the surface-specific `buildPayload` hook (snapshot + photos + floorplans).
 *
 * Token lookup: unified `shares` collection only — building showcases are
 * always created via UnifiedSharingService (ADR-315).
 *
 * @module app/api/building-showcase/[token]/route
 */

import { NextRequest } from 'next/server';
import { createPublicShowcasePayloadRoute } from '@/services/showcase-core';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { buildBuildingShowcaseSnapshot } from '@/services/building-showcase/snapshot-builder';
import { listEntityMedia } from '@/services/property-media/property-media.service';
import type { BuildingShowcaseMedia, BuildingShowcasePayload } from '@/types/building-showcase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function loadBuildingMedia(
  companyId: string,
  buildingId: string,
  category: typeof FILE_CATEGORIES.PHOTOS | typeof FILE_CATEGORIES.FLOORPLANS,
): Promise<BuildingShowcaseMedia[]> {
  const metas = await listEntityMedia({
    companyId,
    entityType: ENTITY_TYPES.BUILDING,
    entityId: buildingId,
    category,
    limit: 30,
  });
  return metas
    .filter((m) => m.downloadUrl)
    .map<BuildingShowcaseMedia>((m) => ({
      id: m.id,
      url: m.downloadUrl!,
      displayName: m.displayName || m.originalFilename || undefined,
      contentType: m.contentType || undefined,
    }));
}

const route = createPublicShowcasePayloadRoute<BuildingShowcasePayload>({
  loggerName: 'BuildingShowcasePublicApi',
  shareNotFoundMessage: 'Building showcase link not found or deactivated',
  pdfUrlPath: (token) => `/api/building-showcase/${token}/pdf`,
  resolveShare: async (token, adminDb) => {
    const snap = await adminDb
      .collection(COLLECTIONS.SHARES)
      .where('token', '==', token)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (snap.empty) return null;

    const d = snap.docs[0].data() as Record<string, unknown>;
    if (d.entityType !== 'building_showcase') return null;

    const entityId = d.entityId as string | undefined;
    const companyId = d.companyId as string | undefined;
    const expiresAt = d.expiresAt as string | undefined;
    if (!entityId || !companyId || !expiresAt) return null;

    const showcaseMeta = (d.showcaseMeta ?? {}) as { pdfStoragePath?: string };
    return { entityId, companyId, expiresAt, pdfStoragePath: showcaseMeta.pdfStoragePath };
  },
  buildPayload: async ({ entityId, companyId, locale, expiresAt, pdfUrl, adminDb, logger }) => {
    const snapshot = await buildBuildingShowcaseSnapshot(entityId, locale, adminDb, companyId);
    const [photos, floorplans] = await Promise.all([
      loadBuildingMedia(companyId, entityId, FILE_CATEGORIES.PHOTOS).catch(() => []),
      loadBuildingMedia(companyId, entityId, FILE_CATEGORIES.FLOORPLANS).catch(() => []),
    ]);

    logger.info('Building showcase media loaded', {
      buildingId: entityId,
      photoCount: photos.length,
      floorplanCount: floorplans.length,
    });

    return {
      building: snapshot.building,
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
