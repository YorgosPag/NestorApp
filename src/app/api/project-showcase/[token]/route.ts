/**
 * =============================================================================
 * GET /api/project-showcase/[token] (ADR-316 + ADR-321 Phase 3)
 * =============================================================================
 *
 * Thin forward to `createPublicShowcasePayloadRoute` (showcase-core). Public
 * (anonymous) — resolves the share via unified `shares` with
 * `entityType === 'project_showcase'`, then delegates payload assembly to
 * the surface-specific `buildPayload` hook (snapshot + photos + floorplans).
 *
 * Token lookup: unified `shares` collection only — project showcases are
 * always created via UnifiedSharingService (ADR-315).
 *
 * @module app/api/project-showcase/[token]/route
 */

import { NextRequest } from 'next/server';
import { createPublicShowcasePayloadRoute } from '@/services/showcase-core';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { buildProjectShowcaseSnapshot } from '@/services/project-showcase/snapshot-builder';
import { listEntityMedia } from '@/services/property-media/property-media.service';
import type { ProjectShowcaseMedia, ProjectShowcasePayload } from '@/types/project-showcase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function loadProjectMedia(
  companyId: string,
  projectId: string,
  category: typeof FILE_CATEGORIES.PHOTOS | typeof FILE_CATEGORIES.FLOORPLANS,
): Promise<ProjectShowcaseMedia[]> {
  const metas = await listEntityMedia({
    companyId,
    entityType: ENTITY_TYPES.PROJECT,
    entityId: projectId,
    category,
    limit: 30,
  });
  return metas
    .filter((m) => m.downloadUrl)
    .map<ProjectShowcaseMedia>((m) => ({
      id: m.id,
      url: m.downloadUrl!,
      displayName: m.displayName || m.originalFilename || undefined,
      contentType: m.contentType || undefined,
    }));
}

const route = createPublicShowcasePayloadRoute<ProjectShowcasePayload>({
  loggerName: 'ProjectShowcasePublicApi',
  shareNotFoundMessage: 'Project showcase link not found or deactivated',
  pdfUrlPath: (token) => `/api/project-showcase/${token}/pdf`,
  resolveShare: async (token, adminDb) => {
    const snap = await adminDb
      .collection(COLLECTIONS.SHARES)
      .where('token', '==', token)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (snap.empty) return null;

    const d = snap.docs[0].data() as Record<string, unknown>;
    if (d.entityType !== 'project_showcase') return null;

    const entityId = d.entityId as string | undefined;
    const companyId = d.companyId as string | undefined;
    const expiresAt = d.expiresAt as string | undefined;
    if (!entityId || !companyId || !expiresAt) return null;

    const showcaseMeta = (d.showcaseMeta ?? {}) as { pdfStoragePath?: string };
    return { entityId, companyId, expiresAt, pdfStoragePath: showcaseMeta.pdfStoragePath };
  },
  buildPayload: async ({ entityId, companyId, locale, expiresAt, pdfUrl, adminDb, logger }) => {
    const snapshot = await buildProjectShowcaseSnapshot(entityId, locale, adminDb, companyId);
    const [photos, floorplans] = await Promise.all([
      loadProjectMedia(companyId, entityId, FILE_CATEGORIES.PHOTOS).catch(() => []),
      loadProjectMedia(companyId, entityId, FILE_CATEGORIES.FLOORPLANS).catch(() => []),
    ]);

    logger.info('Project showcase media loaded', {
      projectId: entityId,
      photoCount: photos.length,
      floorplanCount: floorplans.length,
    });

    return {
      project: snapshot.project,
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
