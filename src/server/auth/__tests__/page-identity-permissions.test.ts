/**
 * @jest-environment node
 *
 * =============================================================================
 * Ο ΔΕΥΤΕΡΟΣ ΠΑΡΑΓΩΓΟΣ ΤΑΥΤΟΤΗΤΑΣ ΚΟΥΒΑΛΑ ΤΟ CLAIM (ADR-801 §2.8)
 * =============================================================================
 *
 * 🔴 **Γιατί υπάρχει αυτό το αρχείο**: ο server έχει **ΔΥΟ** παραγωγούς
 * `AuthContext` — το `buildRequestContext` (διαδρομές API, από `NextRequest`)
 * και το `readPageIdentity` (Server Components, από cookie). Ένα Server
 * Component **δεν έχει** `NextRequest`, γι' αυτό ο δεύτερος υπάρχει και είναι
 * σωστό που υπάρχει (ADR-787 §5.3 ι).
 *
 * ⚠️ Αν **μόνο** ο πρώτος διάβαζε το claim `permissions`, οι **σελίδες** θα
 * έκριναν διαφορετικά από τις **διαδρομές API** — η ίδια βλάβη που κλείνει η
 * Φάση 3γ, έναν όροφο πιο κάτω, και **αόρατη** γιατί κανένα κείμενο δεν
 * ονόμαζε αυτόν τον παραγωγό.
 *
 * @see lib/auth/__tests__/pdp-equivalence.test.ts — η ισοδυναμία των δύο κριτών
 */

const mockGet = jest.fn();
const mockVerify = jest.fn();

jest.mock('next/headers', () => ({
  cookies: async () => ({ get: mockGet }),
}));

jest.mock('@/server/admin/admin-guards', () => ({
  verifySessionCookieToken: (...args: unknown[]) => mockVerify(...args),
}));

// ⚠️ Το περιβάλλον **δεν** πρέπει να είναι `development`: εκεί υπάρχει dev
//    bypass χωρίς cookie, και η άγκυρα θα δοκίμαζε μονοπάτι που δεν κρίνει
//    claims (σχήμα «η δοκιμή έτρεξε σε κόσμο που δεν υπάρχει», CHECK 3.46).
jest.mock('@/config/environment-security-config', () => ({
  getCurrentRuntimeEnvironment: () => 'production',
}));

jest.mock('@/config/dev-environment', () => ({
  getDevCompanyId: async () => 'comp_dev',
}));

import { readPageIdentity } from '../page-identity';

const BASE_TOKEN = {
  uid: 'u1',
  email: 'pagonis.oe@gmail.com',
  companyId: 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757',
  globalRole: 'external_user',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockReturnValue({ value: 'a-session-cookie' });
});

describe('ADR-801 §2.8 — readPageIdentity κουβαλά τα permissions', () => {
  it('Π1 — το ρητό claim φτάνει στο AuthContext της ΣΕΛΙΔΑΣ', async () => {
    mockVerify.mockResolvedValue({ ...BASE_TOKEN, permissions: ['admin_access'] });

    const identity = await readPageIdentity();

    expect(identity.ok).toBe(true);
    if (!identity.ok) throw new Error('unreachable');
    // Το πραγματικό ζωντανό έγγραφο του §2.3: `external_user` + `admin_access`.
    expect(identity.ctx.permissions).toEqual(['admin_access']);
  });

  it('Π2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς claim ⇒ `undefined`, ΟΧΙ σιωπηλό []', async () => {
    // Χωρίς αυτό, το Π1 θα ήταν πράσινο ακόμη κι αν ο παραγωγός έβαζε σταθερά
    // `['admin_access']` σε **κάθε** ταυτότητα.
    mockVerify.mockResolvedValue({ ...BASE_TOKEN });

    const identity = await readPageIdentity();

    expect(identity.ok).toBe(true);
    if (!identity.ok) throw new Error('unreachable');
    expect(identity.ctx.permissions).toBeUndefined();
  });

  it('Π3 — άκυρες τιμές πετιούνται με τον ΙΔΙΟ κανόνα που χρησιμοποιεί ο πελάτης', async () => {
    mockVerify.mockResolvedValue({
      ...BASE_TOKEN,
      permissions: ['admin_access', 'dfx:view', 'toString', 42],
    });

    const identity = await readPageIdentity();

    expect(identity.ok).toBe(true);
    if (!identity.ok) throw new Error('unreachable');
    expect(identity.ctx.permissions).toEqual(['admin_access']);
  });

  it('Π4 — η άρνηση ταυτότητας δεν αλλάζει (fail-closed αμετάβλητο)', async () => {
    mockVerify.mockResolvedValue({ ...BASE_TOKEN, globalRole: 'admin', permissions: ['admin_access'] });

    // Το ιστορικό `'admin'` **δεν** είναι στα `GLOBAL_ROLES` ⇒ απορρίπτεται
    // ΠΡΙΝ φτάσει οτιδήποτε να διαβάσει permissions. Το ρητό claim **δεν**
    // αγοράζει είσοδο σε ταυτότητα που δεν καταλαβαίνουμε.
    const identity = await readPageIdentity();

    expect(identity).toEqual({ ok: false, reason: 'invalid-role' });
  });
});
