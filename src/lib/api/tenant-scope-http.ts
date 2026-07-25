/**
 * 🔒 TENANT SCOPE AT THE HTTP BOUNDARY (ADR-702)
 *
 * `lib/auth/tenant-scope` is deliberately transport-free — it takes an
 * `AuthContext` and a string, so it stays unit-testable without Next.js. This
 * module is the thin layer that reads that string off a real request and turns
 * a refusal into a real response.
 *
 * It exists because the alternative is what jscpd found the moment the strict
 * doctrine was applied to a second endpoint: the same eight lines of
 * read-argument / reject-if-missing / authorise, and the same
 * `TenantIsolationError → NextResponse` mapping, copied side by side. Small
 * enough to retype, security-shaped enough that retyping it is how a guard goes
 * missing.
 *
 * @module lib/api/tenant-scope-http
 * @enterprise ADR-702 — Tenant Query Scope SSoT
 * @see lib/auth/tenant-scope — the doctrine these helpers apply
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import type { AuthContext } from '@/lib/auth/types';
import { TenantIsolationError } from '@/lib/auth/tenant-isolation-error';
import {
  TENANT_SCOPE_QUERY_PARAM,
  requireTenantScope,
  type TenantScope,
} from '@/lib/auth/tenant-scope';
import { ApiError } from './api-error-types';

/** Envelope every tenant refusal answers with. */
export interface TenantIsolationErrorBody {
  success: false;
  error: string;
  details: string;
}

/**
 * Read the company a request names in its query string and authorise it.
 *
 * For endpoints where the company is an *argument to the operation* rather than
 * a filter — a migration, a cost report. Absent is a 400; not yours is a 403.
 *
 * @param req Incoming request
 * @param ctx Authenticated request context
 * @throws {ApiError} 400 when no company is named
 * @throws {TenantIsolationError} 403 when the caller may not act on that company
 */
export function requireTenantScopeFromQuery(req: NextRequest, ctx: AuthContext): TenantScope {
  const requested = req.nextUrl.searchParams.get(TENANT_SCOPE_QUERY_PARAM) ?? '';

  if (!requested) {
    throw new ApiError(400, `${TENANT_SCOPE_QUERY_PARAM} query param required`);
  }

  return requireTenantScope(ctx, requested);
}

/**
 * {@link requireTenantScopeFromQuery} for a company named in the request body.
 *
 * Same decision, different envelope — a write endpoint that takes its target
 * company as JSON is no less a scope decision than one that takes it in the URL.
 *
 * @param body Parsed request body
 * @param ctx  Authenticated request context
 * @throws {ApiError} 400 when no company is named
 * @throws {TenantIsolationError} 403 when the caller may not act on that company
 */
export function requireTenantScopeFromBody(
  body: { companyId?: string },
  ctx: AuthContext,
): TenantScope {
  const requested = body.companyId ?? '';

  if (!requested) {
    throw new ApiError(400, `${TENANT_SCOPE_QUERY_PARAM} required in body`);
  }

  return requireTenantScope(ctx, requested);
}

/**
 * Render a typed tenant refusal as the response shape the list endpoints ship.
 *
 * Routes that already return a hand-built `{ success, error, details }` envelope
 * use this; routes that simply let the error propagate get the same status from
 * `ApiErrorHandler` instead. Both paths, one decision about what a refusal means.
 *
 * @param error           The refusal thrown by a `requireXInTenant` guard
 * @param notFoundMessage What to say when the parent does not exist at all —
 *                        deliberately not "belongs to another company", which
 *                        would confirm the resource's existence to a stranger.
 */
export function tenantIsolationResponse(
  error: TenantIsolationError,
  notFoundMessage: string,
): NextResponse<TenantIsolationErrorBody> {
  return NextResponse.json(
    {
      success: false as const,
      error: error.code === 'NOT_FOUND' ? notFoundMessage : 'Access denied',
      details: error.message,
    },
    { status: error.status },
  );
}
