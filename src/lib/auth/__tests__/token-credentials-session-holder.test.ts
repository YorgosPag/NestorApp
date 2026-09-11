/**
 * @jest-environment node
 *
 * @fileoverview **«Ποιος κρατά αυτή τη συνεδρία — ΤΩΡΑ;»** (ADR-844 §13).
 * @related lib/auth/token-credentials.ts (`sessionHolderUid`)
 *
 * 🔴 **Η ΜΙΑ ΓΡΑΜΜΗ ΠΟΥ ΑΞΙΖΕΙ ΑΓΚΥΡΑ**: το `checkRevoked: true`. Χωρίς αυτό, ο
 * επιτιθέμενος που μόλις αποσυνδέσαμε θα ξαναγινόταν «κάτοχος» με το **παλιό** του cookie
 * — και η επόμενη απόδειξη θα τον αναγνώριζε ως τον νόμιμο χρήστη.
 */

jest.mock('server-only', () => ({}));

const verifySessionCookieMock = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  isFirebaseAdminAvailable: () => true,
  getAdminAuth: () => ({
    verifySessionCookie: (...args: unknown[]) => verifySessionCookieMock(...args),
  }),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { sessionHolderUid, verifySessionCookie } from '../token-credentials';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Ε — ο κάτοχος της συνεδρίας', () => {
  it('Ε1 — κανένα cookie ⇒ `null`, και ΚΑΜΙΑ κλήση στη Firebase (κόστος)', async () => {
    await expect(sessionHolderUid(null)).resolves.toBeNull();
    await expect(sessionHolderUid('')).resolves.toBeNull();
    expect(verifySessionCookieMock).not.toHaveBeenCalled();
  });

  it('🔴 Ε2 — έγκυρο cookie ⇒ το uid, ρωτημένο ΜΕ `checkRevoked: true`', async () => {
    verifySessionCookieMock.mockResolvedValue({ uid: 'uid_holder' });

    await expect(sessionHolderUid('cookie_abc')).resolves.toBe('uid_holder');
    expect(verifySessionCookieMock).toHaveBeenCalledWith('cookie_abc', true);
  });

  it('🔴 Ε3 — ανακληθέν cookie ⇒ `null` — ο αποσυνδεδεμένος ΔΕΝ είναι κάτοχος', async () => {
    verifySessionCookieMock.mockRejectedValue(
      Object.assign(new Error('revoked'), { code: 'auth/session-cookie-revoked' }),
    );

    await expect(sessionHolderUid('cookie_old')).resolves.toBeNull();
  });

  it('🔑 Ε4 — το hot path ΔΕΝ άλλαξε: η προεπιλογή μένει `checkRevoked: false`', async () => {
    // ⚠️ Το `checkRevoked` κοστίζει ένα `getUser` ανά κλήση. Οι 319 διαδρομές `withAuth`
    //    δεν πρέπει να το πληρώσουν επειδή το χρειάστηκε **μία** σπάνια διαδρομή.
    verifySessionCookieMock.mockResolvedValue({ uid: 'u' });

    await verifySessionCookie('cookie_abc');
    expect(verifySessionCookieMock).toHaveBeenCalledWith('cookie_abc', false);
  });
});
