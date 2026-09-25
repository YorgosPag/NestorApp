/**
 * =============================================================================
 * SHOWCASE CORE — Public Payload Route Factory (ADR-321 Phase 1.4c)
 * =============================================================================
 *
 * Config-driven generic that produces `GET /api/{entity}-showcase/[token]`
 * handlers. Extracted from the 3 legacy public routes (property, project,
 * building) which share the same public contract:
 *
 *   1. Validate token is non-empty (400).
 *   2. Pass the **one** share gate (`lookupPublicShowcaseShare` →
 *      `server/sharing/share-gate.ts`, ADR-884 Φ0.12) for the declared
 *      `shareEntityType`.
 *   3. 404 missing / wrong surface · 401 password-protected without the access
 *      grant cookie · 410 expired or exhausted · 503 grant secret missing.
 *   4. Parse `locale` from the query string (`el` / `en`, default `el`).
 *   5. Build the surface-specific payload via `buildPayload` (which owns the
 *      snapshot + media loading; builders already enforce tenant isolation
 *      belt-and-suspenders per Phase 1.1).
 *   6. Synthesise the public PDF URL when the share carries a storage path.
 *   7. Log + return `NextResponse.json(payload)`.
 *
 * Public routes remain anonymous — rate limiting sits on the
 * `withStandardRateLimit` wrapper at the route file (the public pattern
 * already in place for the 3 legacy routes; the factory does not wrap here
 * because some legacy routes rely on Next.js edge caching semantics that
 * differ between surfaces).
 *
 * @module services/showcase-core/api/create-public-payload-route
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import type { Logger } from '@/lib/telemetry/Logger';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import { requestOriginOrThrow } from '@/lib/http/request-origin';
import type { ShareEntityType } from '@/types/sharing';
import { jsonError } from '@/app/api/showcase/shared-pdf-proxy-helpers';
import { createPublicShowcaseHandler, type PublicShowcaseShare } from './public-share-lookup';

// =============================================================================
// Public contracts
// =============================================================================

export interface BuildPublicPayloadParams<TExtra = Record<string, unknown>> {
  entityId: string;
  companyId: string;
  locale: EnumLocale;
  expiresAt: string;
  pdfStoragePath: string | undefined;
  pdfUrl: string | undefined;
  extra: TExtra | undefined;
  adminDb: Firestore;
  logger: Logger;
  /** Raw token — surface may need it to synthesise additional URLs. */
  token: string;
}

export interface CreatePublicPayloadRouteConfig<TPayload, TExtra = Record<string, unknown>> {
  loggerName: string;
  /** Human message shown when the share is missing / deactivated (404). */
  shareNotFoundMessage: string;
  /** Share discriminator served by this route, e.g. `'building_showcase'`. */
  shareEntityType: ShareEntityType;
  /** Surface-specific extras read off the resolved share (property: video URL note). */
  extraOf?: (share: PublicShowcaseShare) => TExtra;
  /**
   * Build the surface-specific public payload. Owns snapshot + media loading
   * + tenant check (snapshot builders already enforce it per Phase 1.1).
   */
  buildPayload: (params: BuildPublicPayloadParams<TExtra>) => Promise<TPayload>;
  /** PDF URL path template (invoked only when `pdfStoragePath` is present). Return null to skip PDF URL. */
  pdfUrlPath: (token: string) => string | null;
}

export interface PublicShowcasePayloadHandler {
  handle(request: NextRequest, token: string): Promise<NextResponse>;
}

// =============================================================================
// Internal helpers
// =============================================================================

function resolveLocale(request: NextRequest): EnumLocale {
  const localeParam = request.nextUrl.searchParams.get('locale');
  return localeParam === 'en' ? 'en' : 'el';
}

// =============================================================================
// Factory
// =============================================================================

export function createPublicShowcasePayloadRoute<TPayload, TExtra = Record<string, unknown>>(
  config: CreatePublicPayloadRouteConfig<TPayload, TExtra>,
): PublicShowcasePayloadHandler {
  return createPublicShowcaseHandler(config, async ({ request, token, share, adminDb, logger }) => {
    const locale = resolveLocale(request);
    const pdfPath = share.pdfStoragePath ? config.pdfUrlPath(token) : null;
    const pdfUrl = pdfPath ? `${requestOriginOrThrow(request)}${pdfPath}` : undefined;

    let payload: TPayload;
    try {
      payload = await config.buildPayload({
        entityId: share.entityId,
        companyId: share.companyId,
        locale,
        expiresAt: share.expiresAt,
        pdfStoragePath: share.pdfStoragePath,
        pdfUrl,
        extra: config.extraOf?.(share),
        adminDb,
        logger,
        token,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Public showcase payload build failed', {
        shareId: share.id, entityId: share.entityId, companyId: share.companyId, error: msg,
      });
      if (msg.includes('not found')) return jsonError(404, 'Entity not found');
      if (msg.toLowerCase().includes('tenant')) return jsonError(403, 'Access denied');
      return jsonError(500, 'Failed to load showcase data');
    }

    logger.info('Public showcase resolved', {
      shareId: share.id, entityId: share.entityId, companyId: share.companyId,
    });

    return NextResponse.json(payload);
  });
}
