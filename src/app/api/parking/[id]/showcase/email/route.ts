/**
 * POST /api/parking/[id]/showcase/email (ADR-315 + ADR-321 pattern)
 *
 * Thin forward to `createShowcaseEmailRoute` (showcase-core). Owns only the
 * parking-specific `loadEmail` hook: tenant re-check, snapshot build, email
 * compose via `buildParkingShowcaseEmail`.
 *
 * Auth + rate limit + Mailgun send + audit-trail fire-and-forget all live in
 * the core factory.
 *
 * @module app/api/parking/[id]/showcase/email/route
 */

import { NextRequest } from 'next/server';
import { createShowcaseEmailRoute } from '@/services/showcase-core';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { buildParkingShowcaseSnapshot } from '@/services/parking-showcase/snapshot-builder';
import { loadParkingShowcasePdfLabels } from '@/services/parking-showcase/labels';
import { buildParkingShowcaseEmail } from '@/services/email-templates/parking-showcase-email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const route = createShowcaseEmailRoute({
  entityType: ENTITY_TYPES.PARKING_SPOT,
  loggerName: 'ParkingShowcaseEmailRoute',
  auditLabel: 'Αποστολή Παρουσίασης Θέσης Στάθμευσης',
  loadEmail: async ({ entityId, ctx, locale, body, adminDb }) => {
    const companyId = ctx.companyId!;

    const parkingDoc = await adminDb.collection(COLLECTIONS.PARKING_SPACES).doc(entityId).get();
    if (!parkingDoc.exists) throw new ApiError(404, 'Parking spot not found');
    const parkingData = (parkingDoc.data() ?? {}) as Record<string, unknown>;
    if ((parkingData.companyId as string | undefined) !== companyId) {
      throw new ApiError(403, 'Tenant mismatch');
    }

    const snapshot = await buildParkingShowcaseSnapshot(entityId, locale, adminDb, companyId);
    const labels = loadParkingShowcasePdfLabels(locale);

    const built = buildParkingShowcaseEmail({
      snapshot,
      labels,
      shareUrl: body.shareUrl,
      personalMessage: body.personalMessage,
    });

    return {
      built,
      auditEntityName: snapshot.parking.number,
      mediaCounts: { photos: 0, floorplans: 0 },
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
