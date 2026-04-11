/**
 * Firestore Rules Test Harness — Persona → Auth Context factory
 *
 * Converts a canonical `Persona` (from _registry/personas.ts) into a
 * `RulesTestContext` with the expected custom claims attached. Every
 * test in the suite acquires its context via `getContext` — no direct
 * `env.authenticatedContext(...)` calls.
 *
 * See ADR-298 §3.1.
 *
 * @module tests/firestore-rules/_harness/auth-contexts
 * @since 2026-04-11 (ADR-298 Phase A)
 */

import type { RulesTestContext, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import {
  PERSONA_CLAIMS,
  isAuthenticatedPersona,
  type Persona,
} from '../_registry/personas';

/**
 * Get an authenticated or unauthenticated Firestore test context for a
 * persona. Anonymous returns an unauthenticated context; all others return
 * authenticated contexts with `companyId` and `globalRole` custom claims.
 */
export function getContext(
  env: RulesTestEnvironment,
  persona: Persona,
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

/** Explicit anonymous shortcut — reads better in tests than `getContext(env, 'anonymous')`. */
export function getAnonymous(env: RulesTestEnvironment): RulesTestContext {
  return env.unauthenticatedContext();
}

/** Explicit super-admin shortcut — used frequently in immutable regression tests. */
export function getSuperAdmin(env: RulesTestEnvironment): RulesTestContext {
  return getContext(env, 'super_admin');
}

/**
 * Seed context — bypasses rules via `withSecurityRulesDisabled`. Use for
 * arrange-phase document creation, never for assertions.
 *
 * @returns a promise that resolves after the callback completes.
 */
export async function withSeedContext(
  env: RulesTestEnvironment,
  fn: (ctx: RulesTestContext) => Promise<void>,
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx);
  });
}
