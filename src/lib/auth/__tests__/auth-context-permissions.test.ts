/**
 * @jest-environment node
 *
 * =============================================================================
 * Ο ΠΡΩΤΟΣ ΠΑΡΑΓΩΓΟΣ ΤΑΥΤΟΤΗΤΑΣ ΚΟΥΒΑΛΑ ΤΟ CLAIM (ADR-801 §2.8)
 * =============================================================================
 *
 * 🔴 **ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΕΜΕΙΝΕ ΠΡΑΣΙΝΗ.** Η άγκυρα ισοδυναμίας
 * (`pdp-equivalence.test.ts`) χτίζει το `AuthContext` **με το χέρι**, οπότε
 * σβήνοντας το `permissions: claims.permissions` από το
 * `contextFromDecodedToken` **δεν κοκκίνιζε τίποτα**: ο κριτής δοκιμαζόταν με
 * είσοδο που κανείς δεν παρήγαγε.
 *
 * Είναι **ακριβώς** το σφάλμα που η ομάδα `Ρ` του §5.1 υπάρχει για να μην
 * ξανασυμβεί — *«το bug ζούσε στην **ΠΗΓΗ**, όχι στην καθαρή συνάρτηση»* — και
 * ξανασυνέβη στο ίδιο ADR, στον **άλλο** από τους δύο παραγωγούς.
 *
 * ⚠️ Ο **δεύτερος** παραγωγός (Server Components) φυλάσσεται χωριστά:
 * `src/server/auth/__tests__/page-identity-permissions.test.ts`.
 */

const mockVerifyIdToken = jest.fn();

jest.mock('@/lib/firebaseAdmin', () => ({
  isFirebaseAdminAvailable: () => true,
  getAdminAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
  getAdminFirestore: () => {
    throw new Error(
      'Ο Firestore ΔΕΝ πρέπει να κληθεί: χωρίς αίτημα για άλλον χώρο, το ' +
      '`resolveEffectiveCompanyId` επιστρέφει με ΜΗΔΕΝ αναγνώσεις (ADR-787 Ε-5 §2).',
    );
  },
}));

import { NextRequest } from 'next/server';
import { buildRequestContext } from '../auth-context';
import { isAuthenticated } from '../types';

const BASE_TOKEN = {
  uid: 'ITjmw0syn7WiYuskqaGtzLPuN852',
  email: 'pagonis.oe@gmail.com',
  companyId: 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757',
  globalRole: 'external_user',
};

/** Αίτημα με Bearer — **χωρίς** κεφαλίδα άλλου χώρου, ώστε να μη γίνει καμία ανάγνωση. */
function requestWithBearer(): NextRequest {
  return new NextRequest('https://nestorconstruct.gr/api/x', {
    headers: { authorization: 'Bearer a-token' },
  });
}

beforeEach(() => jest.clearAllMocks());

describe('ADR-801 §2.8 — buildRequestContext κουβαλά τα permissions', () => {
  it('Ρ1 — το ρητό claim φτάνει στο AuthContext της ΔΙΑΔΡΟΜΗΣ API', async () => {
    mockVerifyIdToken.mockResolvedValue({ ...BASE_TOKEN, permissions: ['admin_access'] });

    const ctx = await buildRequestContext(requestWithBearer());

    expect(isAuthenticated(ctx)).toBe(true);
    if (!isAuthenticated(ctx)) throw new Error('unreachable');
    // Το πραγματικό ζωντανό έγγραφο του §2.3.
    expect(ctx.permissions).toEqual(['admin_access']);
  });

  it('Ρ2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς claim ⇒ `undefined`', async () => {
    // Χωρίς αυτό, το Ρ1 θα ήταν πράσινο ακόμη κι αν ο παραγωγός έβαζε σταθερά
    // `['admin_access']` σε κάθε ταυτότητα.
    mockVerifyIdToken.mockResolvedValue({ ...BASE_TOKEN });

    const ctx = await buildRequestContext(requestWithBearer());

    expect(isAuthenticated(ctx)).toBe(true);
    if (!isAuthenticated(ctx)) throw new Error('unreachable');
    expect(ctx.permissions).toBeUndefined();
  });

  it('Ρ3 — ο ΙΔΙΟΣ κανόνας με τον πελάτη: άκυρα πετιούνται', async () => {
    mockVerifyIdToken.mockResolvedValue({
      ...BASE_TOKEN,
      permissions: ['admin_access', 'dfx:view', 'toString', 42, 'admin_access'],
    });

    const ctx = await buildRequestContext(requestWithBearer());

    expect(isAuthenticated(ctx)).toBe(true);
    if (!isAuthenticated(ctx)) throw new Error('unreachable');
    expect(ctx.permissions).toEqual(['admin_access']);
  });

  it('Ρ4 — ρητό claim ΔΕΝ αγοράζει είσοδο σε ταυτότητα χωρίς έγκυρο ρόλο', async () => {
    // Το ιστορικό `'admin'` του `users/dev-admin` (§2.3). Το fail-closed του
    // ADR-657 §3.5 κρίνει **πριν** διαβαστεί οτιδήποτε άλλο.
    mockVerifyIdToken.mockResolvedValue({
      ...BASE_TOKEN,
      globalRole: 'admin',
      permissions: ['admin_access'],
    });

    const ctx = await buildRequestContext(requestWithBearer());

    expect(ctx).toEqual({ isAuthenticated: false, reason: 'missing_claims' });
  });
});
