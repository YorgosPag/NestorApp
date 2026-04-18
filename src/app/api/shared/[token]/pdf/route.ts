/**
 * =============================================================================
 * GET /api/shared/[token]/pdf (ADR-315 Phase M3)
 * =============================================================================
 *
 * Public PDF proxy for Property Showcase shares persisted under the unified
 * `shares` collection. Mirrors `/api/showcase/[token]/pdf` (ADR-312, legacy
 * `file_shares`) but reads the new SSoT layout: entityType='property_showcase'
 * + `showcaseMeta.pdfStoragePath`.
 *
 * Flow:
 *  1. Validate share by token (active, not expired)
 *  2. Require entityType=property_showcase + showcaseMeta.pdfStoragePath
 *  3. Cross-check tenant: share.companyId === property.companyId
 *  4. Stream PDF via Admin SDK with Content-Disposition attachment
 *  5. Increment share.accessCount (fire-and-forget)
 *
 * Security: anonymous, token-gated, rate-limited.
 *
 * @module app/api/shared/[token]/pdf/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminBucket, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';

const logger = createModuleLogger('UnifiedSharedPdfProxy');

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface UnifiedShareDoc {
  id: string;
  token?: string;
  entityType?: string;
  entityId?: string;
  companyId?: string;
  isActive?: boolean;
  expiresAt?: string;
  showcaseMeta?: {
    pdfStoragePath?: string;
    pdfRegeneratedAt?: string | { toDate: () => Date } | null;
  } | null;
  accessCount?: number;
  maxAccesses?: number;
}

interface PropertyHeader {
  companyId?: string;
  code?: string;
  name?: string;
}

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

async function loadShareByToken(token: string): Promise<UnifiedShareDoc | null> {
  const adminDb = getAdminFirestore();
  if (!adminDb) return null;
  const snap = await adminDb
    .collection(COLLECTIONS.SHARES)
    .where('token', '==', token)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<UnifiedShareDoc, 'id'>) };
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

async function incrementAccessCount(shareId: string): Promise<void> {
  const adminDb = getAdminFirestore();
  if (!adminDb) return;
  const ref = adminDb.collection(COLLECTIONS.SHARES).doc(shareId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const current = (snap.data()?.accessCount as number | undefined) ?? 0;
  await ref.update({ accessCount: current + 1, lastAccessedAt: new Date() });
}

async function streamPdfFromStorage(
  storagePath: string
): Promise<{ stream: ReadableStream<Uint8Array>; size?: number }> {
  const bucket = getAdminBucket();
  const fileRef = bucket.file(storagePath);
  const [exists] = await fileRef.exists();
  if (!exists) {
    throw new Error(`PDF object missing at ${bucket.name}/${storagePath}`);
  }

  const [metadata] = await fileRef.getMetadata();
  const sizeRaw = metadata.size;
  const size = typeof sizeRaw === 'string' ? Number(sizeRaw) : (sizeRaw as number | undefined);

  const nodeStream = fileRef.createReadStream();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err: Error) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
  return { stream, size: Number.isFinite(size) ? size : undefined };
}

async function handleGet(
  _request: NextRequest,
  token: string
): Promise<NextResponse> {
  if (!token || token.trim().length === 0) return jsonError(400, 'Token is required');

  const share = await loadShareByToken(token);
  if (!share) return jsonError(404, 'Share link not found or deactivated');

  if (share.entityType !== 'property_showcase') {
    return jsonError(400, 'Share is not a property showcase');
  }
  if (!share.entityId || !share.companyId || !share.expiresAt) {
    return jsonError(400, 'Share record is malformed');
  }
  const pdfStoragePath = share.showcaseMeta?.pdfStoragePath;
  if (!pdfStoragePath) return jsonError(404, 'PDF is not available for this showcase');

  if (new Date(share.expiresAt).getTime() < Date.now()) {
    return jsonError(410, 'Share link has expired');
  }
  if (
    typeof share.maxAccesses === 'number' &&
    share.maxAccesses > 0 &&
    typeof share.accessCount === 'number' &&
    share.accessCount >= share.maxAccesses
  ) {
    return jsonError(410, 'Access limit reached');
  }

  const property = await loadPropertyHeader(share.entityId);
  if (!property) return jsonError(404, 'Property not found');
  if (property.companyId !== share.companyId) return jsonError(403, 'Tenant mismatch');

  let stream: ReadableStream<Uint8Array>;
  let size: number | undefined;
  try {
    const result = await streamPdfFromStorage(pdfStoragePath);
    stream = result.stream;
    size = result.size;
  } catch (err) {
    logger.error('Unified shared PDF stream failed', {
      token, shareId: share.id, propertyId: share.entityId,
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, 'Failed to stream PDF');
  }

  safeFireAndForget(incrementAccessCount(share.id), 'UnifiedSharedPdfProxy.incrementAccessCount');

  const filename = buildAttachmentFilename(property);
  const encodedFilename = encodeURIComponent(filename);
  const headers: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    'Cache-Control': 'private, max-age=0, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (size !== undefined) headers['Content-Length'] = String(size);

  logger.info('Unified shared PDF streamed', {
    token, shareId: share.id, propertyId: share.entityId,
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
