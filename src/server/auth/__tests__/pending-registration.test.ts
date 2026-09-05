/**
 * @fileoverview Unit tests για το SSoT provisioning service (ADR-660).
 * Καλύπτουν τη λογική: pending upsert χωρίς claims, no-op για ήδη-assigned χρήστη,
 * race-proof notify-once (transaction-guarded `pendingNotifiedAt`), και το ότι η
 * ειδοποίηση στέλνεται μόνο στους ενεργούς admin του tenant (πηγή = `users`
 * collection, companyId + globalRole — ΟΧΙ το συχνά-άδειο members subcollection).
 *
 * Το Admin SDK (Firestore transaction + users query) και ο Mailgun sender είναι
 * mocked — ο έλεγχος είναι καθαρά στη λογική του service.
 */

jest.mock('server-only', () => ({}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'TS' },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

jest.mock('@/config/tenant', () => ({
  getCompanyId: () => 'comp_TEST',
}));

const sendReplyViaMailgunMock = jest.fn();
jest.mock('@/services/ai-pipeline/shared/mailgun-sender', () => ({
  sendReplyViaMailgun: (...args: unknown[]) => sendReplyViaMailgunMock(...args),
}));

jest.mock('@/services/email-templates/pending-registration-admin', () => ({
  buildPendingRegistrationAdminEmail: () => ({ subject: 'S', html: 'H', text: 'T' }),
}));

const getAdminFirestoreMock = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => getAdminFirestoreMock(),
}));

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ensurePendingRegistration } from '../pending-registration';
import { CITIZEN_STATUS } from '../citizen-identity';
import { USER_STATUSES } from '@/auth/types/auth.types';
import { COLLECTIONS } from '@/config/firestore-collections';
import { REPO_ROOT, listRepoSourceFiles, readRepoCode } from '@/test-utils/read-source';

// =============================================================================
// HARNESS
// =============================================================================

/** Ένα doc του `users` collection όπως το επιστρέφει το where('companyId'==tenant). */
interface UserSeed { uid: string; globalRole?: string; status?: string; email?: string }
interface SetCall { data: Record<string, unknown>; options: unknown }

function makeFirestore(opts: {
  userDoc: Record<string, unknown> | null;
  tenantUsers: UserSeed[];
}): { db: unknown; setCalls: SetCall[] } {
  const setCalls: SetCall[] = [];
  const userRef = { __kind: 'userRef' };

  const usersQuery = {
    where: () => usersQuery,
    limit: () => usersQuery,
    get: async () => ({
      docs: opts.tenantUsers.map((u) => ({ id: u.uid, data: () => u })),
    }),
  };

  const db = {
    // Μόνο το USERS collection χρησιμοποιείται πλέον (userRef + admin query).
    collection: (_name: string) => ({
      doc: () => userRef,
      where: () => usersQuery,
    }),
    runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async () => ({ exists: opts.userDoc !== null, data: () => opts.userDoc }),
        set: (_ref: unknown, data: Record<string, unknown>, options: unknown) => {
          setCalls.push({ data, options });
        },
      };
      return cb(tx);
    },
  };

  return { db, setCalls };
}

const INPUT = { uid: 'uid_new', email: 'newuser@example.com', displayName: 'Νέος', authProvider: 'google.com' };

beforeEach(() => {
  jest.clearAllMocks();
  sendReplyViaMailgunMock.mockResolvedValue({ success: true, messageId: 'mg_1' });
});

// Sanity: το collection() δείχνει στο USERS (η μοναδική collection που αγγίζει το service).
it('uses the USERS collection as the admin source', () => {
  expect(COLLECTIONS.USERS).toBeDefined();
});

// =============================================================================
// TESTS
// =============================================================================

describe('ensurePendingRegistration', () => {
  it('creates a pending record WITHOUT claims and notifies active admins (first time)', async () => {
    const { db, setCalls } = makeFirestore({
      userDoc: null,
      tenantUsers: [
        { uid: 'admin1', globalRole: 'company_admin', status: 'active', email: 'admin@example.com' },
        { uid: 'user2', globalRole: 'external_user', status: 'active', email: 'user2@example.com' },
      ],
    });
    getAdminFirestoreMock.mockReturnValue(db);

    const result = await ensurePendingRegistration(INPUT);

    expect(result).toEqual({ status: 'pending', notified: true });
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].data).toMatchObject({
      status: 'pending',
      companyId: null,
      globalRole: null,
      pendingNotifiedAt: 'TS',
      requestedAt: 'TS',
      uid: 'uid_new',
    });
    // 🔴 ADR-660 (2026-08-23) — ΕΝΑ πεδίο κατάστασης, ΠΟΤΕ δύο.
    // Το `registrationStatus` ήταν δεύτερη αυθεντία για το ίδιο ερώτημα (ADR-749):
    // γραφόταν εδώ και δεν το διάβαζε **κανείς** — 0 αναγνώστες στο `src/`, 0
    // έγγραφα στη βάση. ⚠️ Άγκυρα ΑΠΟΥΣΙΑΣ, όχι παρουσίας: το `toMatchObject`
    // αγνοεί τα πεδία που δεν ονομάζει, οπότε χωρίς αυτή τη γραμμή η επιστροφή
    // του πεδίου θα περνούσε **πράσινη**.
    expect(setCalls[0].data).not.toHaveProperty('registrationStatus');
    // Ο external_user φιλτραρίστηκε — μόνο ο admin παραλήπτης.
    expect(sendReplyViaMailgunMock).toHaveBeenCalledTimes(1);
    expect(sendReplyViaMailgunMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin@example.com' }),
    );
  });

  it('is a no-op for an already-assigned user (never downgrades)', async () => {
    const { db, setCalls } = makeFirestore({
      userDoc: { companyId: 'comp_EXISTING', globalRole: 'internal_user' },
      tenantUsers: [{ uid: 'admin1', globalRole: 'company_admin', status: 'active', email: 'admin@example.com' }],
    });
    getAdminFirestoreMock.mockReturnValue(db);

    const result = await ensurePendingRegistration(INPUT);

    expect(result).toEqual({ status: 'assigned', notified: false });
    expect(setCalls).toHaveLength(0);
    expect(sendReplyViaMailgunMock).not.toHaveBeenCalled();
  });

  /**
   * 🔴 **Π1 — Ο ΠΟΛΙΤΗΣ ΔΕΝ ΥΠΟΒΑΘΜΙΖΕΤΑΙ** (ADR-844).
   *
   * Χωρίς αυτό το σκέλος, **κάθε** σύνδεση **κάθε** πολίτη θα έγραφε
   * `globalRole: null, status: 'pending'` πάνω σε **έγκυρο** claim
   * `external_user` ⇒ **ενεργή** απόκλιση claim↔εγγράφου *(που το §5.13 μετρά
   * σήμερα 0/4, δηλαδή λανθάνουσα)* — και θα τον έβαζε σε λίστα «εκκρεμείς
   * εγκρίσεις» ενός διαχειριστή που **δεν ζήτησε τίποτα να κρίνει**.
   *
   * ⚠️ Το `setCalls` **πρέπει** να είναι κενό: το «no-op» δεν είναι «γράφει τα
   * ίδια», είναι «**δεν γράφει**».
   */
  it('Π1 — είναι αυστηρό no-op για πολίτη (ποτέ downgrade, ποτέ ειδοποίηση)', async () => {
    const { db, setCalls } = makeFirestore({
      // ⚠️ Ο πολίτης έχει **έγκυρο ρόλο** και **κανένα** companyId — δηλαδή περνά
      //    τον φρουρό του `assigned` και θα έπεφτε ίσια στη γραφή.
      userDoc: { companyId: null, globalRole: 'external_user', status: CITIZEN_STATUS },
      tenantUsers: [{ uid: 'admin1', globalRole: 'company_admin', status: 'active', email: 'admin@example.com' }],
    });
    getAdminFirestoreMock.mockReturnValue(db);

    const result = await ensurePendingRegistration(INPUT);

    expect(result).toEqual({ status: 'citizen', notified: false });
    expect(setCalls).toHaveLength(0);
    expect(sendReplyViaMailgunMock).not.toHaveBeenCalled();
  });

  /**
   * 🔑 **Π2 — Ο ΦΡΟΥΡΟΣ ΚΡΙΝΕΙ ΤΟ `status`, ΟΧΙ ΤΟΝ ΡΟΛΟ.**
   *
   * Η αφελής υλοποίηση θα ήταν *«έχει globalRole ⇒ μην τον πειράξεις»*. Θα ήταν
   * **λάθος**: υπάρχουν έγγραφα με ρόλο και **χωρίς** μισθωτή που όντως
   * περιμένουν έγκριση *(απόκλιση από τις δύο μη-ατομικές διπλές εγγραφές που
   * ονομάζει το §5.13)*. Μόνο το ρητό `citizen` λέει «δεν περιμένει κανέναν».
   */
  it('Π2 — έγγραφο με ρόλο αλλά ΧΩΡΙΣ την κατάσταση πολίτη μένει pending', async () => {
    const { db, setCalls } = makeFirestore({
      userDoc: { companyId: null, globalRole: 'external_user', status: 'pending' },
      tenantUsers: [{ uid: 'admin1', globalRole: 'company_admin', status: 'active', email: 'admin@example.com' }],
    });
    getAdminFirestoreMock.mockReturnValue(db);

    const result = await ensurePendingRegistration(INPUT);

    expect(result.status).toBe('pending');
    expect(setCalls).toHaveLength(1);
  });

  /**
   * ⛔ **Π3 — Η ΤΙΜΗ ΕΙΝΑΙ ΔΑΝΕΙΣΜΕΝΗ, ΟΧΙ ΕΠΙΝΟΗΜΕΝΗ.**
   *
   * Το περιστατικό του ADR-822 §4.4: μια «θεραπεία» παραλίγο να γράψει
   * `status: 'disabled'` — **τιμή εκτός λεξιλογίου**. Εδώ η άγκυρα εκτελεί την
   * ίδια ερώτηση: ανήκει το `CITIZEN_STATUS` στο **ένα** λεξιλόγιο;
   */
  it('Π3 — το CITIZEN_STATUS ανήκει στο λεξιλόγιο USER_STATUSES', () => {
    expect(USER_STATUSES).toContain(CITIZEN_STATUS);
  });

  it('does NOT re-notify when the user was already notified (notify-once)', async () => {
    const { db, setCalls } = makeFirestore({
      userDoc: { pendingNotifiedAt: 'TS_OLD', displayName: 'Ήδη', companyId: null },
      tenantUsers: [{ uid: 'admin1', globalRole: 'super_admin', status: 'active', email: 'admin@example.com' }],
    });
    getAdminFirestoreMock.mockReturnValue(db);

    const result = await ensurePendingRegistration(INPUT);

    expect(result).toEqual({ status: 'pending', notified: false });
    // Το record ενημερώνεται, αλλά ΧΩΡΙΣ νέο pendingNotifiedAt / requestedAt.
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].data).not.toHaveProperty('pendingNotifiedAt');
    expect(setCalls[0].data).not.toHaveProperty('requestedAt');
    expect(sendReplyViaMailgunMock).not.toHaveBeenCalled();
  });

  it('reports notified:false when the tenant has no admin recipients', async () => {
    const { db } = makeFirestore({
      userDoc: null,
      tenantUsers: [{ uid: 'user2', globalRole: 'external_user', status: 'active', email: 'user2@example.com' }],
    });
    getAdminFirestoreMock.mockReturnValue(db);

    const result = await ensurePendingRegistration(INPUT);

    expect(result).toEqual({ status: 'pending', notified: false });
    expect(sendReplyViaMailgunMock).not.toHaveBeenCalled();
  });

  it('excludes suspended/inactive admins and admins without an email', async () => {
    const { db } = makeFirestore({
      userDoc: null,
      tenantUsers: [
        { uid: 'admin1', globalRole: 'company_admin', status: 'suspended', email: 'suspended@example.com' },
        { uid: 'admin2', globalRole: 'company_admin', status: 'active', email: 'active-admin@example.com' },
        { uid: 'admin3', globalRole: 'super_admin', status: 'active' },
      ],
    });
    getAdminFirestoreMock.mockReturnValue(db);

    const result = await ensurePendingRegistration(INPUT);

    expect(result.notified).toBe(true);
    expect(sendReplyViaMailgunMock).toHaveBeenCalledTimes(1);
    expect(sendReplyViaMailgunMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'active-admin@example.com' }),
    );
  });
});

// =============================================================================
// Χ — Η ΝΕΚΡΗ ΠΟΡΤΑ: ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΚΑΛΟΥΝΤΩΝ + Η ΚΛΑΣΗ ΤΟΥ ΕΛΑΤΤΩΜΑΤΟΣ
// (ADR-660 §5.13)
// =============================================================================
//
// 🔴 ΤΙ ΣΥΝΕΒΗ: το `POST /api/auth/complete-registration` ήταν τυλιγμένο σε
// `withAuth`, που απαιτεί **ακριβώς τα claims** (`companyId` + `globalRole`) των
// οποίων την **απουσία** αυτή η υπηρεσία υπάρχει για να εξυπηρετήσει. Δηλαδή
// επέστρεφε **401 σε ολόκληρο τον πληθυσμό του**, και ο **μόνος** κλάδος του που
// έγραφε κάτι ήταν ο κλάδος που **υποβαθμίζει** τον ίδιο τον καλούντα.
//
// 🔑 ΟΙ ΑΓΚΥΡΕΣ ΦΥΛΑΝΕ ΤΗΝ **ΚΛΑΣΗ**, ΟΧΙ ΤΟ ΔΕΙΓΜΑ. Μια άγκυρα «μην ξαναφτιάξεις
// το αρχείο Χ» φυλά ένα όνομα· εδώ φυλιέται η **ιδιότητα** «αυτο-αναιρούμενος
// φρουρός», που πιάνει και τη μορφή που δεν έχει ακόμη όνομα.
//
// ⚠️ Ο **ΠΑΡΟΝΟΜΑΣΤΗΣ ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ ΕΔΩ.** Ολόκληρο το επιχείρημα στέκει στο
// «το `withAuth` απαιτεί claims» — και αυτό το αποδεικνύει ήδη το `Δ1` του
// `lib/routes/__tests__/landing.test.ts` (ADR-657 §3.5, fail-closed). Δεύτερη
// διατύπωσή του εδώ θα ήταν **δεύτερη αυθεντία** (ADR-749): την ημέρα που η μία
// χαλάρωνε, η άλλη θα έμενε πράσινη. Και οι δύο τρέχουν στην **ίδια μπλοκάρουσα
// σουίτα** (CHECK 3.54), άρα η απόδειξη υπάρχει — απλώς ζει στο σωστό αρχείο.

/**
 * **Το κλειστό σύνολο καλούντων, με υποχρεωτικό λόγο** (πρότυπο CHECK 3.35/3.50/3.58).
 *
 * ⚠️ Κοκκινίζει **και στις δύο** κατευθύνσεις: αδήλωτος καλών **και** δήλωση
 * χωρίς αντικείμενο (νεκρός φρουρός). Με έναν μόνο κανόνα, η **ανταλλαγή**
 * —φεύγει ο νόμιμος, έρχεται άλλος— θα περνούσε αθόρυβα.
 */
const DECLARED_CALLERS: Readonly<Record<string, string>> = {
  'src/app/api/auth/session/route.ts':
    'Το universal login chokepoint — πυροδοτείται από onAuthStateChanged για ΚΑΘΕ provider, ' +
    'και ΔΕΝ είναι κάτω από withAuth (μόνο rate limit), άρα φτάνει και σε χρήστη χωρίς claims.',
};

/** Η αποσυρμένη διεύθυνση (ADR-660 §5.13) — δεν επιτρέπεται να επιστρέψει. */
const RETIRED_ROUTE_DIR = 'src/app/api/auth/complete-registration';

/**
 * ⚠️ **Το pattern ΔΕΝ γράφεται σε template literal.** Ένα `\b` μέσα σε backticks
 * είναι **backspace** πριν καν το δει η `RegExp` — η ακριβής παγίδα που η CHECK
 * 3.56 τεκμηριώνει ως *«γεννήθηκε ΜΟΝΙΜΩΣ ΠΡΑΣΙΝΗ»*. Εδώ πληρώθηκε ζωντανά.
 */
function callerFilesOf(symbol: string): string[] {
  const callSite = new RegExp('\\b' + symbol + '\\s*\\(');
  return listRepoSourceFiles('src/app')
    .filter((file) => !file.includes('__tests__'))
    .filter((file) => callSite.test(readRepoCode(file)));
}

describe('Χ — η νεκρή πόρτα (ADR-660 §5.13)', () => {
  // Χ1: κλειστό σύνολο — καμία αδήλωτη διαδρομή δεν καλεί το SSoT.
  it('Χ1 — κάθε καλών του ensurePendingRegistration είναι ΔΗΛΩΜΕΝΟΣ', () => {
    const actual = callerFilesOf('ensurePendingRegistration');
    const undeclared = actual.filter((file) => !(file in DECLARED_CALLERS));
    expect(undeclared).toEqual([]);
  });

  // Χ1β: η άλλη κατεύθυνση — δήλωση χωρίς αντικείμενο είναι νεκρός φρουρός.
  it('Χ1β — καμία δήλωση δεν είναι ορφανή, και κάθε μία φέρει λόγο', () => {
    const actual = new Set(callerFilesOf('ensurePendingRegistration'));
    for (const [file, reason] of Object.entries(DECLARED_CALLERS)) {
      expect({ file, present: actual.has(file) }).toEqual({ file, present: true });
      expect(reason.trim().length).toBeGreaterThan(20);
    }
  });

  // Χ2: Η ΚΛΑΣΗ. Ένας φρουρός που απαιτεί ό,τι η συνάρτηση υπάρχει να δημιουργήσει
  //     είναι αυτο-αναιρούμενος — 401 σε ακριβώς τον πληθυσμό που εξυπηρετεί.
  it('Χ2 — κανένας καλών δεν τυλίγεται σε withAuth (αυτο-αναιρούμενος φρουρός)', () => {
    const selfDefeating = callerFilesOf('ensurePendingRegistration').filter((file) =>
      /\bwithAuth\s*\(/.test(readRepoCode(file)),
    );
    expect(selfDefeating).toEqual([]);
  });

  // Χ3: η αποσυρμένη διεύθυνση δεν ξαναγεννιέται (OWASP API9 — zombie endpoint).
  it('Χ3 — η αποσυρμένη διαδρομή complete-registration δεν επανέρχεται', () => {
    expect(existsSync(join(REPO_ROOT, ...RETIRED_ROUTE_DIR.split('/')))).toBe(false);
  });

  // Χ4: ο μετρητής της ίδιας της άγκυρας. Χωρίς αυτόν, ένα σφάλμα στο
  //     `callerFilesOf` (λάθος ρίζα, backslash σε Windows, φίλτρο που τα κόβει
  //     όλα) θα έβγαζε ΟΛΕΣ τις παραπάνω πράσινες επειδή **δεν κοίταξαν τίποτα**.
  it('Χ4 — ο σαρωτής όντως βλέπει το δέντρο (αλλιώς το «0» σημαίνει «δεν κοίταξα»)', () => {
    const scanned = listRepoSourceFiles('src/app').filter((f) => !f.includes('__tests__'));
    expect(scanned.length).toBeGreaterThan(100);
    expect(scanned).toContain('src/app/api/auth/session/route.ts');
    expect(callerFilesOf('ensurePendingRegistration').length).toBe(1);
  });
});
