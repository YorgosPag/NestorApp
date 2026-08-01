/**
 * Service-integration harness — the ONE seam between production code and the
 * emulator.
 *
 * ## What this replaces, and what it deliberately does not
 *
 * `src/lib/firebase.ts` builds its `db` at module load from `process.env`
 * Firebase config, and only calls `connectFirestoreEmulator` when
 * `typeof window !== 'undefined' && NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'`.
 * That branch is written for the browser dev server, not for a test process:
 * it hands back an *unauthenticated* client, so `firestore.rules` would see
 * `request.auth == null` and deny everything for the wrong reason.
 *
 * So this module swaps the **transport handle only**. Everything the suite is
 * actually asking about stays production code running unmodified:
 *   - `contactLinkConverter` (`toFirestore` / `fromFirestore`)
 *   - `contact-link.service.ts` query construction, id derivation, idempotency
 *   - the live `firestore.rules` loaded by the rules harness
 *   - a real Firestore emulator storing and indexing real documents
 *
 * That is the point of the suite: rules tests seed documents *directly*, so no
 * test in the repo has ever asked whether the bytes the converter emits are
 * bytes the rules accept. Both halves were green; the join was never run.
 *
 * ## Why a getter and not a plain object
 *
 * `@firebase/rules-unit-testing` mints a **new** Firestore per persona per
 * test (`env.authenticatedContext(...).firestore()`). A value captured at
 * `jest.mock` factory time would pin the first one forever and every later
 * test would silently write as the wrong identity. The getter resolves at call
 * time, so `withPersona()` can rebind between assertions.
 *
 * Reading `db` before a persona is bound throws rather than returning
 * `undefined`: an unbound handle would surface much later as an opaque
 * Firestore internal error, pointing at the SDK instead of at the test.
 *
 * @module tests/service-integration/_harness/firestore-seam
 * @see ADR-745 §4 G3 (prove the flow end-to-end before Φ3 builds on it)
 * @see tests/firestore-rules/_harness/emulator.ts (env lifecycle — reused, not copied)
 */

import type { Firestore } from 'firebase/firestore';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { getContext } from '../../firestore-rules/_harness/auth-contexts';
import type { Persona } from '../../firestore-rules/_registry/personas';

let activeDb: Firestore | null = null;
let activePersona: Persona | null = null;

/**
 * Unwrap `RulesTestContext.firestore()` to the modular `Firestore` the app uses.
 *
 * Measured, because the two APIs are not interchangeable: `ctx.firestore()`
 * hands back a **compat** instance (`.collection().doc().set()` — the shape the
 * rules seed helpers use), while production code calls the modular functions
 * (`doc(db, …)`, `query(collection(db, …), …)`). Passing the compat object
 * straight to `doc()` fails inside the SDK with a type assertion that names
 * neither cause. Every compat instance carries the modular one it wraps as
 * `_delegate`; that is the object `@/lib/firebase` would have exported.
 *
 * The property is underscore-prefixed and therefore off the public typings,
 * hence the cast — narrow, in one place, explained here rather than repeated
 * as an inline `as any` at each call site.
 */
function modularFirestore(ctx: { firestore(): unknown }): Firestore {
  const compat = ctx.firestore() as { _delegate?: unknown };
  const delegate = compat._delegate;

  if (!delegate) {
    throw new Error(
      'firestore-seam: RulesTestContext.firestore() has no `_delegate`. ' +
        '@firebase/rules-unit-testing likely changed its return shape — production code ' +
        'needs the modular Firestore, not the compat wrapper.',
    );
  }

  return delegate as Firestore;
}

/**
 * The object `jest.mock('@/lib/firebase', ...)` returns.
 *
 * `auth` and `storage` are exported by the real module. They are defined here
 * as throwing getters rather than omitted: an omitted export reads as
 * `undefined` and fails deep inside whatever consumed it, while a throw names
 * the boundary that was crossed. Nothing on the contact-link path touches
 * either — if one of these ever fires, the suite has grown a dependency that
 * needs a deliberate decision, not a silent stub.
 */
export const firebaseSeam = {
  get db(): Firestore {
    if (!activeDb) {
      throw new Error(
        'firestore-seam: no persona bound. Wrap the call in `withPersona(env, persona, ...)`.',
      );
    }
    return activeDb;
  },
  get auth(): never {
    throw new Error(
      'firestore-seam: `auth` is not wired. The contact-link path must not need it — ' +
        'if it now does, wire it deliberately instead of stubbing it here.',
    );
  },
  get storage(): never {
    throw new Error('firestore-seam: `storage` is not wired (see `auth`).');
  },
};

/**
 * Run `fn` with production code talking to the emulator **as `persona`**, with
 * `firestore.rules` enforced exactly as in production.
 *
 * The binding is restored (not just cleared) on the way out, so a nested call
 * cannot leave an outer one writing as the wrong identity — and the `finally`
 * runs even when `fn` throws, which matters because half these assertions
 * expect a `permission-denied`.
 */
export async function withPersona<T>(
  env: RulesTestEnvironment,
  persona: Persona,
  fn: () => Promise<T>,
): Promise<T> {
  const previousDb = activeDb;
  const previousPersona = activePersona;

  activeDb = modularFirestore(getContext(env, persona));
  activePersona = persona;

  try {
    return await fn();
  } finally {
    activeDb = previousDb;
    activePersona = previousPersona;
  }
}

/**
 * Read documents with rules **disabled**, for verifying what actually landed.
 *
 * Step 2 of the ADR-745 §2.6 scenario is "verify in the database, not on the
 * screen". Verifying through the same authenticated read path that produced
 * the write would make a tenant-scoping bug invisible: a document written with
 * the wrong `companyId` is also *read back* under the wrong `companyId`, so a
 * round-trip through one persona is self-consistent no matter what it stored.
 * The rules-disabled context sees every tenant, which is the only vantage from
 * which "did it land in the right tenant" is answerable.
 */
export async function readRaw(
  env: RulesTestEnvironment,
  collectionPath: string,
  docId: string,
): Promise<Record<string, unknown> | null> {
  let result: Record<string, unknown> | null = null;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const snap = await ctx.firestore().collection(collectionPath).doc(docId).get();
    result = snap.exists ? (snap.data() as Record<string, unknown>) : null;
  });
  return result;
}

/** Currently bound persona — for assertion messages, never for control flow. */
export function boundPersona(): Persona | null {
  return activePersona;
}
