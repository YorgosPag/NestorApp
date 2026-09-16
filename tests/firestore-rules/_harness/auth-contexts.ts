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
  ALL_PERSONAS,
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
  assertKnownPersona(persona);

  if (!isAuthenticatedPersona(persona)) {
    return env.unauthenticatedContext();
  }

  const claims = PERSONA_CLAIMS[persona];
  return env.authenticatedContext(claims.uid, {
    companyId: claims.companyId,
    globalRole: claims.globalRole,
  });
}

/**
 * ⛔ Ονομάζει την άγνωστη περσόνα **τη στιγμή που ζητείται**.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — Ο ΤΥΠΟΣ `Persona` ΔΕΝ ΦΡΟΥΡΕΙ ΤΙΠΟΤΑ ΕΔΩ: η σουίτα των
 * κανόνων μεταγλωττίζεται με **`@swc/jest`** (`jest.config.firestore-rules.js`),
 * που είναι **transpile-only** — μηδέν έλεγχος τύπων σε χρόνο εκτέλεσης. Άρα
 * ένα λάθος γραμμένο όνομα περνούσε ολόκληρο το σύνορο: ο `isAuthenticatedPersona`
 * ρωτά **μόνο** `p !== 'anonymous'`, οπότε το άγνωστο string κρινόταν
 * «αυθεντικοποιημένο», έφτανε στο `PERSONA_CLAIMS[persona]` ως `undefined` και
 * έσκαγε με `TypeError: Cannot read properties of undefined (reading 'uid')` —
 * σφάλμα που δείχνει στο **harness** και κρύβει ότι το λάθος είναι **μία λέξη
 * στη σουίτα**.
 *
 * 📊 ΜΕΤΡΗΜΕΝΟ 2026-09-16: **τέσσερις** σουίτες έγραφαν `'unauthenticated'` αντί
 * για `'anonymous'` (`company_registry_records` · `showcase_card_channels` ·
 * `holiday_hours_questions` · `showcase_email_confirmations`) και ήταν
 * **κόκκινες στο `main`** από τις 14-15/09 — αόρατες, γιατί την πλήρη σουίτα
 * κανόνων τη βλέπει μόνο ο emulator.
 *
 * 🔑 Η λίστα έρχεται από το `ALL_PERSONAS` (SSoT), ποτέ χειρόγραφη: όγδοη
 * περσόνα θα γινόταν δεκτή **αυτόματα**, χωρίς να χρειάζεται δεύτερη ενημέρωση.
 */
function assertKnownPersona(persona: Persona): void {
  if (!ALL_PERSONAS.includes(persona)) {
    throw new Error(
      `getContext: άγνωστη Persona '${String(persona)}'. ` +
        `Έγκυρες: ${ALL_PERSONAS.join(' · ')}. ` +
        'Ο μη-αυθεντικοποιημένος λέγεται «anonymous».',
    );
  }
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
