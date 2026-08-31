/**
 * @fileoverview **ΚΑΘΕ ΚΛΕΙΔΙ ΤΩΝ ΕΙΣΕΡΧΟΜΕΝΩΝ ΕΧΕΙ ΛΕΞΕΙΣ** — σε ΔΥΟ γλώσσες (N.11).
 * @related components/mandate/inbox/mandate-inbox-labels.ts · ADR-834 §6.5.ε
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ ΤΩΡΑ, ΚΑΙ ΟΧΙ ΜΑΖΙ ΜΕ ΤΟΝ ΚΑΤΑΛΟΓΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο **κατάλογος** είχε αυτή την άγκυρα από το §8.34· τα **εισερχόμενα** δεν είχαν
 * **καμία**. Δύο αδελφές οθόνες, ίδιο ρίσκο, **ένας** φρουρός — και ο έλεγχος έλειπε
 * ακριβώς από την πλευρά όπου τα `REFUSAL_KEYS` **δεν ζωγραφίζονταν ποτέ** *(ο
 * `refusalOf` επέστρεφε πάντα `null`, ADR-834 §6.5.ε)*. Μια ξεχασμένη μετάφραση εκεί
 * ήταν **διπλά αόρατη**: ούτε άγκυρα να τη δει, ούτε οθόνη να τη δείξει.
 *
 * 🔴 Τώρα που ο λόγος **φτάνει**, το ωμό κλειδί έγινε δυνατό — και αυτό το φυλάει.
 *
 * ⚠️ Ο μεταγλωττιστής εγγυάται ότι κάθε λόγος έχει **κλειδί** *(`Record<Κλειστό,
 * string>`)*, ποτέ ότι το κλειδί **έχει λέξεις**. Και η CHECK 3.8 δεν το πιάνει:
 * διαβάζει κυριολεκτικά ορίσματα του `t()`, ενώ εδώ το κλειδί περνά μέσα από πίνακα.
 */

import {
  DECIDED_LABEL_KEYS,
  DECISION_HINT_KEYS,
  DECISION_LABEL_KEYS,
  GROUP_HINT_KEYS,
  GROUP_LABEL_KEYS,
  INBOX_KEYS,
  INBOX_NS,
  REFUSAL_KEYS,
} from '@/components/mandate/inbox/mandate-inbox-labels';
import el from '@/i18n/locales/el/property-market.json';
import en from '@/i18n/locales/en/property-market.json';
import { MANDATE_DECISION_REFUSALS } from '@/services/mandate/mandate-decision-vocabulary';

type Bundle = Record<string, unknown>;

/**
 * Λύνει πλήρες κλειδί (`ns:a.b.c`) πάνω στο πακέτο μιας γλώσσας.
 *
 * ⚠️ Ο έλεγχος του namespace είναι **μέρος της δουλειάς**: λάθος πρόθεμα λύνεται σε
 * άλλο πακέτο —ή σε κανένα— και η οθόνη βγάζει ωμό κείμενο ενώ η μετάφραση **υπάρχει**.
 */
function resolve(bundle: Bundle, fullKey: string): unknown {
  const [namespace, path] = fullKey.split(':');
  if (namespace !== INBOX_NS || path === undefined) return undefined;

  return path
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        node === null || typeof node !== 'object' ? undefined : (node as Bundle)[segment],
      bundle,
    );
}

const ALL_KEYS: ReadonlyArray<readonly [string, string]> = [
  ...Object.entries(INBOX_KEYS).map(([name, key]) => [`INBOX_KEYS.${name}`, key] as const),
  ...Object.entries(GROUP_LABEL_KEYS).map(([name, key]) => [`group.${name}`, key] as const),
  ...Object.entries(GROUP_HINT_KEYS).map(([name, key]) => [`groupHint.${name}`, key] as const),
  ...Object.entries(DECISION_LABEL_KEYS).map(([name, key]) => [`decision.${name}`, key] as const),
  ...Object.entries(DECISION_HINT_KEYS).map(([name, key]) => [`decisionHint.${name}`, key] as const),
  ...Object.entries(DECIDED_LABEL_KEYS).map(([name, key]) => [`decided.${name}`, key] as const),
  // 🔴 ADR-834 §6.5.ε — η **αιτία** της άρνησης: το σύνολο που ως χθες δεν έφτανε ποτέ.
  ...Object.entries(REFUSAL_KEYS).map(([name, key]) => [`refusal.${name}`, key] as const),
];

describe('🔑 Π — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: τίποτα δεν είναι κενό', () => {
  it('Π1 — το κλειστό σύνολο των λόγων έχει μέλη', () => {
    // Χωρίς αυτό, ένα άδειο σύνολο θα άφηνε κάθε βρόχο παρακάτω **κενό** — πράσινη
    // σουίτα που δεν έλεγξε τίποτα.
    expect(MANDATE_DECISION_REFUSALS.length).toBeGreaterThan(0);
  });

  it('Π2 — ελέγχονται πάνω από 20 κλειδιά', () => {
    expect(ALL_KEYS.length).toBeGreaterThan(20);
  });
});

describe('🔴 Κ — κάθε κλειδί έχει λέξεις στα ΕΛΛΗΝΙΚΑ και στα ΑΓΓΛΙΚΑ', () => {
  it.each([
    ['el', el as unknown as Bundle],
    ['en', en as unknown as Bundle],
  ])('Κ · %s', (_language, bundle) => {
    const missing = ALL_KEYS.filter(([, key]) => {
      const words = resolve(bundle, key);
      return typeof words !== 'string' || words.trim() === '';
    }).map(([name, key]) => `${name} → ${key}`);

    expect(missing).toEqual([]);
  });
});

describe('🔴 Ι — τα δύο πακέτα λένε τα ΙΔΙΑ κλειδιά', () => {
  it('Ι1 — καμία μετάφραση δεν υπάρχει μόνο στη μία γλώσσα', () => {
    const onlyOneSide = ALL_KEYS.filter(([, key]) => {
      const greek = typeof resolve(el as unknown as Bundle, key) === 'string';
      const english = typeof resolve(en as unknown as Bundle, key) === 'string';
      return greek !== english;
    }).map(([name]) => name);

    expect(onlyOneSide).toEqual([]);
  });

  it('Ι2 — κάθε λόγος του λεξιλογίου έχει γραμμή, και καμία γραμμή δεν περισσεύει', () => {
    expect(Object.keys(REFUSAL_KEYS).sort()).toEqual([...MANDATE_DECISION_REFUSALS].sort());
  });
});

describe('🔴 Μ — η μετάλλαξη: λάθος κλειδί ΠΡΕΠΕΙ να πιαστεί', () => {
  it('Μ1 — ανύπαρκτο κλειδί δεν λύνεται', () => {
    expect(resolve(el as unknown as Bundle, `${INBOX_NS}:mandate.inbox.refusals.φάντασμα`))
      .toBeUndefined();
  });

  it('Μ2 — σωστό μονοπάτι με ΛΑΘΟΣ namespace δεν λύνεται', () => {
    expect(resolve(el as unknown as Bundle, 'navigation:mandate.inbox.title')).toBeUndefined();
  });

  it('Μ3 — υπαρκτό κλειδί όντως λύνεται (αλλιώς ο Κ ελέγχει τον εαυτό του)', () => {
    expect(typeof resolve(el as unknown as Bundle, REFUSAL_KEYS['request-absent'])).toBe('string');
  });
});
