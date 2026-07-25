/**
 * 🔒 TENANT ISOLATION ERROR — the typed refusal, on its own.
 *
 * Extracted from `tenant-isolation.ts` (ADR-701) for one reason: that module
 * imports `getAdminFirestore` at module scope, so importing it drags the
 * Firebase Admin SDK — and `server-only` — into anything that merely wants to
 * *throw* a tenant refusal. `tenant-scope.ts` deliberately keeps itself free of
 * server imports so it stays unit-testable, and it needs this class.
 *
 * The class itself is unchanged and still re-exported from
 * `tenant-isolation.ts`, so every existing importer keeps working.
 *
 * @module lib/auth/tenant-isolation-error
 * @enterprise ADR-701 — Tenant Query Scope SSoT
 * @see lib/auth/tenant-isolation — per-document ownership checks (ADR-255)
 * @see lib/auth/tenant-scope — collection-level scope resolution (ADR-697/701)
 */

/**
 * Typed tenant isolation error (NO string parsing for status codes).
 *
 * `status` is the HTTP code a route should answer with; `code` lets a handler
 * distinguish "does not exist" from "exists but is not yours" without matching
 * on message text.
 *
 * @enterprise Replaces brittle `errorMessage.includes('not found')` pattern
 */
export class TenantIsolationError extends Error {
  constructor(
    message: string,
    public readonly status: 404 | 403,
    public readonly code: 'NOT_FOUND' | 'FORBIDDEN'
  ) {
    super(message);
    this.name = 'TenantIsolationError';
  }
}
