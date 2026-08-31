/**
 * 🔴 ΑΓΚΥΡΑ — **Ο ΛΟΓΟΣ ΤΗΣ ΑΡΝΗΣΗΣ ΦΤΑΝΕΙ ΣΤΑ ΕΙΣΕΡΧΟΜΕΝΑ** (ADR-834 §6.5.ε).
 *
 * Ο `refusalOf` ζητούσε `cause.data.*` — πεδίο που η `ApiClientError` **δεν είχε ποτέ**
 * ⇒ επέστρεφε **πάντα `null`** ⇒ **κάθε** άρνηση γινόταν *«η απόφαση δεν καταγράφηκε»*.
 * Οι **έξι** λόγοι, καθένας με **δική του θεραπεία**, δεν φάνηκαν ποτέ: ο μεσίτης
 * ξαναπατούσε το ίδιο κουμπί για πρόβλημα που **δεν λύνεται από αυτόν**
 * (`identity-incomplete`).
 *
 * ⚠️ **Το σχήμα εδώ είναι ΑΛΛΟ από του καταλόγου, και είναι ΑΣΦΑΛΕΙΑ**: αυτή η πόρτα
 * απαντά **422 σε κάθε άρνηση** ώστε ο κωδικός κατάστασης να μην αποκαλύπτει την ύπαρξη
 * αιτήματος προς ανταγωνιστή (ADR-787 Ε-5) ⇒ ο λόγος χρειάζεται **δικό του** πεδίο πίσω
 * από τον διακριτή `DECISION_REFUSED`.
 *
 * ⚠️ Ο κριτής είναι ο **ΠΡΑΓΜΑΤΙΚΟΣ**· mock μόνο ο μεταφορέας.
 */

jest.mock('@/lib/api/enterprise-api-client', () => {
  const types = jest.requireActual('@/lib/api/api-client-types');
  return {
    apiClient: { get: jest.fn(), patch: jest.fn() },
    ApiClientError: types.ApiClientError,
    apiErrorBodyOf: types.apiErrorBodyOf,
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

import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { MANDATE_DECISION_REFUSALS } from '@/services/mandate/mandate-decision-vocabulary';
import { REFUSAL_KEYS } from '@/components/mandate/inbox/mandate-inbox-labels';
import { decideMandateRequestFromScreen } from '@/services/mandate/mandate-inbox.client';

const patchMock = apiClient.patch as jest.Mock;

function serverRefusal(status: number, body: unknown): ApiClientError {
  return new ApiClientError('irrelevant', status, `HTTP_${status}`, undefined, 'req_1', undefined, body);
}

const decide = () => decideMandateRequestFromScreen('mrq_1', 'accepted');

beforeEach(() => patchMock.mockReset());

describe('Α — ο λόγος φτάνει', () => {
  it('Α1 — 422 με διακριτή + reason ⇒ refused με τον λόγο', async () => {
    patchMock.mockRejectedValue(
      serverRefusal(422, {
        error: 'DECISION_REFUSED',
        reason: 'request-not-pending',
        violations: [],
      }),
    );

    expect(await decide()).toEqual({ kind: 'refused', reason: 'request-not-pending' });
  });

  it('Α2 — ΚΑΘΕ λόγος του κλειστού συνόλου περνά', async () => {
    for (const reason of MANDATE_DECISION_REFUSALS) {
      patchMock.mockRejectedValue(serverRefusal(422, { error: 'DECISION_REFUSED', reason }));

      expect(await decide()).toEqual({ kind: 'refused', reason });
    }
  });
});

describe('Β — τι ΔΕΝ γίνεται δεκτό', () => {
  it('Β1 — ΧΩΡΙΣ τον διακριτή ⇒ failed, ακόμη κι αν το reason είναι έγκυρο', async () => {
    // Διαβάζοντας `reason` από σχήμα που δεν αναγνωρίσαμε, θα μαντεύαμε.
    patchMock.mockRejectedValue(serverRefusal(422, { reason: 'request-absent' }));

    expect((await decide()).kind).toBe('failed');
  });

  it('Β2 — άγνωστος λόγος πίσω από σωστό διακριτή ⇒ failed, ΠΟΤΕ ωμό κλειδί', async () => {
    patchMock.mockRejectedValue(
      serverRefusal(422, { error: 'DECISION_REFUSED', reason: 'something-new' }),
    );

    expect((await decide()).kind).toBe('failed');
  });

  it('Β3 — λόγος του ΔΙΠΛΑΝΟΥ λεξιλογίου ⇒ failed (τα δύο σύνολα μοιάζουν επικίνδυνα)', async () => {
    // `no-address` ανήκει στον κατάλογο εντολών, όχι εδώ. Κοινός φρουρός θα ζωγράφιζε
    // **λάθος θεραπεία** πάνω σε σωστά δεδομένα.
    patchMock.mockRejectedValue(
      serverRefusal(422, { error: 'DECISION_REFUSED', reason: 'no-address' }),
    );

    expect((await decide()).kind).toBe('failed');
  });

  it('Β4 — «δεν μάθαμε» (503) ΔΕΝ γίνεται «αρνήθηκε»', async () => {
    // Το ίδιο το route το γράφει: 503, ΠΟΤΕ 422 — «δεν μάθαμε» ≠ «δεν επιτρέπεται».
    patchMock.mockRejectedValue(serverRefusal(503, { error: 'REQUEST_UNVERIFIED' }));

    expect((await decide()).kind).toBe('failed');
  });

  it('Β5 — ΤΟ ΔΟΜΙΚΟ CAST: σκέτο Error με σωστό σχήμα ⇒ failed', async () => {
    patchMock.mockRejectedValue(
      Object.assign(new Error('firebase'), {
        errorBody: { error: 'DECISION_REFUSED', reason: 'request-absent' },
      }),
    );

    expect((await decide()).kind).toBe('failed');
  });
});

describe('Ε — επιτυχία και εξαντλητικότητα', () => {
  it('Ε1 — 2xx ⇒ decided με την απόφαση', async () => {
    patchMock.mockResolvedValue(undefined);

    expect(await decide()).toEqual({ kind: 'decided', decision: 'accepted' });
  });

  it('Ε2 — κάθε λόγος έχει κείμενο, και κάθε κείμενο λόγο', () => {
    expect(Object.keys(REFUSAL_KEYS).sort()).toEqual([...MANDATE_DECISION_REFUSALS].sort());
  });
});
