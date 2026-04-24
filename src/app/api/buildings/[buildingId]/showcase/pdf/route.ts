/**
 * =============================================================================
 * POST /api/buildings/[buildingId]/showcase/pdf (ADR-320 + ADR-321 Phase 2)
 * =============================================================================
 *
 * Thin forward to `createShowcasePdfRoute` (showcase-core). Owns only the
 * building-specific data-loading hook (snapshot + media + brand logos) and
 * the route-segment unwrap. Auth, rate limit, FILE_SHARES pre-upload claim,
 * Storage upload + compensate-on-failure all live in the core factory.
 *
 * Security unchanged:
 *  - withAuth: `buildings:buildings:update`
 *  - withStandardRateLimit: 60 req/min per user
 *  - Tenant isolation: enforced by buildBuildingShowcaseSnapshot
 *
 * @module app/api/buildings/[buildingId]/showcase/pdf/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { createShowcasePdfRoute } from '@/services/showcase-core';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { buildBuildingShowcaseSnapshot } from '@/services/building-showcase/snapshot-builder';
import { loadBuildingShowcasePdfLabels } from '@/services/building-showcase/labels';
import { createBuildingShowcasePdfService } from '@/services/pdf/BuildingShowcasePDFService';
import { loadBrandLogoAssets } from '@/services/property-showcase/brand-logo-assets';
import { downloadEntityMedia } from '@/services/property-media/property-media.service';
import type { PropertyMediaBuffer } from '@/services/property-media/property-media.service';
import type {
  BuildingShowcasePDFData,
  ShowcasePhotoAsset,
} from '@/services/pdf/renderers/BuildingShowcaseRenderer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const pdfService = createBuildingShowcasePdfService();

function toPhotoAsset(buf: PropertyMediaBuffer): ShowcasePhotoAsset {
  return {
    id: buf.id,
    bytes: buf.bytes,
    format: buf.jsPdfFormat,
    displayName: buf.displayName || buf.originalFilename || undefined,
  };
}

const route = createShowcasePdfRoute<BuildingShowcasePDFData>({
  entityType: ENTITY_TYPES.BUILDING,
  entityIdFsField: 'showcaseBuildingId',
  permission: 'buildings:buildings:update',
  loggerName: 'BuildingShowcasePdfRoute',
  noteText: 'ADR-320 pre-upload claim (building showcase)',
  pdfService,
  loadPdfData: async ({ entityId, ctx, locale, adminDb, logger }) => {
    const companyId = ctx.companyId!;
    const snapshot = await buildBuildingShowcaseSnapshot(entityId, locale, adminDb, companyId);

    const mediaOpts = {
      companyId,
      entityType: ENTITY_TYPES.BUILDING,
      entityId,
      limit: 20,
    };

    const [photoBuffers, floorplanBuffers, logos] = await Promise.all([
      downloadEntityMedia({ ...mediaOpts, category: FILE_CATEGORIES.PHOTOS }).catch((err) => {
        logger.warn('Photo download failed; continuing without', {
          buildingId: entityId,
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }),
      downloadEntityMedia({ ...mediaOpts, category: FILE_CATEGORIES.FLOORPLANS }).catch((err) => {
        logger.warn('Floorplan download failed; continuing without', {
          buildingId: entityId,
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
      labels: loadBuildingShowcasePdfLabels(locale),
      locale,
    };
  },
});

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> },
) {
  const { buildingId } = await segmentData.params;
  if (!buildingId || buildingId.trim().length === 0) {
    return NextResponse.json({ error: 'Building ID is required' }, { status: 400 });
  }
  return route.handle(request, buildingId);
}
