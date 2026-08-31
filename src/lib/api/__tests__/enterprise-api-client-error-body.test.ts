/**
 * 🔴 ΑΓΚΥΡΑ — **ΤΟ ΣΩΜΑ ΤΗΣ ΑΡΝΗΣΗΣ ΕΠΙΒΙΩΝΕΙ** (ADR-834 §6.5.ε).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ — ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ 2026-08-31
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο διακομιστής απάντησε `409 {"error":"no-address"}` σε **7,2s**, η γραφή έγινε
 * *(`updatedAt` 12:14:46 → 12:20:38)*, και η οθόνη έγραψε **«Δεν υπήρξε απάντηση.
 * Ελέγξτε τη σύνδεσή σας»**. Το `handleResponse` διάβαζε το σώμα σε **τοπική**
 * μεταβλητή και το πετούσε· το `response.json()` καταναλώνει το stream **μία φορά**,
 * άρα ό,τι δεν κρατιόταν εκεί **χανόταν οριστικά**. Τρεις αναγνώστες ζητούσαν
 * `cause.data.*` — πεδίο που **δεν υπήρξε ποτέ** ⇒ **25 ονομασμένοι λόγοι** σε 50
 * κλειδιά δύο γλωσσών δεν έφτασαν **ΠΟΤΕ** σε ανθρώπινο μάτι.
 *
 * ⚠️ **Καμία δοκιμή εδώ δεν ισχυρίζεται πάνω στο `message`** — το Stripe το απαγορεύει
 * ρητά *(«parse το machine-readable `code`, ΠΟΤΕ το `message` string»)*, και μια άγκυρα
 * που κλείδωνε το `message` θα κλείδωνε το ίδιο anti-pattern που έκλεισε αυτό το ADR.
 *
 * ⚠️ **Ψεύτικο `Response`, όχι πραγματικό**: το πραγματικό πετά στη δεύτερη ανάγνωση
 * κατά την επανάληψη — θα δοκίμαζε το `fetch`, όχι τον client.
 */

jest.mock('@/lib/firebase', () => {
  const getIdToken = jest.fn(() => Promise.resolve('token'));
  return {
    auth: { currentUser: { uid: 'u1', getIdToken }, onAuthStateChanged: jest.fn() },
  };
});

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateRequestId: () => 'req_test_1',
}));

jest.mock('@/lib/async-utils', () => ({ sleep: () => Promise.resolve() }));

import {
  apiClient,
  ApiClientError,
  apiErrorBodyOf,
} from '@/lib/api/enterprise-api-client';

type TokenCacheHolder = { tokenCache: unknown };

/** Ψεύτικη απάντηση. `body === undefined` ⇒ το `.json()` **πετά**, όπως σε HTML σώμα. */
function makeResponse(status: number, body: unknown): Response {
  return {
    status,
    statusText: '',
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type' ? 'application/json' : null,
    },
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected token < in JSON');
      return body;
    },
    text: async () => JSON.stringify(body),
    blob: async () => body,
  } as unknown as Response;
}

let fetchMock: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

beforeEach(() => {
  (apiClient as unknown as TokenCacheHolder).tokenCache = null;
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

/** Η άρνηση, όπως πέφτει στα χέρια του καλούντος. */
async function rejectionOf(status: number, body: unknown): Promise<ApiClientError> {
  fetchMock.mockResolvedValue(makeResponse(status, body));
  try {
    await apiClient.post('/api/x', { a: 1 });
  } catch (cause) {
    return cause as ApiClientError;
  }
  throw new Error('Ο παρονομαστής κατέρρευσε: η κλήση ΔΕΝ απέρριψε.');
}

describe('Φ — ο φορέας: το σώμα φτάνει στον καλούντα', () => {
  it('Φ1 — 409 {error:"no-address"} ⇒ το σώμα ταξιδεύει ΑΥΤΟΥΣΙΟ (το περιστατικό)', async () => {
    const error = await rejectionOf(409, { error: 'no-address' });

    expect(error.errorBody).toEqual({ error: 'no-address' });
    expect(error.statusCode).toBe(409);
  });

  it('Φ2 — ΟΛΟΚΛΗΡΟ, όχι φέτα: πεδία που ο client δεν κοιτά ΠΟΤΕ επιβιώνουν', async () => {
    // Το σχήμα των εισερχομένων (422): ο λόγος ζει σε **ξεχωριστό** πεδίο, πίσω από
    // διακριτή — και ο client δεν έχει ιδέα τι σημαίνει κανένα από τα δύο.
    const body = {
      error: 'DECISION_REFUSED',
      reason: 'request-not-pending',
      violations: ['mandate-expiry-past'],
    };

    const error = await rejectionOf(422, body);

    expect(error.errorBody).toEqual(body);
  });

  it('Φ3 — πίνακες μένουν πίνακες (δεν σειριοποιούνται σε string)', async () => {
    const error = await rejectionOf(422, {
      error: 'INVALID_LISTING',
      violations: ['no-live-offer', 'title-missing'],
    });

    const body = error.errorBody as { violations: unknown };
    expect(Array.isArray(body.violations)).toBe(true);
    expect(body.violations).toHaveLength(2);
  });

  it('Φ4 — μη-JSON σώμα (HTML 502 από proxy) ⇒ undefined, ΠΟΤΕ {}', async () => {
    // Το `{}` θα ήταν ψέμα: «ο διακομιστής απάντησε αντικείμενο χωρίς πεδία» ≠ «η
    // απάντηση δεν ήταν καν JSON». Ο αναγνώστης πρέπει να μπορεί να τα ξεχωρίσει.
    const error = await rejectionOf(502, undefined);

    expect(error.errorBody).toBeUndefined();
    expect(error.errorCode).toBe('HTTP_502');
  });

  it('Φ5 — στην επανάληψη 401 φέρει το ΔΕΥΤΕΡΟ σώμα, όχι το πρώτο', async () => {
    // Ο client ξαναστέλνει μία φορά μετά από 401 (force-refresh). Αν το σώμα πιανόταν
    // μία φορά και ξαναχρησιμοποιούνταν, ο καλών θα διάβαζε **μπαγιάτικη** αιτία.
    fetchMock
      .mockResolvedValueOnce(makeResponse(401, { error: 'STALE' }))
      .mockResolvedValueOnce(makeResponse(401, { error: 'REVOKED' }));

    let caught: ApiClientError | null = null;
    try {
      await apiClient.post('/api/x', { a: 1 });
    } catch (cause) {
      caught = cause as ApiClientError;
    }

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(caught?.errorBody).toEqual({ error: 'REVOKED' });
  });

  it('Φ6 — ΔΕΝ διαρρέει στο toJSON: τα logs δεν σειριοποιούν σώματα διακομιστή', async () => {
    // Σε αυτές τις διαδρομές περνούν στοιχεία επαφών. Το `toJSON()` καταλήγει σε κάθε
    // `logger.error({ error })` και σε κάθε breadcrumb.
    const error = await rejectionOf(409, { error: 'no-address', clientEmail: 'a@b.gr' });

    const serialized = JSON.parse(JSON.stringify(error)) as Record<string, unknown>;

    expect('errorBody' in serialized).toBe(false);
    expect(JSON.stringify(serialized)).not.toContain('a@b.gr');
    // Η διάγνωση δεν χάθηκε: ο κωδικός μένει.
    expect(serialized.statusCode).toBe(409);
  });
});

describe('Κ — ο ΕΝΑΣ κριτής (apiErrorBodyOf)', () => {
  it('Κ1 — σφάλμα του client με αντικείμενο ⇒ το σώμα', async () => {
    const error = await rejectionOf(409, { error: 'no-address' });

    expect(apiErrorBodyOf(error)).toEqual({ error: 'no-address' });
  });

  it('Κ2 — σκέτο Error με χειροκίνητο errorBody ⇒ null (το δομικό cast ΔΕΝ επιστρέφει)', () => {
    // 🔴 Αυτό ακριβώς επέτρεπε το `(cause as { data?: … })?.data`: ταίριαζε σε
    // **οποιοδήποτε** throwable με το σωστό σχήμα — π.χ. σφάλμα Firebase.
    const impostor = Object.assign(new Error('boom'), {
      errorBody: { error: 'no-address' },
    });

    expect(apiErrorBodyOf(impostor)).toBeNull();
  });

  it('Κ3 — μη-JSON σώμα ⇒ null (δεν υπάρχει τίποτα να διαβαστεί)', async () => {
    const error = await rejectionOf(502, undefined);

    expect(apiErrorBodyOf(error)).toBeNull();
  });

  it('Κ4 — πίνακας στη ρίζα ⇒ null (κανένα σχήμα μας δεν είναι πίνακας)', async () => {
    const error = await rejectionOf(422, ['no-live-offer']);

    expect(apiErrorBodyOf(error)).toBeNull();
  });

  it('Κ5 — null / πρωτόγονο σώμα ⇒ null', async () => {
    expect(apiErrorBodyOf(await rejectionOf(500, null))).toBeNull();
    expect(apiErrorBodyOf(await rejectionOf(500, 'no-address'))).toBeNull();
    expect(apiErrorBodyOf(null)).toBeNull();
    expect(apiErrorBodyOf(undefined)).toBeNull();
  });
});
