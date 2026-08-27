/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΗΣ ΑΥΘΕΝΤΙΑΣ ΠΡΟΕΛΕΥΣΗΣ (ADR-822 §7)
 * =============================================================================
 *
 * ⚠️ **Η ΒΑΘΜΟΝΟΜΗΣΗ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ** *(πρότυπο ADR-801 §5)*. Οι είσοδοι
 * `Π1`-`Π4` **δεν είναι επινοημένες**: είναι τα **τέσσερα πραγματικά σχήματα
 * απόκλισης** που μετρήθηκαν στη ζωντανή βάση **2026-08-27**, πριν γραφτεί μία
 * γραμμή αυθεντίας. Test που τρέχει σε κόσμο που δεν υπάρχει αποδεικνύει ότι ο
 * κώδικας συμφωνεί με τη φαντασία του συγγραφέα του.
 *
 * 🔴 **ΚΑΙ ΤΑ ΤΕΣΣΕΡΑ ΗΤΑΝ ΑΟΡΑΤΑ ΠΡΙΝ ΜΕΤΡΗΘΟΥΝ.** Το handoff της ίδιας μέρας
 * ζητούσε καθαρισμό **ενός** εγγράφου· μετρήθηκαν **τέσσερις** αποκλίσεις, και
 * το έγγραφο του handoff ήταν το **λιγότερο** επικίνδυνο — το μόνο **χωρίς
 * εξουσία**. Γι' αυτό η σοβαρότητα εδώ ακολουθεί την **εξουσία**, όχι τον θόρυβο.
 *
 * @see ADR-822 — δύο μητρώα ταυτότητας, μία θεραπεία
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from '@jest/globals';

import { stripComments } from './_harness/strip-comments';
import {
  AUTHORITY_BY_QUESTION,
  SAFE_DOWNGRADE_ROLE,
  SYNTHETIC_AUTH_PROVIDER,
  isSyntheticIdentity,
  reconcileIdentity,
  type IdentityAccountFacts,
  type IdentityDocumentFacts,
  type ReconciliationVerdict,
} from '../identity-provenance';
import { GLOBAL_ROLES } from '../types';

// =============================================================================
// ΤΑ ΤΕΣΣΕΡΑ ΠΡΑΓΜΑΤΙΚΑ ΣΧΗΜΑΤΑ ΤΗΣ ΠΑΡΑΓΩΓΗΣ (2026-08-27)
// =============================================================================

/** `WKBWEg3D…` georgios.pagonis@gmail.com — η **συνεπής** ταυτότητα. */
const REAL_OWNER = {
  account: { disabled: false, globalRoleClaim: 'super_admin', mfaEnrolled: true },
  document: { authProvider: 'google.com', status: 'active', globalRole: 'super_admin' },
} as const satisfies { account: IdentityAccountFacts; document: IdentityDocumentFacts };

/**
 * `6hWZagWo…` — 🔴🔴 **ΤΟ ΣΟΒΑΡΟΤΕΡΟ ΕΥΡΗΜΑ**: `super_admin` **στα claims**,
 * `mfaEnrolled: false`, τελευταία σύνδεση 09/08/2026 — και **κανένα έγγραφο**.
 * Έχει ολόκληρη την εξουσία και **δεν εμφανίζεται** σε καμία οθόνη διαχείρισης.
 */
const INVISIBLE_SUPER_ADMIN: IdentityAccountFacts = {
  disabled: false,
  globalRoleClaim: 'super_admin',
  mfaEnrolled: false,
};

/** `rfnKOdTQ…` — `external_user` ενεργός, **αδρανής 105 μέρες**, χωρίς έγγραφο. */
const DORMANT_EXTERNAL: IdentityAccountFacts = {
  disabled: false,
  globalRoleClaim: 'external_user',
  mfaEnrolled: false,
};

/**
 * `eMAVv04g…` mugeshraotech@gmail.com — **ΤΟ ΖΟΜΠΙ**. Το ADR-657 τον
 * απενεργοποίησε στο **Auth** στις 15/07· το έγγραφο λέει `active` ακόμα.
 */
const ZOMBIE = {
  account: { disabled: true, globalRoleClaim: null, mfaEnrolled: false },
  document: { authProvider: 'google.com', status: 'active', globalRole: null },
} as const satisfies { account: IdentityAccountFacts; document: IdentityDocumentFacts };

/** `dev-admin` — **ΤΟ ΦΑΝΤΑΣΜΑ**: έγγραφο `super_admin` χωρίς κανέναν λογαριασμό. */
const GHOST_DOCUMENT: IdentityDocumentFacts = {
  authProvider: SYNTHETIC_AUTH_PROVIDER,
  status: 'active',
  globalRole: 'super_admin',
  loginCount: 0,
};

/** Κάθε ετυμηγορία που **δηλώνει** ο τύπος — ο παρονομαστής της ομάδας Λ. */
const DECLARED_VERDICTS: readonly ReconciliationVerdict[] = [
  'consistent',
  'account-without-document',
  'document-without-account',
  'disabled-account-active-document',
  'role-mismatch',
];

// =============================================================================
// Κ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΩΝ ΙΔΙΩΝ ΤΩΝ ΑΓΚΥΡΩΝ
// =============================================================================

describe('Κ0 — ο παρονομαστής: η αυθεντία ΞΕΧΩΡΙΖΕΙ, δεν λέει πάντα το ίδιο', () => {
  it('μια ΣΥΝΕΠΗΣ ταυτότητα βγάζει consistent / clean', () => {
    // ⚠️ Χωρίς αυτό, μια αυθεντία που επιστρέφει πάντα «απόκλιση» θα έκανε ΚΑΘΕ
    //    άγκυρα Π να περνά — όλες πράσινες, καμία να μην κοιτά.
    const outcome = reconcileIdentity(REAL_OWNER.account, REAL_OWNER.document);
    expect(outcome.verdict).toBe('consistent');
    expect(outcome.severity).toBe('clean');
  });

  it('η ασφαλής τιμή υποβάθμισης είναι ΓΝΩΣΤΟΣ ρόλος, όχι επινόηση', () => {
    // Αν το `SAFE_DOWNGRADE_ROLE` ήταν εκτός λεξιλογίου, η «θεραπεία» θα
    // παρήγαγε ακριβώς το σφάλμα που το `denied-unknown-role` υπάρχει να
    // ονομάσει (ADR-801 §4.3) — δηλαδή θα ήταν νέα βλάβη με άλλο όνομα.
    expect(GLOBAL_ROLES).toContain(SAFE_DOWNGRADE_ROLE);
  });

  it('δύο null είναι σφάλμα καλούντα, ΟΧΙ σιωπηλό «consistent»', () => {
    // 🔑 Ταυτότητα που λείπει και από τα δύο μητρώα δεν είναι απόκλιση — είναι
    //    ανύπαρκτο uid. Σιωπηλό `consistent` εδώ θα σήμαινε ότι το εργαλείο
    //    δηλώνει «καθαρό» για κάθε uid που δεν ρώτησε ποτέ κανείς.
    expect(() => reconcileIdentity(null, null)).toThrow(/δύο null/);
  });
});

// =============================================================================
// Π — ΤΑ ΤΕΣΣΕΡΑ ΠΡΑΓΜΑΤΙΚΑ ΕΥΡΗΜΑΤΑ
// =============================================================================

describe('Π — βαθμονόμηση στα 4 μετρημένα σχήματα απόκλισης (2026-08-27)', () => {
  it('Π1 — ο ΑΟΡΑΤΟΣ super_admin: λογαριασμός με εξουσία, χωρίς έγγραφο ⇒ urgent', () => {
    const outcome = reconcileIdentity(INVISIBLE_SUPER_ADMIN, null);
    expect(outcome.verdict).toBe('account-without-document');
    // 🔑 Η σοβαρότητα ακολουθεί την ΕΞΟΥΣΙΑ: αυτός μπορεί να συνδεθεί σήμερα.
    expect(outcome.severity).toBe('urgent');
  });

  it('Π2 — ο ΑΔΡΑΝΗΣ external_user: ίδιο σχήμα, και ΔΕΝ υποβαθμίζεται σιωπηλά', () => {
    // ⚠️ Ο χαμηλός ρόλος ΔΕΝ κάνει την απόκλιση αθώα: το ερώτημα «υπάρχει
    //    έγγραφο;» δεν εξαρτάται από τον ρόλο. Αν εξαρτιόταν, ένα μελλοντικό
    //    `external_user` με ανεβασμένα claims θα περνούσε ως «attention».
    const outcome = reconcileIdentity(DORMANT_EXTERNAL, null);
    expect(outcome.verdict).toBe('account-without-document');
  });

  it('Π3 — ΤΟ ΖΟΜΠΙ: Auth disabled ↔ έγγραφο active ⇒ η θεραπεία σταμάτησε στη μέση', () => {
    const outcome = reconcileIdentity(ZOMBIE.account, ZOMBIE.document);
    expect(outcome.verdict).toBe('disabled-account-active-document');
    expect(outcome.severity).toBe('urgent');
  });

  it('Π4 — ΤΟ ΦΑΝΤΑΣΜΑ: έγγραφο super_admin χωρίς λογαριασμό ⇒ χαρτί, όχι όπλο', () => {
    const outcome = reconcileIdentity(null, GHOST_DOCUMENT);
    expect(outcome.verdict).toBe('document-without-account');
    // 🔑 `attention`, ΟΧΙ `urgent`: μετρημένο 2026-08-27 ότι τα rules διαβάζουν
    //    `request.auth.token.globalRole` (firestore.rules:5161) — άρα το έγγραφο
    //    δεν εξουσιοδοτεί τίποτα. Η ιεράρχηση είναι ΜΕΤΡΗΣΗ, όχι εντύπωση.
    expect(outcome.severity).toBe('attention');
  });

  it('Π4β — και ΑΝΑΓΝΩΡΙΖΕΤΑΙ ως συνθετικό από το ίδιο το έγγραφο', () => {
    expect(isSyntheticIdentity(GHOST_DOCUMENT)).toBe(true);
    expect(isSyntheticIdentity(REAL_OWNER.document)).toBe(false);
  });

  it('Π4γ — το κατηγόρημα ρωτά το ΕΓΓΡΑΦΟ, όχι το όνομα', () => {
    // ⚠️ Έλεγχος τύπου `uid === 'dev-admin'` θα ήταν κατηγόρημα ΟΝΟΜΑΤΟΣ:
    //    αστοχεί στο επόμενο συνθετικό όνομα (ADR-821 «ΜΗΝ #5»).
    expect(isSyntheticIdentity({ authProvider: SYNTHETIC_AUTH_PROVIDER })).toBe(true);
    expect(isSyntheticIdentity({ authProvider: 'password' })).toBe(false);
    expect(isSyntheticIdentity({})).toBe(false);
  });
});

// =============================================================================
// Λ — Η ΛΟΓΙΣΤΙΚΗ ΚΛΕΙΝΕΙ
// =============================================================================

describe('Λ — κάθε ετυμηγορία είναι ΠΑΡΑΓΩΓΙΜΗ από την ίδια την αυθεντία', () => {
  /**
   * 🔑 **ΑΥΤΟ ΑΚΡΙΒΩΣ ΕΛΕΙΠΕ ΑΛΛΟΥ** (ADR-801 §5, ομάδα Λ): ένας τύπος μπορεί να
   * δηλώνει έξι ετυμηγορίες ενώ ο κώδικας παράγει τρεις. Οι τρεις νεκρές
   * μοιάζουν με κάλυψη και δεν είναι.
   */
  it('Λ1 — και οι πέντε παράγονται από πραγματική είσοδο· η λογιστική κλείνει', () => {
    const produced = new Set<ReconciliationVerdict>([
      reconcileIdentity(REAL_OWNER.account, REAL_OWNER.document).verdict,
      reconcileIdentity(INVISIBLE_SUPER_ADMIN, null).verdict,
      reconcileIdentity(null, GHOST_DOCUMENT).verdict,
      reconcileIdentity(ZOMBIE.account, ZOMBIE.document).verdict,
      reconcileIdentity(
        { disabled: false, globalRoleClaim: 'company_admin', mfaEnrolled: true },
        { authProvider: 'google.com', status: 'active', globalRole: 'external_user' },
      ).verdict,
    ]);
    expect(produced.size).toBe(DECLARED_VERDICTS.length);
    expect([...produced].sort()).toEqual([...DECLARED_VERDICTS].sort());
  });

  it('Λ2 — καμία ετυμηγορία δεν είναι γυμνή: κουβαλά ΛΟΓΟ και ΣΟΒΑΡΟΤΗΤΑ', () => {
    // Άρνηση χωρίς εξήγηση είναι κενή οθόνη (ADR-801 §4.4).
    for (const outcome of [
      reconcileIdentity(INVISIBLE_SUPER_ADMIN, null),
      reconcileIdentity(null, GHOST_DOCUMENT),
      reconcileIdentity(ZOMBIE.account, ZOMBIE.document),
    ]) {
      expect(outcome.reason.length).toBeGreaterThan(20);
      expect(outcome.severity).not.toBe('clean');
    }
  });

  it('Λ3 — η ΑΠΟΥΣΙΑ ρόλου και στα δύο μητρώα ΔΕΝ είναι διαφωνία', () => {
    // 🔑 `null` δίπλα σε `undefined` είναι η ΙΔΙΑ απουσία γραμμένη δύο φορές.
    //    Χωρίς αυτό, κάθε ταυτότητα χωρίς ρόλο θα έβγαινε `role-mismatch` —
    //    θόρυβος που θα έκανε κάποιον να χαλαρώσει το εργαλείο.
    const outcome = reconcileIdentity(
      { disabled: false, globalRoleClaim: null, mfaEnrolled: false },
      { authProvider: 'google.com', status: 'active' },
    );
    expect(outcome.verdict).toBe('consistent');
  });

  it('Λ4 — το disabled κρίνεται ΠΡΙΝ τον ρόλο', () => {
    // Απενεργοποιημένος λογαριασμός με ασύμφωνο ρόλο: η χρήσιμη πληροφορία
    // είναι «η θεραπεία σταμάτησε στη μέση», όχι «οι ρόλοι διαφωνούν».
    const outcome = reconcileIdentity(
      { disabled: true, globalRoleClaim: 'external_user', mfaEnrolled: false },
      { authProvider: 'google.com', status: 'active', globalRole: 'super_admin' },
    );
    expect(outcome.verdict).toBe('disabled-account-active-document');
  });
});

// =============================================================================
// Α — ΠΟΙΟ ΜΗΤΡΩΟ ΑΠΑΝΤΑ ΤΙ
// =============================================================================

describe('Α — AUTHORITY_BY_QUESTION: η ασυμμετρία που λείπει από τους μεγάλους', () => {
  it('Α1 — το «τι επιτρέπεται;» απαντιέται από το AUTH, όχι από το έγγραφο', () => {
    // 🔴 ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΦΥΛΑΕΙ ΑΥΤΗ Η ΓΡΑΜΜΗ (ADR-822 §2.1): το handoff μέτρησε
    //    «πόσοι super_admin;» στο ΕΓΓΡΑΦΟ και βρήκε 2· η αυθεντία απαντά 3.
    //    Καμία τιμή δεν διαφωνούσε — ρωτήθηκε το λάθος μητρώο.
    expect(AUTHORITY_BY_QUESTION['what-is-permitted']).toBe('firebase-auth');
  });

  it('Α2 — το «πώς εμφανίζεται;» απαντιέται από το ΕΓΓΡΑΦΟ', () => {
    // Χωρίς αυτό, ο πίνακας θα μπορούσε να λέει «Auth» παντού και να περνά.
    expect(AUTHORITY_BY_QUESTION['how-is-it-displayed']).toBe('firestore-document');
  });

  it('Α3 — κάθε ερώτημα έχει ΑΚΡΙΒΩΣ ΜΙΑ αυθεντία, από τα δύο γνωστά μητρώα', () => {
    const registries = Object.values(AUTHORITY_BY_QUESTION);
    expect(registries.length).toBeGreaterThan(0);
    for (const registry of registries) {
      expect(['firebase-auth', 'firestore-document']).toContain(registry);
    }
  });
});

// =============================================================================
// Σ — Η ΕΞΑΓΩΓΗ ΕΓΙΝΕ ΠΡΑΓΜΑΤΙΚΑ
// =============================================================================

describe('Σ — το inline κατηγόρημα ΕΦΥΓΕ από το route, δεν αντιγράφηκε', () => {
  const ROUTE = 'src/app/api/admin/role-management/users/route.ts';
  const code = (): string => stripComments(readFileSync(join(process.cwd(), ROUTE), 'utf8'));

  it('Σ1 — το route ΚΑΛΕΙ την αυθεντία', () => {
    expect(code()).toContain('isSyntheticIdentity');
  });

  it('Σ2 — και ΔΕΝ κρατά δικό του αντίγραφο της συμβολοσειράς', () => {
    // 🔴 Δύο σημεία που ξέρουν το literal = δύο λεξιλόγια (ADR-749). Το σχόλιο
    //    πάνω από την κλήση ΕΠΙΤΡΕΠΕΤΑΙ να το αναφέρει — γι' αυτό ο έλεγχος
    //    τρέχει σε κώδικα χωρίς σχόλια.
    expect(code()).not.toContain(SYNTHETIC_AUTH_PROVIDER);
  });

  it('Σ3 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΣΑΡΩΤΗ: βλέπει ΚΩΔΙΚΑ, αγνοεί ΠΡΟΖΑ', () => {
    // ⚠️ Χωρίς αυτό, ένας αφαιρετής που επιστρέφει κενή συμβολοσειρά θα έκανε
    //    το Σ2 μονίμως πράσινο — και το Σ1 μονίμως κόκκινο, που θα το πρόσεχε
    //    κάποιος· αλλά αφαιρετής που δεν αφαιρεί ΤΙΠΟΤΑ κάνει το Σ2 να αποτύχει
    //    για λάθος λόγο. Και οι δύο αστοχίες πιάνονται εδώ.
    expect(stripComments(`const a = '${SYNTHETIC_AUTH_PROVIDER}';`)).toContain(
      SYNTHETIC_AUTH_PROVIDER,
    );
    expect(stripComments(`/** πάλαι ποτέ '${SYNTHETIC_AUTH_PROVIDER}' */`)).not.toContain(
      SYNTHETIC_AUTH_PROVIDER,
    );
    expect(stripComments(`// '${SYNTHETIC_AUTH_PROVIDER}'`)).not.toContain(
      SYNTHETIC_AUTH_PROVIDER,
    );
  });
});
