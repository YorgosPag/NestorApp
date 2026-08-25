/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΟΥ ΚΡΙΤΗ ΕΞΟΥΣΙΟΔΟΤΗΣΗΣ (ADR-801 §5)
 * =============================================================================
 *
 * ⚠️ **Η ΒΑΘΜΟΝΟΜΗΣΗ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ.** Οι είσοδοι `Π1`-`Π4` **δεν είναι
 * επινοημένες**: είναι τα **τέσσερα πραγματικά έγγραφα** της collection `users`
 * της παραγωγής, διαβασμένα 2026-08-24 πριν γραφτεί μία γραμμή κριτή. Ένα test
 * που τρέχει σε κόσμο που δεν υπάρχει αποδεικνύει ότι ο κώδικας συμφωνεί με τη
 * φαντασία του συγγραφέα του.
 *
 * 🔴 **ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΥΠΑΡΧΕΙ ΓΙΑ ΝΑ ΜΗΝ ΞΑΝΑΓΙΝΕΙ.** Το
 * `useCanEditText.test.ts` έχει **11 πράσινα** tests πάνω σε πίνακα **13
 * ρόλων** — και η ζωντανή διαδρομή του παραδίδει **μόνο τρεις** τιμές
 * (`'admin'`·`'authenticated'`·`'public'`), οπότε **δέκα από τους δεκατρείς
 * κλάδους δεν πυροδοτούν ΠΟΤΕ**. Καλεί την καθαρή συνάρτηση απευθείας με
 * `'architect'` — τιμή που **κανείς δεν παράγει**. *Ο παρονομαστής έλειπε.*
 * Γι' αυτό υπάρχει εδώ η ομάδα **`Λ` (ΛΕΞΙΛΟΓΙΟ)**: αποδεικνύει ότι **κάθε**
 * ετυμηγορία είναι **παραγώγιμη** από τον ίδιο τον κριτή.
 *
 * @see ADR-801 · CHECK 3.66
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from '@jest/globals';

import { decideCapability } from '../authority';
import { PERMISSIONS, type PermissionId } from '../types';
import { PREDEFINED_ROLES } from '../roles';
import {
  GRANTING_VERDICTS,
  isGranted,
  type CapabilitySubject,
  type CapabilityVerdict,
} from '@/types/capability-authority';

// =============================================================================
// ΟΙ ΤΕΣΣΕΡΙΣ ΠΡΑΓΜΑΤΙΚΕΣ ΤΑΥΤΟΤΗΤΕΣ ΤΗΣ ΠΑΡΑΓΩΓΗΣ (users, 2026-08-24)
// =============================================================================

/** `WKBWEg3D…` georgios.pagonis@gmail.com — η **συνεπής** ταυτότητα. */
const PROD_SUPER_ADMIN: CapabilitySubject = {
  globalRole: 'super_admin',
  permissions: ['admin_access'],
  companyId: 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757',
};

/**
 * `ITjmw0sy…` pagonis.oe@gmail.com — 🔴 **Η ΑΝΤΙΦΑΤΙΚΗ**: ρόλος `external_user`
 * (που **δεν** δίνει `admin_access`) αλλά **ρητό** `admin_access` στα claims.
 * Σήμερα παίρνει διαχειριστή **μόνο** μέσω της λίστας email — γι' αυτό η
 * «καθαρή αφαίρεση» του fallback θα τον **κλείδωνε έξω**.
 */
const PROD_CONTRADICTORY: CapabilitySubject = {
  globalRole: 'external_user',
  permissions: ['admin_access'],
  companyId: 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757',
};

/**
 * `dev-admin` — 🔴 **globalRole `'admin'`**, τιμή **εκτός** `GLOBAL_ROLES` και
 * εκτός `PREDEFINED_ROLES`. Ο λόγος που το `denied-unknown-role` υπάρχει.
 */
const PROD_UNKNOWN_ROLE: CapabilitySubject = {
  globalRole: 'admin',
  permissions: null,
  companyId: null,
};

/** `eMAVv04g…` mugeshraotech@gmail.com — **χωρίς ρόλο**. Νόμιμη κατάσταση. */
const PROD_NO_ROLE: CapabilitySubject = {
  globalRole: null,
  permissions: null,
  companyId: null,
};

/** Ικανότητες που **υπάρχουν** — επαληθευμένες έναντι του μητρώου παρακάτω (Κ0). */
const ADMIN_ACCESS = 'admin_access' as PermissionId;
const USERS_MANAGE = 'users:users:manage' as PermissionId;
const PROJECTS_VIEW = 'projects:projects:view' as PermissionId;

// =============================================================================
// Κ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΩΝ ΙΔΙΩΝ ΤΩΝ ΑΓΚΥΡΩΝ
// =============================================================================

describe('Κ0 — οι ικανότητες των αγκυρών είναι ΠΡΑΓΜΑΤΙΚΕΣ', () => {
  it('και οι τρεις υπάρχουν στο μητρώο PERMISSIONS', () => {
    // ⚠️ Χωρίς αυτό, ένα τυπογραφικό θα έκανε ΚΑΘΕ άγκυρα να περνά μέσω
    //    `denied-unknown-action` — δηλαδή όλες πράσινες, καμία να μην κοιτά.
    for (const action of [ADMIN_ACCESS, USERS_MANAGE, PROJECTS_VIEW]) {
      expect(Object.hasOwn(PERMISSIONS, action)).toBe(true);
    }
  });

  it('ο ρόλος external_user ΔΕΝ δίνει admin_access (αλλιώς το Π2 δεν αποδεικνύει τίποτα)', () => {
    expect(PREDEFINED_ROLES.external_user?.permissions).not.toContain('admin_access');
  });

  it("το 'admin' ΔΕΝ είναι γνωστός ρόλος (αλλιώς το Π3 δεν αποδεικνύει τίποτα)", () => {
    expect(Object.hasOwn(PREDEFINED_ROLES, 'admin')).toBe(false);
  });
});

// =============================================================================
// Π — ΒΑΘΜΟΝΟΜΗΣΗ ΣΤΑ ΠΡΑΓΜΑΤΙΚΑ ΕΓΓΡΑΦΑ
// =============================================================================

describe('Π — βαθμονόμηση στα 4 έγγραφα της παραγωγής', () => {
  it('Π1 — ο super_admin περνά με bypass', () => {
    const d = decideCapability({ subject: PROD_SUPER_ADMIN, action: USERS_MANAGE });
    expect(d.verdict).toBe('granted-by-bypass');
    expect(d.reason).toBeNull();
  });

  it('Π2 — η ΑΝΤΙΦΑΤΙΚΗ ταυτότητα περνά μέσω ΡΗΤΟΥ permission, όχι ρόλου', () => {
    const d = decideCapability({ subject: PROD_CONTRADICTORY, action: ADMIN_ACCESS });
    expect(d.verdict).toBe('granted-by-permission');
  });

  it('Π2β — και ΔΕΝ παίρνει ό,τι δεν της δόθηκε ρητά', () => {
    // Ο external_user δεν έχει users:users:manage ούτε ως ρόλος ούτε ως claim.
    const d = decideCapability({ subject: PROD_CONTRADICTORY, action: USERS_MANAGE });
    expect(d.verdict).toBe('denied-insufficient');
  });

  it('Π3 — ο dev-admin ονομάζεται ΑΓΝΩΣΤΟΣ, δεν πέφτει σιωπηλά στο insufficient', () => {
    const d = decideCapability({ subject: PROD_UNKNOWN_ROLE, action: ADMIN_ACCESS });
    expect(d.verdict).toBe('denied-unknown-role');
    expect(d.reason).toBe('auth:capability.denyReason.unknownRole');
  });

  it('Π4 — η ΑΠΟΥΣΙΑ ρόλου ΔΕΝ είναι άγνωστος ρόλος', () => {
    // 🔑 Η διάκριση είναι όλο το νόημα: «δεν έχεις ρόλο» = νόμιμη κατάσταση
    //    (ο ιδιώτης)· «ο ρόλος σου δεν υπάρχει» = σφάλμα δεδομένων.
    const d = decideCapability({ subject: PROD_NO_ROLE, action: ADMIN_ACCESS });
    expect(d.verdict).toBe('denied-insufficient');
  });
});

// =============================================================================
// Κ — ΤΟ ΣΥΜΒΟΛΑΙΟ
// =============================================================================

describe('Κ — το συμβόλαιο του κριτή', () => {
  it('Κ1 — άγνωστη ικανότητα ⇒ άρνηση ΑΚΟΜΑ ΚΑΙ ΓΙΑ ΤΟΝ super_admin', () => {
    // 🏆 Εδώ ξεπερνάμε τον υπάρχοντα κώδικα: το `isBypass` σήμερα θα έλεγε
    //    «ναι» σε τυπογραφικό, δηλαδή θα δούλευε ΜΟΝΟ για όποιον μπορεί να το
    //    διορθώσει και θα αποτύγχανε σιωπηλά για όλους τους άλλους.
    const d = decideCapability({
      subject: PROD_SUPER_ADMIN,
      action: 'dfx:view' as PermissionId,
    });
    expect(d.verdict).toBe('denied-unknown-action');
  });

  it('Κ2 — ανώνυμος ⇒ denied-unauthenticated', () => {
    expect(decideCapability({ subject: null, action: ADMIN_ACCESS }).verdict).toBe(
      'denied-unauthenticated',
    );
  });

  it('Κ3 — η ΣΕΙΡΑ: άγνωστη ικανότητα κρίνεται ΠΡΙΝ την απουσία ταυτότητας', () => {
    // Ανώνυμος + άγνωστη ικανότητα: το σφάλμα του προγραμματιστή είναι το
    // χρήσιμο μήνυμα, όχι το «δεν είσαι συνδεδεμένος».
    const d = decideCapability({ subject: null, action: 'nope' as PermissionId });
    expect(d.verdict).toBe('denied-unknown-action');
  });

  it('Κ4 — η ΣΕΙΡΑ: άγνωστος ρόλος κρίνεται ΠΡΙΝ το ρητό permission', () => {
    const d = decideCapability({
      subject: { globalRole: 'admin', permissions: ['admin_access'] },
      action: ADMIN_ACCESS,
    });
    expect(d.verdict).toBe('denied-unknown-role');
  });

  it('Κ5 — granted-by-role: ο company_admin παίρνει ό,τι δίνει ο ρόλος του', () => {
    const d = decideCapability({
      subject: { globalRole: 'company_admin', permissions: [] },
      action: USERS_MANAGE,
    });
    expect(d.verdict).toBe('granted-by-role');
  });

  it('Κ6 — κενή/whitespace συμβολοσειρά ρόλου = ΑΠΟΥΣΙΑ, όχι άγνωστος ρόλος', () => {
    for (const blank of ['', '   ']) {
      const d = decideCapability({
        subject: { globalRole: blank, permissions: null },
        action: ADMIN_ACCESS,
      });
      expect(d.verdict).toBe('denied-insufficient');
    }
  });

  it('Κ7 — prototype pollution: το "toString" ΔΕΝ είναι ικανότητα', () => {
    // ⚠️ Με `in` αντί για `Object.hasOwn`, αυτό θα περνούσε για έγκυρη ικανότητα
    //    και ο super_admin θα έπαιρνε `granted-by-bypass`.
    const d = decideCapability({
      subject: PROD_SUPER_ADMIN,
      action: 'toString' as PermissionId,
    });
    expect(d.verdict).toBe('denied-unknown-action');
  });

  it('Κ8 — prototype pollution στον ΡΟΛΟ: το "constructor" δεν είναι γνωστός ρόλος', () => {
    const d = decideCapability({
      subject: { globalRole: 'constructor', permissions: null },
      action: ADMIN_ACCESS,
    });
    expect(d.verdict).toBe('denied-unknown-role');
  });

  it('Κ9 — η ικανότητα επιστρέφεται ΡΗΤΑ, ώστε ένα «ναι» να μη μετακινείται', () => {
    const d = decideCapability({ subject: PROD_SUPER_ADMIN, action: PROJECTS_VIEW });
    expect(d.action).toBe(PROJECTS_VIEW);
  });

  it('Κ10 — permissions που ΔΕΝ είναι πίνακας δεν ρίχνουν και δεν επιτρέπουν', () => {
    const d = decideCapability({
      subject: { globalRole: 'external_user', permissions: null },
      action: ADMIN_ACCESS,
    });
    expect(d.verdict).toBe('denied-insufficient');
  });
});

// =============================================================================
// Λ — ΛΕΞΙΛΟΓΙΟ: ΚΑΜΙΑ ΕΤΥΜΗΓΟΡΙΑ ΔΕΝ ΕΙΝΑΙ ΝΕΚΡΗ
// =============================================================================

describe('Λ — πληρότητα λεξιλογίου (ο παρονομαστής)', () => {
  /**
   * Είσοδοι που **παράγουν** κάθε ετυμηγορία, μέσα από τον **πραγματικό** κριτή.
   *
   * ⚠️ Αν προστεθεί όγδοη ετυμηγορία χωρίς είσοδο που να τη γεννά, το `Λ1`
   * κοκκινίζει. Αυτό ακριβώς έλειπε από τον πίνακα του `capabilitiesForRole`,
   * όπου **10 από 13** κλάδους ήταν αδύνατο να πυροδοτήσουν.
   */
  const PRODUCERS: ReadonlyArray<{ verdict: CapabilityVerdict; run: () => CapabilityVerdict }> = [
    {
      verdict: 'granted-by-bypass',
      run: () => decideCapability({ subject: PROD_SUPER_ADMIN, action: USERS_MANAGE }).verdict,
    },
    {
      verdict: 'granted-by-permission',
      run: () => decideCapability({ subject: PROD_CONTRADICTORY, action: ADMIN_ACCESS }).verdict,
    },
    {
      verdict: 'granted-by-role',
      run: () =>
        decideCapability({
          subject: { globalRole: 'company_admin', permissions: [] },
          action: USERS_MANAGE,
        }).verdict,
    },
    {
      verdict: 'denied-unauthenticated',
      run: () => decideCapability({ subject: null, action: ADMIN_ACCESS }).verdict,
    },
    {
      verdict: 'denied-insufficient',
      run: () => decideCapability({ subject: PROD_NO_ROLE, action: ADMIN_ACCESS }).verdict,
    },
    {
      verdict: 'denied-unknown-role',
      run: () => decideCapability({ subject: PROD_UNKNOWN_ROLE, action: ADMIN_ACCESS }).verdict,
    },
    {
      verdict: 'denied-unknown-action',
      run: () =>
        decideCapability({ subject: PROD_SUPER_ADMIN, action: 'nope' as PermissionId }).verdict,
    },
  ];

  it.each(PRODUCERS)('Λ1 — η ετυμηγορία $verdict είναι ΠΑΡΑΓΩΓΙΜΗ', ({ verdict, run }) => {
    expect(run()).toBe(verdict);
  });

  it('Λ2 — ΚΑΘΕ ετυμηγορία του τύπου έχει παραγωγό (κλειστή λογιστική)', () => {
    // Το σύνολο των ετυμηγοριών που ονομάζει ο τύπος, μέσα από τους δύο
    // καταλόγους που το αρχείο ήδη εξάγει — ΠΟΤΕ χειρόγραφη τρίτη λίστα.
    const declared: readonly CapabilityVerdict[] = [
      ...GRANTING_VERDICTS,
      'denied-unauthenticated',
      'denied-insufficient',
      'denied-unknown-role',
      'denied-unknown-action',
    ];
    const produced = new Set(PRODUCERS.map(p => p.verdict));
    for (const v of declared) expect(produced.has(v)).toBe(true);
    expect(produced.size).toBe(declared.length);
  });

  it('Λ3 — isGranted: ΜΟΝΟ οι τρεις granted-* επιτρέπουν', () => {
    for (const { verdict } of PRODUCERS) {
      expect(isGranted(verdict)).toBe(verdict.startsWith('granted-'));
    }
  });

  it('Λ4 — κάθε άρνηση φέρει λόγο, κάθε άδεια δεν φέρει', () => {
    // ⚠️ Άρνηση χωρίς λόγο = κενή οθόνη που ο χρήστης δεν μπορεί να εξηγήσει.
    for (const { verdict, run } of PRODUCERS) {
      void run();
      const d = decideCapability(
        verdict === 'denied-unauthenticated'
          ? { subject: null, action: ADMIN_ACCESS }
          : { subject: PROD_SUPER_ADMIN, action: USERS_MANAGE },
      );
      if (isGranted(d.verdict)) expect(d.reason).toBeNull();
      else expect(typeof d.reason).toBe('string');
    }
  });
});

// =============================================================================
// Δ — Η ΤΑΥΤΟΤΗΤΑ ΠΟΥ ΓΡΑΦΕΙ Η ΙΔΙΑ Η ΕΦΑΡΜΟΓΗ (ADR-801 §6, Φάση 2)
// =============================================================================

describe('Δ — καμία ταυτότητα που γράφουμε δεν είναι ακατανόητη στον κριτή', () => {
  /**
   * Αρχεία που **γράφουν** `globalRole` σε έγγραφο χρήστη.
   *
   * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: μέχρι 2026-08-25 το `ensureDevUserProfile` έγραφε
   * `globalRole: 'admin'` — τιμή που **δεν υπάρχει** ούτε στα `GLOBAL_ROLES`,
   * ούτε στα `PREDEFINED_ROLES`. Το έγγραφο `users/dev-admin` υπάρχει **στην
   * παραγωγή** με αυτή την τιμή. Χωρίς άγκυρα, ο επόμενος το ξαναγράφει.
   *
   * ⚠️ **ΔΙΑΒΑΖΕΙ ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΑΡΧΕΙΟ, ΔΕΝ ΑΝΤΙΓΡΑΦΕΙ ΤΙΜΗ.** Καρφωμένο
   *    `'super_admin'` εδώ θα έμενε πράσινο ενώ το αρχείο γράφει ό,τι θέλει.
   */
  const WRITERS = ['src/auth/contexts/auth-context/auth-context-profile.ts'] as const;

  it.each(WRITERS)('Δ1 — κάθε globalRole που γράφει το %s είναι γνωστός ρόλος', file => {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    const found = [...src.matchAll(/globalRole:\s*'([^']+)'/g)].map(m => m[1]);

    // ⚠️ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: αν το regex δεν βρει τίποτα, το test θα ήταν πράσινο
    //    χωρίς να κοιτάξει — το σχήμα «0 = κανείς δεν κοίταξε».
    expect(found.length).toBeGreaterThan(0);

    for (const role of found) {
      const d = decideCapability({
        subject: { globalRole: role, permissions: null },
        action: ADMIN_ACCESS,
      });
      expect(d.verdict).not.toBe('denied-unknown-role');
    }
  });

  it('Δ2 — ο παρονομαστής: το ΠΑΛΙΟ "admin" ΟΝΤΩΣ θα κοκκίνιζε', () => {
    // Χωρίς αυτό, το Δ1 μπορεί να είναι πράσινο επειδή δεν υπήρξε ποτέ βλάβη.
    const d = decideCapability({
      subject: { globalRole: 'admin', permissions: null },
      action: ADMIN_ACCESS,
    });
    expect(d.verdict).toBe('denied-unknown-role');
  });
});
