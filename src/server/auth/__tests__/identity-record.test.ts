/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΠΡΟΦΙΛ ΤΑΥΤΟΤΗΤΑΣ** (ADR-853 Φ1 · ADR-660 §5.13 · ADR-844).
 * @related server/auth/identity-record.ts
 *
 * - **Α** — η γραφή: ταυτότητα, **και τίποτα άλλο**.
 * - **Δ** — 🔴 **Η ΚΛΑΣΗ**: η σύνδεση δεν αγγίζει **ούτε** αίτημα **ούτε** σταθερή εταιρεία
 *   **ούτε** ταχυδρομείο. Χωρίς αυτό, η επαναφορά του περιστατικού της 2026-09-11 θα περνούσε πράσινη.
 * - **Π** — τα δύο no-op (ήδη μέλος · πολίτης) και το λεξιλόγιο.
 * - **Χ** — η νεκρή πόρτα: κλειστό σύνολο καλούντων, φρουρός που δεν αυτοαναιρείται.
 *
 * Το Admin SDK είναι mocked — ο έλεγχος είναι καθαρά στη λογική της μονάδας.
 */

jest.mock('server-only', () => ({}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'TS' },
}));

const getAdminFirestoreMock = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => getAdminFirestoreMock(),
}));

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ensureIdentityRecord } from '../identity-record';
import { CITIZEN_STATUS } from '../citizen-identity';
import { USER_STATUSES } from '@/auth/types/auth.types';
import { COLLECTIONS } from '@/config/firestore-collections';
import { REPO_ROOT, listRepoSourceFiles, readRepoCode } from '@/test-utils/read-source';

// =============================================================================
// HARNESS
// =============================================================================

interface SetCall { data: Record<string, unknown>; options: unknown }

/**
 * ⚠️ Το `collectionsTouched` **δεν είναι διακοσμητικό**: είναι ο μόνος τρόπος να
 * αποδειχθεί ότι η σύνδεση **δεν ακουμπά** τη συλλογή των αιτημάτων. Μια άγκυρα
 * που μετρά μόνο γραφές θα έμενε πράσινη αν κάποιος ξαναέβαζε **ανάγνωση**
 * αιτήματος — δηλαδή το πρώτο μισό του περιστατικού.
 */
function makeFirestore(opts: { userDoc: Record<string, unknown> | null }): {
  db: unknown;
  setCalls: SetCall[];
  collectionsTouched: string[];
} {
  const setCalls: SetCall[] = [];
  const collectionsTouched: string[] = [];
  const userRef = { __kind: 'userRef' };

  const db = {
    collection: (name: string) => {
      collectionsTouched.push(name);
      return { doc: () => userRef, where: () => { throw new Error('no query expected'); } };
    },
    runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async () => ({ exists: opts.userDoc !== null, data: () => opts.userDoc }),
        set: (_ref: unknown, data: Record<string, unknown>, options: unknown) => {
          setCalls.push({ data, options });
        },
        create: () => { throw new Error('no create expected'); },
        update: () => { throw new Error('no update expected'); },
      };
      return cb(tx);
    },
  };

  return { db, setCalls, collectionsTouched };
}

const INPUT = { uid: 'uid_new', email: 'newuser@example.com', displayName: 'Νέος', authProvider: 'google.com' };

const MODULE_PATH = 'src/server/auth/identity-record.ts';

beforeEach(() => {
  jest.clearAllMocks();
});

// =============================================================================
// Α — Η ΓΡΑΦΗ
// =============================================================================

describe('Α — η γραφή είναι ταυτότητα, και τίποτα άλλο', () => {
  it('Α1 — νέος άνθρωπος ⇒ προφίλ ΧΩΡΙΣ claims, ΧΩΡΙΣ status, ΧΩΡΙΣ αίτημα', async () => {
    const { db, setCalls, collectionsTouched } = makeFirestore({ userDoc: null });
    getAdminFirestoreMock.mockReturnValue(db);

    expect(await ensureIdentityRecord(INPUT)).toEqual({ status: 'identity' });
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].data).toMatchObject({ companyId: null, globalRole: null, uid: 'uid_new' });

    // 🔴 Άγκυρες ΑΠΟΥΣΙΑΣ — το `toMatchObject` αγνοεί ό,τι δεν ονομάζει, οπότε χωρίς
    //    αυτές η επιστροφή των πεδίων θα περνούσε **πράσινη** (ADR-660 · ADR-749).
    expect(setCalls[0].data).not.toHaveProperty('status');
    expect(setCalls[0].data).not.toHaveProperty('registrationStatus');
    expect(setCalls[0].data).not.toHaveProperty('pendingNotifiedAt');

    // 🔴 **ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΤΗΣ 2026-09-11**: καμία επαφή με τη συλλογή των αιτημάτων.
    expect(collectionsTouched).toEqual([COLLECTIONS.USERS]);
    expect(collectionsTouched).not.toContain(COLLECTIONS.WORKSPACE_ACCESS_REQUESTS);
  });

  it('Α2 — υπάρχον προφίλ ⇒ καμία δεύτερη `createdAt` (ιδεμποτησία)', async () => {
    const { db, setCalls } = makeFirestore({ userDoc: { displayName: 'Ήδη', companyId: null } });
    getAdminFirestoreMock.mockReturnValue(db);

    expect(await ensureIdentityRecord(INPUT)).toEqual({ status: 'identity' });
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].data).not.toHaveProperty('createdAt');
  });
});

// =============================================================================
// Δ — Η ΚΛΑΣΗ ΤΟΥ ΕΛΑΤΤΩΜΑΤΟΣ (ADR-853 §1)
// =============================================================================
//
// 🔴 ΤΙ ΣΥΝΕΒΗ: η σύνδεση ενός ανθρώπου άνοιγε αίτημα ένταξης προς εταιρεία που
// **κανείς δεν επέλεξε** — γιατί η μονάδα ρωτούσε το `getCompanyId()`, που
// επιστρέφει **πάντα** την ίδια εταιρεία. Η συμπεριφορά ήταν σωστή όσο η
// πλατφόρμα είχε **έναν** χώρο, και έγινε ελάττωμα τη μέρα που απέκτησε δεύτερο.
//
// 🔑 Η ΑΓΚΥΡΑ ΦΥΛΑΕΙ ΤΗΝ **ΙΔΙΟΤΗΤΑ**, ΟΧΙ ΤΟ ΔΕΙΓΜΑ: όχι «μην ξανακαλέσεις τη
// συνάρτηση Χ», αλλά «**αυτή η διαδρομή δεν έχει δουλειά με σταθερό μισθωτή ούτε
// με ταχυδρομείο**». Έτσι πιάνει και τη μορφή που δεν έχει ακόμη όνομα.

describe('Δ — η σύνδεση δεν αποδίδει κανέναν σε κανέναν', () => {
  const FORBIDDEN: ReadonlyArray<readonly [string, string]> = [
    ['getCompanyId', 'σταθερή εταιρεία — ακριβώς το περιστατικό της 2026-09-11 (ADR-853 §1)'],
    ['TENANT_COMPANY_ID', 'η ίδια σταθερά, από την άλλη πόρτα'],
    ['workspace-access-request', 'το αίτημα ένταξης ΠΑΓΩΣΕ — κανείς δεν το ανοίγει αυτόματα (ADR-853 Α4)'],
    ['mailgun', 'καμία ειδοποίηση: δεν υπάρχει άνθρωπος που να έχει κάτι να κρίνει'],
    ['email-templates', 'ούτε πρότυπο μηνύματος — η σύνδεση δεν στέλνει τίποτα σε κανέναν'],
  ];

  it('Δ1 — το SSoT ταυτότητας δεν αναφέρει σταθερή εταιρεία, αίτημα ή ταχυδρομείο', () => {
    const source = readRepoCode(MODULE_PATH);
    // Παρονομαστής: αν η ανάγνωση αποτύχει, το «κανένα εύρημα» σημαίνει «δεν κοίταξα».
    expect(source.length).toBeGreaterThan(500);
    expect(source).toContain('ensureIdentityRecord');

    const present = FORBIDDEN.filter(([needle]) => source.includes(needle)).map(([needle]) => needle);
    expect(present).toEqual([]);
  });

  it('Δ1β — κάθε απαγόρευση φέρει γραμμένο λόγο (δήλωση χωρίς λόγο = παράκαμψη με άλλο όνομα)', () => {
    for (const [needle, why] of FORBIDDEN) {
      expect({ needle, explained: why.trim().length > 20 }).toEqual({ needle, explained: true });
    }
  });
});

// =============================================================================
// Π — ΤΑ ΔΥΟ NO-OP ΚΑΙ ΤΟ ΛΕΞΙΛΟΓΙΟ
// =============================================================================

describe('Π — ποτέ υποβάθμιση', () => {
  it('Π0 — ήδη μέλος χώρου ⇒ αυστηρό no-op', async () => {
    const { db, setCalls } = makeFirestore({
      userDoc: { companyId: 'comp_EXISTING', globalRole: 'internal_user' },
    });
    getAdminFirestoreMock.mockReturnValue(db);

    expect(await ensureIdentityRecord(INPUT)).toEqual({ status: 'assigned' });
    expect(setCalls).toHaveLength(0);
  });

  /**
   * 🔴 **Π1 — Ο ΠΟΛΙΤΗΣ ΔΕΝ ΥΠΟΒΑΘΜΙΖΕΤΑΙ** (ADR-844).
   *
   * Ο πολίτης έχει **έγκυρο ρόλο** και **κανένα** `companyId` — δηλαδή περνά τον
   * φρουρό του `assigned` και θα έπεφτε ίσια στη γραφή. ⚠️ Το «no-op» δεν είναι
   * «γράφει τα ίδια», είναι «**δεν γράφει**».
   */
  it('Π1 — πολίτης ⇒ αυστηρό no-op (ποτέ downgrade)', async () => {
    const { db, setCalls } = makeFirestore({
      userDoc: { companyId: null, globalRole: 'external_user', status: CITIZEN_STATUS },
    });
    getAdminFirestoreMock.mockReturnValue(db);

    expect(await ensureIdentityRecord(INPUT)).toEqual({ status: 'citizen' });
    expect(setCalls).toHaveLength(0);
  });

  /**
   * 🔑 **Π2 — Ο ΦΡΟΥΡΟΣ ΚΡΙΝΕΙ ΤΟ `status`, ΟΧΙ ΤΟΝ ΡΟΛΟ.**
   *
   * Η αφελής υλοποίηση θα ήταν *«έχει globalRole ⇒ μην τον πειράξεις»*. Θα ήταν
   * **λάθος**: υπάρχουν έγγραφα με ρόλο και **χωρίς** χώρο. Μόνο το ρητό `citizen`
   * λέει «η ταυτότητά του είναι ήδη αποφασισμένη».
   */
  it('Π2 — έγγραφο με ρόλο αλλά ΧΩΡΙΣ την κατάσταση πολίτη ⇒ γράφεται ταυτότητα', async () => {
    const { db, setCalls } = makeFirestore({ userDoc: { companyId: null, globalRole: 'external_user' } });
    getAdminFirestoreMock.mockReturnValue(db);

    expect(await ensureIdentityRecord(INPUT)).toEqual({ status: 'identity' });
    expect(setCalls).toHaveLength(1);
  });

  /**
   * ⛔ **Π3 — Η ΤΙΜΗ ΕΙΝΑΙ ΔΑΝΕΙΣΜΕΝΗ, ΟΧΙ ΕΠΙΝΟΗΜΕΝΗ** (περιστατικό ADR-822 §4.4).
   */
  it('Π3 — το CITIZEN_STATUS ανήκει στο λεξιλόγιο· το `pending` έχει φύγει', () => {
    expect(USER_STATUSES).toContain(CITIZEN_STATUS);
    expect(USER_STATUSES).not.toContain('pending');
  });
});

// =============================================================================
// Χ — Η ΝΕΚΡΗ ΠΟΡΤΑ: ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΚΑΛΟΥΝΤΩΝ (ADR-660 §5.13)
// =============================================================================
//
// 🔴 ΤΙ ΣΥΝΕΒΗ: το `POST /api/auth/complete-registration` ήταν τυλιγμένο σε
// `withAuth`, που απαιτεί **ακριβώς τα claims** των οποίων την **απουσία** αυτή η
// υπηρεσία υπάρχει για να εξυπηρετήσει — δηλαδή επέστρεφε **401 σε ολόκληρο τον
// πληθυσμό του**.
//
// ⚠️ Ο **ΠΑΡΟΝΟΜΑΣΤΗΣ ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ ΕΔΩ**: το «το `withAuth` απαιτεί claims»
// το αποδεικνύει ήδη το `Δ1` του `lib/routes/__tests__/landing.test.ts`. Δεύτερη
// διατύπωση θα ήταν δεύτερη αυθεντία (ADR-749).

const DECLARED_CALLERS: Readonly<Record<string, string>> = {
  'src/app/api/auth/session/route.ts':
    'Το universal login chokepoint — πυροδοτείται από onAuthStateChanged για ΚΑΘΕ provider, ' +
    'και ΔΕΝ είναι κάτω από withAuth (μόνο rate limit), άρα φτάνει και σε άνθρωπο χωρίς claims.',
};

/** Η αποσυρμένη διεύθυνση (ADR-660 §5.13) — δεν επιτρέπεται να επιστρέψει. */
const RETIRED_ROUTE_DIR = 'src/app/api/auth/complete-registration';

/**
 * ⚠️ **Το pattern ΔΕΝ γράφεται σε template literal.** Ένα `\b` μέσα σε backticks
 * είναι **backspace** πριν καν το δει η `RegExp` — η ακριβής παγίδα που η CHECK
 * 3.56 τεκμηριώνει ως *«γεννήθηκε ΜΟΝΙΜΩΣ ΠΡΑΣΙΝΗ»*.
 */
function callerFilesOf(symbol: string): string[] {
  const callSite = new RegExp('\\b' + symbol + '\\s*\\(');
  return listRepoSourceFiles('src/app')
    .filter((file) => !file.includes('__tests__'))
    .filter((file) => callSite.test(readRepoCode(file)));
}

describe('Χ — η νεκρή πόρτα (ADR-660 §5.13)', () => {
  it('Χ1 — κάθε καλών του ensureIdentityRecord είναι ΔΗΛΩΜΕΝΟΣ', () => {
    const undeclared = callerFilesOf('ensureIdentityRecord').filter((file) => !(file in DECLARED_CALLERS));
    expect(undeclared).toEqual([]);
  });

  it('Χ1β — καμία δήλωση δεν είναι ορφανή, και κάθε μία φέρει λόγο', () => {
    const actual = new Set(callerFilesOf('ensureIdentityRecord'));
    for (const [file, reason] of Object.entries(DECLARED_CALLERS)) {
      expect({ file, present: actual.has(file) }).toEqual({ file, present: true });
      expect(reason.trim().length).toBeGreaterThan(20);
    }
  });

  it('Χ2 — κανένας καλών δεν τυλίγεται σε withAuth (αυτο-αναιρούμενος φρουρός)', () => {
    const selfDefeating = callerFilesOf('ensureIdentityRecord').filter((file) =>
      /\bwithAuth\s*\(/.test(readRepoCode(file)),
    );
    expect(selfDefeating).toEqual([]);
  });

  it('Χ3 — η αποσυρμένη διαδρομή complete-registration δεν επανέρχεται', () => {
    expect(existsSync(join(REPO_ROOT, ...RETIRED_ROUTE_DIR.split('/')))).toBe(false);
  });

  /**
   * Χ4 — ο μετρητής της ίδιας της άγκυρας. Χωρίς αυτόν, ένα σφάλμα στο
   * `callerFilesOf` θα έβγαζε **όλες** τις παραπάνω πράσινες επειδή **δεν κοίταξαν τίποτα**.
   */
  it('Χ4 — ο σαρωτής όντως βλέπει το δέντρο (αλλιώς το «0» σημαίνει «δεν κοίταξα»)', () => {
    const scanned = listRepoSourceFiles('src/app').filter((f) => !f.includes('__tests__'));
    expect(scanned.length).toBeGreaterThan(100);
    expect(scanned).toContain('src/app/api/auth/session/route.ts');
    expect(callerFilesOf('ensureIdentityRecord')).toHaveLength(1);
  });

  /**
   * 🔴 Χ5 — **Η ΠΑΛΙΑ ΠΟΡΤΑ ΔΕΝ ΞΑΝΑΓΕΝΝΙΕΤΑΙ.** Το `ensurePendingRegistration`
   * δεν είναι «μετονομασία»: ήταν η συνάρτηση που **άνοιγε αίτημα** σε σταθερή
   * εταιρεία. Αν επανεμφανιστεί το όνομα, κάποιος επανέφερε τη ροή.
   */
  it('Χ5 — το ensurePendingRegistration δεν υπάρχει πουθενά στο src/app', () => {
    expect(callerFilesOf('ensurePendingRegistration')).toEqual([]);
  });
});
