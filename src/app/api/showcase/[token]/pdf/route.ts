/**
 * =============================================================================
 * GET /api/showcase/[token]/pdf (ADR-312 + ADR-321 Phase 4)
 * =============================================================================
 *
 * Thin forward to `createPublicShowcasePdfRoute` (showcase-core). Public
 * (anonymous) — resolves share via dual-read (unified `shares` + legacy
 * `file_shares`), streams the PDF, increments the download counter.
 *
 * @module app/api/showcase/[token]/pdf/route
 */

import { NextRequest } from 'next/server';
import { createPublicShowcasePdfRoute } from '@/services/showcase-core';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import type { ResolvedPublicPdfShare } from '@/services/showcase-core';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface PropertyHeader {
  companyId: string;
  code?: string;
  name?: string;
}

function sanitizeFilenameSegment(input: string | undefined): string {
  if (!input) return '';
  return input
    .normalize('NFKD')
    .replace(/[^\w\-. ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
}

const route = createPublicShowcasePdfRoute<PropertyHeader>({
  loggerName: 'ShowcasePdfProxy',
  shareNotFoundMessage: 'Showcase link not found or deactivated',
  entityNotFoundMessage: 'Property not found',
  pdfMissingMessage: 'PDF is not available for this showcase',

  resolveShare: async (token, adminDb): Promise<ResolvedPublicPdfShare | null> => {
    // 1. Unified shares first (ADR-315 M3+).
    const unifiedSnap = await adminDb
      .collection(COLLECTIONS.SHARES)
      .where('token', '==', token)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (!unifiedSnap.empty) {
      const doc = unifiedSnap.docs[0];
      const d = doc.data() as Record<string, unknown>;
      if (d.entityType === 'property_showcase') {
        const entityId = d.entityId as string | undefined;
        const companyId = d.companyId as string | undefined;
        const expiresAt = d.expiresAt as string | undefined;
        const showcaseMeta = (d.showcaseMeta ?? {}) as { pdfStoragePath?: string };
        const pdfStoragePath = showcaseMeta.pdfStoragePath;
        if (!entityId || !companyId || !expiresAt || !pdfStoragePath) return null;
        return { id: doc.id, entityId, companyId, expiresAt, pdfStoragePath };
      }
    }

    // 2. Legacy file_shares fallback.
    const legacySnap = await adminDb
      .collection(COLLECTIONS.FILE_SHARES)
      .where('token', '==', token)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (legacySnap.empty) return null;
    const doc = legacySnap.docs[0];
    const d = doc.data() as Record<string, unknown>;
    const entityId = d.showcasePropertyId as string | undefined;
    const companyId = d.companyId as string | undefined;
    const expiresAt = d.expiresAt as string | undefined;
    const pdfStoragePath = d.pdfStoragePath as string | undefined;
    if (!d.showcaseMode || !entityId || !companyId || !expiresAt || !pdfStoragePath) return null;
    return { id: doc.id, entityId, companyId, expiresAt, pdfStoragePath };
  },

  loadEntityHeader: async (entityId, adminDb): Promise<PropertyHeader | null> => {
    const snap = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(entityId).get();
    if (!snap.exists) return null;
    const d = (snap.data() ?? {}) as Record<string, unknown>;
    const companyId = d.companyId as string | undefined;
    if (!companyId) return null;
    return {
      companyId,
      code: d.code as string | undefined,
      name: d.name as string | undefined,
    };
  },

  checkTenant: (header, companyId) => header.companyId === companyId,

  buildFilename: (header) => {
    const code = sanitizeFilenameSegment(header.code);
    const name = sanitizeFilenameSegment(header.name);
    const base = [code, name].filter((s) => s.length > 0).join('-') || 'property-showcase';
    return `${base}.pdf`;
  },

  incrementCounter: async (shareId, adminDb) => {
    // Dual-write: unified shares first, then legacy file_shares.
    const unifiedRef = adminDb.collection(COLLECTIONS.SHARES).doc(shareId);
    const unifiedSnap = await unifiedRef.get();
    if (unifiedSnap.exists) {
      const current = (unifiedSnap.data()?.accessCount as number | undefined) ?? 0;
      await unifiedRef.update({ accessCount: current + 1, lastAccessedAt: new Date() });
      return;
    }
    const legacyRef = adminDb.collection(COLLECTIONS.FILE_SHARES).doc(shareId);
    const legacySnap = await legacyRef.get();
    if (!legacySnap.exists) return;
    const current = (legacySnap.data()?.downloadCount as number | undefined) ?? 0;
    await legacyRef.update({ downloadCount: current + 1 });
  },
});

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ token: string }> },
) {
  const { token } = await segmentData.params;
  const handler = withStandardRateLimit(async (req: NextRequest) => route.handle(req, token));
  return handler(request);
}
