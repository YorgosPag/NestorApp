/**
 * POST /api/projects/[projectId]/showcase/email (ADR-316 + ADR-321 Phase 3).
 *
 * Thin forward to `createShowcaseEmailRoute` (showcase-core). Owns only the
 * project-specific `loadEmail` hook: tenant re-check, snapshot build, media
 * load, email compose via `buildProjectShowcaseEmail`.
 *
 * Auth + rate limit + Mailgun send + audit-trail fire-and-forget all live in
 * the core factory.
 *
 * @module app/api/projects/[projectId]/showcase/email/route
 */

import { NextRequest } from 'next/server';
import { createShowcaseEmailRoute } from '@/services/showcase-core';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { buildProjectShowcaseSnapshot } from '@/services/project-showcase/snapshot-builder';
import { loadProjectShowcasePdfLabels } from '@/services/project-showcase/labels';
import { listEntityMedia } from '@/services/property-media/property-media.service';
import { buildProjectShowcaseEmail } from '@/services/email-templates/project-showcase-email';
import type { ShowcaseEmailMedia } from '@/services/email-templates/showcase-email-shared';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function loadMedia(
  companyId: string,
  projectId: string,
  category: typeof FILE_CATEGORIES.PHOTOS | typeof FILE_CATEGORIES.FLOORPLANS,
): Promise<ShowcaseEmailMedia[]> {
  const metas = await listEntityMedia({
    companyId,
    entityType: ENTITY_TYPES.PROJECT,
    entityId: projectId,
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
  entityType: ENTITY_TYPES.PROJECT,
  loggerName: 'ProjectShowcaseEmailRoute',
  auditLabel: 'Αποστολή Παρουσίασης Έργου',
  loadEmail: async ({ entityId, ctx, locale, body, adminDb }) => {
    const companyId = ctx.companyId!;

    const projectDoc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(entityId).get();
    if (!projectDoc.exists) throw new ApiError(404, 'Project not found');
    const projectData = (projectDoc.data() ?? {}) as Record<string, unknown>;
    if ((projectData.companyId as string | undefined) !== companyId) {
      throw new ApiError(403, 'Tenant mismatch');
    }

    const snapshot = await buildProjectShowcaseSnapshot(entityId, locale, adminDb, companyId);
    const labels = loadProjectShowcasePdfLabels(locale);

    const [photos, floorplans] = await Promise.all([
      loadMedia(companyId, entityId, FILE_CATEGORIES.PHOTOS).catch(() => []),
      loadMedia(companyId, entityId, FILE_CATEGORIES.FLOORPLANS).catch(() => []),
    ]);

    const built = buildProjectShowcaseEmail({
      snapshot,
      labels,
      photos,
      floorplans,
      shareUrl: body.shareUrl,
      personalMessage: body.personalMessage,
    });

    return {
      built,
      auditEntityName: snapshot.project.name,
      mediaCounts: { photos: photos.length, floorplans: floorplans.length },
    };
  },
});

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await segmentData.params;
  return route.handle(request, projectId);
}
