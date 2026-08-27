/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΗΣ ΥΛΟΠΟΙΗΣΗΣ — «ΑΝΤΙΓΡΑΦΗ» ΚΑΙ ΟΧΙ «ΕΠΙΝΟΗΣΗ» (ADR-822 §4.7)
 * =============================================================================
 *
 * 🔴 **Η ΓΡΑΜΜΗ ΠΟΥ ΦΥΛΑΝΕ.** Το ADR-821 έκλεισε τη γεννήτρια που **επινοούσε**
 * ταυτότητα: `globalRole: 'super_admin'` που κανένα μητρώο δεν είχε πει,
 * `mfaEnrolled: true` δηλωμένο από τον αιτούντα, `email: 'dev@localhost'`.
 *
 * Αυτό εδώ **δημιουργεί έγγραφο** — δηλαδή κάνει, επιφανειακά, το ίδιο πράγμα.
 * Η διαφορά είναι **μία και μετρήσιμη**: κάθε τιμή **αντιγράφεται από το μητρώο
 * που την κατέχει**, και ό,τι δεν κατέχει κανείς **παραλείπεται**.
 *
 * ⚠️ Αν αυτές οι άγκυρες πέσουν, το ADR-822 έχει γίνει ADR-821 με άλλο όνομα.
 *
 * @see ADR-822 §4.7 · ADR-821
 */

import { describe, it, expect } from '@jest/globals';

import {
  MATERIALISED_FIELDS,
  OMITTED_FIELDS,
  explainNoMaterialisation,
  planMaterialisation,
  type AuthProfileFacts,
  type MaterialisationOutcome,
  type NoMaterialisationReason,
} from '../identity-materialisation';
import { GLOBAL_ROLES } from '../types';

const NOW = 1_800_000_000_000;

/** `6hWZagWo…` — ο αδερφός/συνέταιρος, όπως μετρήθηκε στο Auth 2026-08-27. */
const PARTNER: AuthProfileFacts = {
  uid: '6hWZagWogZPFkf3vPHwO1C20bme2',
  email: 'grigoris@example.gr',
  displayName: 'Grigoris Pagonis',
  photoURL: 'https://lh3.googleusercontent.com/a/PHOTO',
  emailVerified: true,
  disabled: false,
  providerId: 'google.com',
  creationTimeMs: 1_778_000_000_000,
  lastSignInTimeMs: 1_786_000_000_000,
  globalRoleClaim: 'super_admin',
  companyIdClaim: 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757',
};

const planOf = (o: MaterialisationOutcome) => {
  if (o.kind !== 'plan') throw new Error(`αναμενόταν σχέδιο, ήρθε '${o.reason}'`);
  return o.plan;
};

// =============================================================================
// Υ0 — ΚΑΘΕ ΠΕΔΙΟ ΕΧΕΙ ΠΗΓΗ
// =============================================================================

describe('Υ0 — κάθε πεδίο του εγγράφου προέρχεται από ΜΗΤΡΩΟ, κανένα από το πουθενά', () => {
  it('Υ0.1 — τα κλειδιά του εγγράφου είναι ΑΚΡΙΒΩΣ ο δηλωμένος πίνακας πηγών', () => {
    // 🔑 Ο πίνακας `MATERIALISED_FIELDS` είναι ΔΕΔΟΜΕΝΟ, όχι σχόλιο. Νέο πεδίο
    //    χωρίς δηλωμένη πηγή ⇒ κόκκινη. Πεδίο που δηλώθηκε αλλά δεν γράφεται
    //    ⇒ επίσης κόκκινη: ο πίνακας θα έλεγε ψέματα προς την άλλη κατεύθυνση.
    const plan = planOf(planMaterialisation(PARTNER, NOW));
    expect(Object.keys(plan.document).sort()).toEqual(Object.keys(MATERIALISED_FIELDS).sort());
  });

  it('Υ0.2 — κάθε τιμή είναι ΑΝΤΙΓΡΑΦΟ του Auth ή των claims', () => {
    const d = planOf(planMaterialisation(PARTNER, NOW)).document;
    expect(d.uid).toBe(PARTNER.uid);
    expect(d.email).toBe(PARTNER.email);
    expect(d.displayName).toBe(PARTNER.displayName);
    expect(d.photoURL).toBe(PARTNER.photoURL);
    expect(d.emailVerified).toBe(PARTNER.emailVerified);
    expect(d.authProvider).toBe(PARTNER.providerId);
    expect(d.globalRole).toBe(PARTNER.globalRoleClaim);
    expect(d.companyId).toBe(PARTNER.companyIdClaim);
    expect((d.createdAt as Date).getTime()).toBe(PARTNER.creationTimeMs);
    expect((d.lastLoginAt as Date).getTime()).toBe(PARTNER.lastSignInTimeMs);
  });

  it('Υ0.3 — 🔴 ΤΟ ΜΑΘΗΜΑ ΤΟΥ ADR-821: ο ρόλος ΔΕΝ επινοείται', () => {
    // Ο ρόλος έρχεται από τα CLAIMS. Άλλος ρόλος στα claims ⇒ άλλος στο έγγραφο.
    // Καρφωμένο 'super_admin' θα ήταν ΑΚΡΙΒΩΣ ο `ensureDevUserProfile`.
    const junior = { ...PARTNER, globalRoleClaim: 'internal_user' } as const;
    expect(planOf(planMaterialisation(junior, NOW)).document.globalRole).toBe('internal_user');
  });

  it('Υ0.4 — ο ρόλος που γράφεται είναι ΓΝΩΣΤΟΣ ρόλος', () => {
    expect(GLOBAL_ROLES).toContain(planOf(planMaterialisation(PARTNER, NOW)).document.globalRole);
  });

  it('Υ0.5 — το status είναι ΜΕΤΑΦΡΑΣΗ του disabled, όχι απόφαση', () => {
    expect(planOf(planMaterialisation(PARTNER, NOW)).document.status).toBe('active');
    // Ο απενεργοποιημένος δεν παίρνει έγγραφο ΚΑΘΟΛΟΥ (Υ2.1) — δεν παίρνει
    // «έγγραφο με status suspended». Η αντίστροφη θεραπεία θα ήταν λάθος.
    const off = planMaterialisation({ ...PARTNER, disabled: true }, NOW);
    expect(off.kind).toBe('none');
  });

  it('Υ0.6 — καθαρή συνάρτηση: ΙΔΙΑ είσοδος ⇒ ΙΔΙΑ έξοδος', () => {
    // ⚠️ Ένα `Date.now()` μέσα στη συνάρτηση θα την έκανε μη-δοκιμάσιμη και
    //    θα έσπαγε το resume των workflow (ίδιος λόγος με τα scripts).
    const a = JSON.stringify(planOf(planMaterialisation(PARTNER, NOW)).document);
    const b = JSON.stringify(planOf(planMaterialisation(PARTNER, NOW)).document);
    expect(a).toBe(b);
  });
});

// =============================================================================
// Υ1 — Η ΠΑΡΑΛΕΙΨΗ ΕΙΝΑΙ Η ΤΙΜΙΑ ΑΠΑΝΤΗΣΗ
// =============================================================================

describe('Υ1 — ό,τι δεν κατέχει κανένα μητρώο ΠΑΡΑΛΕΙΠΕΤΑΙ, δεν μαντεύεται', () => {
  it('Υ1.1 — 🔑 το loginCount ΔΕΝ γράφεται: το 0 θα ήταν ψέμα', () => {
    // Ο άνθρωπος έχει συνδεθεί. `loginCount: 0` θα έλεγε «ποτέ» — ψέμα με
    // σχήμα αριθμού. Και είναι αυτο-θεραπευόμενο: increment(1) στο επόμενο login.
    expect(planOf(planMaterialisation(PARTNER, NOW)).document).not.toHaveProperty('loginCount');
  });

  it('Υ1.2 — ούτε givenName / familyName / mfaEnrolled / permissions', () => {
    const d = planOf(planMaterialisation(PARTNER, NOW)).document;
    for (const field of Object.keys(OMITTED_FIELDS)) expect(d).not.toHaveProperty(field);
  });

  it('Υ1.3 — κάθε παράλειψη έχει ΓΡΑΠΤΟ λόγο, ορατό στον εγκρίνοντα', () => {
    const plan = planOf(planMaterialisation(PARTNER, NOW));
    expect(Object.keys(plan.omitted).length).toBe(Object.keys(OMITTED_FIELDS).length);
    for (const reason of Object.values(plan.omitted)) expect(reason.length).toBeGreaterThan(20);
  });

  it('Υ1.4 — άγνωστος πάροχος γίνεται ΟΝΟΜΑΣΜΕΝΟ "unknown", όχι μαντεψιά', () => {
    const d = planOf(planMaterialisation({ ...PARTNER, providerId: null }, NOW)).document;
    expect(d.authProvider).toBe('unknown');
    expect(d.authProvider).not.toBe('google.com');
  });
});

// =============================================================================
// Υ2 — ΟΙ ΑΡΝΗΣΕΙΣ
// =============================================================================

describe('Υ2 — πότε ΔΕΝ υλοποιείται έγγραφο, με ονομασμένο λόγο', () => {
  const DECLARED: readonly NoMaterialisationReason[] = [
    'account-disabled',
    'no-email-in-auth',
    'no-role-claim',
  ];

  it('Υ2.1 — απενεργοποιημένος λογαριασμός ⇒ καμία παρουσία', () => {
    expect(planMaterialisation({ ...PARTNER, disabled: true }, NOW)).toEqual({
      kind: 'none',
      reason: 'account-disabled',
    });
  });

  it('Υ2.2 — χωρίς email ⇒ άρνηση (το μόνο μητρώο που το κατέχει δεν το έχει)', () => {
    expect(planMaterialisation({ ...PARTNER, email: null }, NOW)).toEqual({
      kind: 'none',
      reason: 'no-email-in-auth',
    });
  });

  it('Υ2.3 — 🔴 χωρίς globalRole claim ⇒ ΑΡΝΗΣΗ, ποτέ προεπιλογή ρόλου', () => {
    // ⚠️ Ένα `?? 'external_user'` εδώ θα ήταν «ασφαλής» επινόηση — αλλά
    //    επινόηση. Το τι επιτρέπεται το κατέχουν τα claims, και μόνο αυτά.
    expect(planMaterialisation({ ...PARTNER, globalRoleClaim: null }, NOW)).toEqual({
      kind: 'none',
      reason: 'no-role-claim',
    });
  });

  it('Υ2.4 — και οι τρεις λόγοι είναι παραγώγιμοι· η λογιστική κλείνει', () => {
    const produced = new Set<NoMaterialisationReason>();
    for (const facts of [
      { ...PARTNER, disabled: true },
      { ...PARTNER, email: null },
      { ...PARTNER, globalRoleClaim: null },
    ]) {
      const o = planMaterialisation(facts, NOW);
      if (o.kind === 'none') produced.add(o.reason);
    }
    expect(produced.size).toBe(DECLARED.length);
    for (const reason of DECLARED) expect(explainNoMaterialisation(reason).length).toBeGreaterThan(20);
  });
});

// =============================================================================
// Υ3 — Η ΜΗ-ΑΝΑΣΤΡΕΨΙΜΟΤΗΤΑ ΕΙΝΑΙ ΔΗΛΩΜΕΝΗ
// =============================================================================

describe('Υ3 — η μόνη πράξη χωρίς undo το ΛΕΕΙ, δεν το κρύβει', () => {
  it('Υ3.1 — inverse === null, ΕΠΙΤΗΔΕΣ, με γραπτή σημείωση', () => {
    // 🔑 Κάθε άλλη πράξη γεννά την αναίρεσή της (Θ1). Αυτή δεν μπορεί, γιατί η
    //    αναίρεση θα ήταν διαγραφή — και ο κώδικας δεν διαγράφει ΠΟΤΕ. Ένα
    //    σιωπηλό `undefined` θα διαβαζόταν ως «ξεχάστηκε».
    const plan = planOf(planMaterialisation(PARTNER, NOW));
    expect(plan.inverse).toBeNull();
    expect(plan.inverseNote).toMatch(/ΜΗ ΑΝΑΣΤΡΕΨΙΜΗ/);
    expect(plan.inverseNote).toMatch(/materialiseFromAuth/);
  });

  it('Υ3.2 — η περίληψη ονομάζει την πηγή του ρόλου', () => {
    // Ο εγκρίνων πρέπει να διαβάσει «από τα CLAIMS» πριν πει ναι.
    expect(planOf(planMaterialisation(PARTNER, NOW)).summary).toMatch(/CLAIMS/);
  });
});
