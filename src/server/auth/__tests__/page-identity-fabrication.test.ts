/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΕΣ — **Ο ΚΑΤΑΝΑΛΩΤΗΣ ΤΗΣ ΑΥΘΕΝΤΙΑΣ** (ADR-821)
 *
 * `npx jest src/server/auth/__tests__/page-identity-fabrication.test.ts`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΤΟ ΡΩΤΑΕΙ ΤΟ `identity-fabrication.test.ts`
 * ─────────────────────────────────────────────────────────────────────────────
 * Εκείνο ρωτά *«τι **αποφασίζει** ο κριτής;»*. Αυτό ρωτά *«**υπακούει** ο
 * καταναλωτής;»* — και είναι **άλλο** ερώτημα: ένας κριτής που λέει «⛔» και ένας
 * καταναλωτής που κατασκευάζει ούτως ή άλλως δίνουν **πράσινο κριτή και σπασμένο
 * σύστημα**.
 *
 * ⚠️ **ΚΑΜΙΑ ΑΓΚΥΡΑ ΔΕΝ ΨΑΧΝΕΙ ΟΝΟΜΑ ή IMPORT** — μετρημένο δύο φορές (26 &
 * 27/08) ότι μετάλλαξη επιβιώνει όταν η άγκυρα ελέγχει ότι ένα σύμβολο υπάρχει
 * αντί για το τι **κάνει**. Εδώ **εκτελείται** η `readPageIdentity` και ελέγχεται
 * η **ετυμηγορία** της.
 */

const mockGet = jest.fn();
const mockVerify = jest.fn();

jest.mock('next/headers', () => ({
  cookies: async () => ({ get: mockGet }),
}));

jest.mock('@/server/admin/admin-guards', () => ({
  verifySessionCookieToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock('@/config/dev-environment', () => ({
  getDevCompanyId: async () => 'comp_dev',
}));

// ⚠️ **ΤΟ `environment-security-config` ΔΕΝ ΕΙΝΑΙ ΜΟΚΑΡΙΣΜΕΝΟ, ΕΠΙΤΗΔΕΣ**: η
//    πολιτική `allowDevBypass` είναι **μέρος του υπό δοκιμή μηχανισμού**. Μοκ εδώ
//    θα δοκίμαζε τη μαϊμού, όχι τον φρουρό.

import { readPageIdentity } from '../page-identity';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST;

function setNodeEnv(value: string | undefined): void {
  if (value === undefined) {
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
    return;
  }
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

function setEmulator(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    return;
  }
  process.env.FIREBASE_AUTH_EMULATOR_HOST = value;
}

beforeEach(() => {
  jest.clearAllMocks();
  // **ΧΩΡΙΣ COOKIE** — αυτό είναι όλο το πείραμα.
  mockGet.mockReturnValue(undefined);
  setNodeEnv('development');
  setEmulator(undefined);
});

afterAll(() => {
  setNodeEnv(ORIGINAL_NODE_ENV);
  setEmulator(ORIGINAL_EMULATOR);
});

describe('ADR-821 — η σελίδα σταματά να κατασκευάζει όταν ο κριτής λέει όχι', () => {
  /**
   * 🔒 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ, ΠΡΩΤΟΣ.** Χωρίς αυτό, κάθε «⛔» παρακάτω θα μπορούσε να
   * σημαίνει *«η συνάρτηση δεν κατασκευάζει ΠΟΤΕ»* — δηλαδή άγκυρα πράσινη για
   * λάθος λόγο.
   */
  it('Π0 — ο παρονομαστής: development χωρίς emulator ⇒ ΟΝΤΩΣ κατασκευάζει', async () => {
    const identity = await readPageIdentity();

    expect(identity.ok).toBe(true);
    if (!identity.ok) throw new Error('unreachable');
    expect(identity.scope).toBe('organization');
    expect(identity.ctx.uid).toBe('dev-user');
  });

  /**
   * 🏆 **Η ΓΡΑΜΜΗ ΠΟΥ ΚΑΝΕΙ ΤΗΝ ΤΟΠΙΚΗ ΕΠΑΛΗΘΕΥΣΗ ΤΙΜΙΑ** (ADR-821 §3.1α).
   *
   * Μέχρι 27/08 ανώνυμος επισκέπτης στον emulator έπαιρνε ολόκληρο το εταιρικό
   * κέλυφος με **κατασκευασμένη** ταυτότητα *(ADR-819 §8.6: `307 →
   * /o/comp_9c7c1a50-…/dashboard`)*. Κάθε «πράσινο» εκεί μπορούσε να είναι
   * πράσινο **για λάθος λόγο**.
   */
  it('Π1 — με τον Auth Emulator σε λειτουργία ⇒ ΚΑΜΙΑ κατασκευή', async () => {
    setEmulator('localhost:9099');

    const identity = await readPageIdentity();

    expect(identity.ok).toBe(false);
    if (identity.ok) throw new Error('unreachable');
    expect(identity.reason).toBe('no-session');
  });

  it('Π2 — με ΑΓΝΩΣΤΟ NODE_ENV ⇒ ΚΑΜΙΑ κατασκευή (η επιεικής προεπιλογή έκλεισε)', async () => {
    setNodeEnv('');

    const identity = await readPageIdentity();

    expect(identity.ok).toBe(false);
  });

  it.each(['production', 'staging', 'test'])(
    'Π3 — σε %s ⇒ ΚΑΜΙΑ κατασκευή',
    async env => {
      setNodeEnv(env);

      const identity = await readPageIdentity();

      expect(identity.ok).toBe(false);
    },
  );

  /**
   * ⚠️ **Η ΚΑΤΑΣΚΕΥΗ ΔΕΝ ΚΛΙΜΑΚΩΝΕΙ** — ελέγχεται στο **αποτέλεσμα** της
   * `readPageIdentity`, όχι στη σταθερά. Καρφωμένη σύγκριση με το
   * `FABRICATED_PRINCIPAL` θα ήταν ταυτολογία: θα έμενε πράσινη ό,τι κι αν
   * κουβαλούσε η σταθερά.
   */
  it('Π4 — ό,τι κατασκευάζεται φτάνει ΧΩΡΙΣ ικανοποιημένο MFA και ΧΩΡΙΣ super_admin', async () => {
    const identity = await readPageIdentity();

    if (!identity.ok) throw new Error('αναμενόταν κατασκευή — δες Π0');
    expect(identity.ctx.mfaEnrolled).toBe(false);
    expect(identity.ctx.globalRole).not.toBe('super_admin');
    expect(identity.ctx.globalRole).not.toBe('admin');
  });

  /**
   * 🔒 **ΤΟ COOKIE ΕΞΑΚΟΛΟΥΘΕΙ ΝΑ ΚΡΙΝΕΤΑΙ** — ο παρονομαστής ότι δεν σβήσαμε τη
   * ΚΑΝΟΝΙΚΗ διαδρομή μαζί με την κατασκευή.
   */
  it('Π5 — με πραγματικό cookie, η κατασκευή δεν εμπλέκεται καν', async () => {
    setEmulator('localhost:9099'); // ο κριτής θα έλεγε «⛔ κατασκευή»…
    mockGet.mockReturnValue({ value: 'a-session-cookie' });
    mockVerify.mockResolvedValue({
      uid: 'u-real',
      email: 'real@example.com',
      companyId: 'comp_real',
      globalRole: 'internal_user',
    });

    const identity = await readPageIdentity();

    // …αλλά υπάρχει cookie, άρα κρίνεται **αυτό**.
    expect(identity.ok).toBe(true);
    if (!identity.ok) throw new Error('unreachable');
    expect(identity.ctx.uid).toBe('u-real');
  });
});
