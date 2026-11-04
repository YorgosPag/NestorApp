/**
 * =============================================================================
 * defineRoute — API Route-Handler Factory (SSoT composition layer)
 * =============================================================================
 *
 * Single composition point for the repeated CRUD handler assembly found across
 * `src/app/api/**\/route.ts`. It composes the EXISTING primitives — it does NOT
 * re-implement them:
 *
 *   shield  →  rate-limit wrapper  →  withAuth  →  try/catch  →  schema parse  →  envelope
 *   (cache policy +       (@/lib/middleware)  (@/lib/auth)             (safeJsonBody)  (ApiError)
 *    safe 500, ADR-603 §Ασπίδα — route-response-shield)
 *
 * Big-player rationale (Stripe / Figma / GitHub):
 *  - The SSoT here is the COMPOSITION of cross-cutting concerns, NOT a change to
 *    the public wire contract. The factory emits the bare envelope
 *    (`{ success, data }` / `{ success, error }`) the migrated routes emit. The
 *    ONE deliberate exception (ADR-603 §Ασπίδα, 2026-11-04): an UNEXPECTED error
 *    no longer echoes its internal message — the client gets the route's
 *    `fallbackError` + `errorCode` + `requestId` (fields ADDED, none removed).
 *  - Every response leaves through the shield: `Cache-Control` from the route's
 *    DECLARED policy (default `private, no-store`); refusals/errors always no-store.
 *  - Divergences (schema, business logic, rate tier, auth requirements, status)
 *    are injected via config/handler — composition, NOT a God-wrapper with
 *    if-branching.
 *
 * @module lib/api/define-route
 * @see ADR-603 API Route-Handler Factory SSoT (the code said «ADR-602» — that number is the grip ADR)
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
import { safeJsonBody } from '@/lib/validation/shared-schemas';
import { ApiError, asApiError } from '@/lib/api/api-error-types';
import { cacheControlOf, NO_STORE_POLICY, type ResponseCachePolicy } from '@/lib/http/cache-control';
import { shieldResponse, unexpectedErrorResponse } from '@/lib/api/route-response-shield';

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
  /**
   * The client-facing message of the 500 envelope for an UNEXPECTED error (anything not an `ApiError`). The thrown
   * error's own message goes ONLY to the server log, under the `requestId` the client also receives.
   */
  fallbackError?: string;
  /**
   * What the person's browser may keep from a SUCCESSFUL response (default `{ kind: 'no-store' }` ⇒ `private, no-store`).
   * Refusals and errors (≥400) are ALWAYS `private, no-store`, whatever is declared. Validated when the route loads.
   */
  cache?: ResponseCachePolicy;
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
  const cachePolicy = config.cache ?? NO_STORE_POLICY;
  cacheControlOf(cachePolicy); // fail fast: an invalid declaration breaks the route at load, never at first request

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
          // Malformed/empty JSON ⇒ 400 «Invalid or empty JSON body» (SSoT), never a 500 carrying the parser's text.
          const parsed = await safeJsonBody(schema, req);
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

  return shielded(RATE_LIMIT_WRAPPERS[rateLimit](authed), cachePolicy, fallbackError);
}

/**
 * The outermost layer: EVERY response — handler, schema 400, `withAuth` 401/403, rate-limit 429 — leaves through the
 * shield. A throw from the rate-limit store or the auth layer itself gets the same safe 500 (belt and braces).
 */
function shielded<TParams>(
  inner: (request: NextRequest, segmentData?: SegmentData<TParams>) => Promise<Response> | Response,
  cachePolicy: ResponseCachePolicy,
  fallbackError: string | undefined,
): (request: NextRequest, segmentData?: SegmentData<TParams>) => Promise<Response> {
  return async (request, segmentData) => {
    let response: Response;
    try {
      response = await inner(request, segmentData);
    } catch (error) {
      response = unexpectedErrorResponse(error, request, fallbackError);
    }
    return shieldResponse(response, cachePolicy);
  };
}

// =============================================================================
// ERROR → ENVELOPE (ApiError = expected, keeps its message; else safe 500 + log)
// =============================================================================

function toErrorResponse(
  error: unknown,
  req: NextRequest,
  fallbackError?: string,
): NextResponse {
  // Expected business errors (404/409/400/403…) — NOT logged, details spread.
  // ADR-702: classification is shared with ApiErrorHandler so a route's status
  // does not depend on which wrapper it was built with.
  // `errorCode` (ADR-284 policy codes) reaches the client exactly as with ApiErrorHandler — without it a client
  // cannot translate the refusal (N.11) and shows the raw server text. Absent code ⇒ envelope byte-identical.
  const apiError = asApiError(error);
  if (apiError) {
    return NextResponse.json(
      {
        success: false,
        error: apiError.message,
        ...(apiError.errorCode ? { errorCode: apiError.errorCode } : {}),
        ...(apiError.details ?? {}),
      },
      { status: apiError.statusCode },
    );
  }

  // Unexpected errors → generic 500 + requestId; the detail lives only in the server log (ADR-603 §Ασπίδα).
  return unexpectedErrorResponse(error, req, fallbackError);
}
