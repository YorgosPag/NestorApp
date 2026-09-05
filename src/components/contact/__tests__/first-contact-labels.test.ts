/**
 * @fileoverview **ΚΑΘΕ ΚΕΙΜΕΝΟ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ ΕΧΕΙ ΛΕΞΕΙΣ** — σε ΔΥΟ γλώσσες.
 * @related ADR-843 §10 · components/contact/first-contact-labels.ts · N.11
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ — ΤΟ ΓΕΙΤΟΝΙΚΟ ΥΠΟΣΥΣΤΗΜΑ ΤΟ ΠΛΗΡΩΣΕ ΖΩΝΤΑΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Στο ADR-832 ένας κωδικός άρνησης (`listing-conflicting-mandate`) γεννήθηκε στον
 * γραφέα, ταξίδεψε ως τα σύνορα — και **έλειπε από τον πίνακα ετικετών**. Η οθόνη τον
 * διάβαζε ως *«δεν μάθαμε»* και έλεγε *«δοκιμάστε ξανά χωρίς να αλλάξετε τίποτα»*,
 * δηλαδή **ακριβώς το αντίθετο** από ό,τι έπρεπε.
 *
 * ⚠️ Ο τύπος `Record<Κλειστό, string>` φυλά την **πληρότητα** του πίνακα — αλλά ο N.17
 * απαγορεύει στον πράκτορα να τρέξει `tsc`, και το hook έρχεται **μετά**.
 *
 * 🔴 **ΚΑΙ Ο ΜΕΤΑΓΛΩΤΤΙΣΤΗΣ ΔΕΝ ΦΥΛΑΕΙ ΤΗΝ ΑΛΛΗ ΑΚΡΗ**: πίνακας που δείχνει σε
 * **ανύπαρκτο** κλειδί μεταγλωττίζεται μια χαρά, και ο άνθρωπος βλέπει
 * `property-market:contact.first.…` **ωμό στην οθόνη**. Αυτό το φυλά **μόνο** αυτό εδώ.
 */

import el from '@/i18n/locales/el/property-market.json';
import en from '@/i18n/locales/en/property-market.json';

import {
  ACT_KEYS,
  FORM_BLOCKER_KEYS,
  INBOX_KEYS,
  INVARIANT_KEYS,
  MINE_KEYS,
  REJECTION_KEYS,
  REJECTION_REMEDY,
  demandBlockerKey,
} from '@/components/contact/first-contact-labels';
import { FIRST_CONTACT_REJECTIONS } from '@/services/contact/first-contact-vocabulary';
import { FIRST_CONTACT_INVARIANTS } from '@/types/first-contact';
import { FIRST_CONTACT_FORM_BLOCKERS } from '@/lib/contact/first-contact-form-values';
import { DEMAND_BLOCKERS } from '@/lib/demand/demand-match-vocabulary';

type Bundle = Record<string, unknown>;

/** `property-market:contact.first.x` → η τιμή του, ή `undefined`. */
function wordsForKey(bundle: Bundle, qualifiedKey: string): unknown {
  const path = qualifiedKey.includes(':') ? qualifiedKey.split(':')[1] : qualifiedKey;
  return path
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node === null || typeof node !== 'object' ? undefined : (node as Bundle)[part],
      bundle,
    );
}

const TABLES: readonly (readonly [string, Readonly<Record<string, string>>])[] = [
  ['REJECTION_KEYS', REJECTION_KEYS],
  ['INVARIANT_KEYS', INVARIANT_KEYS],
  ['FORM_BLOCKER_KEYS', FORM_BLOCKER_KEYS],
  ['ACT_KEYS', ACT_KEYS],
  ['MINE_KEYS', MINE_KEYS],
  ['INBOX_KEYS', INBOX_KEYS],
];

const LANGUAGES = [['el', el], ['en', en]] as const;

describe('🔴 Ρ — κάθε κείμενο της πρώτης επαφής υπάρχει, σε ΔΥΟ γλώσσες', () => {
  it('🔑 Ρ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: κανένας πίνακας ΔΕΝ είναι κενός', () => {
    // ⚠️ Χωρίς αυτό, ένας πίνακας που έγινε κατά λάθος `{}` θα περνούσε **κάθε** άλλο
    //    σκέλος — μηδέν κλειδιά σημαίνει μηδέν αποτυχίες.
    for (const [name, table] of TABLES) {
      expect([name, Object.keys(table).length > 0]).toEqual([name, true]);
    }
  });

  it.each(LANGUAGES)('🔴 Ρ1 — %s: κανένα κλειδί πίνακα χωρίς λέξεις', (_lang, bundle) => {
    const gaps: string[] = [];
    for (const [name, table] of TABLES) {
      for (const [code, key] of Object.entries(table)) {
        const words = wordsForKey(bundle as Bundle, key);
        if (typeof words !== 'string' || words.trim() === '') gaps.push(`${name}.${code} → ${key}`);
      }
    }
    expect(gaps).toEqual([]);
  });

  it('🔴 Ρ2 — και το κείμενο ΔΕΝ είναι το ίδιο το αναγνωριστικό', () => {
    // Ένα κλειδί που «μεταφράστηκε» στον εαυτό του είναι **ωμό κλειδί με άλλο ρούχο**.
    const echoes: string[] = [];
    for (const [, table] of TABLES) {
      for (const [code, key] of Object.entries(table)) {
        for (const [lang, bundle] of LANGUAGES) {
          const words = wordsForKey(bundle as Bundle, key);
          if (words === code || words === key) echoes.push(`${lang} · ${key}`);
        }
      }
    }
    expect(echoes).toEqual([]);
  });

  it('🔴 Ρ3 — ΚΑΘΕ ΚΩΔΙΚΑΣ ΤΩΝ ΚΛΕΙΣΤΩΝ ΣΥΝΟΛΩΝ ΕΧΕΙ ΓΡΑΜΜΗ', () => {
    expect(FIRST_CONTACT_REJECTIONS.filter((code) => !(code in REJECTION_KEYS))).toEqual([]);
    expect(FIRST_CONTACT_INVARIANTS.filter((code) => !(code in INVARIANT_KEYS))).toEqual([]);
    expect(FIRST_CONTACT_FORM_BLOCKERS.filter((code) => !(code in FORM_BLOCKER_KEYS))).toEqual([]);
    // 🔑 Και η **διέξοδος** είναι πλήρης: `null` είναι απάντηση, απουσία γραμμής όχι.
    expect(FIRST_CONTACT_REJECTIONS.filter((code) => !(code in REJECTION_REMEDY))).toEqual([]);
  });

  it('🔑 Ρ4 — η άγκυρα ΠΙΑΝΕΙ πραγματικά: ανύπαρκτο κλειδί λείπει', () => {
    // ⚠️ Χωρίς αυτό, ένα σφάλμα στο `wordsForKey` θα έκανε **τα πάντα** να «υπάρχουν».
    expect(wordsForKey(el as Bundle, 'property-market:contact.first.δεν-υπάρχει')).toBeUndefined();
  });
});

describe('🔴 Σ — ΤΑ ΔΥΝΑΜΙΚΑ ΚΛΕΙΔΙΑ, ΠΟΥ ΚΑΝΕΝΑΣ ΤΥΠΟΣ ΔΕΝ ΦΥΛΑΕΙ', () => {
  /**
   * 🔴 **ΤΟ ΕΠΙΚΙΝΔΥΝΟΤΕΡΟ ΣΗΜΕΙΟ ΤΟΥ ΑΡΧΕΙΟΥ ΕΤΙΚΕΤΩΝ.** Το `demandBlockerKey()`
   * χτίζει κλειδί με **συνένωση** — άρα ο μεταγλωττιστής δέχεται **οποιαδήποτε**
   * συμβολοσειρά και η CHECK 3.8 βλέπει μόνο τη ρίζα. Αν το λεξιλόγιο των αξόνων
   * αποκτήσει **νέο** μέλος χωρίς ετικέτα, ο προσφέρων θα δει `demand.blocker.…`
   * **ωμό μέσα στη λίστα «γιατί ταιριάζει»** — και τίποτα άλλο δεν θα το έλεγε.
   *
   * ⚠️ **Ο αριθμός «21ο» αφαιρέθηκε** *(ADR-777 §8.52)*: πάλιωσε την ώρα που το λεξιλόγιο
   * απέκτησε τα τέσσερα εμπόδια απουσίας. Το test μετρά το **σύνολο**, όχι ένα πλήθος —
   * και ένας αριθμός σε πρόζα δίπλα σε μια άγκυρα που τον υπολογίζει είναι ακριβώς το
   * σχήμα που το N.12 πλήρωσε τρεις φορές.
   */
  it.each(LANGUAGES)('🔴 Σ1 — %s: κάθε άξονας ζήτησης έχει λέξεις', (_lang, bundle) => {
    const gaps = DEMAND_BLOCKERS.filter((axis) => {
      const words = wordsForKey(bundle as Bundle, demandBlockerKey(axis));
      return typeof words !== 'string' || words.trim() === '';
    });
    expect(gaps).toEqual([]);
  });

  it('🔑 Σ2 — ο παρονομαστής: άγνωστος άξονας ΔΕΝ βρίσκει λέξεις', () => {
    expect(wordsForKey(el as Bundle, demandBlockerKey('δεν-υπάρχει-άξονας'))).toBeUndefined();
  });
});

describe('🔴 Τ — ΟΙ ΔΥΟ ΑΠΟΦΑΣΕΙΣ ΠΟΥ ΖΟΥΝ ΜΕΣΑ ΣΤΟ ΚΕΙΜΕΝΟ', () => {
  /**
   * 🔴 **Κ9, ΑΠΟΛΥΤΟ — ΤΟ ΟΡΙΟ ΔΕΝ ΠΟΥΛΙΕΤΑΙ.**
   *
   * Η θεραπεία της γεμάτης χωρητικότητας είναι *«κλείσε κάποια από τις ανοιχτές»*,
   * **ποτέ** *«αναβάθμισε»*. Ένα όριο που πουλιέται παύει να είναι προστασία και
   * γίνεται προϊόν — και τότε **εμείς** θα ελέγχαμε το νούμερο.
   *
   * ⚠️ Είναι απόφαση **ΑΡΧΙΤΕΚΤΟΝΙΚΗ**, όχι διατύπωση: δεν υπάρχει πεδίο
   * χωρητικότητας σε χρήστη/πακέτο/`capabilities` πουθενά στο δέντρο. Αυτό εδώ φυλά
   * την **οθόνη**, που είναι η μόνη πόρτα από την οποία θα ξαναέμπαινε.
   */
  it.each(LANGUAGES)('⛔ Τ1 — %s: η γεμάτη χωρητικότητα ΔΕΝ προτείνει αγορά', (_lang, bundle) => {
    const words = wordsForKey(bundle as Bundle, REJECTION_KEYS['capacity-full']);
    expect(typeof words).toBe('string');

    const forbidden = ['αναβάθμ', 'αναβαθμ', 'πακέτο', 'συνδρομ', 'πληρωμ', 'αγορά',
      'upgrade', 'plan', 'subscri', 'premium', 'pay'];
    const found = forbidden.filter((w) => String(words).toLowerCase().includes(w));
    expect(found).toEqual([]);
  });

  it.each(LANGUAGES)('🔑 Τ2 — %s: και ο αριθμός έρχεται από τον διακομιστή', (_lang, bundle) => {
    // ⚠️ Το `{capacity}` **οφείλει** να είναι στο κείμενο: αν η οθόνη έγραφε το «10»
    //    μόνη της, θα ήταν **δεύτερη αυθεντία** πάνω σε αριθμό που το ΠΕ5 λέει ρητά
    //    ότι μπορεί να αλλάξει — και οι δύο θα απέκλιναν σιωπηλά.
    expect(String(wordsForKey(bundle as Bundle, REJECTION_KEYS['capacity-full'])))
      .toContain('{capacity}');
  });

  /**
   * 🔴 **Κ10 — Η ΔΙΑΤΥΠΩΣΗ ΤΗΣ ΑΠΟΣΥΡΣΗΣ ΕΙΝΑΙ ΜΕΡΟΣ ΤΗΣ ΑΠΟΦΑΣΗΣ.**
   *
   * Η απόσυρση ανακαλεί τη **ΣΧΕΣΗ**, ποτέ την **ΙΣΤΟΡΙΑ** (ΠΕ6). Ο άλλος μπορεί να
   * έχει το τηλέφωνο σε χαρτί· *«διαγράφονται τα στοιχεία σου»* είναι **υπόσχεση που
   * δεν μπορούμε να κρατήσουμε** — και μια τέτοια είναι χειρότερη από καμία.
   *
   * ⚠️ **ΔΕΝ είναι το δικαίωμα στη λήθη** (Κ11): η τελική διατύπωση περνά από
   * δικηγόρο. Αυτή η άγκυρα δεν εγκρίνει κείμενο — **απαγορεύει το ψέμα**.
   */
  it.each(LANGUAGES)('⛔ Τ3 — %s: η απόσυρση ΔΕΝ υπόσχεται διαγραφή', (_lang, bundle) => {
    const words = String(wordsForKey(bundle as Bundle, MINE_KEYS.withdrawBody)).toLowerCase();
    expect(words.length).toBeGreaterThan(0);

    const lies = ['διαγρ', 'σβήν', 'σβησ', 'delete', 'erase', 'wipe', 'remov'];
    expect(lies.filter((w) => words.includes(w))).toEqual([]);
  });

  it('🔑 Τ4 — ο παρονομαστής: οι απαγορευμένες λέξεις ΘΑ πιάνονταν', () => {
    // ⚠️ Χωρίς αυτό, ένα λάθος στο `toLowerCase`/`includes` θα έκανε τα Τ1 και Τ3
    //    **μονίμως πράσινα** — δηλαδή σχόλια, όχι άγκυρες.
    const sample = 'Τα στοιχεία σας ΔΙΑΓΡΑΦΟΝΤΑΙ οριστικά'.toLowerCase();
    expect(['διαγρ', 'σβήν'].filter((w) => sample.includes(w))).toEqual(['διαγρ']);
  });
});
