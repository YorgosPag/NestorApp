/**
 * @fileoverview **ΚΑΘΕ ΚΛΕΙΔΙ ΤΟΥ ΚΑΤΑΛΟΓΟΥ ΕΧΕΙ ΛΕΞΕΙΣ** — σε ΔΥΟ γλώσσες (§8.34).
 * @related components/mandate/catalog/mandate-catalog-labels.ts · CLAUDE.md N.11
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ ΠΟΥ Ο ΜΕΤΑΓΛΩΤΤΙΣΤΗΣ ΔΕΝ ΜΠΟΡΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι πίνακες ετικετών είναι `Record<Κλειστό, string>` ⇒ ο **μεταγλωττιστής** εγγυάται
 * ότι κάθε κατάσταση έχει **κλειδί**. Δεν έχει καμία γνώμη για το αν το κλειδί
 * **υπάρχει** στο locale — μια συμβολοσειρά είναι συμβολοσειρά.
 *
 * Και η **CHECK 3.8** δεν το πιάνει: διαβάζει κυριολεκτικά ορίσματα του `t()`, ενώ εδώ
 * το κλειδί περνά μέσα από πίνακα. Είναι το ίδιο σχήμα με το `form-issue-keys` — και
 * η ίδια θεραπεία: **η άγκυρα είναι η πύλη**.
 *
 * 🔴 Χωρίς αυτό, μια ξεχασμένη μετάφραση βγάζει στην οθόνη
 * `property-market:offer.mandates.standing.link-revoked` — και το ξέρουμε ότι συμβαίνει,
 * γιατί **συνέβη** στο §8.33 και το βρήκε άνθρωπος σε στιγμιότυπο (μάθημα Μ-Η).
 */

import {
  ACTION_DONE_KEYS,
  ACTION_LABEL_KEYS,
  CATALOG_KEYS,
  CATALOG_NS,
  CLIENT_NAME_KEYS,
  GROUP_LABEL_KEYS,
  NEVER_NOTIFIED_HINT_KEYS,
  PROOF_LABEL_KEYS,
  PRESENCE_DONE_KEYS,
  PRESENCE_LABEL_KEYS,
  REJECTION_KEYS,
  STANDING_HINT_KEYS,
  STANDING_LABEL_KEYS,
} from '@/components/mandate/catalog/mandate-catalog-labels';
import el from '@/i18n/locales/el/property-market.json';
import en from '@/i18n/locales/en/property-market.json';
import { MANDATE_ACTIONS } from '@/lib/mandate/mandate-actions';
import {
  MANDATE_STANDING_GROUPS,
  MANDATE_STANDINGS,
} from '@/lib/mandate/mandate-standing';
import { MANDATE_PROOF_VIAS } from '@/types/owner-property-mandate';

type Bundle = Record<string, unknown>;

/**
 * Λύνει ένα πλήρες κλειδί (`ns:a.b.c`) πάνω στο πακέτο μιας γλώσσας.
 *
 * ⚠️ **Ο έλεγχος του namespace είναι μέρος της δουλειάς.** Ένα κλειδί με λάθος
 * πρόθεμα θα λυνόταν σε **άλλο** πακέτο —ή σε κανένα— και η οθόνη θα έβγαζε ωμό
 * κείμενο ενώ η μετάφραση **υπάρχει** (ακριβώς το ελάττωμα της CHECK 3.51).
 */
function resolve(bundle: Bundle, fullKey: string): unknown {
  const [namespace, path] = fullKey.split(':');
  if (namespace !== CATALOG_NS || path === undefined) return undefined;

  return path
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        node === null || typeof node !== 'object'
          ? undefined
          : (node as Bundle)[segment],
      bundle,
    );
}

/** Κάθε κλειδί που μπορεί να φτάσει στην οθόνη, με το όνομα της πηγής του. */
const ALL_KEYS: ReadonlyArray<readonly [string, string]> = [
  ...Object.entries(CATALOG_KEYS).map(([name, key]) => [`CATALOG_KEYS.${name}`, key] as const),
  ...Object.entries(GROUP_LABEL_KEYS).map(([name, key]) => [`group.${name}`, key] as const),
  ...Object.entries(STANDING_LABEL_KEYS).map(([name, key]) => [`standing.${name}`, key] as const),
  ...Object.entries(STANDING_HINT_KEYS).map(([name, key]) => [`hint.${name}`, key] as const),
  // 🔴 ADR-834 §6.5.δ — ο **δεύτερος άξονας** της θεραπείας μπαίνει στο ΙΔΙΟ κλειστό
  // σύνολο: μια αιτία χωρίς λέξεις είναι ωμό κλειδί στην οθόνη, ό,τι κι αν την επέλεξε.
  ...Object.entries(NEVER_NOTIFIED_HINT_KEYS).map(
    ([name, key]) => [`neverNotifiedHint.${name}`, key] as const,
  ),
  ...Object.entries(CLIENT_NAME_KEYS).map(([name, key]) => [`clientName.${name}`, key] as const),
  ...Object.entries(PROOF_LABEL_KEYS).map(([name, key]) => [`proof.${name}`, key] as const),
  ...Object.entries(ACTION_LABEL_KEYS).map(([name, key]) => [`action.${name}`, key] as const),
  ...Object.entries(ACTION_DONE_KEYS).map(([name, key]) => [`done.${name}`, key] as const),
  ...Object.entries(REJECTION_KEYS).map(([name, key]) => [`reject.${name}`, key] as const),
  // ADR-777 §8.39 — η πράξη **παρουσίας** μπαίνει στο ΙΔΙΟ κλειστό σύνολο: μια ετικέτα
  // χωρίς λέξεις είναι ωμό κλειδί στην οθόνη, ό,τι μηχανή καταστάσεων κι αν υπηρετεί.
  ...Object.entries(PRESENCE_LABEL_KEYS).map(([name, key]) => [`presence.${name}`, key] as const),
  ...Object.entries(PRESENCE_DONE_KEYS).map(([name, key]) => [`presenceDone.${name}`, key] as const),
];

describe('🔑 Π — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: τα κλειστά σύνολα δεν είναι κενά', () => {
  it('Π1 — τα τρία σύνολα του τομέα έχουν μέλη', () => {
    // Χωρίς αυτό, ένα άδειο σύνολο θα έκανε τους πίνακες κενούς και κάθε βρόχο
    // παρακάτω **κενό** — πράσινη σουίτα που δεν έλεγξε τίποτα.
    expect(MANDATE_STANDINGS.length).toBeGreaterThan(0);
    expect(MANDATE_STANDING_GROUPS.length).toBeGreaterThan(0);
    expect(MANDATE_ACTIONS.length).toBeGreaterThan(0);
    expect(MANDATE_PROOF_VIAS.length).toBeGreaterThan(0);
  });

  it('Π2 — ελέγχονται πάνω από 40 κλειδιά', () => {
    expect(ALL_KEYS.length).toBeGreaterThan(40);
  });
});

describe('🔴 Κ — κάθε κλειδί έχει λέξεις στα ΕΛΛΗΝΙΚΑ και στα ΑΓΓΛΙΚΑ', () => {
  it.each([
    ['el', el as unknown as Bundle],
    ['en', en as unknown as Bundle],
  ])('Κ · %s', (_language, bundle) => {
    // ⚠️ **Λίστα ελλείψεων, όχι `expect` ανά κλειδί**: το `expect` του jest δεν παίρνει
    // μήνυμα, οπότε η αποτυχία πρέπει να ονομάζει **ποια** λείπουν (Π11 του handoff).
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
});

describe('🔴 Μ — η μετάλλαξη: λάθος κλειδί ΠΡΕΠΕΙ να πιαστεί', () => {
  it('Μ1 — ανύπαρκτο κλειδί δεν λύνεται', () => {
    expect(resolve(el as unknown as Bundle, `${CATALOG_NS}:offer.mandates.standing.φάντασμα`))
      .toBeUndefined();
  });

  it('Μ2 — σωστό μονοπάτι με ΛΑΘΟΣ namespace δεν λύνεται', () => {
    // Ο έλεγχος που πιάνει το ελάττωμα «η μετάφραση υπάρχει και η οθόνη βγάζει ωμό».
    expect(resolve(el as unknown as Bundle, 'navigation:offer.mandates.title')).toBeUndefined();
  });

  it('Μ3 — υπαρκτό κλειδί όντως λύνεται (αλλιώς ο Κ ελέγχει τον εαυτό του)', () => {
    expect(typeof resolve(el as unknown as Bundle, CATALOG_KEYS.title)).toBe('string');
  });
});
