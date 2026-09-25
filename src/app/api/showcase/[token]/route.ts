/**
 * =============================================================================
 * GET /api/showcase/[token] (ADR-312 Phase 4 + ADR-321 Phase 4)
 * =============================================================================
 *
 * Thin forward to `createPublicShowcasePayloadRoute` (showcase-core). Public
 * (anonymous) — the share gate (ADR-884 Φ0.12) resolves the token over unified
 * `shares` and legacy `file_shares.showcaseMode=true`, and payload assembly is
 * delegated to the surface-specific `buildPayload` hook.
 * videoUrl lives in the share `note` — surfaced via `extra.note`.
 *
 * @module app/api/showcase/[token]/route
 */

import { NextRequest } from 'next/server';
import { createPublicShowcasePayloadRoute } from '@/services/showcase-core';
import { FILE_CATEGORIES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { resolveShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';
import {
  buildPropertyShowcaseSnapshot,
  loadShowcaseRelations,
} from '@/services/property-showcase/snapshot-builder';
import type { ShowcasePayload } from '@/components/property-showcase/types';
import {
  loadFilesByCategory,
  loadLinkedSpaceFloorplans,
  loadPropertyFloorFloorplans,
} from './helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface PropertyShareExtra {
  note?: string;
}

const route = createPublicShowcasePayloadRoute<ShowcasePayload, PropertyShareExtra>({
  loggerName: 'ShowcasePublicApi',
  shareNotFoundMessage: 'Showcase link not found or deactivated',
  pdfUrlPath: (token) => `/api/showcase/${token}/pdf`,

  // ADR-884 Φ0.12 — the one share gate resolves `shares` AND legacy `file_shares`
  // (`showcaseMode` ⇒ property_showcase), checks expiry, limit and password grant.
  shareEntityType: 'property_showcase',
  extraOf: (share) => ({ note: share.note ?? undefined }),

  buildPayload: async ({
    entityId, companyId, locale, expiresAt, pdfUrl, extra, adminDb, logger,
  }) => {
    const propertySnap = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(entityId).get();
    if (!propertySnap.exists) throw new Error('Property not found');
    const propertyData = (propertySnap.data() ?? {}) as Record<string, unknown>;
    if ((propertyData.companyId as string | undefined) !== companyId) {
      throw new Error('Tenant mismatch');
    }

    const branding = await resolveShowcaseCompanyBranding({ adminDb, propertyData, companyId });
    const context = await loadShowcaseRelations({
      adminDb, propertyId: entityId, property: propertyData, branding,
    });

    const [photos, floorplans, linkedSpaceFloorplans, propertyFloorFloorplans] = await Promise.all([
      loadFilesByCategory(companyId, entityId, FILE_CATEGORIES.PHOTOS),
      loadFilesByCategory(companyId, entityId, FILE_CATEGORIES.FLOORPLANS),
      loadLinkedSpaceFloorplans(companyId, context),
      loadPropertyFloorFloorplans(companyId, context),
    ]);

    const snapshot = buildPropertyShowcaseSnapshot(context, locale);
    const hasLinkedFloorplans =
      linkedSpaceFloorplans.parking.length > 0 || linkedSpaceFloorplans.storage.length > 0;

    logger.info('Showcase resolved', {
      propertyId: entityId, companyId,
      photoCount: photos.length, floorplanCount: floorplans.length,
      propertyFloorFloorplans: propertyFloorFloorplans?.media.length ?? 0,
      linkedParkingFloorplans: linkedSpaceFloorplans.parking.reduce(
        (sum, g) => sum + g.media.length + (g.floorFloorplans?.length ?? 0), 0),
      linkedStorageFloorplans: linkedSpaceFloorplans.storage.reduce(
        (sum, g) => sum + g.media.length + (g.floorFloorplans?.length ?? 0), 0),
    });

    return {
      property: snapshot.property,
      company: {
        name: snapshot.company.name,
        phone: snapshot.company.phone,
        email: snapshot.company.email,
        website: snapshot.company.website,
        logoUrl: snapshot.company.logoUrl,
        phones: snapshot.company.phones,
        emails: snapshot.company.emails,
        addresses: snapshot.company.addresses,
        websites: snapshot.company.websites,
        socialMedia: snapshot.company.socialMedia,
      },
      photos,
      floorplans,
      propertyFloorFloorplans,
      linkedSpaceFloorplans: hasLinkedFloorplans ? linkedSpaceFloorplans : undefined,
      videoUrl: extra?.note || undefined,
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
