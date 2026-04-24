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
 *   2. Resolve the share via the surface-specific `resolveShare` hook.
 *   3. Return 404 when the share is missing, 410 when expired.
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
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger, type Logger } from '@/lib/telemetry/Logger';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';

// =============================================================================
// Public contracts
// =============================================================================

export interface ResolvedShowcaseShare<TExtra = Record<string, unknown>> {
  entityId: string;
  companyId: string;
  expiresAt: string;
  pdfStoragePath?: string;
  /** Surface-specific extras (e.g. property's videoUrl note). */
  extra?: TExtra;
}

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
  /**
   * Resolve the share document by token. Returning `null` → 404.
   * Surface-specific because property uses the legacy `FILE_SHARES`
   * collection while project/building use the unified `shares` with
   * `entityType === '{entity}_showcase'`.
   */
  resolveShare: (
    token: string,
    adminDb: Firestore,
  ) => Promise<ResolvedShowcaseShare<TExtra> | null>;
  /**
   * Build the surface-specific public payload. Owns snapshot + media loading
   * + tenant check (snapshot builders already enforce it per Phase 1.1).
   */
  buildPayload: (params: BuildPublicPayloadParams<TExtra>) => Promise<TPayload>;
  /** PDF URL path template (invoked only when `pdfStoragePath` is present). */
  pdfUrlPath: (token: string) => string;
}

export interface PublicShowcasePayloadHandler {
  handle(request: NextRequest, token: string): Promise<NextResponse>;
}

// =============================================================================
// Internal helpers
// =============================================================================

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function buildBaseUrl(req: NextRequest): string {
  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  if (envBase && envBase.trim().length > 0) return envBase.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

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
  const logger = createModuleLogger(config.loggerName);

  return {
    async handle(request: NextRequest, token: string): Promise<NextResponse> {
      if (!token || token.trim().length === 0) {
        return jsonError(400, 'Token is required');
      }

      const adminDb = getAdminFirestore();
      if (!adminDb) return jsonError(503, 'Database connection not available');

      const share = await config.resolveShare(token, adminDb);
      if (!share) return jsonError(404, config.shareNotFoundMessage);

      if (new Date(share.expiresAt).getTime() < Date.now()) {
        return jsonError(410, 'Showcase link has expired');
      }

      const locale = resolveLocale(request);
      const pdfUrl = share.pdfStoragePath
        ? `${buildBaseUrl(request)}${config.pdfUrlPath(token)}`
        : undefined;

      let payload: TPayload;
      try {
        payload = await config.buildPayload({
          entityId: share.entityId,
          companyId: share.companyId,
          locale,
          expiresAt: share.expiresAt,
          pdfStoragePath: share.pdfStoragePath,
          pdfUrl,
          extra: share.extra,
          adminDb,
          logger,
          token,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Public showcase payload build failed', {
          token, entityId: share.entityId, companyId: share.companyId, error: msg,
        });
        if (msg.includes('not found')) return jsonError(404, 'Entity not found');
        if (msg.toLowerCase().includes('tenant')) return jsonError(403, 'Access denied');
        return jsonError(500, 'Failed to load showcase data');
      }

      logger.info('Public showcase resolved', {
        token, entityId: share.entityId, companyId: share.companyId,
      });

      return NextResponse.json(payload);
    },
  };
}
