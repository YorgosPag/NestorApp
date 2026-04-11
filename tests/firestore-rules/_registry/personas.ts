/**
 * Firestore Rules Test Coverage — Canonical Personas
 *
 * Single source of truth for authenticated test identities. Each persona
 * corresponds to a distinct rules decision path: super_admin bypasses tenant
 * isolation, same_tenant_* rely on companyId claim matching the doc's
 * companyId, cross_tenant_* deliberately mismatch, anonymous has no claims.
 *
 * See ADR-298 §3.2.
 *
 * @module tests/firestore-rules/_registry/personas
 * @since 2026-04-11 (ADR-298 Phase A)
 */

/** Canonical persona set exercised by every collection's coverage matrix. */
export type Persona =
  | 'super_admin'
  | 'same_tenant_admin'
  | 'same_tenant_user'
  | 'cross_tenant_admin'
  | 'cross_tenant_user'
  | 'anonymous'
  | 'external_user';

/** Auth claims attached to a persona's authenticated Firestore context. */
export interface PersonaClaims {
  readonly uid: string;
  readonly companyId: string;
  readonly globalRole:
    | 'super_admin'
    | 'company_admin'
    | 'internal_user'
    | 'external_user';
}

/**
 * Logical companyId buckets.
 *
 * `SAME_TENANT_COMPANY_ID` is the companyId used for the *seeded document*
 * in every test — same_tenant_* personas are allowed, cross_tenant_* are
 * denied. Super admin has its own companyId and bypasses via globalRole.
 */
export const SAME_TENANT_COMPANY_ID = 'company-a' as const;
export const CROSS_TENANT_COMPANY_ID = 'company-b' as const;
export const SUPER_ADMIN_COMPANY_ID = 'company-root' as const;

/**
 * Persona → claims map.
 *
 * `anonymous` has no entry — it uses the unauthenticated context via
 * `getAnonymous(env)` in auth-contexts.ts.
 */
export const PERSONA_CLAIMS: Readonly<Record<Exclude<Persona, 'anonymous'>, PersonaClaims>> = {
  super_admin: {
    uid: 'persona-super-admin',
    companyId: SUPER_ADMIN_COMPANY_ID,
    globalRole: 'super_admin',
  },
  same_tenant_admin: {
    uid: 'persona-same-admin',
    companyId: SAME_TENANT_COMPANY_ID,
    globalRole: 'company_admin',
  },
  same_tenant_user: {
    uid: 'persona-same-user',
    companyId: SAME_TENANT_COMPANY_ID,
    globalRole: 'internal_user',
  },
  cross_tenant_admin: {
    uid: 'persona-cross-admin',
    companyId: CROSS_TENANT_COMPANY_ID,
    globalRole: 'company_admin',
  },
  cross_tenant_user: {
    uid: 'persona-cross-user',
    companyId: CROSS_TENANT_COMPANY_ID,
    globalRole: 'internal_user',
  },
  external_user: {
    uid: 'persona-external',
    companyId: SAME_TENANT_COMPANY_ID,
    globalRole: 'external_user',
  },
} as const;

/** All personas — iteration helper. */
export const ALL_PERSONAS: readonly Persona[] = [
  'super_admin',
  'same_tenant_admin',
  'same_tenant_user',
  'cross_tenant_admin',
  'cross_tenant_user',
  'anonymous',
  'external_user',
] as const;

/** Type guard: does this persona carry claims? */
export function isAuthenticatedPersona(
  p: Persona,
): p is Exclude<Persona, 'anonymous'> {
  return p !== 'anonymous';
}
