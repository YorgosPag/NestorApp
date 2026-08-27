/**
 * Άγκυρες της αλυσίδας **Κ-1** (ADR-787) — `lib/workspace/workspace-provisioning.ts`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΚΛΕΙΔΩΝΟΥΝ — ΚΑΙ ΓΙΑΤΙ ΑΥΤΟ ΚΑΙ ΟΧΙ «ΓΥΡΙΣΕ ΤΟ ΣΩΣΤΟ»
 * ─────────────────────────────────────────────────────────────────────────────
 * Το «επέστρεψε `ok`» **δεν αποδεικνύει τίποτα εδώ**: η ορθότητα αυτού του
 * αρχείου είναι η **ΣΕΙΡΑ ΤΩΝ ΓΡΑΦΩΝ**, και η λάθος σειρά επιστρέφει **επίσης**
 * `ok` — απλώς αφήνει τον άνθρωπο με χώρο που δεν μπορεί να ονομάσει, ή με άδεια
 * προς χώρο που δεν υπάρχει ακόμη.
 *
 * ⇒ Οι άγκυρες καταγράφουν **τι έγινε και με ποια σειρά** (`journal`), και
 *   κρίνουν τη **σειρά**. Ένα test που κοιτούσε μόνο την τιμή επιστροφής θα
 *   έμενε **πράσινο πάνω σε κάθε μετάθεση** των βημάτων.
 *
 * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ**: το `Κ0` αποδεικνύει ότι το ημερολόγιο **γεμίζει** στην
 * επιτυχία. Χωρίς αυτό, κάθε «δεν γράφτηκε τίποτα» θα μπορούσε να σημαίνει «το
 * όργανο δεν κατέγραψε τίποτα ποτέ» — το σχήμα «0 = κανείς δεν κοίταξε».
 *
 * @see docs/centralized-systems/reference/adrs/ADR-787-multi-organization-platform.md Κ-1
 */

/** Το ημερολόγιο πράξεων — η **σειρά** είναι το αντικείμενο της κρίσης. */
var journal: string[] = [];
var aliasOutcome: unknown = { ok: true, alias: 'domi', skeleton: 'domi' };
var existingClaims: Record<string, unknown> = {};
var companyDocThrows = false;

jest.mock('../alias-registry', () => ({
  claimAlias: jest.fn(async (companyId: string) => {
    journal.push(`alias:${companyId}`);
    if (aliasOutcome instanceof Error) throw aliasOutcome;
    return aliasOutcome;
  }),
}));

jest.mock('@/services/company-document.service', () => ({
  ensureCompanyDocument: jest.fn(async (companyId: string) => {
    journal.push(`company-doc:${companyId}`);
    if (companyDocThrows) throw new Error('boom');
    return { id: companyId };
  }),
}));

jest.mock('@/lib/auth/set-claims-with-mirror', () => ({
  setClaimsWithMirror: jest.fn(async (uid: string, claims: Record<string, unknown>) => {
    journal.push(`claims:${JSON.stringify(claims)}`);
    return { claimsUpdatedAt: 1, firestoreMirrorOk: true };
  }),
}));

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => undefined) },
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateCompanyId: jest.fn(() => 'comp_generated'),
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '<ts>' },
}));

jest.mock('@/lib/firebaseAdmin', () => ({
  isFirebaseAdminAvailable: jest.fn(() => true),
  getAdminAuth: jest.fn(() => ({
    getUser: jest.fn(async () => ({ customClaims: existingClaims })),
  })),
  getAdminFirestore: jest.fn(() => ({
    batch: () => ({
      set: (ref: { __path: string }) => { journal.push(`batch-set:${ref.__path}`); },
      commit: async () => { journal.push('batch-commit'); },
    }),
    collection: (name: string) => makeCollection(name),
  })),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

function makeCollection(name: string) {
  return {
    doc: (id: string) => ({
      __path: `${name}/${id}`,
      collection: (sub: string) => ({
        doc: (subId: string) => ({ __path: `${name}/${id}/${sub}/${subId}` }),
      }),
    }),
  };
}

import { provisionWorkspace, type ProvisioningInput } from '../workspace-provisioning';
import { isFirebaseAdminAvailable } from '@/lib/firebaseAdmin';

// ⚠️ `null` και ΟΧΙ `''` — αυτό είναι που στέλνει **όντως** η διαδρομή
//    (`actorWorkspace(actor)`, ADR-817). Το fixture έγραφε `''`, τιμή που ο
//    πραγματικός καλών **δεν παράγει**: η σουίτα δοκίμαζε μονοπάτι που δεν
//    εκτελείται. Το `''` κρατιέται ως ξεχωριστή περίπτωση στο Κ2.
const INPUT: ProvisioningInput = {
  uid: 'user_1',
  currentCompanyId: null,
  displayName: 'Δομή Τεχνική',
  requestedAlias: 'domi',
};

beforeEach(() => {
  journal = [];
  aliasOutcome = { ok: true, alias: 'domi', skeleton: 'domi' };
  existingClaims = {};
  companyDocThrows = false;
  (isFirebaseAdminAvailable as jest.Mock).mockReturnValue(true);
});

/** Πού στο ημερολόγιο συνέβη κάτι — `-1` αν δεν συνέβη ποτέ. */
const at = (prefix: string) => journal.findIndex((entry) => entry.startsWith(prefix));

describe('Κ0 — ο παρονομαστής: το όργανο ΒΛΕΠΕΙ', () => {
  it('η επιτυχία γράφει ΟΛΑ τα βήματα στο ημερολόγιο', async () => {
    const result = await provisionWorkspace(INPUT);

    expect(result).toEqual({ ok: true, companyId: 'comp_generated', alias: 'domi' });
    // Χωρίς αυτόν τον ισχυρισμό, κάθε «δεν γράφτηκε τίποτα» παρακάτω θα ήταν
    // κενό επειδή το ημερολόγιο δεν καταγράφει, όχι επειδή δεν έγινε γραφή.
    expect(at('alias:')).toBeGreaterThanOrEqual(0);
    expect(at('company-doc:')).toBeGreaterThanOrEqual(0);
    expect(at('batch-commit')).toBeGreaterThanOrEqual(0);
    expect(at('claims:')).toBeGreaterThanOrEqual(0);
  });
});

describe('Κ1 — Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ', () => {
  it('το ΟΝΟΜΑ δεσμεύεται ΠΡΙΝ γραφτεί οτιδήποτε άλλο', async () => {
    await provisionWorkspace(INPUT);
    // Αλλιώς ο άνθρωπος αποκτά χώρο και ΜΕΤΑ μαθαίνει ότι το όνομα δεν γίνεται.
    expect(at('alias:')).toBeLessThan(at('company-doc:'));
    expect(at('alias:')).toBeLessThan(at('batch-commit'));
    expect(at('alias:')).toBeLessThan(at('claims:'));
  });

  it('τα CLAIMS γράφονται ΤΕΛΕΥΤΑΙΑ — η άδεια μετά τον χώρο', async () => {
    await provisionWorkspace(INPUT);
    // Αλλιώς το token δίνει companyId προς χώρο που δεν υπάρχει ακόμη.
    expect(at('claims:')).toBeGreaterThan(at('company-doc:'));
    expect(at('claims:')).toBeGreaterThan(at('batch-commit'));
    expect(at('claims:')).toBe(journal.length - 1);
  });

  it('η συμμετοχή και το προφίλ φεύγουν σε ΜΙΑ δέσμη, όχι σε τρεις γραφές', async () => {
    await provisionWorkspace(INPUT);
    const sets = journal.filter((e) => e.startsWith('batch-set:'));
    expect(sets).toEqual([
      'batch-set:companies/comp_generated',
      'batch-set:companies/comp_generated/workspace_members/user_1',
      'batch-set:users/user_1',
    ]);
    expect(journal.filter((e) => e === 'batch-commit')).toHaveLength(1);
  });
});

describe('Κ2 — Ο ΦΡΟΥΡΟΣ: ένας χώρος ανά άνθρωπο', () => {
  it('όποιος έχει ήδη χώρο απορρίπτεται ΧΩΡΙΣ ΚΑΜΙΑ γραφή', async () => {
    const result = await provisionWorkspace({ ...INPUT, currentCompanyId: 'comp_existing' });

    expect(result).toEqual({ ok: false, reason: 'already-has-workspace' });
    // Το Κ0 απέδειξε ότι το ημερολόγιο γεμίζει· άρα το κενό εδώ σημαίνει κάτι.
    expect(journal).toEqual([]);
  });

  // 🔴 Η ΑΛΛΗ ΠΛΕΥΡΑ ΤΟΥ ΦΡΟΥΡΟΥ, ΚΑΙ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΥΠΑΡΧΕΙ Η ΟΘΟΝΗ Κ-1:
  //    ο άνθρωπος **χωρίς** χώρο πρέπει να ΠΕΡΝΑΕΙ. Μέχρι τις 2026-08-27 δεν
  //    περνούσε ποτέ — όχι εδώ, αλλά στο σύνορο (`withAuth` → 401 σε κάθε
  //    `scope: 'personal'`), δηλαδή σε στρώμα που **αυτή η σουίτα δεν βλέπει**.
  //    Ο ισχυρισμός μένει ως δήλωση της αναμενόμενης εισόδου· το σύνορο το
  //    φυλά το `lib/auth/__tests__/personal-scope-consumers.test.ts`.
  it('ΤΟ null ΠΕΡΝΑΕΙ — ο πολίτης είναι ο κύριος πληθυσμός, όχι η εξαίρεση', async () => {
    await expect(provisionWorkspace({ ...INPUT, currentCompanyId: null })).resolves.toEqual({
      ok: true,
      companyId: 'comp_generated',
      alias: 'domi',
    });
  });

  // ⚠️ Ο έλεγχος είναι ΠΑΡΟΥΣΙΑΣ: η κενή συμβολοσειρά δεν είναι χώρος. Χωρίς
  //    αυτό, μια μετατροπή του `if (x)` σε `if (x !== null)` θα έμενε πράσινη.
  it('η ΚΕΝΗ συμβολοσειρά διαβάζεται ως «δεν έχει χώρο», ταυτόσημα με το null', async () => {
    await expect(provisionWorkspace({ ...INPUT, currentCompanyId: '' })).resolves.toEqual({
      ok: true,
      companyId: 'comp_generated',
      alias: 'domi',
    });
  });
});

describe('Κ3 — ΑΠΟΡΡΙΨΗ ΟΝΟΜΑΤΟΣ: τίποτα δεν προσγειώνεται', () => {
  it.each([
    ['already-taken'],
    ['reserved'],
    ['mixed-script'],
  ])('«%s» ⇒ καμία εταιρεία, καμία συμμετοχή, κανένα claim', async (reason) => {
    aliasOutcome = { ok: false, reason };

    const result = await provisionWorkspace(INPUT);

    expect(result).toEqual({ ok: false, reason });
    expect(at('company-doc:')).toBe(-1);
    expect(at('batch-commit')).toBe(-1);
    expect(at('claims:')).toBe(-1);
  });

  it('το μητρώο που ΡΙΧΝΕΙ γίνεται «registry-unavailable», ΟΧΙ «already-taken»', async () => {
    // ⚠️ Οι δύο δεν ενώνονται: η πρώτη λέει «δοκίμασε ξανά», η δεύτερη «διάλεξε
    //    άλλο». Ένα κοινό «απέτυχε» βάζει τον άνθρωπο να ξαναγράφει όνομα που
    //    ήταν μια χαρά.
    aliasOutcome = new Error('registry down');

    await expect(provisionWorkspace(INPUT)).resolves.toEqual({
      ok: false,
      reason: 'registry-unavailable',
    });
  });

  it('χωρίς Firebase Admin: καμία γραφή, και ΔΕΝ λέγεται «already-taken»', async () => {
    (isFirebaseAdminAvailable as jest.Mock).mockReturnValue(false);

    const result = await provisionWorkspace(INPUT);

    expect(result).toEqual({ ok: false, reason: 'registry-unavailable' });
    expect(journal).toEqual([]);
  });
});

describe('Κ4 — ΤΑ CLAIMS: ό,τι υπήρχε ΔΙΑΤΗΡΕΙΤΑΙ', () => {
  it('το mfaEnrolled ΕΠΙΖΕΙ — η δημιουργία χώρου δεν σβήνει τον δεύτερο παράγοντα', async () => {
    // 🔴 Το `setClaimsWithMirror` ΔΕΝ κάνει merge (το δηλώνει ρητά). Χωρίς
    //    διατήρηση, το να φτιάξεις γραφείο θα απενεργοποιούσε σιωπηλά το 2FA.
    existingClaims = { mfaEnrolled: true, somethingElse: 'x' };

    await provisionWorkspace(INPUT);

    const written = JSON.parse(journal.find((e) => e.startsWith('claims:'))!.slice('claims:'.length));
    expect(written).toEqual({
      mfaEnrolled: true,
      somethingElse: 'x',
      companyId: 'comp_generated',
      globalRole: 'company_admin',
    });
  });

  it('ΔΕΝ γράφεται emailVerified — το κατέχει το Firebase Auth', async () => {
    await provisionWorkspace(INPUT);

    const written = JSON.parse(journal.find((e) => e.startsWith('claims:'))!.slice('claims:'.length));
    expect(written).not.toHaveProperty('emailVerified');
    expect(written.globalRole).toBe('company_admin');
  });
});

describe('Κ5 — ΣΠΑΣΜΕΝΗ ΑΛΥΣΙΔΑ: η άδεια δεν δίνεται', () => {
  it('αν σκάσει το έγγραφο του χώρου, ΔΕΝ γράφονται claims', async () => {
    companyDocThrows = true;

    const result = await provisionWorkspace(INPUT);

    expect(result).toEqual({ ok: false, reason: 'failed' });
    expect(at('claims:')).toBe(-1);
    // Το όνομα ΜΕΝΕΙ δεσμευμένο σε αυτή την ταυτότητα — εκεί ζει η idempotency
    // της επανάληψης (δες την κεφαλίδα του module).
    expect(at('alias:')).toBeGreaterThanOrEqual(0);
  });
});
