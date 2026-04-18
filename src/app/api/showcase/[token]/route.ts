/**
 * =============================================================================
 * GET /api/showcase/[token] (ADR-312 Phase 4)
 * =============================================================================
 *
 * Public endpoint — no authentication required. Resolves a showcase token into
 * a read-only snapshot of the property: full Πληροφορίες-tab coverage, company
 * branding, published photos, floorplans, optional video link, PDF link.
 *
 * The snapshot payload is produced by the SSoT `buildPropertyShowcaseSnapshot`
 * so this route and the PDF generator cannot drift.
 *
 * Validation:
 *  - Share exists, is active, has showcaseMode=true
 *  - Share is not expired
 *
 * SRP split — media helpers + share lookup live in ./helpers.ts.
 *
 * @module app/api/showcase/[token]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_CATEGORIES } from '@/config/domain-constants';
import { resolveShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';
import {
  buildPropertyShowcaseSnapshot,
  loadShowcaseRelations,
} from '@/services/property-showcase/snapshot-builder';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type { ShowcasePayload } from '@/components/property-showcase/types';
import {
  buildBaseUrl,
  loadFilesByCategory,
  loadLinkedSpaceFloorplans,
  loadShareByToken,
} from './helpers';

const logger = createModuleLogger('ShowcasePublicApi');

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ token: string }> }
) {
  const { token } = await segmentData.params;
  if (!token || token.trim().length === 0) {
    return jsonError(400, 'Token is required');
  }

  const adminDb = getAdminFirestore();
  if (!adminDb) return jsonError(503, 'Database connection not available');

  const share = await loadShareByToken(token);
  if (!share) return jsonError(404, 'Showcase link not found or deactivated');

  const showcaseMode = share.showcaseMode as boolean | undefined;
  const showcasePropertyId = share.showcasePropertyId as string | undefined;
  const companyId = share.companyId as string | undefined;
  const expiresAt = share.expiresAt as string | undefined;

  if (!showcaseMode || !showcasePropertyId || !companyId || !expiresAt) {
    return jsonError(400, 'Share is not a property showcase');
  }

  if (new Date(expiresAt).getTime() < Date.now()) {
    return jsonError(410, 'Showcase link has expired');
  }

  const propertySnap = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(showcasePropertyId).get();
  if (!propertySnap.exists) return jsonError(404, 'Property not found');
  const propertyData = (propertySnap.data() ?? {}) as Record<string, unknown>;
  if ((propertyData as { companyId?: string }).companyId !== companyId) {
    return jsonError(403, 'Tenant mismatch');
  }

  // Branding via hierarchy Property → Project → Contact (ADR-312 Phase 3.7).
  const branding = await resolveShowcaseCompanyBranding({
    adminDb,
    propertyData,
    companyId,
  });

  const localeParam = request.nextUrl.searchParams.get('locale');
  const locale: EnumLocale = localeParam === 'en' ? 'en' : 'el';

  const context = await loadShowcaseRelations({
    adminDb,
    propertyId: showcasePropertyId,
    property: propertyData,
    branding,
  });

  const [photos, floorplans, linkedSpaceFloorplans] = await Promise.all([
    loadFilesByCategory(companyId, showcasePropertyId, FILE_CATEGORIES.PHOTOS),
    loadFilesByCategory(companyId, showcasePropertyId, FILE_CATEGORIES.FLOORPLANS),
    loadLinkedSpaceFloorplans(companyId, context),
  ]);

  const snapshot = buildPropertyShowcaseSnapshot(context, locale);

  const hasLinkedFloorplans =
    linkedSpaceFloorplans.parking.length > 0 || linkedSpaceFloorplans.storage.length > 0;

  const response: ShowcasePayload = {
    property: snapshot.property,
    company: {
      name: snapshot.company.name,
      phone: snapshot.company.phone,
      email: snapshot.company.email,
      website: snapshot.company.website,
    },
    photos,
    floorplans,
    linkedSpaceFloorplans: hasLinkedFloorplans ? linkedSpaceFloorplans : undefined,
    videoUrl: (share.note as string | undefined) || undefined,
    pdfUrl: share.pdfStoragePath ? `${buildBaseUrl(request)}/api/showcase/${token}/pdf` : undefined,
    expiresAt,
  };

  logger.info('Showcase resolved', {
    token, propertyId: showcasePropertyId, companyId,
    photoCount: photos.length, floorplanCount: floorplans.length,
    linkedParkingFloorplans: linkedSpaceFloorplans.parking.reduce((sum, g) => sum + g.media.length, 0),
    linkedStorageFloorplans: linkedSpaceFloorplans.storage.reduce((sum, g) => sum + g.media.length, 0),
  });

  return NextResponse.json(response);
}
