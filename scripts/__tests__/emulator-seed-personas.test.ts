/**
 * ADR-798 Φάση 6 — οι άγκυρες των **οκτώ ανθρώπων**.
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

describe('ADR-798 Φάση 6 — οι οκτώ προσωπικότητες', () => {
  it('Π1 — ο παρονομαστής: υπάρχουν όντως οκτώ, με μοναδικά email', () => {
    expect(PERSONAS.length).toBe(8);
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
    expect(jobs.size).toBeGreaterThanOrEqual(3);
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
});
