/**
 * ADR-798 Φάση 6 · §19 — οι άγκυρες των **δεκατριών ανθρώπων**.
 *
 * ⚠️ **ΓΙΑΤΙ ΧΡΕΙΑΖΟΝΤΑΙ ΑΓΚΥΡΕΣ ΣΕ ΕΝΑ SEED SCRIPT.** Ο σπορέας δεν σπάει ποτέ
 * θορυβωδώς: αν ένας κωδικός ISCO δεν λύνεται, η προσωπικότητα γίνεται **σιωπηλά
 * ισοδύναμη με «χωρίς επάγγελμα»** — το script τυπώνει ✅, ο χρήστης δημιουργείται,
 * και το rig δοκιμάζει **κόσμο που δεν υπάρχει**. Ακριβώς η βλάβη που το ADR-798
 * §17.3 πλήρωσε με δύο fixtures.
 *
 * 🔑 Οι άγκυρες τρέχουν **χωρίς emulator**: κρίνουν τα **δεδομένα** των
 * προσωπικοτήτων έναντι των **πραγματικών** SSoT (`GLOBAL_ROLES` ·
 * `ISCO_JOB_AFFINITY`), όχι τη σπορά.
 */

import { GLOBAL_ROLES } from '@/lib/auth/types';
import { resolveJobAffinity } from '@/config/isco-job-affinity';

import { PERSONAS } from '../lib/emulator/personas';

describe('ADR-798 Φάση 6 · §19 — οι δεκατρείς προσωπικότητες', () => {
  it('Π1 — ο παρονομαστής: υπάρχουν όντως δεκατρείς, με μοναδικά email', () => {
    expect(PERSONAS.length).toBe(13);
    expect(new Set(PERSONAS.map((p) => p.email)).size).toBe(PERSONAS.length);
  });

  it('Κ1 — κάθε globalRole υπάρχει στο ΠΡΑΓΜΑΤΙΚΟ λεξιλόγιο των claims', () => {
    const vocabulary = new Set<string>(GLOBAL_ROLES);
    for (const person of PERSONAS) {
      expect(vocabulary.has(person.globalRole)).toBe(true);
    }
  });

  /**
   * 🔴 Η ΚΥΡΙΑ ΑΓΚΥΡΑ. Ένας κωδικός που δεν λύνεται **δεν σπάει τίποτα** — απλώς
   * δεν κάνει τίποτα, και το σενάριο εξαφανίζεται χωρίς να το πει κανείς.
   */
  it('Κ2 — κάθε iscoCode ΛΥΝΕΤΑΙ σε δουλειά (αλλιώς η προσωπικότητα είναι σιωπηλά κενή)', () => {
    const unresolved = PERSONAS
      .filter((p) => p.occupation?.iscoCode)
      .filter((p) => resolveJobAffinity(p.occupation?.iscoCode) === null)
      .map((p) => `${p.email} → ${p.occupation?.iscoCode}`);
    expect(unresolved).toEqual([]);
  });

  it('Κ3 — οι οκτώ καλύπτουν ≥3 ΔΙΑΦΟΡΕΤΙΚΕΣ δουλειές, αλλιώς είναι αντίγραφα ενός σεναρίου', () => {
    const jobs = new Set(
      PERSONAS.map((p) => resolveJobAffinity(p.occupation?.iscoCode)).filter(Boolean),
    );
    expect(jobs.size).toBeGreaterThanOrEqual(4);
  });

  /**
   * 🔑 Το ΚΡΙΣΙΜΟ ΖΕΥΓΟΣ: το `landing.ts:104` κρίνει **ένα μπιτ** (`companyId`).
   * Χωρίς δύο ανθρώπους που διαφέρουν **μόνο** σε αυτό, το rig δεν μπορεί να
   * απομονώσει τη μεταβλητή — θα σύγκρινε δύο πράγματα ταυτόχρονα.
   */
  it('Κ4 — υπάρχει ζεύγος με ΙΔΙΟ επάγγελμα και ΑΛΛΟΝ χώρο', () => {
    const solo = PERSONAS.find((p) => !p.companyId && p.occupation?.iscoCode);
    const org = PERSONAS.find(
      (p) => p.companyId && p.occupation?.iscoCode === solo?.occupation?.iscoCode,
    );
    expect(solo).toBeDefined();
    expect(org).toBeDefined();
    expect(org?.email).not.toBe(solo?.email);
  });

  it('Κ5 — υπάρχει άνθρωπος ΧΩΡΙΣ επάγγελμα: ο πολίτης δεν είναι επαγγελματίας', () => {
    expect(PERSONAS.some((p) => !p.occupation && !p.companyId)).toBe(true);
  });

  /**
   * ⚠️ ADR-798 **Α4**: το επάγγελμα ΔΕΝ μπαίνει στα claims — δεν είναι
   * εξουσιοδότηση, και τα claims έχουν όριο 1.000 bytes. Η άγκυρα κρίνει το
   * **σχήμα** του τύπου: αν κάποιος προσθέσει `occupation` στα claims, το
   * `SeedIdentity` θα πρέπει να αλλάξει και αυτή η γραμμή να ξαναγραφτεί.
   */
  it('Κ6 — καμία προσωπικότητα δεν κουβαλά το επάγγελμα ως πεδίο ρόλου', () => {
    for (const person of PERSONAS) {
      expect(person.globalRole).not.toMatch(/architect|surveyor|lawyer|accountant/i);
    }
  });
  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΠΟΥ ΕΛΕΙΠΕ (ADR-798 §19).** Το `Κ2` ρωτά τον **ΠΙΝΑΚΑ**· η οθόνη
   * περνά από τη **ΔΙΑΔΡΟΜΗ**, και ανάμεσά τους στέκεται ο `useDeclaredOccupation`,
   * που **αρνείται** `iscoCode` χωρίς `escoUri` (άγκυρα `Ρ-4`). Μέχρι 2026-08-26
   * κανένας από τους οκτώ δεν είχε `escoUri` ⇒ **8 στους 8** έφταναν ως **σιωπή**
   * με το `Κ2` **πράσινο**. Ο μοναδικός γραφέας της παραγωγής
   * (`EscoOccupationPicker`) εκπέμπει **και τα τέσσερα ή κανένα**.
   *
   * ⚠️ Το σχήμα κρίνεται γιατί ο τύπος εγγυάται μόνο «συμβολοσειρά»: ένα
   * `escoUri: 'TODO'` θα ικανοποιούσε τον μεταγλωττιστή και θα ξαναγεννούσε τη
   * βλάβη σε νέα μορφή — ο hook θα έλεγε `isClassified`, ο καθρέφτης όχι.
   */
  it('Κ7 — κάθε επάγγελμα φέρει ESCO URI που ο picker ΘΑ ΜΠΟΡΟΥΣΕ να παραγάγει', () => {
    const shape = /^http:\/\/data\.europa\.eu\/esco\/occupation\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const bad = PERSONAS
      .filter((p) => p.occupation)
      .filter((p) => !shape.test(p.occupation?.escoUri ?? ''))
      .map((p) => `${p.email} -> ${p.occupation?.escoUri}`);
    expect(bad).toEqual([]);
  });

  /**
   * 🔑 Το ESCO εγγυάται ότι **κάθε occupation ανήκει σε ΑΚΡΙΒΩΣ ΜΙΑ** ομάδα
   * ISCO-08. Άρα το ζεύγος δεν είναι θέμα εμπιστοσύνης — είναι **ελέγξιμο**: δύο
   * άνθρωποι με το **ίδιο** URI οφείλουν να κουβαλούν **ίδιο** κωδικό και **ίδια**
   * ετικέτα. Χωρίς αυτό, μια χειρόγραφη διόρθωση σε **έναν** από τους δύο
   * αρχιτέκτονες θα δίχαζε την ταξινόμηση **χωρίς καμία πύλη να το δει**.
   */
  it('Κ8 — ίδιο ESCO URI σημαίνει ίδιος κωδικός ΚΑΙ ίδια ετικέτα', () => {
    const byUri = new Map<string, { code: string; label: string }>();
    const drift: string[] = [];
    for (const person of PERSONAS) {
      const o = person.occupation;
      if (!o) continue;
      const seen = byUri.get(o.escoUri);
      if (!seen) {
        byUri.set(o.escoUri, { code: o.iscoCode, label: o.escoLabel });
        continue;
      }
      if (seen.code !== o.iscoCode || seen.label !== o.escoLabel) {
        drift.push(`${person.email}: ${seen.code}/${seen.label} vs ${o.iscoCode}/${o.escoLabel}`);
      }
    }
    expect(drift).toEqual([]);
  });

  /**
   * ⚠️ **ΟΝΟΜΑΣΤΙΚΑ, ΟΧΙ ΜΕ ΠΛΗΘΟΣ.** Το `Κ3` μετρά «≥4 διαφορετικές» — μια
   * **ανταλλαγή** (χάνεται το Εργοτάξιο, εμφανίζεται κάτι άλλο) θα το άφηνε
   * πράσινο. Το Εργοτάξιο είχε **μηδέν** κάλυψη μέχρι 2026-08-26, ενώ είναι μία
   * από τις έξι δουλειές του μητρώου.
   */
  it('Κ9 — το ΕΡΓΟΤΑΞΙΟ καλύπτεται ονομαστικά, όχι κατά πλήθος', () => {
    const jobs = PERSONAS.map((p) => resolveJobAffinity(p.occupation?.iscoCode));
    expect(jobs).toContain('site');
    expect(jobs).toContain('design');
    expect(jobs).toContain('clients');
    expect(jobs).toContain('finance');
  });
});
