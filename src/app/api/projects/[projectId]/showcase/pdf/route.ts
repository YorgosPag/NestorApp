/**
 * =============================================================================
 * POST /api/projects/[projectId]/showcase/pdf (ADR-316 + ADR-321 Phase 3)
 * =============================================================================
 *
 * Thin forward to `createShowcasePdfRoute` (showcase-core). Owns only the
 * project-specific data-loading hook (snapshot + media + brand logos) and
 * the route-segment unwrap. Auth, rate limit, FILE_SHARES pre-upload claim,
 * Storage upload + compensate-on-failure all live in the core factory.
 *
 * Security unchanged:
 *  - withAuth: `projects:projects:update`
 *  - withStandardRateLimit: 60 req/min per user
 *  - Tenant isolation: enforced by buildProjectShowcaseSnapshot
 *
 * @module app/api/projects/[projectId]/showcase/pdf/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { createShowcasePdfRoute } from '@/services/showcase-core';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { buildProjectShowcaseSnapshot } from '@/services/project-showcase/snapshot-builder';
import { loadProjectShowcasePdfLabels } from '@/services/project-showcase/labels';
import { createProjectShowcasePdfService } from '@/services/pdf/ProjectShowcasePDFService';
import { loadBrandLogoAssets } from '@/services/property-showcase/brand-logo-assets';
import { downloadEntityMedia } from '@/services/property-media/property-media.service';
import type { PropertyMediaBuffer } from '@/services/property-media/property-media.service';
import type {
  ProjectShowcasePDFData,
  ShowcasePhotoAsset,
} from '@/services/pdf/renderers/ProjectShowcaseRenderer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const pdfService = createProjectShowcasePdfService();

function toPhotoAsset(buf: PropertyMediaBuffer): ShowcasePhotoAsset {
  return {
    id: buf.id,
    bytes: buf.bytes,
    format: buf.jsPdfFormat,
    displayName: buf.displayName || buf.originalFilename || undefined,
  };
}

const route = createShowcasePdfRoute<ProjectShowcasePDFData>({
  entityType: ENTITY_TYPES.PROJECT,
  entityIdFsField: 'showcaseProjectId',
  permission: 'projects:projects:update',
  loggerName: 'ProjectShowcasePdfRoute',
  noteText: 'ADR-316 pre-upload claim (project showcase)',
  pdfService,
  loadPdfData: async ({ entityId, ctx, locale, adminDb, logger }) => {
    const companyId = ctx.companyId!;
    const snapshot = await buildProjectShowcaseSnapshot(entityId, locale, adminDb, companyId);

    const mediaOpts = {
      companyId,
      entityType: ENTITY_TYPES.PROJECT,
      entityId,
      limit: 20,
    };

    const [photoBuffers, floorplanBuffers, logos] = await Promise.all([
      downloadEntityMedia({ ...mediaOpts, category: FILE_CATEGORIES.PHOTOS }).catch((err) => {
        logger.warn('Photo download failed; continuing without', {
          projectId: entityId,
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }),
      downloadEntityMedia({ ...mediaOpts, category: FILE_CATEGORIES.FLOORPLANS }).catch((err) => {
        logger.warn('Floorplan download failed; continuing without', {
          projectId: entityId,
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }),
      loadBrandLogoAssets(snapshot.company),
    ]);

    return {
      snapshot,
      photos: photoBuffers.map(toPhotoAsset),
      floorplans: floorplanBuffers.map(toPhotoAsset),
      companyLogo: logos.companyLogo,
      nestorAppLogo: logos.nestorAppLogo,
      generatedAt: new Date(),
      labels: loadProjectShowcasePdfLabels(locale),
      locale,
    };
  },
});

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await segmentData.params;
  if (!projectId || projectId.trim().length === 0) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }
  return route.handle(request, projectId);
}
