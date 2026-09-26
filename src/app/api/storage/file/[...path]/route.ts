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
 * @module api/storage/file/[...path]
 * @see src/services/storage-admin/public-upload.service.ts (canonical writer)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { openStorageObject } from '@/lib/storage/storage-object-stream';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('STORAGE_FILE_PROXY');

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path: rawSegments } = await segmentData!.params;
  const segments = rawSegments.map((s) => decodeURIComponent(s));
  const storagePath = segments.join('/');

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      if (segments[0] !== 'companies' || segments[1] !== ctx.companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      try {
        // Ο ΕΝΑΣ τρόπος ροής αντικειμένου (N.0.2 — `lib/storage/storage-object-stream`).
        const opened = await openStorageObject(storagePath);
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

        const { stream } = opened;
        return new NextResponse(stream, { status: 200, headers });
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
