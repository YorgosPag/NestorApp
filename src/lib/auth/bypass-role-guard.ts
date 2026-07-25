/**
 * =============================================================================
 * BYPASS-ROLE ROUTE GUARD — SSoT (ADR-703)
 * =============================================================================
 *
 * The "system-level admin endpoint" gate: refuse any caller whose global role does
 * not bypass permission checks.
 *
 * It asks {@link isRoleBypass} — the roles SSoT — instead of comparing the role
 * string. A raw `globalRole === 'super_admin'` silently refuses any *second* bypass
 * role its own privileges: the code reads correct, the behaviour is wrong, and
 * nothing fails. Routing the question through the SSoT means a new bypass role is
 * honoured everywhere at once.
 *
 * @example
 * ```ts
 * const forbidden = bypassRoleGuard(ctx);
 * if (forbidden) return forbidden;
 * ```
 *
 * ⚠️ ONE payload, ON PURPOSE — do not parameterise it.
 * Routes whose 403 body differs (own error text, `ApiError`, `createErrorResponse`)
 * call `isRoleBypass()` directly instead. Adding a payload/logger option bag here
 * would not remove the duplication — it would move it into the call-site config,
 * the failure mode measured in ADR-698/699. A second *fixed* payload deserves a
 * second named function, not a flag.
 *
 * @module lib/auth/bypass-role-guard
 * @see ADR-703 — Role-predicate SSoT
 * @see roles.ts — `isRoleBypass`, the predicate this wraps
 */

import { NextResponse } from 'next/server';
import { isRoleBypass } from './roles';

/**
 * Machine-readable code returned with the canonical refusal.
 * Kept exported so callers/tests assert on the constant, not a string literal.
 */
export const BYPASS_ROLE_REQUIRED_CODE = 'SUPER_ADMIN_REQUIRED' as const;

/** Human-readable message of the canonical refusal. */
export const BYPASS_ROLE_REQUIRED_ERROR = 'Forbidden: super_admin required' as const;

/** Body shape of the canonical refusal — unchanged from the routes it replaces. */
export interface BypassRoleForbiddenBody {
  success: false;
  error: typeof BYPASS_ROLE_REQUIRED_ERROR;
  code: typeof BYPASS_ROLE_REQUIRED_CODE;
}

/**
 * Guard a system-level admin route.
 *
 * @param ctx - Anything carrying the caller's global role (`AuthContext`, or the
 *              `auth` object handed to a `defineRoute` handler).
 * @returns `null` when the caller may proceed, otherwise the canonical 403 response.
 */
export function bypassRoleGuard(
  ctx: Readonly<{ globalRole: string }>,
): NextResponse<BypassRoleForbiddenBody> | null {
  if (isRoleBypass(ctx.globalRole)) {
    return null;
  }

  return NextResponse.json<BypassRoleForbiddenBody>(
    {
      success: false,
      error: BYPASS_ROLE_REQUIRED_ERROR,
      code: BYPASS_ROLE_REQUIRED_CODE,
    },
    { status: 403 },
  );
}
