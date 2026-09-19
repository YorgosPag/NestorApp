/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΤΗΣ ΔΗΜΟΣΙΑΣ ΔΙΑΘΕΣΙΜΟΤΗΤΑΣ ΚΑΛΕΙ ΩΣ ΑΝΩΝΥΜΟΣ** — άγκυρα.
 * @related services/stay-calendar/stay-public.client.ts · lib/api/api-client-types.ts (`PUBLIC_REQUEST`) ·
 *   ADR-777 §8.60.21.7 «Ζωντανή επαλήθευση»
 *
 * 🔴 **Γιατί υπάρχει**: στη ζωντανή επαλήθευση (2026-09-19) η αναζήτηση με ημερομηνίες έδειχνε σε
 * **κάθε** ανώνυμο επισκέπτη «1 με ημερολόγιο που δεν διαβάστηκε» και την κάρτα **χωρίς σύνολο**.
 * Ο server απαντούσε σωστά — το αίτημα **δεν έφευγε ποτέ**: χωρίς `skipAuth` ο μεταφορέας ζητά
 * `getIdToken()` και πετά 401 **πριν** το `fetch`. Τα tests του hook μόκαραν τον πελάτη, οπότε
 * κανένα δεν μπορούσε να το δει· ο συνδεδεμένος developer επίσης όχι.
 *
 * ⚠️ Mock **μόνο ο μεταφορέας**· η σταθερά είναι η **πραγματική**, και ο ισχυρισμός ελέγχει την
 * **τιμή** `{ skipAuth: true }` — μετάλλαξη της σταθεράς ή αφαίρεσή της από την κλήση ⇒ κόκκινο.
 */

const getMock = jest.fn();
const postMock = jest.fn();

jest.mock('@/lib/api/enterprise-api-client', () => ({
  PUBLIC_REQUEST: jest.requireActual('@/lib/api/api-client-types').PUBLIC_REQUEST,
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { fetchPublicStayNights, fetchStayAnswers } from '../stay-public.client';

const QUERY = { checkIn: '2026-10-05', checkOut: '2026-10-08', guests: 2, pets: 2 } as const;

beforeEach(() => jest.clearAllMocks());

describe('stay-public.client — δημόσια διαδρομή = ανώνυμη κλήση', () => {
  it('🔴 Α1 — οι απαντήσεις αναζήτησης καλούνται με `skipAuth` (αλλιώς 401 πριν φύγει το αίτημα)', async () => {
    postMock.mockResolvedValue({ answers: {} });
    await expect(fetchStayAnswers(['ownp_a'], QUERY)).resolves.toEqual({ kind: 'loaded', answers: {} });
    expect(postMock).toHaveBeenCalledWith(
      '/api/public-listings/stay-availability',
      { listingIds: ['ownp_a'], ...QUERY },
      { skipAuth: true },
    );
  });

  it('🔴 Α2 — το δημόσιο ημερολόγιο της σελίδας καλείται με `skipAuth`', async () => {
    getMock.mockResolvedValue({ nights: [] });
    await fetchPublicStayNights('ownp_a', '2026-10', 2, 'cached');
    expect(getMock).toHaveBeenCalledWith(
      '/api/public-listings/ownp_a/stay-nights?from=2026-10&months=2',
      { skipAuth: true },
    );
  });

  it('🔴 Α2′ (ADR-835 §23.12 Ε2) — μετά από δική μου γραφή: `reload` ΚΑΙ ανώνυμο — ποτέ η cache του SWR', async () => {
    getMock.mockResolvedValue({ nights: [] });
    await fetchPublicStayNights('ownp_a', '2026-10', 2, 'fresh');
    expect(getMock).toHaveBeenCalledWith(
      '/api/public-listings/ownp_a/stay-nights?from=2026-10&months=2',
      { skipAuth: true, cache: 'reload' },
    );
  });

  it('Α3 — ο μεταφορέας αρνείται ⇒ `failed` (η οθόνη το μετρά `unreadable`), ποτέ κενή απάντηση', async () => {
    postMock.mockRejectedValue(new Error('User not authenticated'));
    await expect(fetchStayAnswers(['ownp_a'], QUERY)).resolves.toEqual({ kind: 'failed' });
  });
});
