/**
 * =============================================================================
 * Η ΣΑΡΩΣΗ ΠΟΥ ΠΕΤΥΧΑΙΝΕ ΚΑΙ ΕΛΕΓΕ «TIMEOUT» — ΑΓΚΥΡΕΣ
 * =============================================================================
 *
 * Το ερώτημα **δεν** είναι «διαβάζει `json.data`;» — αυτό είναι όνομα, και μια
 * άγκυρα που ζητά όνομα περνά με την **εισαγωγή**. Εδώ ρωτάμε τη ΣΥΜΠΕΡΙΦΟΡΑ
 * που έβλεπε ο άνθρωπος, με τα **πραγματικά** σχήματα των δύο διαδρομών:
 *
 *   POST /api/quotes/scan   → `{ success, data: { quoteId, … } }`  (route.ts:247)
 *   GET  /api/quotes/{id}   → `{ success, data: <Quote> }`         (route.ts:79)
 *
 * ┌──────┬──────────────────────────────────────────────────────────────────┐
 * │ Σ1   │ Πετυχημένη σάρωση ⇒ ο άνθρωπος βλέπει **επιτυχία**, και η λίστα  │
 * │      │ ανανεώνεται (`onSuccess` με το σωστό αναγνωριστικό).             │
 * │ Σ2   │ Το polling ρωτά **`/api/quotes/q1`**, όχι `/api/quotes/undefined`│
 * │      │ — η ΡΙΖΑ του σφάλματος, και το μόνο σημείο όπου φαίνεται.        │
 * │ Σ3   │ Φάκελος **χωρίς** `quoteId` ⇒ σφάλμα **ΑΜΕΣΩΣ**, μηδέν polls.    │
 * │      │ Πριν: 20 άκυρα αιτήματα και 60″ αναμονής για ψεύτικο «timeout».  │
 * │ Σ4   │ Όσο **δεν** υπάρχει `extractedData`, ΔΕΝ λέει «επιτυχία».        │
 * │      │ Φυλάει το αφαιρεμένο σκέλος `status` από επιστροφή: το status    │
 * │      │ μένει `'draft'` σε ΟΛΕΣ τις εκβάσεις, άρα ως κριτήριο θα έλεγε   │
 * │      │ «έτοιμο» από το πρώτο poll — πρόωρη, ψεύτικη επιτυχία.           │
 * └──────┴──────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ **Μετάλλαξη που ΠΡΕΠΕΙ να κοκκινίζει** (αλλιώς η άγκυρα δεν φυλά τίποτα):
 *    γύρνα το `envelopeData(...)?.quoteId` σε `(await res.json()).quoteId` ⇒ Σ1+Σ2.
 *
 * @see ADR-787 Φάση Β — η διόρθωση προηγείται της μετανάστευσης, χωριστά
 */

import { renderHook, act } from '@testing-library/react';

import { useScanQueue } from '../useScanQueue';

// -----------------------------------------------------------------------------
// Διπλοί — ό,τι δεν αφορά το ερώτημα
// -----------------------------------------------------------------------------

jest.mock('sonner', () => ({
  toast: { loading: jest.fn(), dismiss: jest.fn(), error: jest.fn(), success: jest.fn() },
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** Ό,τι στέλνει πράγματι ο διακομιστής — φάκελος, όχι γυμνό αντικείμενο. */
const scanAccepted = (quoteId: string) => ({
  success: true,
  data: { quoteId, displayNumber: 'Q-1', status: 'processing', attachment: { id: 'a1' } },
});
const quoteBody = (extractedData: unknown) => ({
  success: true,
  data: { id: 'q1', status: 'draft', extractedData },
});

const jsonOk = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

/** Οι διευθύνσεις που ζητήθηκαν πράγματι — εκεί φαίνεται το `undefined`. */
let requested: string[] = [];
let fetchMock: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  requested = [];
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

/** Απαντά ανά διαδρομή και καταγράφει τι ζητήθηκε. */
function respondWith(handler: (url: string) => unknown) {
  fetchMock.mockImplementation(async (url: string) => {
    requested.push(url);
    return jsonOk(handler(url));
  });
}

const POLL_MS = 3000;
const file = new File(['x'], 'quote.pdf', { type: 'application/pdf' });

// -----------------------------------------------------------------------------
// Σ1 + Σ2 — η επιτυχία φτάνει στον άνθρωπο, και ρωτά το σωστό αναγνωριστικό
// -----------------------------------------------------------------------------

describe('Σ — η σάρωση που πέτυχε το ΛΕΕΙ', () => {
  it('Σ1: πετυχημένη σάρωση ⇒ status «success» + onSuccess με το σωστό id', async () => {
    respondWith((url) =>
      url.includes('/scan') ? scanAccepted('q1') : quoteBody({ vendorName: { value: 'ΑΦΟΙ Π.' } }),
    );
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useScanQueue({ onSuccess }));

    await act(async () => {
      const inFlight = result.current.enqueue(file);
      await jest.advanceTimersByTimeAsync(POLL_MS + 50);
      await inFlight;
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].status).toBe('success');
    expect(result.current.items[0].resultQuoteId).toBe('q1');
    expect(onSuccess).toHaveBeenCalledWith('q1');
  });

  it('Σ2: το polling ρωτά /api/quotes/q1 — ΠΟΤΕ /api/quotes/undefined', async () => {
    respondWith((url) => (url.includes('/scan') ? scanAccepted('q1') : quoteBody({ ok: 1 })));
    const { result } = renderHook(() => useScanQueue());

    await act(async () => {
      const inFlight = result.current.enqueue(file);
      await jest.advanceTimersByTimeAsync(POLL_MS + 50);
      await inFlight;
    });

    expect(requested).toContain('/api/quotes/q1');
    expect(requested.some((u) => u.includes('undefined'))).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Σ3 — η αποτυχία φαίνεται ΑΜΕΣΩΣ, όχι μετά από ένα λεπτό
// -----------------------------------------------------------------------------

describe('Σ3 — φάκελος χωρίς αναγνωριστικό', () => {
  it('σταματά αμέσως, χωρίς κανένα poll', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      requested.push(url);
      return jsonOk({ success: true, data: {} }); // δεκτό, αλλά χωρίς quoteId
    });
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useScanQueue({ onSuccess }));

    await act(async () => {
      await result.current.enqueue(file);
    });

    expect(result.current.items[0].status).toBe('error');
    expect(onSuccess).not.toHaveBeenCalled();
    // ΜΟΝΟ το POST — καμία απόπειρα polling με κενό αναγνωριστικό
    expect(requested).toEqual(['/api/quotes/scan']);
  });
});

// -----------------------------------------------------------------------------
// Σ4 — καμία πρόωρη επιτυχία (φυλάει το αφαιρεμένο σκέλος `status`)
// -----------------------------------------------------------------------------

describe('Σ4 — όσο λείπει το extractedData', () => {
  it('μένει «pending»: το status «draft» ΔΕΝ είναι σήμα ολοκλήρωσης', async () => {
    respondWith((url) => (url.includes('/scan') ? scanAccepted('q1') : quoteBody(null)));
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useScanQueue({ onSuccess }));

    await act(async () => {
      result.current.enqueue(file);
      await jest.advanceTimersByTimeAsync(POLL_MS * 3);
    });

    expect(result.current.items[0].status).toBe('pending');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
