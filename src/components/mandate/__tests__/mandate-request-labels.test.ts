/**
 * @fileoverview **ΚΑΘΕ ΚΕΙΜΕΝΟ ΤΗΣ ΦΟΡΜΑΣ ΤΟΥ Σ1 ΕΧΕΙ ΛΕΞΕΙΣ** — σε ΔΥΟ γλώσσες.
 * @related ADR-832 §5 · components/mandate/mandate-request-form-labels.ts · N.11
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ: ΕΝΑΣ ΚΩΔΙΚΑΣ ΕΦΤΑΣΕ ΩΣ ΤΑ ΣΥΝΟΡΑ ΚΑΙ ΚΑΝΕΙΣ ΔΕΝ ΤΟΝ ΟΝΟΜΑΖΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `listing-conflicting-mandate` γεννήθηκε στον γραφέα του Σ1 (ADR-832 §5.7),
 * ταξίδεψε ως το `readOutcome` — και **έλειπε από τον `REJECTION_KEYS`**. Η φόρμα
 * τον διάβαζε ως *«δεν μάθαμε»* και έλεγε στον άνθρωπο *«δοκιμάστε ξανά χωρίς να
 * αλλάξετε τίποτα»*, δηλαδή **ακριβώς το αντίθετο** από ό,τι έπρεπε.
 *
 * ⚠️ Ο τύπος `Record<MandateRequestRejection, string>` θα το είχε πιάσει στη
 * μεταγλώττιση — αλλά ο N.17 απαγορεύει στον πράκτορα να τρέξει `tsc`, και το
 * pre-commit hook έρχεται **μετά**. Άγκυρα που **τρέχει** το πιάνει τώρα.
 *
 * 🔴 **Και ο μεταγλωττιστής φυλά ΜΟΝΟ την πληρότητα του πίνακα**: ένας πίνακας που
 * δείχνει σε **ανύπαρκτο** κλειδί μεταγλωττίζεται μια χαρά, και ο ιδιοκτήτης βλέπει
 * `property-market:mandate.request.…` **ωμό**. Αυτό το φυλά **μόνο** αυτό εδώ.
 */

import el from '@/i18n/locales/el/property-market.json';
import en from '@/i18n/locales/en/property-market.json';

import {
  REJECTION_KEYS,
  SCREEN_KEYS,
  TEXT_KEYS,
} from '@/components/mandate/mandate-request-form-labels';
import {
  LISTING_AGREEMENT_I18N_KEYS,
  everyAgreementNamed,
} from '@/components/mandate/listing-agreement-labels';
import {
  OFFER_KIND_I18N_KEYS,
  everyOfferKindNamed,
} from '@/components/mandate/offer-kind-labels';
import { MANDATE_REQUEST_FORM_BLOCKERS } from '@/lib/mandate/mandate-request-form-values';
import { MANDATE_REQUEST_REJECTIONS } from '@/services/mandate/mandate-request.service';
import { OFFER_KINDS } from '@/types/property-offers';
import { LISTING_AGREEMENTS } from '@/types/listing-agreement';

type Bundle = Record<string, unknown>;

/** `property-market:mandate.request.x` → η τιμή του, ή `undefined`. */
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
  ['TEXT_KEYS', TEXT_KEYS],
  ['REJECTION_KEYS', REJECTION_KEYS],
  ['SCREEN_KEYS', SCREEN_KEYS],
  ['LISTING_AGREEMENT_I18N_KEYS', LISTING_AGREEMENT_I18N_KEYS],
  ['OFFER_KIND_I18N_KEYS', OFFER_KIND_I18N_KEYS],
];

describe('🔴 Ρ — κάθε κείμενο της φόρμας του Σ1 υπάρχει, σε ΔΥΟ γλώσσες', () => {
  it('🔑 Ρ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: κανένας πίνακας ΔΕΝ είναι κενός', () => {
    for (const [name, table] of TABLES) {
      expect([name, Object.keys(table).length > 0]).toEqual([name, true]);
    }
  });

  it.each([['el', el], ['en', en]] as const)(
    '🔴 Ρ1 — %s: κανένα κλειδί πίνακα χωρίς λέξεις',
    (_lang, bundle) => {
      const gaps: string[] = [];
      for (const [name, table] of TABLES) {
        for (const [code, key] of Object.entries(table)) {
          const words = wordsForKey(bundle as Bundle, key);
          if (typeof words !== 'string' || words.trim() === '') gaps.push(`${name}.${code} → ${key}`);
        }
      }
      expect(gaps).toEqual([]);
    },
  );

  it('🔴 Ρ2 — και το κείμενο ΔΕΝ είναι το ίδιο το αναγνωριστικό', () => {
    const echoes: string[] = [];
    for (const [, table] of TABLES) {
      for (const [code, key] of Object.entries(table)) {
        for (const [lang, bundle] of [['el', el], ['en', en]] as const) {
          const words = wordsForKey(bundle as Bundle, key);
          if (words === code || words === key) echoes.push(`${lang} · ${key}`);
        }
      }
    }
    expect(echoes).toEqual([]);
  });

  it('🔴 Ρ3 — ΚΑΘΕ ΚΩΔΙΚΑΣ ΤΩΝ ΚΛΕΙΣΤΩΝ ΣΥΝΟΛΩΝ ΕΧΕΙ ΓΡΑΜΜΗ ΣΤΟΝ ΠΙΝΑΚΑ', () => {
    // 🔴 **ΑΥΤΗ Η ΓΡΑΜΜΗ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΥΠΑΡΧΕΙ ΤΟ ΑΡΧΕΙΟ**: το
    //    `listing-conflicting-mandate` έλειπε από τον `REJECTION_KEYS` ενώ ο γραφέας
    //    τον παρήγε ήδη — και ο άνθρωπος έβλεπε «δεν μάθαμε» αντί για τη διέξοδο.
    const missingRejections = MANDATE_REQUEST_REJECTIONS.filter(
      (code) => !(code in REJECTION_KEYS),
    );
    expect(missingRejections).toEqual([]);

    const missingBlockers = MANDATE_REQUEST_FORM_BLOCKERS.filter((code) => !(code in TEXT_KEYS));
    expect(missingBlockers).toEqual([]);
  });

  it('🔑 Ρ4 — η άγκυρα ΠΙΑΝΕΙ πραγματικά: ανύπαρκτο κλειδί λείπει', () => {
    // ⚠️ Χωρίς αυτό, ένα σφάλμα στο `wordsForKey` θα έκανε **τα πάντα** να «υπάρχουν».
    expect(wordsForKey(el as Bundle, 'property-market:mandate.request.δεν-υπάρχει')).toBeUndefined();
  });
});

// ============================================================================
// Σ — ΟΙ ΠΑΡΟΝΟΜΑΣΤΕΣ ΤΩΝ ΛΕΞΙΛΟΓΙΩΝ (CHECK 3.54)
// ============================================================================

describe('Σ — κάθε λεξιλόγιο έχει όνομα για κάθε τιμή του', () => {
  /**
   * 🔑 **ΟΙ ΔΥΟ ΣΥΝΑΡΤΗΣΕΙΣ ΗΤΑΝ ΑΔΡΑΝΕΙΣ ΦΡΟΥΡΟΙ** (ADR-749 §5): υπήρχαν με **μηδέν
   * καλούντες** — ακριβώς το σχήμα που το ADR-832 §1 μέτρησε στο
   * `allowsOtherAgencies`. Ο τύπος `Record<K, string>` εγγυάται ήδη την πληρότητα,
   * αλλά ο N.17 απαγορεύει `tsc` στον πράκτορα: **μόνο εκτελούμενη** άγκυρα
   * κοκκινίζει σήμερα (CHECK 3.54 — *«μπορεί αυτό το αρχείο να κοκκινίσει κάτι;»*).
   */
  it('Σ1 — κάθε ΕΙΔΟΣ ΕΝΤΟΛΗΣ έχει όνομα', () => {
    expect(everyAgreementNamed()).toBe(true);
    expect(Object.keys(LISTING_AGREEMENT_I18N_KEYS).sort()).toEqual([...LISTING_AGREEMENTS].sort());
  });

  it('Σ2 — κάθε ΠΡΑΞΗ έχει όνομα', () => {
    expect(everyOfferKindNamed()).toBe(true);
    expect(Object.keys(OFFER_KIND_I18N_KEYS).sort()).toEqual([...OFFER_KINDS].sort());
  });
});
