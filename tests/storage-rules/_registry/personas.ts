/**
 * Storage Rules Test Coverage — Canonical Personas
 *
 * Single source of truth for authenticated test identities used in Storage
 * rules tests. Intentionally duplicated from the Firestore registry (SRP) —
 * Storage and Firestore share the same Firebase Auth claims model but have
 * different rule evaluation contexts.
 *
 * See ADR-301 §3.2.
 *
 * @module tests/storage-rules/_registry/personas
 * @since 2026-04-14 (ADR-301 Phase A)
 */

/** Canonical persona set exercised by every path's coverage matrix. */
export type StoragePersona =
  | 'super_admin'
  | 'same_tenant_user'
  | 'same_tenant_admin'
  | 'cross_tenant_user'
  | 'anonymous';

/** Auth claims attached to an authenticated storage context. */
export interface PersonaClaims {
  readonly uid: string;
  readonly companyId: string;
  readonly globalRole: 'super_admin' | 'company_admin' | 'internal_user';
}

/**
 * Logical companyId buckets.
 *
 * `SAME_TENANT_COMPANY_ID` is the companyId used as the path segment in
 * company-scoped tests — same_tenant_* personas are allowed, cross_tenant_*
 * are denied. Owner-based paths use `OWNER_USER_UID` embedded in the path.
 */
export const SAME_TENANT_COMPANY_ID = 'company-a' as const;
export const CROSS_TENANT_COMPANY_ID = 'company-b' as const;
export const SUPER_ADMIN_COMPANY_ID = 'company-root' as const;

/**
 * UID used as the `{userId}` path segment in owner-based tests (cad/, temp/).
 * `same_tenant_user` acts as the file owner in these suites.
 */
export const OWNER_USER_UID = 'persona-same-user' as const;

/**
 * Persona → claims map.
 *
 * `anonymous` has no entry — it uses the unauthenticated context via
 * `env.unauthenticatedContext()`.
 */
export const PERSONA_CLAIMS: Readonly<
  Record<Exclude<StoragePersona, 'anonymous'>, PersonaClaims>
> = {
  super_admin: {
    uid: 'persona-super-admin',
    companyId: SUPER_ADMIN_COMPANY_ID,
    globalRole: 'super_admin',
  },
  same_tenant_user: {
    uid: OWNER_USER_UID,
    companyId: SAME_TENANT_COMPANY_ID,
    globalRole: 'internal_user',
  },
  same_tenant_admin: {
    uid: 'persona-same-admin',
    companyId: SAME_TENANT_COMPANY_ID,
    globalRole: 'company_admin',
  },
  cross_tenant_user: {
    uid: 'persona-cross-user',
    companyId: CROSS_TENANT_COMPANY_ID,
    globalRole: 'internal_user',
  },
} as const;

/** Type guard: does this persona carry claims? */
export function isAuthenticatedPersona(
  p: StoragePersona,
): p is Exclude<StoragePersona, 'anonymous'> {
  return p !== 'anonymous';
}
