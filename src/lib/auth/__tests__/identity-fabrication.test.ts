/**
 * ΑΓΚΥΡΕΣ — **Η ΑΥΘΕΝΤΙΑ ΤΗΣ ΚΑΤΑΣΚΕΥΑΣΜΕΝΗΣ ΤΑΥΤΟΤΗΤΑΣ** (ADR-821)
 *
 * `npx jest src/lib/auth/__tests__/identity-fabrication.test.ts`
 *
 * ⚠️ **ΚΑΜΙΑ ΑΓΚΥΡΑ ΔΕΝ ΨΑΧΝΕΙ ΟΝΟΜΑ** — μετρημένο δύο φορές (26 & 27/08) ότι
 * μετάλλαξη **επιβιώνει** όταν η άγκυρα ελέγχει ότι ένα σύμβολο υπάρχει αντί για
 * το τι **κάνει**. Εδώ **εκτελείται** ο κριτής και ελέγχεται η **ετυμηγορία**.
 *
 * 🔑 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΣΕ ΚΑΘΕ ΟΜΑΔΑ**: κάθε άρνηση συνοδεύεται από την απόδειξη
 * ότι το **ίδιο** σενάριο **χωρίς** τον έναν παράγοντα δίνει `granted` — αλλιώς
 * ένα «⛔ πάντα» θα ήταν πράσινο για λάθος λόγο.
 */

/**
 * Παράκαμψη **μόνο** της πολιτικής, για την Κ1.5 — το υπόλοιπο αρχείο τρέχει τον
 * **πραγματικό** πίνακα. `mock`-πρόθεμα: απαίτηση του hoisting του `jest.mock`.
 */
let mockPolicyOverride: { allowDevBypass: boolean } | null = null;

jest.mock('@/config/environment-security-config', () => {
  const actual = jest.requireActual('@/config/environment-security-config');
  return {
    ...actual,
    getCurrentSecurityPolicy: () => mockPolicyOverride ?? actual.getCurrentSecurityPolicy(),
  };
});

import {
  decideIdentityFabrication,
  FABRICATED_PRINCIPAL,
  type FabricationVerdict,
} from '../identity-fabrication';
import { isValidGlobalRole } from '../types';

// =============================================================================
// ΤΟ ΠΕΡΙΒΑΛΛΟΝ — αποκαθίσταται πάντα (οι μεταβλητές είναι καθολικές)
// =============================================================================

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST;

/** `NODE_ENV` είναι readonly στους τύπους του Node· η ανάθεση είναι σκόπιμη. */
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

/** Η κατάσταση όπου η κατασκευή **επιτρέπεται** — η αφετηρία κάθε πειράματος. */
function grantingWorld(): void {
  setNodeEnv('development');
  setEmulator(undefined);
  mockPolicyOverride = null;
}

beforeEach(grantingWorld);

afterAll(() => {
  setNodeEnv(ORIGINAL_NODE_ENV);
  setEmulator(ORIGINAL_EMULATOR);
});

const verdictOf = (): FabricationVerdict => decideIdentityFabrication().verdict;

// =============================================================================
// Κ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΩΝ ΙΔΙΩΝ ΤΩΝ ΑΓΚΥΡΩΝ
// =============================================================================

describe('Κ0 — ο παρονομαστής: υπάρχει κόσμος όπου η κατασκευή ΕΠΙΤΡΕΠΕΤΑΙ', () => {
  it('Κ0.1 — `development` χωρίς emulator ⇒ granted', () => {
    expect(verdictOf()).toBe('granted-development-fallback');
  });

  it('Κ0.2 — ο επιτρεπτικός κλάδος ΚΟΥΒΑΛΑΕΙ την αρχή, δεν την υπόσχεται', () => {
    const decision = decideIdentityFabrication();

    // ⚠️ Η διάκριση ελέγχεται **μέσω του τύπου**: ο αρνητικός κλάδος δεν έχει
    //    `principal`. Αν κάποιος τους ενοποιήσει, αυτό σπάει.
    if (decision.verdict !== 'granted-development-fallback') {
      throw new Error(`αναμενόταν granted, ήρθε ${decision.verdict}`);
    }
    expect(decision.principal).toBe(FABRICATED_PRINCIPAL);
  });
});

// =============================================================================
// Κ1 — ΤΟ ΑΓΝΩΣΤΟ ΠΕΡΙΒΑΛΛΟΝ (ADR-821 §2.3, §4.2)
// =============================================================================

describe('Κ1 — άγνωστο NODE_ENV είναι ΟΝΟΜΑΣΜΕΝΗ άρνηση, όχι σιωπηλό development', () => {
  it.each([
    ['κενό', ''],
    ['λάθος γραμμένο', 'develpment'],
    ['απόν', undefined],
    ['σκουπίδι', 'DEVELOPMENT'],
  ])('Κ1.%# — NODE_ENV %s ⇒ denied-unknown-environment', (_label, value) => {
    setNodeEnv(value as string | undefined);
    expect(verdictOf()).toBe('denied-unknown-environment');
  });

  /**
   * 🔴 **ΤΟ ΚΑΡΔΙΑΚΟ ΤΗΣ ΑΠΟΦΑΣΗΣ** (ADR-821 §4.2): η σειρά (1)→(2).
   *
   * Η `getCurrentSecurityPolicy()` **λύνει** το άγνωστο `NODE_ENV` ως
   * `development`, άρα θα απαντούσε `allowDevBypass: true`. Αν το βήμα της
   * πολιτικής έτρεχε **πρώτο**, το άγνωστο περιβάλλον θα περνούσε — και θα ήταν
   * **αόρατο**, γιατί θα έμοιαζε με σωστή ανάγνωση SSoT.
   *
   * Αυτό εδώ αποδεικνύει ότι ο έλεγχος περιβάλλοντος **προηγείται**: η άρνηση
   * ονομάζει το περιβάλλον, **όχι** την πολιτική.
   */
  it('Κ1.4 — η άρνηση ονομάζει το ΠΕΡΙΒΑΛΛΟΝ, όχι την πολιτική', () => {
    setNodeEnv('');
    const decision = decideIdentityFabrication();
    expect(decision.verdict).toBe('denied-unknown-environment');
    expect(decision.verdict).not.toBe('denied-by-policy');
  });

  /**
   * 🔒 **Η ΑΓΚΥΡΑ ΤΗΣ ΣΕΙΡΑΣ — ΚΑΙ ΓΙΑΤΙ ΧΡΕΙΑΣΤΗΚΕ ΜΟΧΛΟΣ**
   *
   * 🔴 **ΜΕΤΡΗΜΕΝΟ 2026-08-27**: μετάλλαξη που **μετακίνησε** τον έλεγχο
   * περιβάλλοντος **μετά** την πολιτική **ΕΠΕΖΗΣΕ** — και **σωστά**. Με τον
   * **σημερινό** πίνακα πολιτικών οι δύο σειρές **συμφωνούν**: το άγνωστο
   * `NODE_ENV` λύνεται σε `development`, του οποίου το `allowDevBypass` είναι
   * `true`, άρα η πολιτική **δεν αρνείται ποτέ** εκεί.
   *
   * ⚠️ **Άρα η σειρά είναι σήμερα ΑΠΑΡΑΤΗΡΗΤΗ — και θα πάψει να είναι** την ώρα
   * που κάποιος γράψει `development.allowDevBypass: false`. Τότε η λάθος σειρά θα
   * ανέφερε *«η πολιτική το απαγορεύει»* ενώ η αλήθεια είναι *«δεν ξέρω πού
   * τρέχω»* — και ο προγραμματιστής θα κυνηγούσε **λάθος αιτία**.
   *
   * 🔑 Αυτή η άγκυρα **στήνει ακριβώς εκείνο τον κόσμο** και κλειδώνει τη σειρά
   * **πριν** τη χρειαστεί κανείς. *(Χωρίς τον μοχλό θα ήταν σχόλιο, όχι άγκυρα.)*
   */
  it('Κ1.5 — με ΑΡΝΗΤΙΚΗ πολιτική, το άγνωστο περιβάλλον μιλά ΠΡΩΤΟ', () => {
    mockPolicyOverride = { allowDevBypass: false };
    setNodeEnv('');

    expect(verdictOf()).toBe('denied-unknown-environment');
  });

  it('Κ1.6 — ο παρονομαστής του Κ1.5: ΓΝΩΣΤΟ περιβάλλον + ίδια πολιτική ⇒ denied-by-policy', () => {
    mockPolicyOverride = { allowDevBypass: false };
    setNodeEnv('development');

    expect(verdictOf()).toBe('denied-by-policy');
  });
});

// =============================================================================
// Κ2 — Η ΠΟΛΙΤΙΚΗ ΠΟΥ ΚΟΙΜΟΤΑΝ (ADR-821 §2.4)
// =============================================================================

describe('Κ2 — ο αδρανής φρουρός `allowDevBypass` ξύπνησε', () => {
  it.each([
    ['production', 'denied-by-policy'],
    ['staging', 'denied-by-policy'],
    ['test', 'denied-by-policy'],
  ] as const)('Κ2.%# — %s ⇒ %s', (env, expected) => {
    setNodeEnv(env);
    expect(verdictOf()).toBe(expected);
  });

  /**
   * 🔒 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ Κ2**: τα παραπάνω θα ήταν πράσινα και με έναν κριτή
   * που λέει «⛔ σε ό,τι δεν είναι development» **χωρίς** να ρωτά την πολιτική.
   * Η διάκριση φαίνεται **μόνο** στο ότι το `development` — που η πολιτική του
   * δηλώνει `allowDevBypass: true` — περνά.
   */
  it('Κ2.3 — και ο παρονομαστής: μόνο το development περνά την πολιτική', () => {
    setNodeEnv('development');
    expect(verdictOf()).toBe('granted-development-fallback');
  });
});

// =============================================================================
// Κ3 — Η ΠΡΩΤΟΤΥΠΙΑ: «ΕΠΙΤΡΕΠΕΤΑΙ» ≠ «ΧΡΕΙΑΖΕΤΑΙ» (ADR-821 §3.1α)
// =============================================================================

describe('Κ3 — όταν υπάρχουν ΑΛΗΘΙΝΑ πιστοποιητικά, η κατασκευή αρνείται τον εαυτό της', () => {
  it('Κ3.1 — emulator σε λειτουργία ⇒ denied-real-credentials-available', () => {
    setEmulator('localhost:9099');
    expect(verdictOf()).toBe('denied-real-credentials-available');
  });

  it('Κ3.2 — ο παρονομαστής: ΙΔΙΟ περιβάλλον, χωρίς emulator ⇒ granted', () => {
    setEmulator(undefined);
    expect(verdictOf()).toBe('granted-development-fallback');
  });

  it('Κ3.3 — κενή/λευκή τιμή ΔΕΝ μετρά ως «τρέχει» (πρότυπο extractCustomClaims)', () => {
    setEmulator('   ');
    expect(verdictOf()).toBe('granted-development-fallback');
  });

  /**
   * ⚠️ Η σειρά (2)→(3): σε `production` **με** emulator, η άρνηση πρέπει να είναι
   * της **πολιτικής** — αλλιώς ένα λάθος περιβάλλον θα κρυβόταν πίσω από ένα
   * καλοήθες «υπάρχουν αληθινά πιστοποιητικά».
   */
  it('Κ3.4 — production ΜΕ emulator ⇒ η πολιτική μιλά πρώτη', () => {
    setNodeEnv('production');
    setEmulator('localhost:9099');
    expect(verdictOf()).toBe('denied-by-policy');
  });
});

// =============================================================================
// Κ4 — Η ΜΙΑ ΤΑΥΤΟΤΗΤΑ, ΚΑΙ Η ΚΛΙΜΑΚΩΣΗ ΠΟΥ ΕΦΥΓΕ (ADR-821 §4.3)
// =============================================================================

describe('Κ4 — η κατασκευασμένη αρχή δεν κλιμακώνει', () => {
  it('Κ4.1 — ο ρόλος της είναι ΓΝΩΣΤΟΣ στο λεξιλόγιο (ποτέ ξανά το «admin»)', () => {
    // 🔴 Το `'admin'` ήταν **εκτός** `GLOBAL_ROLES` — η ακριβής τιμή που γέννησε το
    //    `denied-unknown-role` του ADR-801 §4.3, και που ζει στην παραγωγή.
    expect(isValidGlobalRole(FABRICATED_PRINCIPAL.globalRole)).toBe(true);
    expect(isValidGlobalRole('admin')).toBe(false);
  });

  it('Κ4.2 — ΠΟΤΕ super_admin: η κατασκευή δεν φτάνει στον ανώτατο ρόλο', () => {
    expect(FABRICATED_PRINCIPAL.globalRole).not.toBe('super_admin');
  });

  it('Κ4.3 — ΠΟΤΕ ικανοποιημένο MFA (ADR-821 §2.8)', () => {
    // Το `permissions.ts` κρίνει πάνω σε αυτό το πεδίο. Κατασκευασμένο `true` =
    // δεύτερος παράγοντας **δηλωμένος από τον αιτούντα**.
    expect(FABRICATED_PRINCIPAL.mfaEnrolled).toBe(false);
  });

  it('Κ4.4 — το όνομα `dev-admin` δεν κατασκευάζεται από πουθενά', () => {
    expect(FABRICATED_PRINCIPAL.uid).not.toBe('dev-admin');
  });
});

// =============================================================================
// Κ5 — ΠΛΗΡΟΤΗΤΑ ΛΟΓΩΝ: καμία άρνηση χωρίς εξήγηση (πρότυπο ADR-801 §4.4)
// =============================================================================

describe('Κ5 — κάθε άρνηση κουβαλά λόγο που εξηγεί την ΕΠΟΜΕΝΗ ΚΙΝΗΣΗ', () => {
  it.each([
    ['denied-unknown-environment', () => setNodeEnv('')],
    ['denied-by-policy', () => setNodeEnv('production')],
    ['denied-real-credentials-available', () => setEmulator('localhost:9099')],
  ] as const)('Κ5.%# — %s έχει μη κενό λόγο', (expected, arrange) => {
    arrange();
    const decision = decideIdentityFabrication();

    expect(decision.verdict).toBe(expected);
    if (decision.verdict === 'granted-development-fallback') {
      throw new Error('αναμενόταν άρνηση');
    }
    expect(decision.reason.trim().length).toBeGreaterThan(20);
  });
});
