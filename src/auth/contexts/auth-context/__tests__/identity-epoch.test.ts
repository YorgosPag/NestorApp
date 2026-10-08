/**
 * @fileoverview ADR-908 §3.2 — καμία εργασία δεν γράφει ταυτότητα μετά από `await` χωρίς να ξαναρωτήσει.
 *
 * | Άγκυρα | Τι φυλά |
 * |---|---|
 * | Ε1 🔴 | ο άνθρωπος άλλαξε **όσο** περιμέναμε το token ⇒ **κανένα** `POST /api/auth/session` (το cookie που ξαναστηνόταν) |
 * | Ε2 | ίδιος άνθρωπος ⇒ το cookie ζητείται κανονικά (ο φρουρός δεν κόβει τη σύνδεση) |
 * | Ε3 | ο ακροατής ανεβάζει την εποχή **μόνο** όταν αλλάζει ο άνθρωπος — η ανανέωση token δεν είναι αλλαγή |
 */

import type { User as FirebaseUser } from 'firebase/auth';

import { syncServerSession } from '../auth-context-session';
import {
  advanceIdentityEpoch,
  currentIdentityEpoch,
  identityChangedSince,
  observeIdentity,
} from '../identity-epoch';

const fetchMock = jest.fn();

function userWhoseTokenArrives(duringTheWait: () => void): FirebaseUser {
  const fake = {
    getIdToken: async () => {
      duringTheWait();
      return 'id-token';
    },
  };
  return fake as unknown as FirebaseUser;
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true });
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('syncServerSession — ο ΕΝΑΣ φρουρός', () => {
  it('Ε1 🔴 — αποσύνδεση ΟΣΟ περιμένει το token ⇒ κανένα αίτημα cookie', async () => {
    await syncServerSession(userWhoseTokenArrives(advanceIdentityEpoch));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Ε2 — ίδιος άνθρωπος ⇒ ένα POST με το token', async () => {
    await syncServerSession(userWhoseTokenArrives(() => undefined));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ idToken: 'id-token' }));
  });
});

describe('observeIdentity', () => {
  it('Ε3 — ίδιο uid ⇒ ίδια εποχή· άλλος άνθρωπος ή κανείς ⇒ νέα', () => {
    observeIdentity('u1');
    const signedIn = currentIdentityEpoch();

    observeIdentity('u1');
    expect(identityChangedSince(signedIn)).toBe(false);

    observeIdentity(null);
    expect(identityChangedSince(signedIn)).toBe(true);

    const anonymous = currentIdentityEpoch();
    observeIdentity('u2');
    expect(identityChangedSince(anonymous)).toBe(true);
  });
});
