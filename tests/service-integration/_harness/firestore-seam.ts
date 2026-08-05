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
import { PERSONA_CLAIMS } from '../../firestore-rules/_registry/personas';
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
 * The slice of `FirebaseUser` the API client actually reads — `uid` and `getIdToken`.
 *
 * Declared as its own interface rather than casting to `FirebaseUser`: a cast would claim
 * this object satisfies the whole SDK type, and the next reader would have no way to see
 * which two members are real. If production code starts reading a third, it fails by name.
 */
export interface MinimalAuthUser {
  readonly uid: string;
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

type AuthListener = (user: MinimalAuthUser | null) => void;
export type OnAuthStateChanged = (cb: AuthListener) => () => void;

const authListeners = new Set<AuthListener>();

/**
 * The acting persona as an auth user, or `null` when nothing is bound.
 *
 * Derived on every read rather than stored, for the same reason `db` is a getter: a value
 * captured once would pin the first persona forever and every later assertion would run
 * under an identity the test never chose.
 */
function currentAuthUser(): MinimalAuthUser | null {
  if (!activePersona || activePersona === 'anonymous') return null;
  const { uid } = PERSONA_CLAIMS[activePersona];
  return {
    uid,
    // Deterministic and obviously synthetic. Nothing in this process verifies it (see the
    // honesty boundary on `firebaseSeam.auth`); it exists so the client's token path runs
    // its real branches instead of short-circuiting on a missing user.
    getIdToken: async () => `emulator-persona-token:${uid}`,
  };
}

const personaAuth = {
  get currentUser(): MinimalAuthUser | null {
    return currentAuthUser();
  },
  onAuthStateChanged(cb: AuthListener): () => void {
    authListeners.add(cb);
    // Fired immediately, as the real SDK does: a listener that only hears about *changes*
    // never learns who is signed in when it subscribes after the fact.
    cb(currentAuthUser());
    return () => authListeners.delete(cb);
  },
};

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
  /**
   * Persona-bound Auth stand-in — wired **deliberately** in ADR-745 Φ3β, and here is why.
   *
   * This getter used to throw, with the instruction "if it now does need auth, wire it
   * deliberately instead of stubbing it here". It now does, and the reason is worth
   * recording rather than papering over: `title-block-apply/index.ts` imports
   * `apply-landowner.ts` → `project-mutation-gateway` → `projects-client.service` →
   * `enterprise-api-client`, whose **module-load singleton** touches `auth` in its
   * constructor (`enterprise-api-client.ts:76`). So merely *importing the approval
   * dispatcher* requires auth, even for the contact target, which never makes an HTTP
   * call. A suite that dodged this by importing only the sub-applier would be exercising
   * a module graph the application does not have.
   *
   * 🔴 **The honesty boundary, stated so nobody mistakes this for more than it is.**
   * There is no Next.js server in this process and `setup-after-env.ts` answers every
   * in-app route with `{ success: true }`. So this token is **never validated by
   * anything**. What this harness proves about the HTTP targets is *what the production
   * code sent* — never that the server accepted it. Firestore targets are the opposite:
   * those run against real rules and the verdict is real. Do not read a green HTTP-target
   * assertion as proof of authorisation.
   *
   * The uid tracks `withPersona`, so an HTTP payload built from `auth.currentUser` cannot
   * silently carry a different identity than the Firestore write beside it — the exact
   * split that would let a suite prove tenancy on one half and miss it on the other.
   */
  get auth(): { currentUser: MinimalAuthUser | null; onAuthStateChanged: OnAuthStateChanged } {
    return personaAuth;
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
  notifyAuthListeners();

  try {
    return await fn();
  } finally {
    activeDb = previousDb;
    activePersona = previousPersona;
    // Restored, not merely cleared — and the listeners are told, because the API client
    // caches `currentUser` from the callback (`enterprise-api-client.ts:77`). Without this
    // it would keep serving the identity of whichever persona happened to subscribe first.
    notifyAuthListeners();
  }
}

function notifyAuthListeners(): void {
  const user = currentAuthUser();
  for (const listener of authListeners) listener(user);
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

/**
 * Every document of a collection, rules **disabled** — the census `readRaw` cannot take.
 *
 * `readRaw` answers "did *this* document land". It cannot answer "how many documents does
 * the collection now hold", and that is the literal acceptance criterion of ADR-745 §0:
 * `title_block_bindings` **0 → 1**. The difference is not pedantic — a write path that
 * produces the intended document *plus* a stray second one under a slightly different
 * deterministic key passes every `readRaw` assertion ever written, because each one only
 * ever looks at the id it already expected. Idempotency is a claim about the **count**.
 *
 * Rules-disabled for the same reason as `readRaw`: an authenticated list is filtered by
 * tenant, so it can never reveal a document that landed in the wrong one.
 */
export async function listRaw(
  env: RulesTestEnvironment,
  collectionPath: string,
): Promise<Record<string, unknown>[]> {
  let result: Record<string, unknown>[] = [];
  await env.withSecurityRulesDisabled(async (ctx) => {
    const snap = await ctx.firestore().collection(collectionPath).get();
    result = snap.docs.map((d: { id: string; data(): unknown }) => ({
      id: d.id,
      ...(d.data() as Record<string, unknown>),
    }));
  });
  return result;
}

/** Currently bound persona — for assertion messages, never for control flow. */
export function boundPersona(): Persona | null {
  return activePersona;
}
