/**
 * POST /api/buildings/[buildingId]/showcase/email (ADR-320 + ADR-321 Phase 2).
 *
 * Thin forward to `createShowcaseEmailRoute` (showcase-core). Owns only the
 * building-specific `loadEmail` hook: tenant re-check, snapshot build, media
 * load, email compose via `buildBuildingShowcaseEmail`.
 *
 * Auth + rate limit + Mailgun send + audit-trail fire-and-forget all live in
 * the core factory.
 *
 * @module app/api/buildings/[buildingId]/showcase/email/route
 */

import { NextRequest } from 'next/server';
import { createShowcaseEmailRoute } from '@/services/showcase-core';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { buildBuildingShowcaseSnapshot } from '@/services/building-showcase/snapshot-builder';
import { loadBuildingShowcasePdfLabels } from '@/services/building-showcase/labels';
import { listEntityMedia } from '@/services/property-media/property-media.service';
import { buildBuildingShowcaseEmail } from '@/services/email-templates/building-showcase-email';
import type { ShowcaseEmailMedia } from '@/services/email-templates/showcase-email-shared';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function loadMedia(
  companyId: string,
  buildingId: string,
  category: typeof FILE_CATEGORIES.PHOTOS | typeof FILE_CATEGORIES.FLOORPLANS,
): Promise<ShowcaseEmailMedia[]> {
  const metas = await listEntityMedia({
    companyId,
    entityType: ENTITY_TYPES.BUILDING,
    entityId: buildingId,
    category,
    limit: 30,
  });
  return metas
    .filter((m) => m.downloadUrl)
    .map<ShowcaseEmailMedia>((m) => ({
      id: m.id,
      url: m.downloadUrl!,
      displayName: m.displayName || m.originalFilename || null,
    }));
}

const route = createShowcaseEmailRoute({
  entityType: ENTITY_TYPES.BUILDING,
  loggerName: 'BuildingShowcaseEmailRoute',
  auditLabel: 'Αποστολή Παρουσίασης Κτηρίου',
  loadEmail: async ({ entityId, ctx, locale, body, adminDb }) => {
    const companyId = ctx.companyId!;

    const buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(entityId).get();
    if (!buildingDoc.exists) throw new ApiError(404, 'Building not found');
    const buildingData = (buildingDoc.data() ?? {}) as Record<string, unknown>;
    if ((buildingData.companyId as string | undefined) !== companyId) {
      throw new ApiError(403, 'Tenant mismatch');
    }

    const snapshot = await buildBuildingShowcaseSnapshot(entityId, locale, adminDb, companyId);
    const labels = loadBuildingShowcasePdfLabels(locale);

    const [photos, floorplans] = await Promise.all([
      loadMedia(companyId, entityId, FILE_CATEGORIES.PHOTOS).catch(() => []),
      loadMedia(companyId, entityId, FILE_CATEGORIES.FLOORPLANS).catch(() => []),
    ]);

    const built = buildBuildingShowcaseEmail({
      snapshot,
      labels,
      photos,
      floorplans,
      shareUrl: body.shareUrl,
      personalMessage: body.personalMessage,
    });

    return {
      built,
      auditEntityName: snapshot.building.name,
      mediaCounts: { photos: photos.length, floorplans: floorplans.length },
    };
  },
});

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> },
) {
  const { buildingId } = await segmentData.params;
  return route.handle(request, buildingId);
}
