/**
 * =============================================================================
 * GET /api/project-showcase/[token]/pdf (ADR-316)
 * =============================================================================
 *
 * Public PDF proxy — streams a project showcase PDF via Admin SDK, bypassing
 * Storage rules and the `.firebasestorage.app` download-token limitation.
 *
 * Flow:
 *  1. Validate share by token (unified shares collection, entityType=project_showcase, active)
 *  2. Cross-check tenant: share.companyId === project.companyId
 *  3. Stream object at showcaseMeta.pdfStoragePath via Admin SDK
 *  4. Serve as PDF attachment
 *  5. Increment accessCount (fire-and-forget)
 *
 * Security: anonymous endpoint protected only by share-token validation and
 * tenant cross-check. Rate-limited with withStandardRateLimit.
 *
 * @module app/api/project-showcase/[token]/pdf/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminBucket, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';

const logger = createModuleLogger('ProjectShowcasePdfProxy');

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

async function loadShare(token: string): Promise<{
  id: string;
  companyId: string;
  entityId: string;
  expiresAt: string;
  pdfStoragePath: string;
} | null> {
  const adminDb = getAdminFirestore();
  if (!adminDb) return null;

  const snap = await adminDb
    .collection(COLLECTIONS.SHARES)
    .where('token', '==', token)
    .where('entityType', '==', 'project_showcase')
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
}

async function streamPdfFromStorage(
  storagePath: string,
): Promise<{ stream: ReadableStream<Uint8Array>; size?: number }> {
  const bucket = getAdminBucket();
  if (!bucket) throw new Error('Storage not available');
  const fileRef = bucket.file(storagePath);
  const [meta] = await fileRef.getMetadata();
  const size = meta.size !== undefined ? Number(meta.size) : undefined;
  const nodeStream = fileRef.createReadStream();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() { nodeStream.destroy(); },
  });
  return { stream, size };
}

async function incrementAccessCount(shareId: string): Promise<void> {
  const adminDb = getAdminFirestore();
  if (!adminDb) return;
  await adminDb
    .collection(COLLECTIONS.SHARES)
    .doc(shareId)
    .update({ accessCount: (await import('firebase-admin/firestore')).FieldValue.increment(1) });
}

async function handleGet(_request: NextRequest, token: string): Promise<NextResponse> {
  if (!token?.trim()) return jsonError(400, 'Token is required');

  const share = await loadShare(token);
  if (!share) return jsonError(404, 'Project showcase link not found or deactivated');
  if (new Date(share.expiresAt).getTime() < Date.now()) return jsonError(410, 'Project showcase link has expired');

  const adminDb = getAdminFirestore();
  if (!adminDb) return jsonError(503, 'Database not available');

  const projectSnap = await adminDb.collection(COLLECTIONS.PROJECTS).doc(share.entityId).get();
  if (!projectSnap.exists) return jsonError(404, 'Project not found');
  const projectCompanyId = (projectSnap.data() as Record<string, unknown>).companyId as string | undefined;
  if (projectCompanyId !== share.companyId) return jsonError(403, 'Tenant mismatch');

  let stream: ReadableStream<Uint8Array>;
  let size: number | undefined;
  try {
    const result = await streamPdfFromStorage(share.pdfStoragePath);
    stream = result.stream;
    size = result.size;
  } catch (err) {
    logger.error('Project showcase PDF stream failed', {
      token, shareId: share.id, projectId: share.entityId,
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, 'Failed to stream PDF');
  }

  safeFireAndForget(incrementAccessCount(share.id), 'ProjectShowcasePdfProxy.incrementAccessCount');

  const projectName = ((projectSnap.data() as Record<string, unknown>).name as string | undefined) ?? 'project-showcase';
  const filename = `${projectName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}-showcase.pdf`;
  const encodedFilename = encodeURIComponent(filename);
  const headers: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    'Cache-Control': 'private, max-age=0, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (size !== undefined) headers['Content-Length'] = String(size);

  logger.info('Project showcase PDF streamed', {
    token, shareId: share.id, projectId: share.entityId, companyId: share.companyId, size,
  });

  return new NextResponse(stream, { status: 200, headers });
}

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ token: string }> },
) {
  const { token } = await segmentData.params;
  const handler = withStandardRateLimit<{ params: Promise<{ token: string }> }>(
    async (req) => handleGet(req, token)
  );
  return handler(request);
}
