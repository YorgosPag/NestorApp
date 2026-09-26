/**
 * @jest-environment node
 *
 * @fileoverview **ΟΙ ΔΗΜΟΣΙΕΣ ΠΟΡΤΕΣ ΤΗΣ ΘΕΑΣΗΣ ΚΑΛΟΥΝΤΑΙ ΩΣ ΑΝΩΝΥΜΟΣ** — άγκυρα.
 * @related services/spatial-tour/spatial-tour-viewing.client.ts · lib/api/api-client-types.ts (`PUBLIC_REQUEST`) ·
 *   ADR-884 changelog «Κ3β — ζωντανή επαλήθευση» · πρώτη εμφάνιση της κλάσης: ADR-777 §8.60.21.7
 *
 * 🔴 **Γιατί υπάρχει**: στη ζωντανή επαλήθευση (2026-09-26) η κάρτα «Περιήγηση 360°» **δεν εμφανίστηκε ποτέ** σε
 * ανώνυμο επισκέπτη, ενώ το `…/presence` απαντούσε σωστά `on-request` στο curl. Το αίτημα **δεν έφευγε**: χωρίς
 * `skipAuth` ο μεταφορέας ζητά `getIdToken()` και πετά 401 **πριν** το `fetch` — και η κάρτα μένει `hidden` σιωπηλά.
 * Ίδια κλάση στην πόρτα `view-session/public` (ο ανώνυμος παραλήπτης προσωπικού συνδέσμου).
 *
 * ⚠️ Mock **μόνο ο μεταφορέας**· η σταθερά είναι η **πραγματική** και ο ισχυρισμός ελέγχει την **τιμή**
 * `{ skipAuth: true }` — αφαίρεσή της από την κλήση ⇒ κόκκινο. Και το αντίστροφο (Γ): η πόρτα **με** λογαριασμό
 * **δεν** καλείται ανώνυμα, αλλιώς ο διακομιστής θα έβλεπε «κανέναν» και θα αρνιόταν τον εγκεκριμένο.
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

import { openTourViewSessionFromScreen, readTourPresenceFromScreen } from '../spatial-tour-viewing.client';

const SUBJECT = { kind: 'company-property', id: 'prop_a' } as const;
const ANONYMOUS = { skipAuth: true };

beforeEach(() => jest.clearAllMocks());

describe('spatial-tour-viewing.client — δημόσια πόρτα = ανώνυμη κλήση', () => {
  it('🔴 Α — η παρουσία στην αγγελία καλείται με `skipAuth` (αλλιώς 401 πριν φύγει ⇒ κάρτα κρυφή)', async () => {
    getMock.mockResolvedValue({ tour: null });
    await expect(readTourPresenceFromScreen('prop_a')).resolves.toEqual({ kind: 'ok', value: null });
    expect(getMock).toHaveBeenCalledWith('/api/spatial-tours/listings/prop_a/presence', ANONYMOUS);
  });

  it('🔴 Β — η συνεδρία θέασης χωρίς λογαριασμό πάει στην πόρτα `/public` ΚΑΙ ανώνυμα', async () => {
    postMock.mockResolvedValue({});
    await openTourViewSessionFromScreen(SUBJECT, { signedIn: false, shareId: 'share_1' });
    expect(postMock).toHaveBeenCalledWith(
      '/api/spatial-tours/company-property/prop_a/view-session/public',
      { shareId: 'share_1' },
      ANONYMOUS,
    );
  });

  it('🔴 Γ — η συνεδρία θέασης με λογαριασμό κρατά την ταυτότητα (ποτέ `skipAuth`)', async () => {
    postMock.mockResolvedValue({});
    await openTourViewSessionFromScreen(SUBJECT, { signedIn: true, shareId: null });
    expect(postMock).toHaveBeenCalledWith('/api/spatial-tours/company-property/prop_a/view-session', { shareId: null });
    expect(postMock.mock.calls[0]).toHaveLength(2);
  });
});
