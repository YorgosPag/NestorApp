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
const mockWarn = jest.fn();

// ADR-859 — οι μέθοδοι διαβάζουν το `mockWarn` ΟΤΑΝ κληθούν: το `createModuleLogger`
// τρέχει στο σώμα του module, πριν αρχικοποιηθεί η δέσμευση (ανύψωση του jest).
jest.mock('@/lib/telemetry', () => ({
  ...jest.requireActual('@/lib/telemetry'),
  createModuleLogger: () => ({
    warn: (...args: unknown[]) => mockWarn(...args),
    info: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  }),
}));

jest.mock('next/headers', () => ({
  cookies: async () => ({ get: mockGet }),
}));

jest.mock('@/server/admin/admin-guards', () => ({
  verifySessionCookieToken: (...args: unknown[]) => mockVerify(...args),
}));

// ⚠️ Το περιβάλλον **δεν** πρέπει να είναι `development`: εκεί μπορεί να
//    κατασκευαστεί ταυτότητα χωρίς cookie, και η άγκυρα θα δοκίμαζε μονοπάτι που
//    δεν κρίνει claims (σχήμα «η δοκιμή έτρεξε σε κόσμο που δεν υπάρχει», CHECK 3.46).
//
// ⚠️ **ΤΟ `...actual` ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟ** (ADR-821): το μοκ ήταν **μερικό** —
//    δήλωνε **μόνο** το `getCurrentRuntimeEnvironment`. Όταν η κατασκευή απέκτησε
//    αυθεντία που ρωτά και το `getCurrentSecurityPolicy`, το μοκ θα το έδινε
//    `undefined`. Δεν έσπασε **μόνο** επειδή αυτές οι άγκυρες στέλνουν πάντα
//    cookie, άρα ο κλάδος δεν εκτελείται ποτέ. **Λανθάνουσα παγίδα για τον
//    επόμενο**, όχι σφάλμα σήμερα.
jest.mock('@/config/environment-security-config', () => ({
  ...jest.requireActual('@/config/environment-security-config'),
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

/**
 * ADR-859 — **ΚΑΘΕ ΑΡΝΗΣΗ ΛΕΕΙ ΤΟΝ ΛΟΓΟ ΤΗΣ ΣΤΑ LOGS.** Μέχρι 2026-09-14 μόνο το
 * `no-session` γραφόταν· η διάγνωση του βρόχου της πρόσκλησης **δεν μπορούσε** να
 * ξεχωρίσει «δεν ήρθε cookie» από «ήρθε και απορρίφθηκε».
 * Μετάλλαξη: αφαίρεση οποιουδήποτε `logger.warn` της άρνησης ⇒ Δ1 ή Δ2 κόκκινο.
 */
describe('ADR-859 — οι αρνήσεις δεν είναι σιωπηλές', () => {
  it('Δ1 — cookie που δεν επαληθεύεται ⇒ `invalid-session` ΚΑΙ γραμμή στα logs', async () => {
    mockVerify.mockResolvedValue(null);

    const identity = await readPageIdentity();

    expect(identity).toEqual({ ok: false, reason: 'invalid-session' });
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('DENY'));
  });

  it('Δ2 — απορριφθέντα claims ⇒ ο ταξινομημένος λόγος, με uid και ΧΩΡΙΣ email', async () => {
    mockVerify.mockResolvedValue({ ...BASE_TOKEN, globalRole: 'admin' });

    await readPageIdentity();

    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('DENY'), { uid: 'u1', why: 'invalid-role' });
    expect(JSON.stringify(mockWarn.mock.calls)).not.toContain(BASE_TOKEN.email);
  });

  it('Δ3 — ΠΑΡΟΝΟΜΑΣΤΗΣ: έγκυρη ταυτότητα ⇒ καμία γραμμή άρνησης', async () => {
    mockVerify.mockResolvedValue({ ...BASE_TOKEN });

    await readPageIdentity();

    expect(mockWarn).not.toHaveBeenCalled();
  });
});
