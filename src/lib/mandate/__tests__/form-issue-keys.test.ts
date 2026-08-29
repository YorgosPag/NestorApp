/**
 * @fileoverview **ΚΑΘΕ ΚΩΔΙΚΑΣ ΤΗΣ ΦΟΡΜΑΣ ΕΧΕΙ ΛΕΞΕΙΣ** — σε ΔΥΟ γλώσσες (§8.33).
 * @related components/shared/forms/FormIssues.tsx · lib/forms/draft-form-labels.ts · N.11
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ: ΤΟ CHECK 3.8 ΗΤΑΝ **ΔΟΜΙΚΑ ΤΥΦΛΟ** ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `FormIssues` **έχτιζε** τα κλειδιά του από prop:
 *
 * ```ts
 * t(`${NS}:${keyBase}.formBlocker.${blocker}`)
 * ```
 *
 * Η CHECK 3.8 ψάχνει `t('κυριολεκτικό.κλειδί')` ⇒ **καμία πύλη δεν τα έβλεπε**, και
 * ένας νέος κωδικός έφτανε στην οθόνη **ωμός**.
 *
 * 🔴 **ΣΥΝΕΒΗ, ΣΤΟ ΙΔΙΟ ΤΟ §8.33.** Οι κωδικοί της εντολής μπήκαν στη λίστα εμποδίων,
 * τα κείμενά τους γράφτηκαν σε **λάθος κλαδί** του locale, και ο μεσίτης είδε:
 *
 * > `offer.formBlocker.mandate-client-unset`
 *
 * **Το βρήκε ο Giorgio σε στιγμιότυπο** — όχι πύλη, όχι μεταγλωττιστής, όχι άγκυρα
 * (μάθημα `Μ-Η`).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ✅ Η ΡΙΖΑ ΕΚΛΕΙΣΕ (2026-08-29) — ΚΑΙ Η ΑΓΚΥΡΑ ΠΑΡΑΜΕΝΕΙ ΑΠΑΡΑΙΤΗΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `keyBase` **καταργήθηκε**: τα κλειδιά ζουν πλέον σε **στατικούς πίνακες ανά
 * βάση** (`offer-form-labels.ts` · `demand-form-labels.ts`), ορατούς και στη CHECK 3.8
 * και στον τεμαχιστή — δες `lib/forms/draft-form-labels.ts` για το πλήρες σκεπτικό και
 * τις δύο πηγές της πρακτικής.
 *
 * ⚠️ **Ο μεταγλωττιστής φυλά ΜΟΝΟ ότι κάθε κωδικός έχει ΚΛΕΙΔΙ.** Ότι το κλειδί
 * **έχει λέξεις, σε δύο γλώσσες**, το φυλά **μόνο** αυτό το αρχείο: ένας πίνακας που
 * δείχνει σε ανύπαρκτο κλειδί μεταγλωττίζεται μια χαρά.
 */

import el from '@/i18n/locales/el/property-market.json';
import en from '@/i18n/locales/en/property-market.json';
import { OWNER_PROPERTY_FORM_BLOCKERS } from '@/lib/owner-property/owner-property-form-values';
import { MANDATE_FORM_BLOCKERS } from '@/lib/mandate/mandate-form-values';
import { OWNER_PROPERTY_INVARIANTS } from '@/types/owner-property-invariants';
import { MANDATE_INVARIANTS } from '@/types/owner-property-mandate';
import { LISTING_AGREEMENTS } from '@/types/listing-agreement';
// 🔴 **Οι ΙΔΙΟΙ πίνακες που διαβάζει η οθόνη** — ποτέ ανακατασκευή μονοπατιού.
import { TEXT_KEYS as OFFER_TEXT_KEYS } from '@/components/owner-property/offer-form-labels';
import { TEXT_KEYS as DEMAND_TEXT_KEYS } from '@/components/demand/demand-form-labels';
import { DRAFT_FORM_SLOTS } from '@/lib/forms/draft-form-labels';
import { DEMAND_FORM_BLOCKERS } from '@/lib/demand/demand-form-values';
import { DEMAND_INVARIANTS } from '@/types/property-demand';
// ⚠️ Το κλειστό σύνολο εισάγεται από τη **ΜΙΑ** πηγή του (SSoT): μια αντιγραφή της
//    λίστας εδώ θα έμενε πράσινη ενώ ο κώδικας θα είχε αποκτήσει τέταρτο λόγο.
import { AGENCY_PROFILE_REJECTIONS } from '@/services/mandate/agency-profile.service';

/**
 * 🔴 **ΤΑ ΚΛΕΙΔΙΑ ΕΡΧΟΝΤΑΙ ΑΠΟ ΤΟΝ ΙΔΙΟ ΤΟΝ ΠΙΝΑΚΑ (2026-08-29)** — όχι από
 * ανακατασκευή διαδρομής.
 *
 * Μέχρι σήμερα αυτό το αρχείο έχτιζε `` `${KEY_BASE}.${branch}.${code}` `` και έψαχνε
 * **εκείνο** το μονοπάτι. Ήταν σωστό όσο η οθόνη έχτιζε **το ίδιο** — δηλαδή ήταν
 * **δεύτερο βιβλίο** (ADR-749). Τώρα η οθόνη διαβάζει από `TEXT_KEYS`, οπότε η άγκυρα
 * διαβάζει **από εκεί**: πίνακας που δείχνει αλλού **κοκκινίζει**.
 */
type Bundle = Record<string, unknown>;

/** `property-market:offer.formBlocker.x` → η τιμή του, ή `undefined`. */
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

describe('🔴 Κ — κάθε κείμενο που μπορεί να φτάσει στην οθόνη υπάρχει', () => {
  /**
   * ⚠️ **Και οι ΔΥΟ βάσεις**, στο ίδιο αρχείο: ήταν το τυφλό σημείο της παλιάς
   * γραφής — έλεγχε **μόνο** τη βάση `offer` (`KEY_BASE = 'offer'`), ενώ το ίδιο
   * κέλυφος σερβίρει **και** τη ζήτηση.
   */
  const BASES = [
    {
      base: 'offer',
      keys: OFFER_TEXT_KEYS as Readonly<Record<string, string>>,
      blockers: [...OWNER_PROPERTY_FORM_BLOCKERS, ...MANDATE_FORM_BLOCKERS] as readonly string[],
      violations: [...OWNER_PROPERTY_INVARIANTS, ...MANDATE_INVARIANTS] as readonly string[],
    },
    {
      base: 'demand',
      keys: DEMAND_TEXT_KEYS as Readonly<Record<string, string>>,
      blockers: DEMAND_FORM_BLOCKERS as readonly string[],
      violations: DEMAND_INVARIANTS as readonly string[],
    },
  ] as const;

  it('🔑 Κ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: κανένας πίνακας ΔΕΝ είναι κενός', () => {
    // Χωρίς αυτό, ένας άδειος πίνακας θα έκανε κάθε βρόχο παρακάτω **κενό** — και η
    // σουίτα θα ήταν πράσινη επειδή δεν έλεγξε τίποτα.
    expect(BASES.filter(({ keys }) => Object.keys(keys).length === 0)).toEqual([]);
  });

  function missingIn(bundle: Bundle): readonly string[] {
    const gaps: string[] = [];
    for (const { keys } of BASES) {
      for (const key of Object.values(keys)) {
        const words = wordsForKey(bundle, key);
        if (typeof words !== 'string' || words.trim() === '') gaps.push(key);
      }
    }
    return gaps;
  }

  it('🔴 Κ1 — ΕΛΛΗΝΙΚΑ: κανένα κλειδί πίνακα χωρίς λέξεις', () => {
    expect(missingIn(el as Bundle)).toEqual([]);
  });

  it('🔴 Κ2 — ΑΓΓΛΙΚΑ: κανένα κλειδί πίνακα χωρίς λέξεις', () => {
    expect(missingIn(en as Bundle)).toEqual([]);
  });

  it('🔴 Κ3 — και το κείμενο ΔΕΝ είναι το ίδιο το αναγνωριστικό', () => {
    // Ένα «κείμενο» ίσο με τον κωδικό είναι ωμό κλειδί με άλλη διαδρομή: περνά κάθε
    // έλεγχο «υπάρχει;» και βγαίνει στην οθόνη αμετάφραστο.
    const echoes: string[] = [];
    for (const { keys } of BASES) {
      for (const [id, key] of Object.entries(keys)) {
        for (const [lang, bundle] of [['el', el], ['en', en]] as const) {
          if (wordsForKey(bundle as Bundle, key) === id) echoes.push(`${lang} · ${key}`);
        }
      }
    }
    expect(echoes).toEqual([]);
  });

  it('🔴 Κ4 — ΚΑΘΕ ΚΩΔΙΚΟΣ ΤΩΝ ΚΛΕΙΣΤΩΝ ΣΥΝΟΛΩΝ ΕΧΕΙ ΓΡΑΜΜΗ ΣΤΟΝ ΠΙΝΑΚΑ', () => {
    // 🔑 Ο μεταγλωττιστής το φυλά ήδη μέσω `Record<…>` — αλλά **μόνο** για τα σύνολα
    //    που ο πίνακας ονομάζει στον τύπο του. Αυτό το επαληθεύει από την **άλλη**
    //    μεριά: από τις ίδιες τις λίστες, όπως τις διαβάζει ο κώδικας εκτέλεσης.
    const gaps: string[] = [];
    for (const { base, keys, blockers, violations } of BASES) {
      for (const id of [...DRAFT_FORM_SLOTS, ...blockers, ...violations]) {
        if (!(id in keys)) gaps.push(`${base} ← ${id}`);
      }
    }
    expect(gaps).toEqual([]);
  });

  it('🔴 Κ6 — ΚΑΘΕ ΠΙΝΑΚΑΣ ΔΕΙΧΝΕΙ ΣΤΗ ΔΙΚΗ ΤΟΥ ΒΑΣΗ', () => {
    // 🔴 **ΤΟ ΚΕΝΟ ΠΟΥ ΒΡΗΚΕ Η ΜΕΤΑΛΛΑΞΗ (Ρ5, 2026-08-29).** Δύο κωδικοί υπάρχουν
    //    **και στις δύο** βάσεις με το ίδιο όνομα (`place-unresolved`), οπότε πίνακας
    //    της προσφοράς που έδειχνε σε `demand.*` έβρισκε λέξεις και **έμενε
    //    πράσινος** — ενώ θα ζωγράφιζε το λεξιλόγιο της **άλλης** βάσης ΚΑΙ θα
    //    ξανάφερνε τη διασταύρωση που όλος ο διαχωρισμός υπάρχει για να σβήσει.
    const strays: string[] = [];
    for (const { base, keys } of BASES) {
      for (const key of Object.values(keys)) {
        if (!key.startsWith(`property-market:${base}.`)) strays.push(`${base} ← ${key}`);
      }
    }
    expect(strays).toEqual([]);
  });

  it('🔴 Κ7 — ΤΑ ΤΡΙΑ ΛΕΞΙΛΟΓΙΑ ΔΕΝ ΣΥΓΚΡΟΥΟΝΤΑΙ ΣΕ ΟΝΟΜΑ', () => {
    // 🔴 **Ο φρουρός της ΕΝΩΣΗΣ.** Ο πίνακας είναι ένας για θέσεις κελύφους **και**
    //    κωδικούς ελλείψεων. Αν ποτέ μια θέση αποκτήσει το **ίδιο όνομα** με κωδικό,
    //    ο ένας θα **έσβηνε σιωπηλά** τον άλλο — και ο τύπος `Record<ένωση>` **δεν το
    //    πιάνει**, γιατί η ένωση απορροφά το διπλότυπο σε **ένα** μέλος.
    const collisions: string[] = [];
    for (const { base, blockers, violations } of BASES) {
      const vocabularies: ReadonlyArray<readonly [string, readonly string[]]> = [
        ['slot', DRAFT_FORM_SLOTS],
        ['blocker', blockers],
        ['invariant', violations],
      ];
      const seen = new Map<string, string>();
      for (const [kind, names] of vocabularies) {
        for (const name of names) {
          const previous = seen.get(name);
          if (previous !== undefined) collisions.push(`${base}: ${name} (${previous} ↔ ${kind})`);
          else seen.set(name, kind);
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it('🔑 Κ5 — η άγκυρα ΠΙΑΝΕΙ πραγματικά: ανύπαρκτο κλειδί λείπει', () => {
    // Απόδειξη ζωής (ADR-749 §5): χωρίς αυτό, ένα `wordsForKey` που πάντα βρίσκει
    // κάτι θα έκανε τα Κ1/Κ2 πράσινα για πάντα.
    expect(wordsForKey(el as Bundle, 'property-market:offer.formBlocker.δεν-υπάρχει')).toBeUndefined();
  });
});

// =============================================================================
// Λ — ΤΟ ΙΔΙΟ ΚΕΝΟ, ΔΕΥΤΕΡΗ ΦΟΡΑ: ΤΟ ΕΙΔΟΣ ΤΗΣ ΕΝΤΟΛΗΣ (ADR-827 §8.9 α)
// =============================================================================

/**
 * 🔴 **ΑΚΡΙΒΩΣ Η ΙΔΙΑ ΚΛΑΣΗ ΜΕ ΤΟ Κ, ΣΕ ΑΛΛΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ.** Το
 * `BrokeredMandateFields` **χτίζει** τα κλειδιά του είδους εντολής:
 *
 * ```ts
 * t(`${K}.agreementOptions.${agreement}`)
 * t(`${K}.agreementHints.${agreement}`)
 * ```
 *
 * Η CHECK 3.8 ψάχνει κυριολεκτικά κλειδιά ⇒ **δεν βλέπει τίποτα εδώ**. Πέμπτη τιμή
 * στο `LISTING_AGREEMENTS` θα εμφανιζόταν στην οθόνη ως ωμό
 * `property-market:mandate.office.agreementOptions.…` — και **τίποτα δεν θα
 * κοκκίνιζε**, ακριβώς όπως συνέβη στο §8.33 με τους κωδικούς της εντολής.
 */
describe('🔴 Λ — κάθε είδος εντολής έχει λέξεις, σε ΔΥΟ γλώσσες', () => {
  const BRANCHES = ['agreementOptions', 'agreementHints'] as const;

  function officeWords(bundle: Bundle, branch: string, code: string): unknown {
    const office = (bundle as Record<string, Bundle>).mandate?.[
      'office'
    ] as Record<string, Bundle> | undefined;
    return (office?.[branch] as Record<string, unknown> | undefined)?.[code];
  }

  it('🔑 Λ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: το κλειστό σύνολο ΔΕΝ είναι κενό', () => {
    expect(LISTING_AGREEMENTS.length).toBeGreaterThan(0);
  });

  it.each([['el', el], ['en', en]] as const)(
    '🔴 Λ1 — %s: κανένα είδος χωρίς όνομα ΚΑΙ επεξήγηση',
    (_lang, bundle) => {
      const gaps: string[] = [];
      for (const branch of BRANCHES) {
        for (const agreement of LISTING_AGREEMENTS) {
          const words = officeWords(bundle as Bundle, branch, agreement);
          if (typeof words !== 'string' || words.trim() === '') {
            gaps.push(`mandate.office.${branch}.${agreement}`);
          }
        }
      }
      expect(gaps).toEqual([]);
    },
  );

  it('🔑 Λ2 — η άγκυρα ΠΙΑΝΕΙ: ανύπαρκτο είδος λείπει', () => {
    expect(officeWords(el as Bundle, 'agreementOptions', 'δεν-υπάρχει')).toBeUndefined();
  });

  it('🔴 Λ3 — το όριο διάρκειας ΑΝΑΦΕΡΕΤΑΙ στο κείμενο, και με τα ΔΥΟ ονόματα', () => {
    // 🏆 Ο αριθμός και η διάταξη έρχονται από το `StatutoryTermLimit` ως
    //    interpolation — αν κάποιος τα γράψει σκέτα στο locale, θα παλιώσουν σιωπηλά.
    for (const bundle of [el, en]) {
      const office = (bundle as unknown as Record<string, Record<string, Record<string, string>>>)
        .mandate.office;
      expect(office.untilHint).toContain('{months}');
      expect(office.untilHint).toContain('{authority}');
    }
  });
});

// =============================================================================
// Μ — ΤΡΙΤΗ ΦΟΡΑ Η ΙΔΙΑ ΚΛΑΣΗ: ΟΙ ΑΡΝΗΣΕΙΣ ΤΗΣ ΒΙΤΡΙΝΑΣ (ADR-827 §9.10)
// =============================================================================

/**
 * 🔑 **ΕΔΩ Η ΟΘΟΝΗ ΔΕΝ ΧΤΙΖΕΙ ΚΛΕΙΔΙ — ΚΑΙ Η ΑΓΚΥΡΑ ΕΞΑΚΟΛΟΥΘΕΙ ΝΑ ΧΡΕΙΑΖΕΤΑΙ.**
 *
 * Η βιτρίνα χρησιμοποιεί **πίνακα** (`SHOWCASE_REJECTION_KEYS`), όχι
 * ``t(`…rejection.${reason}`)``, ακριβώς για να **μην** πέσει στο τυφλό σημείο της
 * CHECK 3.8. Ο τύπος `Record<AgencyProfileRejection, string>` κάνει τον **τέταρτο**
 * λόγο **να μη μεταγλωττίζεται** χωρίς κλειδί.
 *
 * ⚠️ **Ο μεταγλωττιστής όμως φυλά ΜΟΝΟ την πληρότητα του πίνακα.** Ένας πίνακας που
 * δείχνει σε **ανύπαρκτο** κλειδί μεταγλωττίζεται μια χαρά, και το γραφείο βλέπει
 * `property-market:mandate.showcase.rejection.…` **ωμό**. Το *«έχει λέξεις, σε δύο
 * γλώσσες;»* το απαντά **μόνο** αυτό εδώ — ίδιος καταμερισμός με το
 * `mandate-catalog-labels.test.ts`.
 *
 * 🔑 **Και είναι κρισιμότερο απ' ό,τι στα Κ/Λ**: αυτό το κείμενο είναι η **μόνη**
 * οδηγία που παίρνει ο άνθρωπος για το τι να διορθώσει. Ωμό κλειδί εδώ δεν είναι
 * άσχημο — είναι **αδιέξοδο**.
 */
describe('🔴 Μ — κάθε άρνηση της βιτρίνας έχει λέξεις, σε ΔΥΟ γλώσσες', () => {
  function rejectionWords(bundle: Bundle, code: string): unknown {
    const showcase = (bundle as Record<string, Bundle>).mandate?.[
      'showcase'
    ] as Record<string, Bundle> | undefined;
    return (showcase?.rejection as Record<string, unknown> | undefined)?.[code];
  }

  it('🔑 Μ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: το κλειστό σύνολο ΔΕΝ είναι κενό', () => {
    expect(AGENCY_PROFILE_REJECTIONS.length).toBeGreaterThan(0);
  });

  it.each([['el', el], ['en', en]] as const)(
    '🔴 Μ1 — %s: κανένας λόγος άρνησης χωρίς λέξεις',
    (_lang, bundle) => {
      const gaps = AGENCY_PROFILE_REJECTIONS.filter((code) => {
        const words = rejectionWords(bundle as Bundle, code);
        return typeof words !== 'string' || words.trim() === '';
      }).map((code) => `mandate.showcase.rejection.${code}`);
      expect(gaps).toEqual([]);
    },
  );

  it('🔴 Μ2 — και το κείμενο ΔΕΝ είναι το ίδιο το κλειδί', () => {
    const echoes: string[] = [];
    for (const code of AGENCY_PROFILE_REJECTIONS) {
      for (const [lang, bundle] of [['el', el], ['en', en]] as const) {
        if (rejectionWords(bundle as Bundle, code) === code) echoes.push(`${lang} · ${code}`);
      }
    }
    expect(echoes).toEqual([]);
  });

  it('🔑 Μ3 — η άγκυρα ΠΙΑΝΕΙ: ανύπαρκτος λόγος λείπει', () => {
    expect(rejectionWords(el as Bundle, 'agency-profile-δεν-υπάρχει')).toBeUndefined();
  });
});
