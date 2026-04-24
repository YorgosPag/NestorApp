/**
 * =============================================================================
 * SHOWCASE CORE — Public PDF Proxy Route Factory (ADR-321 Phase 1.4d)
 * =============================================================================
 *
 * Config-driven generic that produces `GET /api/{entity}-showcase/[token]/
 * pdf` handlers. Extracted from the 3 legacy public-PDF routes (property,
 * project, building) which were ~95 %-shared via
 * `shared-pdf-proxy-helpers.ts`; this factory collapses the remaining
 * 5 % (share resolution, entity header load, tenant check, attachment
 * filename construction, access-count increment).
 *
 * Flow (identical across surfaces):
 *   1. Validate token (400).
 *   2. Resolve share via surface-specific `resolveShare` hook.
 *   3. Return 404 when missing, 410 when expired.
 *   4. Load entity header (for filename + tenant cross-check).
 *   5. Return 403 on tenant mismatch.
 *   6. Stream the PDF via the shared `streamPdfFromStorage` helper.
 *   7. Fire-and-forget `incrementCounter(shareId)`.
 *   8. Set Content-Type/Disposition/Cache-Control headers + respond.
 *
 * Public route — anonymous access is protected only by share-token validation
 * and tenant cross-check. The route file wraps with `withStandardRateLimit`
 * (matches the 3 legacy routes).
 *
 * @module services/showcase-core/api/create-public-pdf-route
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger, type Logger } from '@/lib/telemetry/Logger';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import {
  jsonError,
  streamPdfFromStorage,
} from '@/app/api/showcase/shared-pdf-proxy-helpers';

// =============================================================================
// Public contracts
// =============================================================================

export interface ResolvedPublicPdfShare {
  id: string;
  companyId: string;
  entityId: string;
  expiresAt: string;
  pdfStoragePath: string;
}

export interface CreatePublicPdfRouteConfig<TEntityHeader> {
  loggerName: string;
  /** Human message for 404 (e.g. `'Building showcase link not found or deactivated'`). */
  shareNotFoundMessage: string;
  /** Human message for 404 on entity lookup (e.g. `'Building not found'`). */
  entityNotFoundMessage: string;
  /** Human message for 404 on missing PDF (optional; property path only). */
  pdfMissingMessage?: string;
  /**
   * Resolve share by token. Returns `null` → 404. Surface-specific because
   * property queries unified `shares` AND legacy `FILE_SHARES`; project/
   * building query unified only with `entityType` filter.
   */
  resolveShare: (
    token: string,
    adminDb: Firestore,
  ) => Promise<ResolvedPublicPdfShare | null>;
  /**
   * Load the minimum entity header needed for tenant check + attachment
   * filename (e.g. `{ companyId, name, code? }`). Returns `null` → 404.
   */
  loadEntityHeader: (
    entityId: string,
    adminDb: Firestore,
  ) => Promise<TEntityHeader | null>;
  /** Tenant cross-check — share.companyId vs entity.companyId. */
  checkTenant: (header: TEntityHeader, companyId: string) => boolean;
  /** Build the download attachment filename (always ends with `.pdf`). */
  buildFilename: (header: TEntityHeader) => string;
  /**
   * Increment the access / download counter on the share. Surface-specific
   * because property writes to `FILE_SHARES.downloadCount` (legacy) or
   * `SHARES.accessCount` (unified); building/project write only to unified.
   */
  incrementCounter: (shareId: string, adminDb: Firestore) => Promise<void>;
}

export interface PublicShowcasePdfHandler {
  handle(request: NextRequest, token: string): Promise<NextResponse>;
}

// =============================================================================
// Internal helpers
// =============================================================================

function buildHeaders(filename: string, size: number | undefined): Record<string, string> {
  const encoded = encodeURIComponent(filename);
  const headers: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encoded}`,
    'Cache-Control': 'private, max-age=0, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (size !== undefined) headers['Content-Length'] = String(size);
  return headers;
}

async function streamOrFail(
  pdfStoragePath: string,
  logger: Logger,
  token: string,
  shareId: string,
): Promise<{ stream: ReadableStream<Uint8Array>; size: number | undefined } | NextResponse> {
  try {
    return await streamPdfFromStorage(pdfStoragePath);
  } catch (err) {
    logger.error('Public showcase PDF stream failed', {
      token, shareId,
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, 'Failed to stream PDF');
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createPublicShowcasePdfRoute<TEntityHeader>(
  config: CreatePublicPdfRouteConfig<TEntityHeader>,
): PublicShowcasePdfHandler {
  const logger = createModuleLogger(config.loggerName);

  return {
    async handle(_request: NextRequest, token: string): Promise<NextResponse> {
      if (!token || token.trim().length === 0) return jsonError(400, 'Token is required');

      const adminDb = getAdminFirestore();
      if (!adminDb) return jsonError(503, 'Database connection not available');

      const share = await config.resolveShare(token, adminDb);
      if (!share) return jsonError(404, config.shareNotFoundMessage);

      if (!share.pdfStoragePath) {
        return jsonError(
          404,
          config.pdfMissingMessage ?? 'PDF is not available for this showcase',
        );
      }
      if (new Date(share.expiresAt).getTime() < Date.now()) {
        return jsonError(410, 'Showcase link has expired');
      }

      const header = await config.loadEntityHeader(share.entityId, adminDb);
      if (!header) return jsonError(404, config.entityNotFoundMessage);
      if (!config.checkTenant(header, share.companyId)) {
        return jsonError(403, 'Tenant mismatch');
      }

      const streamed = await streamOrFail(share.pdfStoragePath, logger, token, share.id);
      if (streamed instanceof NextResponse) return streamed;

      safeFireAndForget(
        config.incrementCounter(share.id, adminDb),
        `${config.loggerName}.incrementCounter`,
      );

      const filename = config.buildFilename(header);
      const headers = buildHeaders(filename, streamed.size);

      logger.info('Public showcase PDF streamed', {
        token, shareId: share.id, entityId: share.entityId,
        companyId: share.companyId, size: streamed.size,
      });

      return new NextResponse(streamed.stream, { status: 200, headers });
    },
  };
}
