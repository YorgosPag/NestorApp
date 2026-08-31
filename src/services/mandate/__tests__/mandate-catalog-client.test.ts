/**
 * 🔴 ΑΓΚΥΡΑ — **Η ΑΙΤΙΑ ΤΗΣ ΑΡΝΗΣΗΣ ΦΤΑΝΕΙ ΣΤΗΝ ΟΘΟΝΗ** (ADR-834 §6.5.ε).
 *
 * Το περιστατικό, μετρημένο ζωντανά 2026-08-31: ο διακομιστής απάντησε
 * `409 {"error":"no-address"}` και η οθόνη έγραψε **«Δεν υπήρξε απάντηση. Ελέγξτε τη
 * σύνδεσή σας»** — δηλαδή έστειλε τον μεσίτη να ελέγξει το **δίκτυό** του για επαφή που
 * απλώς **δεν έχει email**. Ο `rejectionOf` ζητούσε `cause.data.error`, πεδίο που **δεν
 * υπήρξε ποτέ**, και επέστρεφε **πάντα `null`**.
 *
 * ⚠️ **Ο κριτής είναι ο ΠΡΑΓΜΑΤΙΚΟΣ.** Mock είναι **μόνο** ο μεταφορέας (`apiClient`).
 * Αν αντικαθιστούσαμε και το `apiErrorBodyOf`, η άγκυρα θα δοκίμαζε το mock της — «ο
 * έλεγχος σε λάθος επίπεδο», η μορφή που άφησε αυτό το ελάττωμα αόρατο επί μήνες.
 */

jest.mock('@/lib/api/enterprise-api-client', () => {
  const types = jest.requireActual('@/lib/api/api-client-types');
  return {
    apiClient: { get: jest.fn(), post: jest.fn() },
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
import { MANDATE_ACTION_REJECTIONS } from '@/lib/mandate/mandate-actions';
import { REJECTION_KEYS } from '@/components/mandate/catalog/mandate-catalog-labels';
import { runMandateAction } from '@/services/mandate/mandate-catalog.client';

const postMock = apiClient.post as jest.Mock;

/** Άρνηση διακομιστή, όπως ακριβώς την παράγει ο `apiClient`. */
function serverRefusal(status: number, body: unknown): ApiClientError {
  return new ApiClientError(
    'irrelevant',
    status,
    `HTTP_${status}`,
    undefined,
    'req_1',
    undefined,
    body,
  );
}

beforeEach(() => postMock.mockReset());

describe('Α — η αιτία φτάνει', () => {
  it('Α1 — ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: 409 {error:"no-address"} ⇒ rejected, όχι failed', async () => {
    postMock.mockRejectedValue(serverRefusal(409, { error: 'no-address' }));

    const result = await runMandateAction('ownp_1', 'resend');

    expect(result).toEqual({ kind: 'rejected', reason: 'no-address' });
  });

  it('Α2 — ΚΑΘΕ λόγος του κλειστού συνόλου περνά (κανένας δεν ξεχάστηκε)', async () => {
    for (const reason of MANDATE_ACTION_REJECTIONS) {
      postMock.mockRejectedValue(serverRefusal(409, { error: reason }));

      const result = await runMandateAction('ownp_1', 'resend');

      expect(result).toEqual({ kind: 'rejected', reason });
    }
  });
});

describe('Β — τι ΔΕΝ γίνεται δεκτό', () => {
  it('Β1 — άγνωστος κωδικός ⇒ failed, ΠΟΤΕ ωμό κλειδί στην οθόνη', async () => {
    // Χωρίς φρουρό, το `as MandateActionRejection` θα το περνούσε ως λόγο και το
    // `REJECTION_KEYS[reason]` θα έδινε `undefined` ⇒ κενό ή ωμό κείμενο.
    postMock.mockRejectedValue(serverRefusal(400, { error: 'MALFORMED_BODY' }));

    const result = await runMandateAction('ownp_1', 'resend');

    expect(result.kind).toBe('failed');
  });

  it('Β2 — το λεξιλόγιο του ΔΙΠΛΑΝΟΥ τομέα δεν περνά για δικό μας', async () => {
    // `DECISION_REFUSED` / `request-absent` ανήκουν στα εισερχόμενα. Αν περνούσαν εδώ,
    // η οθόνη θα ζωγράφιζε **λάθος θεραπεία** πάνω σε σωστά δεδομένα.
    postMock.mockRejectedValue(serverRefusal(422, { error: 'DECISION_REFUSED' }));

    expect((await runMandateAction('ownp_1', 'resend')).kind).toBe('failed');
  });

  it('Β3 — ΤΟ ΔΟΜΙΚΟ CAST: σκέτο Error με σωστό σχήμα ⇒ failed', async () => {
    // 🔴 Το παλιό `(cause as { data?: … })?.data` ταίριαζε σε **οποιοδήποτε** throwable.
    postMock.mockRejectedValue(
      Object.assign(new Error('firebase'), { errorBody: { error: 'no-address' } }),
    );

    expect((await runMandateAction('ownp_1', 'resend')).kind).toBe('failed');
  });

  it('Β4 — αστοχία δικτύου ⇒ failed με το μήνυμα (ΟΧΙ άρνηση)', async () => {
    postMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await runMandateAction('ownp_1', 'resend');

    expect(result).toEqual({ kind: 'failed', message: 'Failed to fetch' });
  });

  it('Β5 — άρνηση χωρίς σώμα (HTML από proxy) ⇒ failed', async () => {
    postMock.mockRejectedValue(serverRefusal(502, undefined));

    expect((await runMandateAction('ownp_1', 'resend')).kind).toBe('failed');
  });
});

describe('Ε — επιτυχία και εξαντλητικότητα', () => {
  it('Ε1 — 2xx ⇒ done με την έκβαση του διακομιστή', async () => {
    const outcome = { ok: true, action: 'resend', notify: { kind: 'sent', to: 'a@b.gr' } };
    postMock.mockResolvedValue(outcome);

    expect(await runMandateAction('ownp_1', 'resend')).toEqual({ kind: 'done', outcome });
  });

  it('Ε2 — κάθε λόγος έχει κείμενο, και κάθε κείμενο λόγο (καμία ορφανή πλευρά)', () => {
    // Δυνατό **μόνο** τώρα που το λεξιλόγιο υπάρχει σε χρόνο εκτέλεσης.
    expect(Object.keys(REJECTION_KEYS).sort()).toEqual([...MANDATE_ACTION_REJECTIONS].sort());
  });
});

describe('Σ — το σύνορο επικυρώνει (parse, don\'t validate)', () => {
  it('Σ1 — 200 με ok:false ΔΕΝ περνά για επιτυχία: ονομάζεται άρνηση', async () => {
    // Ο διακομιστής δεν το κάνει σήμερα *(κάθε άρνηση φεύγει 404/409/502)*. Αν κάποτε
    // το κάνει, ένα σκέτο στένεμα τύπου θα το εμπιστευόταν σιωπηλά και η **άρνηση θα
    // παρουσιαζόταν ως επιτυχία** — χειρότερο από το ελάττωμα που κλείνει το ADR.
    postMock.mockResolvedValue({ ok: false, reason: 'no-address' });

    expect(await runMandateAction('ownp_1', 'resend')).toEqual({
      kind: 'rejected',
      reason: 'no-address',
    });
  });

  it('Σ2 — 200 με ok:false και ΑΓΝΩΣΤΟ λόγο ⇒ failed, ποτέ ωμό κλειδί', async () => {
    postMock.mockResolvedValue({ ok: false, reason: 'something-new' });

    expect((await runMandateAction('ownp_1', 'resend')).kind).toBe('failed');
  });
});
