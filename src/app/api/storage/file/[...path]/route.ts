/**
 * GET /api/storage/file/[...path] — Auth-gated proxy for Storage objects.
 *
 * Browser-friendly URL produced by `uploadPublicFile()`. The bytes live in a
 * private bucket — this proxy authenticates the user via session cookie,
 * verifies the path's `companyId` matches the user's claim, and streams the
 * object back with the original `Content-Type` and `Cache-Control`.
 *
 * Path scheme (must match `buildStoragePath`): `companies/{companyId}/...`.
 *
 * `?w=<πλάτος κλίμακας>` ⇒ παράγωγο webp κατ' απαίτηση αντί για το πρωτότυπο (ADR-899).
 * Πλάτος εκτός `FILE_PREVIEW_ENCODING.widths` ⇒ 400 (κλειστή κλίμακα — όχι cache-busting).
 *
 * @module api/storage/file/[...path]
 * @see src/services/storage-admin/public-upload.service.ts (canonical writer)
 */

import 'server-only';

import type { Bucket } from '@google-cloud/storage';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { openStorageObject } from '@/lib/storage/storage-object-stream';
import {
  FILE_STORAGE_PLACEMENT_QUERY_PARAM,
  fileStoragePlacementOf,
  isFileStoragePlacement,
  type FileStoragePlacement,
} from '@/lib/files/file-storage-placement';
import { FILE_PREVIEW_WIDTH_QUERY_PARAM, filePreviewWidthOf } from '@/lib/files/file-preview-ladder';
import { fileStorageBucket } from '@/server/files/file-record-bucket';
import { serveImagePreview, type ImagePreviewOutcome } from '@/server/files/image-preview.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('STORAGE_FILE_PROXY');

/** Τα παράγωγα: ιδιωτικά, και **πάντα** επαληθευμένα — το ETag κάνει την επαλήθευση `304` (ADR-899 §3.5). */
const PREVIEW_CACHE_CONTROL = 'private, no-cache';

/** Η θέση που φέρει το URL — `null` ⇒ άγνωστη τιμή (το URL δεν το έφτιαξε το `buildProxyUrl`). */
function placementOfProxyRequest(request: NextRequest): FileStoragePlacement | null {
  const raw = request.nextUrl.searchParams.get(FILE_STORAGE_PLACEMENT_QUERY_PARAM);
  if (raw === null) return fileStoragePlacementOf({});
  return isFileStoragePlacement(raw) ? raw : null;
}

/** Η ωμή τιμή του `?w=` — `undefined` ⇒ δεν ζητήθηκε παράγωγο· `null` ⇒ ζητήθηκε πλάτος εκτός κλίμακας. */
function previewWidthOfRequest(request: NextRequest): number | null | undefined {
  const raw = request.nextUrl.searchParams.get(FILE_PREVIEW_WIDTH_QUERY_PARAM);
  return raw === null ? undefined : filePreviewWidthOf(raw);
}

const PREVIEW_FAILURE_STATUS: Readonly<Record<Exclude<ImagePreviewOutcome['kind'], 'image' | 'not-modified'>, number>> = {
  absent: 404,
  'not-previewable': 415,
  'too-large': 413,
  undecodable: 422,
  busy: 503,
};

/**
 * **Παράγωγο κατ' απαίτηση** (ADR-899). `private, no-cache` + ETag: κάθε προβολή επαληθεύει με ένα
 * φτηνό `304`, άρα ένα διαγραμμένο αρχείο εξαφανίζεται αμέσως και από τον browser.
 */
async function servePreview(request: NextRequest, storagePath: string, bucket: Bucket, width: number): Promise<NextResponse> {
  const outcome = await serveImagePreview({
    bucket,
    bucketKey: bucket.name,
    storagePath,
    width,
    ifNoneMatch: request.headers.get('if-none-match'),
  });
  const cacheHeaders = { 'Cache-Control': PREVIEW_CACHE_CONTROL, 'X-Content-Type-Options': 'nosniff' };
  if (outcome.kind === 'not-modified') {
    return new NextResponse(null, { status: 304, headers: { ...cacheHeaders, ETag: outcome.etag } });
  }
  if (outcome.kind === 'image') {
    return new NextResponse(new Uint8Array(outcome.bytes), {
      status: 200,
      headers: { ...cacheHeaders, ETag: outcome.etag, 'Content-Type': outcome.contentType, 'Content-Length': String(outcome.bytes.length) },
    });
  }
  const status = PREVIEW_FAILURE_STATUS[outcome.kind];
  return NextResponse.json({ error: outcome.kind }, { status, headers: status === 503 ? { 'Retry-After': '1' } : undefined });
}

/** **Το πρωτότυπο**, ως ροή — ο αρχικός κλάδος του proxy, αμετάβλητος. */
async function streamOriginal(storagePath: string, bucket: Bucket): Promise<NextResponse> {
  const opened = await openStorageObject(storagePath, null, { bucket });
  if (opened.kind !== 'found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const headers = new Headers({
    'Content-Type': opened.contentType,
    'Cache-Control': opened.storedCacheControl ?? 'private, max-age=86400',
  });
  if (opened.contentLength !== null) {
    headers.set('Content-Length', String(opened.contentLength));
  }
  return new NextResponse(opened.stream, { status: 200, headers });
}

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path: rawSegments } = await segmentData!.params;
  const segments = rawSegments.map((s) => decodeURIComponent(s));
  const storagePath = segments.join('/');

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      // 🔒 Ο μισθωτής ΠΡΩΤΑ — πριν από θέση, πλάτος ή οποιαδήποτε cache (ADR-899 §3.5).
      if (segments[0] !== 'companies' || segments[1] !== ctx.companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const placement = placementOfProxyRequest(request);
      if (placement === null) {
        return NextResponse.json({ error: 'Invalid placement' }, { status: 400 });
      }
      const width = previewWidthOfRequest(request);
      if (width === null) {
        return NextResponse.json({ error: 'Invalid preview width' }, { status: 400 });
      }

      try {
        const bucket = fileStorageBucket(placement);
        return width === undefined
          ? await streamOriginal(storagePath, bucket)
          : await servePreview(request, storagePath, bucket, width);
      } catch (err) {
        const message = getErrorMessage(err, 'Failed to fetch file');
        logger.error('Storage file proxy error', { storagePath, error: message });
        return NextResponse.json({ error: message }, { status: 500 });
      }
    },
  );
  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
