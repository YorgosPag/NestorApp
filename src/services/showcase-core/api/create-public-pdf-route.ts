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
 *   2. Pass the **one** share gate for the declared `shareEntityType`
 *      (ADR-884 Φ0.12): 404 missing · 401 password without grant · 410
 *      expired/exhausted · 503 grant secret missing.
 *   3. Load entity header (for filename + tenant cross-check).
 *   4. Return 403 on tenant mismatch.
 *   5. Record the access **in a transaction, before streaming** — the limit is
 *      enforced (410 when exhausted), not merely counted after the fact. Inside
 *      a visit (access grant cookie from `/api/shares/resolve`) it is not
 *      counted twice.
 *   6. Stream the PDF via the shared `streamPdfFromStorage` helper.
 *   7. Set Content-Type/Disposition/Cache-Control headers + respond.
 *
 * Public route — anonymous access is protected only by share-token validation
 * and tenant cross-check. The route file wraps with `withStandardRateLimit`
 * (matches the 3 legacy routes).
 *
 * @module services/showcase-core/api/create-public-pdf-route
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import type { Logger } from '@/lib/telemetry/Logger';
import {
  jsonError,
  streamPdfFromStorage,
} from '@/app/api/showcase/shared-pdf-proxy-helpers';
import { recordShareAccess } from '@/server/sharing/share-access';
import { requestHasShareAccessGrant } from '@/server/sharing/share-access-grant';
import type { ShareEntityType } from '@/types/sharing';
import { createPublicShowcaseHandler, publicShowcaseRefusalResponse } from './public-share-lookup';

// =============================================================================
// Public contracts
// =============================================================================

export interface CreatePublicPdfRouteConfig<TEntityHeader> {
  loggerName: string;
  /** Human message for 404 (e.g. `'Building showcase link not found or deactivated'`). */
  shareNotFoundMessage: string;
  /** Human message for 404 on entity lookup (e.g. `'Building not found'`). */
  entityNotFoundMessage: string;
  /** Human message for 404 on missing PDF (optional; property path only). */
  pdfMissingMessage?: string;
  /** Share discriminator served by this route, e.g. `'building_showcase'`. */
  shareEntityType: ShareEntityType;
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
  shareId: string,
): Promise<{ stream: ReadableStream<Uint8Array>; size?: number | undefined } | NextResponse> {
  try {
    return await streamPdfFromStorage(pdfStoragePath);
  } catch (err) {
    logger.error('Public showcase PDF stream failed', {
      shareId,
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
  return createPublicShowcaseHandler(config, async ({ request, share, adminDb, logger }) => {
    if (!share.pdfStoragePath) {
      return jsonError(404, config.pdfMissingMessage ?? 'PDF is not available for this showcase');
    }

    const header = await config.loadEntityHeader(share.entityId, adminDb);
    if (!header) return jsonError(404, config.entityNotFoundMessage);
    if (!config.checkTenant(header, share.companyId)) return jsonError(403, 'Tenant mismatch');

    // Μέσα στην επίσκεψη (κουπόνι της επίλυσης) το PDF δεν ξαναμετρά· αλλιώς μετρά.
    if (!requestHasShareAccessGrant(request, share.id)) {
      const access = await recordShareAccess(adminDb, share.stored);
      if (access !== 'recorded') {
        return publicShowcaseRefusalResponse(access === 'gone' ? 'not-found' : 'expired', config.shareNotFoundMessage);
      }
    }

    const streamed = await streamOrFail(share.pdfStoragePath, logger, share.id);
    if (streamed instanceof NextResponse) return streamed;

    logger.info('Public showcase PDF streamed', {
      shareId: share.id, entityId: share.entityId, companyId: share.companyId, size: streamed.size,
    });
    const headers = buildHeaders(config.buildFilename(header), streamed.size);
    return new NextResponse(streamed.stream, { status: 200, headers });
  });
}
