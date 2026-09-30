/**
 * Storage Rules Test Harness — Persona → Auth Context factory
 *
 * Converts a canonical `StoragePersona` (from _registry/personas.ts) into a
 * `RulesTestContext` with the expected custom claims attached. Every
 * test in the suite acquires its context via `getStorageContext` — no direct
 * `env.authenticatedContext(...)` calls.
 *
 * See ADR-301 §3.1.
 *
 * @module tests/storage-rules/_harness/auth-contexts
 * @since 2026-04-14 (ADR-301 Phase A)
 */

import type { RulesTestContext, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import {
  PERSONA_CLAIMS,
  isAuthenticatedPersona,
  type StoragePersona,
} from '../_registry/personas';
import { REVOKED_SIGN_INS_CLAIM } from '../../../src/lib/auth/revoked-sign-ins-claim';

/**
 * Get an authenticated or unauthenticated test context for a persona.
 * Anonymous returns an unauthenticated context; all others return
 * authenticated contexts with `companyId` and `globalRole` custom claims.
 *
 * The returned `RulesTestContext` is used to call `.storage()` in assertions.
 */
export function getStorageContext(
  env: RulesTestEnvironment,
  persona: StoragePersona,
): RulesTestContext {
  if (!isAuthenticatedPersona(persona)) {
    return env.unauthenticatedContext();
  }

  const claims = PERSONA_CLAIMS[persona];
  return env.authenticatedContext(claims.uid, {
    companyId: claims.companyId,
    globalRole: claims.globalRole,
  });
}

/** Explicit anonymous shortcut — reads better in tests than `getStorageContext(env, 'anonymous')`. */
export function getAnonymousStorageContext(env: RulesTestEnvironment): RulesTestContext {
  return env.unauthenticatedContext();
}

/** Explicit super-admin shortcut. */
export function getSuperAdminStorageContext(env: RulesTestEnvironment): RulesTestContext {
  return getStorageContext(env, 'super_admin');
}

/**
 * ADR-894 §10.7 — ζωντανή σύνδεση: το token της περσόνας με **συγκεκριμένο** `auth_time` και το claim
 * `revokedSignIns` που προβάλλει ο γραφέας claims. Ίδιο όνομα claim με την παραγωγή (το σταθερό του πυρήνα).
 */
export function getSignInStorageContext(
  env: RulesTestEnvironment,
  persona: Exclude<StoragePersona, 'anonymous'>,
  signIn: { readonly authTime: number; readonly revokedSignIns?: readonly number[] },
): RulesTestContext {
  const claims = PERSONA_CLAIMS[persona];
  return env.authenticatedContext(claims.uid, {
    companyId: claims.companyId,
    globalRole: claims.globalRole,
    auth_time: signIn.authTime,
    ...(signIn.revokedSignIns ? { [REVOKED_SIGN_INS_CLAIM]: [...signIn.revokedSignIns] } : {}),
  });
}

/**
 * Seed context — bypasses rules via `withSecurityRulesDisabled`. Use for
 * arrange-phase file uploads (seeding files that read/delete tests need).
 * NEVER use for assertions.
 */
export async function withSeedContext(
  env: RulesTestEnvironment,
  fn: (ctx: RulesTestContext) => Promise<void>,
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx);
  });
}
