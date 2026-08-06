/**
 * 🔴 ADR-739 §52.2 — **η άγκυρα του «κάτι όντως μετέφρασε»**.
 *
 * ## ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * Το dropdown «Στυλ πίνακα» έδειχνε `ribbon.commands.tableStyleNames.standard` στην οθόνη με
 * **όλες** τις πύλες πράσινες. Καμία δεν μπορούσε να το δει, και ο λόγος είναι δομικός:
 *
 * - το **CHECK 3.8** ψάχνει `t('κλειδί')` χωρίς αντιστοίχιση — εδώ δεν υπήρχε **καμία** κλήση
 *   `t()`· το `isLiteralLabel: true` είναι κυριολεκτικά η εντολή «μην μεταφράσεις»·
 *   - το **CHECK 3.36** ελέγχει ότι το namespace **φορτώνεται** — φορτωνόταν κανονικά·
 * - το **CHECK 3.33/3.34** ελέγχουν φρεσκάδα παραγόμενων — τα κλειδιά **υπήρχαν** σε el+en.
 *
 * Δηλαδή το κενό δεν ήταν «λείπει μετάφραση» αλλά «**κανείς δεν τη ζήτησε**». Αυτό το test
 * είναι το μόνο σημείο που ρωτά τη ζωντανή αλυσίδα από άκρη σε άκρη: preset → κανόνας →
 * locale JSON, και **αρνείται** αποτέλεσμα που μοιάζει με κλειδί.
 *
 * ## ΑΝ ΣΕ ΕΚΟΨΕ ΑΥΤΟ ΤΟ TEST
 * Πρόσθεσες built-in στυλ (γραμμής ή πίνακα). Το `name` του πρέπει να είναι i18n **κλειδί**
 * που υπάρχει σε `el` **και** `en`. **ΜΗΝ** βάλεις κυριολεκτικό όνομα σε built-in (θα βγει
 * ωμό μέσα από `t()`) και **ΜΗΝ** «διορθώσεις» το test.
 *
 * @see ../style-name-label.ts — ο κανόνας
 */

import {
  resolveStyleNameLabel,
  type NamedStyleProvenance,
} from '../style-name-label';
import { BUILTIN_TABLE_STYLES } from '../../../bim/table/table-style-presets';
import { BUILTIN_LINE_STYLES } from '../../line-styles/line-style-templates';
import { BUILTIN_DIM_STYLES } from '../../dimensions/dim-style-templates';
import elShell from '@/i18n/locales/el/dxf-viewer-shell.json';
import enShell from '@/i18n/locales/en/dxf-viewer-shell.json';

type LocaleTree = { readonly [key: string]: string | LocaleTree };

/** Μίμηση του `t()` σε επίπεδο δεδομένων: επιστρέφει `undefined` αν το κλειδί δεν υπάρχει. */
function lookup(tree: LocaleTree, key: string): string | undefined {
  let node: string | LocaleTree | undefined = tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

const EL = elShell as unknown as LocaleTree;
const EN = enShell as unknown as LocaleTree;

/** Τα δύο μητρώα που μοιράζονται τη σύμβαση «built-in ⇒ κλειδί» (η κεφαλίδα του module). */
const KEYED_BUILTIN_STYLES: readonly { readonly registry: string; readonly styles: readonly NamedStyleProvenance[] }[] = [
  { registry: 'table-style-presets', styles: BUILTIN_TABLE_STYLES },
  { registry: 'line-style-templates', styles: BUILTIN_LINE_STYLES },
];

describe('resolveStyleNameLabel — ο κανόνας', () => {
  it('built-in ⇒ το όνομα είναι ΚΛΕΙΔΙ (περνά από t())', () => {
    expect(resolveStyleNameLabel({ name: 'ns.some.key', isBuiltIn: true })).toEqual({
      labelKey: 'ns.some.key',
      isLiteralLabel: false,
    });
  });

  it('custom ⇒ το όνομα είναι ΚΥΡΙΟΛΕΞΙΑ (τυπώνεται αυτούσιο)', () => {
    expect(resolveStyleNameLabel({ name: 'Πίνακας ποσοτήτων', isBuiltIn: false })).toEqual({
      labelKey: 'Πίνακας ποσοτήτων',
      isLiteralLabel: true,
    });
  });

  it('ΔΕΝ μεταφράζει μόνο του — επιστρέφει ζεύγος, ώστε το t() να μείνει στην επιφάνεια', () => {
    // Το κλειδί επιστρέφεται **αμετάβλητο**: αν αυτό αλλάξει, κάποιος έβαλε i18n runtime μέσα
    // στον κανόνα και το μητρώο στυλ έπαψε να είναι καθαρό.
    const key = 'ribbon.commands.tableStyleNames.standard';
    expect(resolveStyleNameLabel({ name: key, isBuiltIn: true }).labelKey).toBe(key);
  });
});

describe('🔴 ΑΓΚΥΡΑ — κάθε built-in όνομα ΟΝΤΩΣ μεταφράζεται (el + en)', () => {
  for (const { registry, styles } of KEYED_BUILTIN_STYLES) {
    describe(registry, () => {
      it('έχει τουλάχιστον ένα built-in (αλλιώς το test θα περνούσε κενό)', () => {
        expect(styles.length).toBeGreaterThan(0);
      });

      it.each(styles.map((style) => [style.name, style] as const))(
        '%s → ετικέτα σε el + en που ΔΕΝ είναι το κλειδί',
        (_name, style) => {
          const label = resolveStyleNameLabel(style);

          // 1. Ο κανόνας το στέλνει στο `t()` — αν πει «κυριολεξία», το κλειδί βγαίνει ωμό.
          expect(label.isLiteralLabel).toBe(false);

          // 2. Το κλειδί υπάρχει και στις δύο γλώσσες, μη κενό.
          const el = lookup(EL, label.labelKey);
          const en = lookup(EN, label.labelKey);
          expect(typeof el).toBe('string');
          expect(typeof en).toBe('string');
          expect(el).not.toHaveLength(0);
          expect(en).not.toHaveLength(0);

          // 3. 🔑 Το αποτέλεσμα δεν ΜΟΙΑΖΕΙ με κλειδί — δηλαδή κάτι όντως μετέφρασε. Αυτή
          //    ακριβώς η γραμμή είναι που έλειπε όταν η οθόνη έδειχνε «ribbon.commands.…».
          expect(el).not.toBe(label.labelKey);
          expect(en).not.toBe(label.labelKey);
          expect(el).not.toMatch(/^ribbon\./);
          expect(en).not.toMatch(/^ribbon\./);
        },
      );
    });
  }
});

describe('⚠️ Τα `DimStyle` έχουν ΑΝΤΙΘΕΤΗ σύμβαση — δεν περνούν από τον κανόνα', () => {
  /**
   * Πιν παγιδεύει την **επόμενη** «κεντρικοποίηση»: τα `DimStyle` ταιριάζουν **δομικά** με το
   * `NamedStyleProvenance` (έχουν `name` + `isBuiltIn`), αλλά τα built-in τους κρατούν
   * **κυριολεκτικά** ονόματα («ΔΙΑΣΤΑΣΕΙΣ Nestor»). Περνώντας τα από τον κανόνα θα ζητούσαν
   * `t('ΔΙΑΣΤΑΣΕΙΣ Nestor')` — δηλαδή ακριβώς το σφάλμα του §52.2, ανάποδα.
   *
   * Αν κάποια μέρα τα ονόματά τους γίνουν κλειδιά, **αυτό** το test κοκκινίζει και ζητά να
   * ξαναδιαβαστεί η απόφαση — αντί να το ανακαλύψει ο χρήστης στην οθόνη.
   */
  it('κανένα built-in `DimStyle` δεν κρατά όνομα σχήματος i18n κλειδιού', () => {
    const keyLike = BUILTIN_DIM_STYLES.filter((style) => /^[a-z][\w-]*(\.[\w-]+)+$/.test(style.name));
    expect(keyLike.map((style) => style.name)).toEqual([]);
  });
});
