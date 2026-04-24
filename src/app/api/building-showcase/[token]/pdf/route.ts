/**
 * =============================================================================
 * GET /api/building-showcase/[token]/pdf (ADR-320 + ADR-321 Phase 2)
 * =============================================================================
 *
 * Thin forward to `createPublicShowcasePdfRoute` (showcase-core). Public PDF
 * proxy — streams a building showcase PDF via Admin SDK, bypassing Storage
 * rules and the `.firebasestorage.app` download-token limitation.
 *
 * Security unchanged: anonymous, token-validated + tenant cross-check +
 * `withStandardRateLimit`.
 *
 * @module app/api/building-showcase/[token]/pdf/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { createPublicShowcasePdfRoute } from '@/services/showcase-core';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface BuildingPdfHeader {
  companyId: string;
  name: string;
}

const route = createPublicShowcasePdfRoute<BuildingPdfHeader>({
  loggerName: 'BuildingShowcasePdfProxy',
  shareNotFoundMessage: 'Building showcase link not found or deactivated',
  entityNotFoundMessage: 'Building not found',
  resolveShare: async (token, adminDb) => {
    const snap = await adminDb
      .collection(COLLECTIONS.SHARES)
      .where('token', '==', token)
      .where('entityType', '==', 'building_showcase')
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (snap.empty) return null;

    const d = snap.docs[0].data() as Record<string, unknown>;
    const companyId = d.companyId as string | undefined;
    const entityId = d.entityId as string | undefined;
    const expiresAt = d.expiresAt as string | undefined;
    const pdfStoragePath = (d.showcaseMeta as { pdfStoragePath?: string } | undefined)?.pdfStoragePath;

    if (!companyId || !entityId || !expiresAt || !pdfStoragePath) return null;

    return { id: snap.docs[0].id, companyId, entityId, expiresAt, pdfStoragePath };
  },
  loadEntityHeader: async (buildingId, adminDb) => {
    const snap = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();
    if (!snap.exists) return null;
    const d = snap.data() as Record<string, unknown>;
    return {
      companyId: (d.companyId as string | undefined) ?? '',
      name: (d.name as string | undefined) ?? 'building-showcase',
    };
  },
  checkTenant: (header, companyId) => header.companyId === companyId,
  buildFilename: (header) => {
    const sanitized = header.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
    return `${sanitized || 'building-showcase'}-showcase.pdf`;
  },
  incrementCounter: async (shareId, adminDb) => {
    await adminDb
      .collection(COLLECTIONS.SHARES)
      .doc(shareId)
      .update({ accessCount: FieldValue.increment(1) });
  },
});

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ token: string }> },
) {
  const { token } = await segmentData.params;
  const handler = withStandardRateLimit<{ params: Promise<{ token: string }> }>(
    async (req: NextRequest): Promise<NextResponse> => route.handle(req, token),
  );
  return handler(request);
}
