/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΗΣ ΘΕΡΑΠΕΙΑΣ (ADR-822 §7.2)
 * =============================================================================
 *
 * 🔴 **Η ΟΜΑΔΑ `Θ0` ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ, ΚΑΙ ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΠΡΑΓΜΑΤΙΚΟ ΛΑΘΟΣ.**
 * Η πρώτη εισήγηση του ADR-822 §4.4 πρότεινε να γραφτεί `status: 'disabled'`
 * στη **ζωντανή** βάση. Το `'disabled'` **δεν υπάρχει** στο λεξιλόγιο
 * *(`auth.types.ts:211`)*. Η «θεραπεία» θα έγραφε **τιμή εκτός λεξιλογίου** —
 * δηλαδή θα γεννούσε **ακριβώς την κλάση βλάβης που καθαρίζει** *(το
 * `globalRole: 'admin'` του ADR-801 §4.3)*.
 *
 * Το έπιασε **άνθρωπος που ρώτησε «θα το έκαναν οι μεγάλοι;»**, όχι τα tests.
 * Αυτή η ομάδα υπάρχει ώστε να μη χρειαστεί να το ξαναπιάσει άνθρωπος.
 *
 * @see ADR-822 §4.4 · §4.5
 */

import { describe, it, expect } from '@jest/globals';

import {
  REMEDIATION_STATUS,
  explainNoPlan,
  planRemediation,
  type NoPlanReason,
  type RemediationOutcome,
} from '../identity-remediation';
import { SAFE_DOWNGRADE_ROLE, SYNTHETIC_AUTH_PROVIDER } from '../identity-provenance';
import { GLOBAL_ROLES } from '../types';
import type { UserProfile } from '@/auth/types/auth.types';

/** Το ζωντανό `users/dev-admin`, όπως μετρήθηκε 2026-08-27. */
const GHOST = {
  authProvider: SYNTHETIC_AUTH_PROVIDER,
  status: 'active',
  globalRole: 'super_admin',
  loginCount: 0,
} as const;

/** Το ζωντανό `users/eMAVv04g…` — ζόμπι: Auth disabled ↔ έγγραφο active. */
const ZOMBIE = { authProvider: 'google.com', status: 'active', globalRole: null } as const;

const planOf = (o: RemediationOutcome) => {
  if (o.kind !== 'plan') throw new Error(`αναμενόταν σχέδιο, ήρθε '${o.reason}'`);
  return o.plan;
};

// =============================================================================
// Θ0 — ΤΟ ΛΕΞΙΛΟΓΙΟ: ΚΑΜΙΑ ΤΙΜΗ ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ
// =============================================================================

describe('Θ0 — η θεραπεία γράφει ΜΟΝΟ τιμές που υπάρχουν στο λεξιλόγιο', () => {
  /**
   * 🔒 **Ο ΤΥΠΟΣ ΕΙΝΑΙ Ο ΚΡΙΤΗΣ, ΟΧΙ ΑΝΤΙΓΡΑΜΜΕΝΗ ΛΙΣΤΑ.** Καρφωμένο
   * `['active','inactive','suspended','pending']` εδώ θα έμενε πράσινο ενώ ο
   * τύπος αλλάζει — άγκυρα που διαβάζει τον εαυτό της.
   */
  const assignableStatus = (value: UserProfile['status']): UserProfile['status'] => value;

  it('Θ0.1 — κάθε τιμή του REMEDIATION_STATUS είναι έγκυρο UserProfile["status"]', () => {
    for (const value of Object.values(REMEDIATION_STATUS)) {
      // Αν κάποιος βάλει 'disabled', ΕΔΩ σταματά ο μεταγλωττιστής.
      expect(assignableStatus(value)).toBe(value);
    }
  });

  it("Θ0.2 — ΤΟ ΣΥΓΚΕΚΡΙΜΕΝΟ ΛΑΘΟΣ: το 'disabled' ΔΕΝ είναι στο λεξιλόγιο", () => {
    // 🔴 Ο παρονομαστής του Θ0.1: χωρίς αυτό, ένα λεξιλόγιο που δέχεται τα
    //    πάντα θα έκανε το Θ0.1 μονίμως πράσινο.
    expect(Object.values(REMEDIATION_STATUS)).not.toContain('disabled');
    expect(Object.values(REMEDIATION_STATUS)).toContain('suspended');
  });

  it('Θ0.3 — καμία πράξη δεν γράφει ποτέ status εκτός λεξιλογίου', () => {
    const allowed: readonly string[] = Object.values(REMEDIATION_STATUS);
    for (const doc of [GHOST, ZOMBIE]) {
      const verdict = doc === GHOST ? 'document-without-account' : 'disabled-account-active-document';
      const plan = planOf(planRemediation('u', verdict, doc, 1));
      for (const patch of [plan.forward.patch, plan.inverse.patch]) {
        if (patch.status !== undefined) expect(allowed).toContain(patch.status);
      }
    }
  });

  it('Θ0.4 — και κανένας ρόλος εκτός GLOBAL_ROLES', () => {
    const plan = planOf(planRemediation('u', 'document-without-account', GHOST, 1));
    expect(GLOBAL_ROLES).toContain(plan.forward.patch.globalRole);
  });
});

// =============================================================================
// Θ1 — Η ΑΝΤΙΣΤΡΕΨΙΜΟΤΗΤΑ
// =============================================================================

describe('Θ1 — κάθε πράξη γεννά την ΑΚΡΙΒΗ αναίρεσή της, από ΔΙΑΒΑΣΜΕΝΕΣ τιμές', () => {
  it('Θ1.1 — το φάντασμα: υποβάθμιση + αναστολή, αναίρεση στις ΑΡΧΙΚΕΣ τιμές', () => {
    const plan = planOf(planRemediation('dev-admin', 'document-without-account', GHOST, 1_700_000));

    expect(plan.forward.patch).toEqual({
      globalRole: SAFE_DOWNGRADE_ROLE,
      status: REMEDIATION_STATUS.suspended,
    });
    // 🔑 Η αναίρεση ΔΕΝ είναι «κάτι λογικό» — είναι ΑΚΡΙΒΩΣ ό,τι διαβάστηκε.
    expect(plan.inverse.patch).toEqual({
      globalRole: 'super_admin',
      status: 'active',
    });
  });

  it('Θ1.2 — η αναίρεση ΑΚΟΛΟΥΘΕΙ το έγγραφο, δεν το μαντεύει', () => {
    // Ίδια ετυμηγορία, ΑΛΛΟ έγγραφο ⇒ ΑΛΛΗ αναίρεση. Αν το inverse ήταν
    // καρφωμένο, αυτό θα το αποκάλυπτε.
    const other = { ...GHOST, globalRole: 'internal_user', status: 'pending' } as const;
    const plan = planOf(planRemediation('x', 'document-without-account', other, 1));
    expect(plan.inverse.patch).toEqual({ globalRole: 'internal_user', status: 'pending' });
  });

  it('Θ1.3 — έγγραφο ΧΩΡΙΣ ρόλο: η αναίρεση ΕΠΑΝΑΦΕΡΕΙ το null, δεν επινοεί ρόλο', () => {
    // ⚠️ Ένα `globalRole: 'external_user'` στην αναίρεση θα επινοούσε τιμή.
    //
    // 🔴 **ΑΛΛΑΞΕ Η ΠΡΟΣΔΟΚΙΑ, ΚΑΙ ΕΙΝΑΙ ΔΙΟΡΘΩΣΗ — ΟΧΙ ΧΑΛΑΡΩΣΗ** (2026-08-27):
    //    η άγκυρα απαιτούσε `toBeUndefined()`, δηλαδή **παράλειψη** του πεδίου.
    //    Παράλειψη σημαίνει ότι μετά την «αναίρεση» το έγγραφο μένει με
    //    `external_user` — δηλαδή **δεν αναιρέθηκε**.
    //
    //    Το σχόλιο έλεγε «πεδίο που δεν υπήρχε ποτέ». **Υπήρχε**: στη Firestore
    //    το `null` είναι **τιμή**, όχι απουσία — μετρημένο σε ζωντανό έγγραφο
    //    της παραγωγής (`globalRole: null` ρητά γραμμένο).
    const roleless = { authProvider: SYNTHETIC_AUTH_PROVIDER, status: 'active', globalRole: null } as const;
    const plan = planOf(planRemediation('x', 'document-without-account', roleless, 1));
    expect(plan.inverse.patch.globalRole).toBeNull();
    expect(plan.inverse.patch.status).toBe('active');
  });

  it('Θ1.4 — το ζόμπι: ΜΟΝΟ κατάσταση, ΚΑΜΙΑ αλλαγή ρόλου', () => {
    const plan = planOf(planRemediation('e', 'disabled-account-active-document', ZOMBIE, 1));
    expect(plan.forward.patch).toEqual({ status: REMEDIATION_STATUS.suspended });
    expect(plan.forward.patch.globalRole).toBeUndefined();
    expect(plan.inverse.patch).toEqual({ status: 'active' });
  });

  it('Θ1.5 — η forward κουβαλά την ΤΑΥΤΟΤΗΤΑ της κατάστασης που είδε', () => {
    // Χωρίς αυτό, η γραφή θα ήταν τυφλή — το σχήμα των μεγάλων (ADR-822 §5).
    expect(planOf(planRemediation('d', 'document-without-account', GHOST, 42)).forward.expectedUpdatedAtMs).toBe(42);
    expect(planOf(planRemediation('d', 'document-without-account', GHOST, null)).forward.expectedUpdatedAtMs).toBeNull();
  });
});

// =============================================================================
// Θ2 — ΤΙ ΑΡΝΕΙΤΑΙ ΝΑ ΚΑΝΕΙ
// =============================================================================

describe('Θ2 — οι πράξεις που ο κώδικας ΑΡΝΕΙΤΑΙ, με ονομασμένο λόγο', () => {
  it('Θ2.1 — συνεπής ταυτότητα ⇒ κανένα σχέδιο', () => {
    const outcome = planRemediation('w', 'consistent', GHOST, 1);
    expect(outcome).toEqual({ kind: 'none', reason: 'nothing-to-remediate' });
  });

  it('Θ2.2 — 🔴 λογαριασμός ΧΩΡΙΣ έγγραφο ⇒ ΠΟΤΕ αυτόματη δημιουργία', () => {
    // 🔑 Η δημιουργία εγγράφου εδώ θα ΕΠΙΝΟΟΥΣΕ ταυτότητα — η βλάβη του
    //    ADR-821. Το «ποιος είναι αυτός ο άνθρωπος;» δεν είναι ερώτημα κώδικα.
    const outcome = planRemediation('6hWZ', 'account-without-document', null, null);
    expect(outcome).toEqual({ kind: 'none', reason: 'requires-human-identification' });
  });

  it('Θ2.3 — role-mismatch ευθυγραμμίζει ΠΡΟΣ ΤΑ ΚΑΤΩ, ποτέ προς τα πάνω', () => {
    // ⚠️ Το claim νικά — αλλά «νικά» ΔΕΝ σημαίνει «ανέβασε το έγγραφο στο
    //    claim». Αυτό θα ήταν κλιμάκωση μέσω θεραπείας.
    const doc = { authProvider: 'google.com', status: 'active', globalRole: 'company_admin' } as const;
    const plan = planOf(planRemediation('m', 'role-mismatch', doc, 1));
    expect(plan.forward.patch.globalRole).toBe(SAFE_DOWNGRADE_ROLE);
    expect(plan.forward.patch.globalRole).not.toBe('super_admin');
  });

  it('Θ2.4 — καμία πράξη δεν αγγίζει πεδίο εκτός {globalRole, status}', () => {
    // 🔒 Ο παρονομαστής της «ελάχιστης επέμβασης»: μια θεραπεία που γράφει
    //    email/companyId/authProvider θα ήταν άλλη πράξη με το ίδιο όνομα.
    const allowed = ['globalRole', 'status'];
    for (const [verdict, doc] of [
      ['document-without-account', GHOST],
      ['disabled-account-active-document', ZOMBIE],
    ] as const) {
      const plan = planOf(planRemediation('u', verdict, doc, 1));
      expect(Object.keys(plan.forward.patch).every((k) => allowed.includes(k))).toBe(true);
      expect(Object.keys(plan.inverse.patch).every((k) => allowed.includes(k))).toBe(true);
    }
  });

  it('Θ2.5 — ήδη θεραπευμένο ζόμπι ⇒ κανένα σχέδιο (ιδεμποτεντικό)', () => {
    // Ο λόγος έγινε **ακριβής** (2026-08-27): «δεν ξέρω τι να κάνω» και «είμαι
    // ήδη στον στόχο» είναι **δύο** καταστάσεις — πριν συγχέονταν σε μία.
    const healed = { ...ZOMBIE, status: 'suspended' } as const;
    expect(planRemediation('e', 'disabled-account-active-document', healed, 1)).toEqual({
      kind: 'none',
      reason: 'already-in-desired-state',
    });
  });

  it('Θ2.6 — Η ΔΕΥΤΕΡΗ ΕΚΤΕΛΕΣΗ: εφαρμόζω το forward και ξανακρίνω', () => {
    // 🔴 **Η ΑΓΚΥΡΑ ΠΟΥ ΕΛΕΙΠΕ ΑΠΟ ΤΙΣ 42** — μετρημένο κενό, βρέθηκε στην
    //    ΠΑΡΑΓΩΓΗ (2026-08-27), όχι από test. Όλες οι άγκυρες ρωτούσαν «τι
    //    κάνει η πράξη;»· **καμία** δεν ρωτούσε «τι κάνει η ΕΠΑΝΑΛΗΨΗ της;».
    //
    //    Χωρίς αυτήν, το `document-without-account` ξαναπρότεινε την ίδια πράξη
    //    με `patch === inverse`, δηλαδή **αναίρεση που δεν αναιρεί** — και η
    //    δεύτερη εκτέλεση θα κατέστρεφε τη μοναδική πραγματική αναίρεση.
    //
    // 🔑 Η άγκυρα **εκτελεί** τη μετάβαση αντί να την υποθέσει: εφαρμόζει το
    //    `forward.patch` πάνω στο έγγραφο — ακριβώς ό,τι κάνει η βάση — και
    //    ξανακρίνει το αποτέλεσμα.
    const first = planOf(planRemediation('x', 'document-without-account', GHOST, 1));
    const healed = { ...GHOST, ...first.forward.patch };

    expect(planRemediation('x', 'document-without-account', healed, 2)).toEqual({
      kind: 'none',
      reason: 'already-in-desired-state',
    });
  });

  it('Θ2.7 — ΜΕΡΙΚΩΣ θεραπευμένο: στενεύει ΜΟΝΟ στο πεδίο που απομένει', () => {
    // Η ενδιάμεση κατάσταση — ο ρόλος υποβαθμίστηκε, η αναστολή ΔΕΝ γράφτηκε
    // (π.χ. μερική γραφή, ή χειροκίνητη αλλαγή). Το σχέδιο πρέπει να αγγίξει
    // **μόνο** το `status`, και η αναίρεση να μη «θυμηθεί» ρόλο που δεν αλλάζει.
    const halfway = { ...GHOST, globalRole: SAFE_DOWNGRADE_ROLE } as const;
    const plan = planOf(planRemediation('x', 'document-without-account', halfway, 1));

    expect(plan.forward.patch).toEqual({ status: 'suspended' });
    expect(plan.inverse.patch).toEqual({ status: 'active' });
  });
});

// =============================================================================
// Λ — Η ΛΟΓΙΣΤΙΚΗ ΚΛΕΙΝΕΙ
// =============================================================================

describe('Λ — κάθε λόγος «δεν υπάρχει σχέδιο» είναι παραγώγιμος και εξηγήσιμος', () => {
  const DECLARED: readonly NoPlanReason[] = [
    'nothing-to-remediate',
    'requires-human-identification',
    'no-actionable-fields',
  ];

  it('Λ1 — και οι τρεις παράγονται από πραγματική είσοδο', () => {
    const produced = new Set<NoPlanReason>();
    for (const outcome of [
      planRemediation('a', 'consistent', GHOST, 1),
      planRemediation('b', 'account-without-document', null, null),
      planRemediation('c', 'disabled-account-active-document', { ...ZOMBIE, status: 'suspended' }, 1),
    ]) {
      if (outcome.kind === 'none') produced.add(outcome.reason);
    }
    expect(produced.size).toBe(DECLARED.length);
  });

  it('Λ2 — κάθε λόγος έχει ανθρώπινη εξήγηση, καμία κενή', () => {
    for (const reason of DECLARED) expect(explainNoPlan(reason).length).toBeGreaterThan(20);
  });
});
