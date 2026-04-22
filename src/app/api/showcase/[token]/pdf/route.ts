/**
 * =============================================================================
 * GET /api/showcase/[token]/pdf (ADR-312)
 * =============================================================================
 *
 * Public PDF proxy — streams a showcase PDF via Admin SDK, bypassing Storage
 * rules and the `.firebasestorage.app` download-token limitation.
 *
 * Flow:
 *  1. Validate showcase share by token (active, showcaseMode, not expired)
 *  2. Cross-check tenant: share.companyId === property.companyId
 *  3. Open object at share.pdfStoragePath via Admin SDK
 *  4. Stream PDF with Content-Disposition attachment
 *  5. Increment share.downloadCount (fire-and-forget)
 *
 * Security: anonymous endpoint, protected only by share-token validation and
 * tenant cross-check. Rate-limited with withStandardRateLimit (anonymous IP).
 *
 * @module app/api/showcase/[token]/pdf/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { jsonError, streamPdfFromStorage } from '../shared-pdf-proxy-helpers';

const logger = createModuleLogger('ShowcasePdfProxy');

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ShareDoc {
  id: string;
  token?: string;
  companyId?: string;
  isActive?: boolean;
  expiresAt?: string;
  showcaseMode?: boolean;
  showcasePropertyId?: string;
  pdfStoragePath?: string;
}

interface PropertyHeader {
  companyId?: string;
  code?: string;
  name?: string;
}

async function loadShareByToken(token: string): Promise<ShareDoc | null> {
  const adminDb = getAdminFirestore();
  if (!adminDb) return null;

  // ADR-315 dual-read: unified `shares` first.
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
      const showcaseMeta = (d.showcaseMeta ?? {}) as { pdfStoragePath?: string };
      return {
        id: doc.id,
        token: d.token as string,
        companyId: d.companyId as string,
        isActive: d.isActive as boolean,
        expiresAt: d.expiresAt as string,
        showcaseMode: true,
        showcasePropertyId: d.entityId as string,
        pdfStoragePath: showcaseMeta.pdfStoragePath,
      };
    }
  }

  // Legacy fallback — `file_shares`.
  const snap = await adminDb
    .collection(COLLECTIONS.FILE_SHARES)
    .where('token', '==', token)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<ShareDoc, 'id'>) };
}

async function loadPropertyHeader(propertyId: string): Promise<PropertyHeader | null> {
  const adminDb = getAdminFirestore();
  if (!adminDb) return null;
  const snap = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
  if (!snap.exists) return null;
  const d = (snap.data() ?? {}) as Record<string, unknown>;
  return {
    companyId: d.companyId as string | undefined,
    code: d.code as string | undefined,
    name: d.name as string | undefined,
  };
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

function buildAttachmentFilename(property: PropertyHeader): string {
  const code = sanitizeFilenameSegment(property.code);
  const name = sanitizeFilenameSegment(property.name);
  const base = [code, name].filter((s) => s.length > 0).join('-') || 'property-showcase';
  return `${base}.pdf`;
}

async function incrementDownloadCount(shareId: string): Promise<void> {
  const adminDb = getAdminFirestore();
  if (!adminDb) return;
  // ADR-315 dual-write: probe unified `shares` first, then legacy `file_shares`.
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
}

async function handleGet(
  _request: NextRequest,
  token: string
): Promise<NextResponse> {
  if (!token || token.trim().length === 0) return jsonError(400, 'Token is required');

  const share = await loadShareByToken(token);
  if (!share) return jsonError(404, 'Showcase link not found or deactivated');

  if (!share.showcaseMode || !share.showcasePropertyId || !share.companyId || !share.expiresAt) {
    return jsonError(400, 'Share is not a property showcase');
  }
  if (!share.pdfStoragePath) return jsonError(404, 'PDF is not available for this showcase');

  if (new Date(share.expiresAt).getTime() < Date.now()) {
    return jsonError(410, 'Showcase link has expired');
  }

  const property = await loadPropertyHeader(share.showcasePropertyId);
  if (!property) return jsonError(404, 'Property not found');
  if (property.companyId !== share.companyId) return jsonError(403, 'Tenant mismatch');

  let stream: ReadableStream<Uint8Array>;
  let size: number | undefined;
  try {
    const result = await streamPdfFromStorage(share.pdfStoragePath);
    stream = result.stream;
    size = result.size;
  } catch (err) {
    logger.error('Showcase PDF stream failed', {
      token, shareId: share.id, propertyId: share.showcasePropertyId,
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, 'Failed to stream PDF');
  }

  safeFireAndForget(incrementDownloadCount(share.id), 'ShowcasePdfProxy.incrementDownloadCount');

  const filename = buildAttachmentFilename(property);
  const encodedFilename = encodeURIComponent(filename);
  const headers: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    'Cache-Control': 'private, max-age=0, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (size !== undefined) headers['Content-Length'] = String(size);

  logger.info('Showcase PDF streamed', {
    token, shareId: share.id, propertyId: share.showcasePropertyId,
    companyId: share.companyId, size,
  });

  return new NextResponse(stream, { status: 200, headers });
}

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ token: string }> }
) {
  const { token } = await segmentData.params;
  const handler = withStandardRateLimit<{ params: Promise<{ token: string }> }>(
    async (req) => handleGet(req, token)
  );
  return handler(request);
}
