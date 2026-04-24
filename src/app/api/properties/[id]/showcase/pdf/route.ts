/**
 * =============================================================================
 * POST /api/properties/[id]/showcase/pdf (ADR-315 Phase M3 + ADR-321 Phase 4)
 * =============================================================================
 *
 * Thin forward to `createShowcasePdfRoute` (showcase-core). Owns only the
 * property-specific data-loading hook (snapshot + media + logos) and the
 * route-segment unwrap. Auth, rate limit, FILE_SHARES pre-upload claim,
 * Storage upload + compensate-on-failure all live in the core factory.
 *
 * Security unchanged:
 *  - withAuth: `properties:properties:update`
 *  - withStandardRateLimit: 60 req/min per user
 *  - Tenant isolation: enforced by loadShowcaseSources
 *
 * @module app/api/properties/[id]/showcase/pdf/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createShowcasePdfRoute } from '@/services/showcase-core';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { createPropertyShowcasePdfService } from '@/services/pdf/PropertyShowcasePDFService';
import { loadBrandLogoAssets } from '@/services/property-showcase/brand-logo-assets';
import {
  buildPdfData,
  loadShowcaseFloorplans,
  loadShowcaseLinkedSpaceFloorplans,
  loadShowcasePhotos,
  loadShowcasePropertyFloorFloorplans,
  loadShowcaseSources,
} from '../generate/helpers';
import type { PropertyShowcasePDFData } from '@/services/pdf/PropertyShowcasePDFService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const pdfService = createPropertyShowcasePdfService();

const extraBodySchema = z.object({
  videoUrl: z.string().url().optional(),
});

const route = createShowcasePdfRoute<PropertyShowcasePDFData, z.infer<typeof extraBodySchema>>({
  entityType: ENTITY_TYPES.PROPERTY,
  entityIdFsField: 'showcasePropertyId',
  permission: 'properties:properties:update',
  loggerName: 'PropertyShowcasePdfRoute',
  noteText: 'ADR-315 M3 pre-upload claim (unified flow)',
  extraBodySchema,
  pdfService,
  loadPdfData: async ({ entityId, ctx, locale, body, baseUrl, logger }) => {
    const companyId = ctx.companyId!;
    const showcaseUrl = `${baseUrl}/shared`;

    const sources = await loadShowcaseSources(entityId, companyId);
    const [photos, floorplans, linkedSpaceFloorplans, propertyFloorFloorplans, logos] =
      await Promise.all([
        loadShowcasePhotos(entityId, companyId),
        loadShowcaseFloorplans(entityId, companyId),
        loadShowcaseLinkedSpaceFloorplans(sources.context, companyId).catch((err) => {
          logger.warn('Linked-space floorplan load failed; continuing without', {
            propertyId: entityId,
            error: err instanceof Error ? err.message : String(err),
          });
          return { parking: [], storage: [] };
        }),
        loadShowcasePropertyFloorFloorplans(sources.context, companyId).catch((err) => {
          logger.warn('Property-floor floorplan load failed; continuing without', {
            propertyId: entityId,
            error: err instanceof Error ? err.message : String(err),
          });
          return undefined;
        }),
        loadBrandLogoAssets(sources.context.branding),
      ]);

    return buildPdfData(
      entityId, sources, showcaseUrl, body.videoUrl, locale,
      { photos, floorplans, linkedSpaceFloorplans, propertyFloorFloorplans, ...logos },
    );
  },
});

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> },
) {
  const { id } = await segmentData.params;
  if (!id || id.trim().length === 0) {
    return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
  }
  return route.handle(request, id);
}
