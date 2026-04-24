/**
 * =============================================================================
 * GET /api/showcase/[token] (ADR-312 Phase 4 + ADR-321 Phase 4)
 * =============================================================================
 *
 * Thin forward to `createPublicShowcasePayloadRoute` (showcase-core). Public
 * (anonymous) — resolves the share via dual-read (unified `shares` first, then
 * legacy `file_shares` for backward compat) and delegates payload assembly to
 * the surface-specific `buildPayload` hook.
 *
 * Token lookup: unified `shares` (entityType='property_showcase') first,
 * then legacy `file_shares.showcaseMode=true` for older tokens.
 * videoUrl lives in legacy `file_shares.note` — surfaced via `extra.note`.
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

  resolveShare: async (token, adminDb) => {
    // 1. Unified shares (entityType='property_showcase') — ADR-315 M3+.
    const unifiedSnap = await adminDb
      .collection(COLLECTIONS.SHARES)
      .where('token', '==', token)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (!unifiedSnap.empty) {
      const d = unifiedSnap.docs[0].data() as Record<string, unknown>;
      if (d.entityType === 'property_showcase') {
        const entityId = d.entityId as string | undefined;
        const companyId = d.companyId as string | undefined;
        const expiresAt = d.expiresAt as string | undefined;
        if (!entityId || !companyId || !expiresAt) return null;
        const showcaseMeta = (d.showcaseMeta ?? {}) as { pdfStoragePath?: string };
        return { entityId, companyId, expiresAt, pdfStoragePath: showcaseMeta.pdfStoragePath };
      }
    }

    // 2. Legacy file_shares fallback — older tokens before ADR-315 M3.
    const legacySnap = await adminDb
      .collection(COLLECTIONS.FILE_SHARES)
      .where('token', '==', token)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (legacySnap.empty) return null;
    const d = legacySnap.docs[0].data() as Record<string, unknown>;
    const entityId = d.showcasePropertyId as string | undefined;
    const companyId = d.companyId as string | undefined;
    const expiresAt = d.expiresAt as string | undefined;
    if (!d.showcaseMode || !entityId || !companyId || !expiresAt) return null;
    return {
      entityId,
      companyId,
      expiresAt,
      pdfStoragePath: d.pdfStoragePath as string | undefined,
      extra: { note: d.note as string | undefined },
    };
  },

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
