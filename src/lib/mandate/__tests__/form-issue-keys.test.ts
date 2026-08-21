/**
 * @fileoverview **ΚΑΘΕ ΚΩΔΙΚΑΣ ΤΗΣ ΦΟΡΜΑΣ ΕΧΕΙ ΛΕΞΕΙΣ** — σε ΔΥΟ γλώσσες (§8.33).
 * @related components/shared/forms/FormIssues.tsx · CLAUDE.md N.11
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΟ CHECK 3.8 ΕΙΝΑΙ **ΔΟΜΙΚΑ ΤΥΦΛΟ** ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `FormIssues` δεν γράφει ποτέ κυριολεκτικό κλειδί — το **χτίζει**:
 *
 * ```ts
 * t(`${NS}:${keyBase}.formBlocker.${blocker}`)
 * t(`${NS}:${keyBase}.invariant.${violation}`)
 * ```
 *
 * Η CHECK 3.8 ψάχνει `t('κυριολεκτικό.κλειδί')`. Ένα κλειδί που συντίθεται από **τρεις
 * μεταβλητές** δεν είναι κυριολεκτικό, άρα **δεν ελέγχεται από καμία πύλη** — και ένας
 * νέος κωδικός στο κλειστό σύνολο φτάνει στην οθόνη **ωμός**, χωρίς τίποτα να κοκκινίσει.
 *
 * 🔴 **ΣΥΝΕΒΗ, ΣΤΟ ΙΔΙΟ ΤΟ §8.33.** Οι κωδικοί της εντολής μπήκαν στη λίστα εμποδίων
 * της φόρμας, τα κείμενά τους γράφτηκαν σε **λάθος κλαδί** του locale, και ο μεσίτης
 * είδε στην οθόνη:
 *
 * > `offer.formBlocker.mandate-client-unset`
 *
 * **Το βρήκε ο Giorgio σε στιγμιότυπο** — όχι πύλη, όχι μεταγλωττιστής, όχι άγκυρα
 * (μάθημα `Μ-Η`). Αυτή η άγκυρα κλείνει την **κλάση**, όχι το περιστατικό: κάθε
 * μελλοντικός κωδικός οποιουδήποτε από τα τέσσερα κλειστά σύνολα κοκκινίζει **πριν**
 * φτάσει σε οθόνη.
 */

import el from '@/i18n/locales/el/property-market.json';
import en from '@/i18n/locales/en/property-market.json';
import { OWNER_PROPERTY_FORM_BLOCKERS } from '@/lib/owner-property/owner-property-form-values';
import { MANDATE_FORM_BLOCKERS } from '@/lib/mandate/mandate-form-values';
import { OWNER_PROPERTY_INVARIANTS } from '@/types/owner-property-invariants';
import { MANDATE_INVARIANTS } from '@/types/owner-property-mandate';

/** Το `keyBase` που περνά η φόρμα προσφοράς στο `DraftFormShell`. */
const KEY_BASE = 'offer';

type Bundle = Record<string, unknown>;

function wordsFor(bundle: Bundle, branch: 'formBlocker' | 'invariant', code: string): unknown {
  const base = (bundle as Record<string, Bundle>)[KEY_BASE];
  const leaf = base?.[branch] as Record<string, unknown> | undefined;
  return leaf?.[code];
}

describe('🔴 Κ — κάθε κωδικός που μπορεί να φτάσει στην οθόνη έχει λέξεις', () => {
  const cases: ReadonlyArray<readonly ['formBlocker' | 'invariant', readonly string[], string]> = [
    ['formBlocker', OWNER_PROPERTY_FORM_BLOCKERS, 'εμπόδια ακινήτου'],
    ['formBlocker', MANDATE_FORM_BLOCKERS, 'εμπόδια εντολής'],
    ['invariant', OWNER_PROPERTY_INVARIANTS, 'invariants ακινήτου'],
    ['invariant', MANDATE_INVARIANTS, 'invariants εντολής'],
  ];

  it('🔑 Κ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: τα τέσσερα κλειστά σύνολα ΔΕΝ είναι κενά', () => {
    // Χωρίς αυτό, μια άδεια λίστα θα έκανε κάθε βρόχο παρακάτω **κενό** — και η σουίτα
    // θα ήταν πράσινη επειδή δεν έλεγξε τίποτα.
    expect(cases.map(([, codes]) => codes.length).filter((n) => n === 0)).toEqual([]);
  });

  /**
   * ⚠️ **Η αποτυχία ΟΝΟΜΑΖΕΙ τα κλειδιά που λείπουν**, δεν λέει «false !== true».
   * Το jest δεν δέχεται μήνυμα στο `expect` (αυτό είναι άλλη βιβλιοθήκη), οπότε η
   * λίστα των ελλείψεων **είναι** ο ισχυρισμός — και μια κενή λίστα διαβάζεται
   * μονοσήμαντα.
   */
  function missingIn(bundle: Bundle): readonly string[] {
    const gaps: string[] = [];
    for (const [branch, codes] of cases) {
      for (const code of codes) {
        const words = wordsFor(bundle, branch, code);
        if (typeof words !== 'string' || words.trim() === '') {
          gaps.push(`${KEY_BASE}.${branch}.${code}`);
        }
      }
    }
    return gaps;
  }

  it('🔴 Κ1 — ΕΛΛΗΝΙΚΑ: κανένας κωδικός χωρίς λέξεις', () => {
    expect(missingIn(el as Bundle)).toEqual([]);
  });

  it('🔴 Κ2 — ΑΓΓΛΙΚΑ: κανένας κωδικός χωρίς λέξεις', () => {
    expect(missingIn(en as Bundle)).toEqual([]);
  });

  it('🔴 Κ3 — και το κείμενο ΔΕΝ είναι το ίδιο το κλειδί', () => {
    // Ένα «κείμενο» ίσο με τον κωδικό είναι ωμό κλειδί με άλλη διαδρομή: περνά κάθε
    // έλεγχο «υπάρχει;» και βγαίνει στην οθόνη αμετάφραστο.
    const echoes: string[] = [];
    for (const [branch, codes] of cases) {
      for (const code of codes) {
        for (const [lang, bundle] of [['el', el], ['en', en]] as const) {
          if (wordsFor(bundle as Bundle, branch, code) === code) {
            echoes.push(`${lang} · ${KEY_BASE}.${branch}.${code}`);
          }
        }
      }
    }
    expect(echoes).toEqual([]);
  });

  it('🔑 Κ4 — η άγκυρα ΠΙΑΝΕΙ πραγματικά: ανύπαρκτος κωδικός λείπει', () => {
    // Απόδειξη ζωής (ADR-749 §5): χωρίς αυτό, ένα `missingIn` που πάντα επιστρέφει
    // κενό θα έκανε τα Κ1/Κ2 πράσινα για πάντα.
    expect(wordsFor(el as Bundle, 'formBlocker', 'κωδικός-που-δεν-υπάρχει')).toBeUndefined();
  });
});
