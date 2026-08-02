/**
 * 🔴 ADR-739 §27.16 Ε5 — **ΚΑΘΕ BIM ΚΑΤΗΓΟΡΙΑ ΕΧΕΙ ΕΤΙΚΕΤΑ, ΚΑΙ ΣΤΙΣ ΔΥΟ ΓΛΩΣΣΕΣ.**
 *
 * ## Γιατί υπάρχει αυτό το αρχείο
 * Το `BIM_CATEGORIES` και ο χάρτης ετικετών `ribbon.commands.objectStyles.categories` είναι
 * **δύο χειρόγραφες λίστες του ίδιου πράγματος**. Το ADR-684 πρόσθεσε το `generic-solid`
 * στην πρώτη και **όχι** στη δεύτερη· ο πίνακας «Στυλ Αντικειμένων» ζωγράφιζε από τότε
 * **ωμό κλειδί** στην οθόνη, και **κανένα** από τα εργαλεία δεν το είδε:
 *
 *  - το **CHECK 3.8** ψάχνει `t('literal')` — εδώ το κλειδί είναι **δυναμικό**
 *    (`` t(`…categories.${cat}`) ``), άρα αόρατο εξ ορισμού·
 *  - το **`i18n:audit`** ψάχνει `defaultValue:` και `toast(` — ούτε το ένα ούτε το άλλο·
 *  - το **`validate:i18n`** συγκρίνει `el` με `en`: **και οι δύο** έλειπαν, άρα «συμφωνούν».
 *
 * Δηλαδή το κλασικό «**0 = κανείς δεν κοίταξε**» (N.11/N.12). Η μόνη πύλη που μπορεί να το
 * δει είναι αυτή: η σύγκριση της λίστας **με** τον χάρτη. Ίδιο σχήμα με το CHECK 3.34, όπου
 * δύο χειρόγραφες λίστες namespace είχαν αποκλίνει κατά 63 χωρίς κανένα gate να τις συγκρίνει.
 *
 * ⚠️ Διαβάζονται τα **πραγματικά** locale JSON, όχι στημένα δεδομένα: το ζητούμενο είναι
 * ακριβώς «τι έχει το αρχείο που φορτώνεται», όχι «τι λέει ένα fixture».
 */

import el from '@/i18n/locales/el/dxf-viewer-shell.json';
import en from '@/i18n/locales/en/dxf-viewer-shell.json';
import { BIM_CATEGORIES } from '../bim-object-styles';

type CategoryLabels = Readonly<Record<string, string>>;

const LOCALES: ReadonlyArray<readonly [string, CategoryLabels]> = [
  ['el', el.ribbon.commands.objectStyles.categories as CategoryLabels],
  ['en', en.ribbon.commands.objectStyles.categories as CategoryLabels],
];

describe('🔴 §27.16 Ε5 — ετικέτες BIM κατηγοριών: η λίστα και ο χάρτης δεν αποκλίνουν', () => {
  it.each(LOCALES)('%s — καμία κατηγορία χωρίς ετικέτα', (_locale, labels) => {
    const missing = BIM_CATEGORIES.filter((cat) => !labels[cat]);
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)('%s — καμία ετικέτα χωρίς κατηγορία (νεκρό κλειδί)', (_locale, labels) => {
    const known = new Set<string>(BIM_CATEGORIES);
    expect(Object.keys(labels).filter((key) => !known.has(key))).toEqual([]);
  });

  it('🔴 `generic-solid` — η κατηγορία που έλειπε (ADR-684), ονομαστικά', () => {
    // Ονομαστικά και όχι μόνο μέσα στον βρόχο: αν κάποιος αφαιρέσει τη γραμμή, θέλουμε το
    // test να λέει **ποια** κατηγορία, όχι «κάτι λείπει».
    for (const [, labels] of LOCALES) expect(labels['generic-solid']).toBeTruthy();
  });

  it('οι δύο γλώσσες έχουν ΤΑ ΙΔΙΑ κλειδιά — αλλιώς η μία οθόνη λέει άλλα από την άλλη', () => {
    const [[, elLabels], [, enLabels]] = LOCALES;
    expect(Object.keys(elLabels).sort()).toEqual(Object.keys(enLabels).sort());
  });
});
