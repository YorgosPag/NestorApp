/**
 * 🔴 ΑΓΚΥΡΑ — **ΟΙ ΠΑΡΑΒΙΑΣΕΙΣ ΦΤΑΝΟΥΝ, ΚΑΙ ΣΩΣΤΑ ΟΝΟΜΑΣΜΕΝΕΣ** (ADR-834 §6.5.ε).
 *
 * Ο `violationsOf` ζητούσε `cause.data.violations` — πεδίο που η `ApiClientError` **δεν
 * είχε ποτέ** ⇒ **πάντα `null`** ⇒ κάθε 422 κατέληγε «κάτι πήγε στραβά». Το ίδιο το
 * σχόλιο από πάνω του **προειδοποιούσε γι' αυτό ακριβώς** — και καμία άγκυρα δεν
 * εκτελούσε την προειδοποίηση.
 *
 * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: κανένα component δεν αποδίδει ακόμη αυτές τις παραβιάσεις. Η
 * άγκυρα φυλάει τη **μετάφραση**, όχι μια οθόνη — και είναι ό,τι χρειάζεται όταν οι δύο
 * κριτές (πελάτη/διακομιστή) αποκλίνουν.
 *
 * ⚠️ Ο κριτής είναι ο **ΠΡΑΓΜΑΤΙΚΟΣ**· mock μόνο ο μεταφορέας.
 */

jest.mock('@/lib/api/enterprise-api-client', () => {
  const types = jest.requireActual('@/lib/api/api-client-types');
  return {
    apiClient: { post: jest.fn(), patch: jest.fn() },
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

jest.mock('@/services/enterprise-id.service', () => ({
  enterpriseIdService: { generateOwnerPropertyId: () => 'ownp_test' },
}));

import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { createOwnerListing } from '@/services/owner-property/owner-property.service';
import type { OwnerPropertyDraft } from '@/types/owner-property';

const postMock = apiClient.post as jest.Mock;

function serverRefusal(status: number, body: unknown): ApiClientError {
  return new ApiClientError('irrelevant', status, `HTTP_${status}`, undefined, 'req_1', undefined, body);
}

const DRAFT = { title: 'x' } as unknown as OwnerPropertyDraft;
const create = () => createOwnerListing('ownp_1', DRAFT);

beforeEach(() => postMock.mockReset());

describe('Π — οι παραβιάσεις φτάνουν', () => {
  it('Π1 — 422 INVALID_LISTING ⇒ invalid με τους κωδικούς αγγελίας', async () => {
    postMock.mockRejectedValue(
      serverRefusal(422, { error: 'INVALID_LISTING', violations: ['no-live-offer'] }),
    );

    expect(await create()).toEqual({ kind: 'invalid', violations: ['no-live-offer'] });
  });

  it('Π2 — ΤΑ ΔΥΟ ΛΕΞΙΛΟΓΙΑ: 422 INVALID_MANDATE διατηρεί τον κωδικό ΕΝΤΟΛΗΣ', async () => {
    // 🔴 Το ίδιο πεδίο `violations` κουβαλά δύο λεξιλόγια. Ένας φρουρός μόνο για
    // παραβιάσεις αγγελίας θα **πετούσε** αυτόν τον κωδικό ⇒ κενή λίστα ⇒ «απέτυχε».
    postMock.mockRejectedValue(
      serverRefusal(422, { error: 'INVALID_MANDATE', violations: ['mandate-expiry-past'] }),
    );

    expect(await create()).toEqual({ kind: 'invalid', violations: ['mandate-expiry-past'] });
  });

  it('Π3 — μεικτή λίστα: κρατά ΚΑΙ ΤΑ ΔΥΟ λεξιλόγια', async () => {
    postMock.mockRejectedValue(
      serverRefusal(422, {
        error: 'INVALID_LISTING',
        violations: ['title-missing', 'mandate-scope-empty'],
      }),
    );

    const result = await create();

    expect(result).toEqual({
      kind: 'invalid',
      violations: ['title-missing', 'mandate-scope-empty'],
    });
  });
});

describe('Φ — ο φρουρός', () => {
  it('Φ1 — άγνωστος κωδικός ΠΕΦΤΕΙ, ΠΟΤΕ ωμό κλειδί στην οθόνη', async () => {
    postMock.mockRejectedValue(
      serverRefusal(422, { error: 'INVALID_LISTING', violations: ['not-a-code', 'title-missing'] }),
    );

    expect(await create()).toEqual({ kind: 'invalid', violations: ['title-missing'] });
  });

  it('Φ2 — ΜΟΝΟ άγνωστοι ⇒ failed, ΟΧΙ «άκυρο με κενή λίστα»', async () => {
    // Λευκό πλαίσιο σφάλματος: ο άνθρωπος βλέπει ότι κάτι χάλασε χωρίς να μάθει τι.
    postMock.mockRejectedValue(
      serverRefusal(422, { error: 'INVALID_LISTING', violations: ['not-a-code'] }),
    );

    expect((await create()).kind).toBe('failed');
  });

  it('Φ3 — ΚΕΝΟΣ πίνακας ⇒ failed (αόρατο στους τύπους: Array.isArray([]) === true)', async () => {
    postMock.mockRejectedValue(serverRefusal(422, { error: 'INVALID_LISTING', violations: [] }));

    expect((await create()).kind).toBe('failed');
  });

  it('Φ4 — string αντί πίνακα ⇒ failed', async () => {
    postMock.mockRejectedValue(
      serverRefusal(422, { error: 'INVALID_LISTING', violations: 'no-live-offer' }),
    );

    expect((await create()).kind).toBe('failed');
  });

  it('Φ5 — άρνηση ΧΩΡΙΣ violations (404) ⇒ failed, όχι invalid', async () => {
    postMock.mockRejectedValue(serverRefusal(404, { error: 'NOT_FOUND' }));

    expect((await create()).kind).toBe('failed');
  });

  it('Φ6 — ΤΟ ΔΟΜΙΚΟ CAST: σκέτο Error με σωστό σχήμα ⇒ failed', async () => {
    postMock.mockRejectedValue(
      Object.assign(new Error('firebase'), {
        errorBody: { error: 'INVALID_LISTING', violations: ['no-live-offer'] },
      }),
    );

    expect((await create()).kind).toBe('failed');
  });
});
