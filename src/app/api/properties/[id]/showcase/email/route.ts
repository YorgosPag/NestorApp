/**
 * POST /api/properties/[id]/showcase/email (ADR-312 Phase 8 + ADR-321 Phase 4)
 *
 * Thin forward to `createShowcaseEmailRoute` (showcase-core). Owns only the
 * property-specific `loadEmail` hook: tenant check, snapshot build, media
 * load, email compose via `buildShowcaseEmail`.
 *
 * Auth + rate limit + Mailgun send + audit-trail fire-and-forget all live in
 * the core factory.
 *
 * @module app/api/properties/[id]/showcase/email/route
 */

import { NextRequest } from 'next/server';
import { createShowcaseEmailRoute } from '@/services/showcase-core';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { resolveShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';
import {
  buildPropertyShowcaseSnapshot,
  loadShowcaseRelations,
} from '@/services/property-showcase/snapshot-builder';
import { loadShowcasePdfLabels } from '@/services/property-showcase/labels';
import {
  loadFilesByCategory,
  loadLinkedSpaceFloorplans,
  loadPropertyFloorFloorplans,
} from '@/app/api/showcase/[token]/helpers';
import { buildShowcaseEmail } from '@/services/email-templates/property-showcase-email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const route = createShowcaseEmailRoute({
  entityType: ENTITY_TYPES.PROPERTY,
  loggerName: 'PropertyShowcaseEmailRoute',
  auditLabel: 'Αποστολή Παρουσίασης',
  loadEmail: async ({ entityId, ctx, locale, body, adminDb }) => {
    const companyId = ctx.companyId!;

    const propertyDoc = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(entityId).get();
    if (!propertyDoc.exists) throw new ApiError(404, 'Property not found');
    const propertyData = (propertyDoc.data() ?? {}) as Record<string, unknown>;
    if ((propertyData.companyId as string | undefined) !== companyId) {
      throw new ApiError(403, 'Tenant mismatch');
    }

    const branding = await resolveShowcaseCompanyBranding({
      adminDb, propertyData, companyId,
    });
    const context = await loadShowcaseRelations({
      adminDb, propertyId: entityId, property: propertyData, branding,
    });

    const [photos, floorplans, linkedSpaceFloorplansRaw, propertyFloorFloorplans] =
      await Promise.all([
        loadFilesByCategory(companyId, entityId, FILE_CATEGORIES.PHOTOS),
        loadFilesByCategory(companyId, entityId, FILE_CATEGORIES.FLOORPLANS),
        loadLinkedSpaceFloorplans(companyId, context).catch(() => ({ parking: [], storage: [] })),
        loadPropertyFloorFloorplans(companyId, context).catch(() => undefined),
      ]);

    const linkedSpaceFloorplans =
      linkedSpaceFloorplansRaw.parking.length > 0 || linkedSpaceFloorplansRaw.storage.length > 0
        ? linkedSpaceFloorplansRaw
        : undefined;

    const snapshot = buildPropertyShowcaseSnapshot(context, locale);
    const labels = loadShowcasePdfLabels(locale);

    const built = buildShowcaseEmail({
      snapshot,
      labels,
      photos,
      floorplans,
      shareUrl: body.shareUrl,
      personalMessage: body.personalMessage,
      extras: { propertyFloorFloorplans, linkedSpaceFloorplans },
    });

    return {
      built,
      auditEntityName: snapshot.property.name,
      mediaCounts: { photos: photos.length, floorplans: floorplans.length },
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
