/**
 * =============================================================================
 * defineRoute — API Route-Handler Factory (SSoT composition layer)
 * =============================================================================
 *
 * Single composition point for the repeated CRUD handler assembly found across
 * `src/app/api/**\/route.ts`. It composes the EXISTING primitives — it does NOT
 * re-implement them:
 *
 *   rate-limit wrapper  →  withAuth  →  try/catch  →  schema parse  →  envelope
 *   (@/lib/middleware)     (@/lib/auth)                (safeParseBody) (ApiError)
 *
 * Big-player rationale (Stripe / Figma / GitHub):
 *  - The SSoT here is the COMPOSITION of cross-cutting concerns, NOT a change to
 *    the public wire contract. The factory emits the exact bare envelope
 *    (`{ success, data }` / `{ success, error }`) and status codes the migrated
 *    routes already emit — byte-identical. A unified richer envelope
 *    (requestId/timestamp) would be a SEPARATE, versioned rollout — see ADR-602.
 *  - Divergences (schema, business logic, rate tier, auth requirements, status)
 *    are injected via config/handler — composition, NOT a God-wrapper with
 *    if-branching.
 *
 * @module lib/api/define-route
 * @see ADR-602 API Route-Handler Factory SSoT
 * @see ADR-245 API Routes Centralization (URL extraction helpers)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache, WithAuthOptions } from '@/lib/auth';
import {
  withAssetRateLimit,
  withHighRateLimit,
  withStandardRateLimit,
  withSensitiveRateLimit,
  withHeavyRateLimit,
  withWebhookRateLimit,
  withTelegramRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { getErrorMessage } from '@/lib/error-utils';
import { ApiError } from '@/lib/api/api-error-types';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('API_ROUTE');

// =============================================================================
// RATE-LIMIT TIER → wrapper map (reuse existing 6 categories)
// =============================================================================

export type RateLimitTier =
  | 'asset'
  | 'high'
  | 'standard'
  | 'sensitive'
  | 'heavy'
  | 'webhook'
  | 'telegram';

const RATE_LIMIT_WRAPPERS: Record<
  RateLimitTier,
  <C>(handler: (req: NextRequest, ctx?: C) => Promise<Response> | Response) => (req: NextRequest, ctx?: C) => Promise<Response> | Response
> = {
  asset: withAssetRateLimit,
  high: withHighRateLimit,
  standard: withStandardRateLimit,
  sensitive: withSensitiveRateLimit,
  heavy: withHeavyRateLimit,
  webhook: withWebhookRateLimit,
  telegram: withTelegramRateLimit,
};

// =============================================================================
// ENVELOPE HELPERS — bare `{ success, ... }` shape (byte-identical to routes)
// =============================================================================

/**
 * 200 OK success envelope. `ok(data)` → `{ success: true, data }`;
 * `ok()` → `{ success: true }` (matches PATCH routes that return no payload).
 */
export function ok<T>(data?: T): NextResponse {
  return NextResponse.json(
    data === undefined ? { success: true } : { success: true, data },
    { status: 200 },
  );
}

/** 201 Created success envelope. `created({ id })` → `{ success: true, data: { id } }`. */
export function created<T>(data?: T): NextResponse {
  return NextResponse.json(
    data === undefined ? { success: true } : { success: true, data },
    { status: 201 },
  );
}

/** Throw a 400 Bad Request. Optional `details` are spread into the envelope. */
export function badRequest(message: string, details?: Record<string, unknown>): never {
  throw new ApiError(400, message, undefined, details);
}

/** Throw a 404 Not Found. */
export function notFound(message: string, details?: Record<string, unknown>): never {
  throw new ApiError(404, message, undefined, details);
}

/**
 * Throw a 409 Conflict. `details` are spread at the top level of the envelope,
 * e.g. `conflict('...', { existingCertificateId })`.
 */
export function conflict(message: string, details?: Record<string, unknown>): never {
  throw new ApiError(409, message, undefined, details);
}

/** Throw an arbitrary typed HTTP error (reuses the shared ApiError class). */
export function httpError(
  statusCode: number,
  message: string,
  details?: Record<string, unknown>,
): never {
  throw new ApiError(statusCode, message, undefined, details);
}

// =============================================================================
// HANDLER CONTEXT + CONFIG
// =============================================================================

/**
 * Everything a route handler needs, resolved by the factory:
 * `req` (raw request), `auth` (AuthContext with companyId/uid), `cache`
 * (PermissionCache for in-handler permission checks), `body` (parsed schema
 * output — `undefined` when no schema), `params` (awaited dynamic segments).
 */
export interface RouteHandlerContext<TBody, TParams> {
  req: NextRequest;
  auth: AuthContext;
  cache: PermissionCache;
  body: TBody;
  params: TParams;
}

export type RouteHandler<TBody, TParams> = (
  context: RouteHandlerContext<TBody, TParams>,
) => Promise<NextResponse> | NextResponse;

export interface DefineRouteConfig<TSchema extends z.ZodTypeAny, TParams> {
  /** Rate-limit tier → maps to the existing pre-configured wrappers. */
  rateLimit: RateLimitTier;
  /** Optional Zod schema — when present, the body is parsed via `safeParseBody`
   *  and the typed result is passed as `context.body`. A 400 is returned
   *  automatically (byte-identical to `safeParseBody`) on validation failure. */
  schema?: TSchema;
  /** Optional withAuth options (permissions / roles / allowUnauthenticated). */
  auth?: WithAuthOptions;
  /** Fallback message for the 500 envelope when a thrown error has no message. */
  fallbackError?: string;
  /** Business handler — receives the resolved context, returns an envelope. */
  handler: RouteHandler<z.infer<TSchema>, TParams>;
}

/** Next.js route segment context: `{ params: Promise<...> }` (v15+ async). */
type SegmentData<TParams> = { params: Promise<TParams> } | undefined;

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Compose a Next.js route export from the shared primitives.
 *
 * @example
 * export const GET = defineRoute({
 *   rateLimit: 'standard',
 *   handler: async ({ auth }) => {
 *     const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
 *     return ok(await repository.listAPYCertificates());
 *   },
 * });
 *
 * export const POST = defineRoute({
 *   rateLimit: 'sensitive',
 *   schema: CreateAPYSchema,
 *   handler: async ({ auth, body }) => {
 *     // ...duplicate check → conflict('...', { existingCertificateId });
 *     return created({ id });
 *   },
 * });
 */
export function defineRoute<
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TParams = Record<string, string>,
>(
  config: DefineRouteConfig<TSchema, TParams>,
): (request: NextRequest, segmentData?: SegmentData<TParams>) => Promise<Response> {
  const { rateLimit, schema, auth, fallbackError, handler } = config;

  const authed = withAuth(
    async (
      req: NextRequest,
      ctx: AuthContext,
      cache: PermissionCache,
      routeContext?: SegmentData<TParams>,
    ): Promise<NextResponse> => {
      try {
        const params = (routeContext?.params
          ? await routeContext.params
          : ({} as TParams)) as TParams;

        let body = undefined as z.infer<TSchema>;
        if (schema) {
          const parsed = safeParseBody(schema, await req.json());
          if (parsed.error) return parsed.error;
          body = parsed.data;
        }

        return await handler({ req, auth: ctx, cache, body, params });
      } catch (error) {
        return toErrorResponse(error, req, fallbackError);
      }
    },
    auth,
  );

  const rateLimited = RATE_LIMIT_WRAPPERS[rateLimit](authed);

  return (request: NextRequest, segmentData?: SegmentData<TParams>) =>
    Promise.resolve(rateLimited(request, segmentData));
}

// =============================================================================
// ERROR → ENVELOPE (byte-identical: ApiError = expected, else 500 + log)
// =============================================================================

function toErrorResponse(
  error: unknown,
  req: NextRequest,
  fallbackError?: string,
): NextResponse {
  // Expected business errors (404/409/400/…) — NOT logged, details spread.
  if (error instanceof ApiError) {
    return NextResponse.json(
      { success: false, error: error.message, ...(error.details ?? {}) },
      { status: error.statusCode },
    );
  }

  // Unexpected errors → 500 + structured server log (server-only, N.11 exempt).
  const message = getErrorMessage(error, fallbackError ?? 'Internal server error');
  logger.error('Route handler error', {
    method: req.method,
    path: new URL(req.url).pathname,
    error: message,
  });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}
