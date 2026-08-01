/**
 * Service-integration harness — recording `fetch` wrapper.
 *
 * ## Why `fetch` is touched at all
 *
 * `linkContactToEntity` posts to the audit-trail API route through
 * `safeFireAndForget`. There is no Next.js server in this process, so an
 * untouched `fetch` would hang until the test timeout, and a missing `fetch`
 * would throw a `ReferenceError` inside the service's own try block — *after*
 * `setDoc` committed — turning a successful write into `{ success: false }`.
 *
 * ## Why passthrough and not a blanket stub
 *
 * Measured: `@firebase/rules-unit-testing` uploads `firestore.rules` to the
 * emulator over this same global `fetch`. A stub that answers everything
 * breaks the harness itself (`initializeTestEnvironment` fails at
 * `loadFirestoreRules`) — the first version of this file did exactly that.
 *
 * The split is by URL shape, which matches the split in reality: app API
 * routes are **relative** (`/api/...` from `API_ROUTES`), everything else in
 * this process is an absolute emulator URL. Relative requests are recorded and
 * answered; absolute ones go to the network untouched.
 *
 * Recording rather than silently succeeding, because "was the audit trail
 * called, with what payload" is part of the flow under proof. A `jest.fn()`
 * that resolves and forgets would let a dropped audit call pass unnoticed.
 *
 * @module tests/service-integration/_harness/setup-after-env
 */

/** One recorded call to an in-app API route. */
export interface RecordedFetch {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

const recorded: RecordedFetch[] = [];

/** In-app API calls since the last reset (absolute URLs are not recorded). */
export function recordedFetches(): readonly RecordedFetch[] {
  return recorded;
}

export function resetRecordedFetches(): void {
  recorded.length = 0;
}

function parseBody(init?: RequestInit): unknown {
  if (typeof init?.body !== 'string') return init?.body ?? null;
  try {
    return JSON.parse(init.body);
  } catch {
    return init.body;
  }
}

/**
 * An in-app route is one this process cannot serve: a relative path, or an
 * absolute URL on the jsdom origin (`http://localhost/`) — jsdom resolves
 * relative URLs against that origin, so both spellings reach here.
 */
function isInAppRoute(url: string): boolean {
  if (url.startsWith('/')) return true;
  try {
    return new URL(url).origin === globalThis.location?.origin;
  } catch {
    return false;
  }
}

beforeAll(() => {
  const passthrough = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (!isInAppRoute(url)) {
      return passthrough(input, init);
    }

    recorded.push({ url, method: init?.method ?? 'GET', body: parseBody(init) });

    return Promise.resolve(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }) as typeof globalThis.fetch;
});

beforeEach(() => {
  resetRecordedFetches();
});
