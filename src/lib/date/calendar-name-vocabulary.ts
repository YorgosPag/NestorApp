/**
 * 🔴 ADR-828 §1 — **ΤΑ ΟΝΟΜΑΤΑ ΤΟΥ ΗΜΕΡΟΛΟΓΙΟΥ, ΜΙΑ ΦΟΡΑ.** Μήνες και ημέρες, ελληνικά και
 * αγγλικά, στις μορφές που ένας άνθρωπος πράγματι γράφει σε κελί.
 *
 * ## Η κεντρική αρχή: **η στήλη που ΑΝΑΓΝΩΡΙΣΤΗΚΕ είναι η στήλη που ΠΑΡΑΓΕΤΑΙ**
 * Ο χρήστης που έγραψε «Ιανουαρίου» και τράβηξε τη λαβή περιμένει «Φεβρουαρίου», όχι
 * «Φεβρουάριος». Η πτώση **δεν** παράγεται με κανόνα — είναι λεξιλογική, και κάθε προσπάθεια
 * να βγει με κατάληξη σπάει στον πρώτο ανώμαλο τύπο. Άρα αποθηκεύεται ως **στήλη**, και η
 * ταυτότητα που ταξιδεύει από την αναγνώριση στην παραγωγή δεν είναι μόνο «ποιος μήνας»
 * αλλά «ποιος μήνας **σε ποια στήλη**».
 *
 * Αντίθετα, τα **κεφαλαία και οι τόνοι** είναι μηχανικά: επανεφαρμόζονται από το
 * {@link applyWrittenWordShape}, δεν αποθηκεύονται δώδεκα φορές. Ο πίνακας κρατά **μία**
 * πηγαία γραφή ανά στήλη — Title Case, με τόνους.
 *
 * ## ⚠️ ΔΕΔΟΜΕΝΑ ΑΝΑΓΝΩΡΙΣΗΣ, ΟΧΙ ΚΕΙΜΕΝΟ ΔΙΕΠΑΦΗΣ — δεν περνούν από `t()`
 * Ίδιος κανόνας, ίδιος λόγος με το `lib/survey-record/survey-date.ts` (ADR-759 §5.6): αν τα
 * ονόματα μεταφράζονταν, **το ίδιο σχέδιο θα διαβαζόταν αλλιώς** σε αγγλικό περιβάλλον, και
 * ένας πίνακας που γράφτηκε στα ελληνικά θα σταματούσε να συμπληρώνεται όταν τον ανοίγει
 * συνάδελφος με αγγλική διεπαφή. Το έγγραφο δεν αλλάζει γλώσσα επειδή άλλαξε ο θεατής.
 * Γι' αυτό αναγνωρίζονται **και οι δύο** γλώσσες, πάντα, ανεξάρτητα από το locale της UI.
 *
 * ## 🔴 Γιατί κυριολεκτικός πίνακας και όχι `Intl.DateTimeFormat`
 * Μετρημένο σε node v20:
 *
 * | έκφραση | αποτέλεσμα |
 * |---|---|
 * | `Intl.DateTimeFormat('el-GR',{month:'long'}).format(Ιαν)` | `'Ιανουαρίου'` — **γενική** |
 *
 * Η JS δίνει το *συμφραστικό* (formatting) περιβάλλον· η **ονομαστική** (stand-alone) δεν
 * είναι προσβάσιμη από το `DateTimeFormat`. Δηλαδή το `Intl` δεν μπορεί να απαντήσει το μισό
 * ερώτημα καθόλου — και θα ήταν **δεύτερος μηχανισμός** για το άλλο μισό. Επιπλέον οι
 * συντομογραφίες του CLDR αλλάζουν μεταξύ εκδόσεων (`Sep`→`Sept`), δηλαδή το ίδιο γέμισμα θα
 * έγραφε **διαφορετικό κείμενο σε διαφορετικό μηχάνημα**. Ο πίνακας είναι ντετερμινιστικός,
 * δουλεύει χωρίς πλήρες ICU, και είναι ένα σημείο αντί για δύο.
 *
 * @module lib/date/calendar-name-vocabulary
 * @see utils/greek-text.ts — {@link normalizeForLabelMatch} (σύγκριση) + μορφή γραφής
 * @see lib/survey-record/survey-date.ts — ο δεύτερος καταναλωτής, με **φίλτρο μορφών**
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §1
 */

import { normalizeForLabelMatch } from '@/utils/greek-text';
import type { NameListCandidate } from '@/lib/string/name-list-match';

/**
 * Ποιες **στήλες** έχει ένας πίνακας ονομάτων.
 *
 * - `full` — η ονομαστική: «Ιανουάριος», «Δευτέρα», «January».
 * - `genitive` — η ελληνική γενική: «Ιανουαρίου». Υπάρχει επειδή τα σχέδια τη γράφουν
 *   («30 Ιουλίου 2026»), όχι για συμμετρία· τα αγγλικά δεν την έχουν και δεν τη δηλώνουν.
 * - `abbrev` — η συντομογραφία: «Ιαν», «Δευ», «Jan».
 */
export type CalendarNameForm = 'full' | 'genitive' | 'abbrev';

export type CalendarNameListId =
  | 'greek-month'
  | 'greek-weekday'
  | 'english-month'
  | 'english-weekday';

/**
 * Ένας πίνακας ονομάτων.
 *
 * 🔴 Το `Record<F, string>` και **όχι** `Partial`: ξεχασμένη μορφή σε μία εγγραφή **δεν
 * μεταγλωττίζεται**. Ένας πίνακας 12 σειρών × 3 στηλών γράφεται μία φορά και διαβάζεται για
 * χρόνια — το κενό που θα έμπαινε σιωπηλά θα εμφανιζόταν ως άδειο κελί σε γέμισμα, δηλαδή
 * στον χρήστη, όχι στον προγραμματιστή.
 */
export interface CalendarNameList<F extends CalendarNameForm = CalendarNameForm> {
  readonly id: CalendarNameListId;
  /**
   * Οι στήλες που έχει, με **σειρά προτεραιότητας αναγνώρισης**.
   *
   * 🔑 Η σειρά είναι σημασιολογία, όχι διακόσμηση: το αγγλικό `May` είναι **ταυτόχρονα**
   * `full` και `abbrev`. Με το `full` πρώτο, το `May` διαβάζεται ως πλήρες όνομα και η σειρά
   * του συνεχίζει `June`, `July` — που είναι η απάντηση του Excel. Με ανάποδη σειρά θα
   * συνέχιζε `Jun`, `Jul`, δηλαδή η λέξη θα άλλαζε μορφή στη μέση της στήλης.
   */
  readonly forms: readonly F[];
  /** Σε **πηγαία** γραφή (Title Case, με τόνους). Η **θέση** στον πίνακα είναι η ταυτότητα. */
  readonly entries: readonly Readonly<Record<F, string>>[];
}

/**
 * Οι ελληνικοί μήνες σε **ονομαστική, γενική και συντομογραφία**.
 *
 * Η γενική δεν είναι πλεονασμός: το σχέδιο χρησιμοποιεί και τις δύο — «ΙΟΥΛΙΟΣ 2026» στην
 * πινακίδα, «30 Ιουλίου 2026» στην πρόζα του σώματος (ADR-759 §2β.6).
 */
export const GREEK_MONTHS: CalendarNameList<'full' | 'genitive' | 'abbrev'> = {
  id: 'greek-month',
  forms: ['full', 'genitive', 'abbrev'],
  entries: [
    { full: 'Ιανουάριος', genitive: 'Ιανουαρίου', abbrev: 'Ιαν' },
    { full: 'Φεβρουάριος', genitive: 'Φεβρουαρίου', abbrev: 'Φεβ' },
    { full: 'Μάρτιος', genitive: 'Μαρτίου', abbrev: 'Μαρ' },
    { full: 'Απρίλιος', genitive: 'Απριλίου', abbrev: 'Απρ' },
    { full: 'Μάιος', genitive: 'Μαΐου', abbrev: 'Μάι' },
    { full: 'Ιούνιος', genitive: 'Ιουνίου', abbrev: 'Ιουν' },
    { full: 'Ιούλιος', genitive: 'Ιουλίου', abbrev: 'Ιουλ' },
    { full: 'Αύγουστος', genitive: 'Αυγούστου', abbrev: 'Αυγ' },
    { full: 'Σεπτέμβριος', genitive: 'Σεπτεμβρίου', abbrev: 'Σεπ' },
    { full: 'Οκτώβριος', genitive: 'Οκτωβρίου', abbrev: 'Οκτ' },
    { full: 'Νοέμβριος', genitive: 'Νοεμβρίου', abbrev: 'Νοε' },
    { full: 'Δεκέμβριος', genitive: 'Δεκεμβρίου', abbrev: 'Δεκ' },
  ],
};

/**
 * Οι ελληνικές ημέρες.
 *
 * ⚠️ Η **θέση 0 είναι αυθαίρετη** — μόνο η **κυκλική σειρά** έχει νόημα εδώ. Η λαβή δεν
 * ρωτά ποτέ «τι μέρα είναι η μηδενική», ρωτά «ποια έρχεται μετά». Επιλέχθηκε η Δευτέρα
 * (ISO 8601) ώστε ο πίνακας να διαβάζεται όπως το ημερολόγιο τοίχου, όχι επειδή κάποιος
 * υπολογισμός εξαρτάται από αυτό. **Μην** τη «διορθώσετε» σε Κυριακή νομίζοντας ότι
 * αντιστοιχεί στο `Date.getUTCDay()` — δεν διασταυρώνεται πουθενά μαζί του.
 *
 * Η γενική παραλείπεται συνειδητά: τα σχέδια και οι πίνακες ποσοτήτων γράφουν «ΔΕΥΤΕΡΑ»,
 * όχι «Δευτέρας». Μια στήλη που κανείς δεν γράφει είναι επιφάνεια αναγνώρισης χωρίς αφορμή.
 */
export const GREEK_WEEKDAYS: CalendarNameList<'full' | 'abbrev'> = {
  id: 'greek-weekday',
  forms: ['full', 'abbrev'],
  entries: [
    { full: 'Δευτέρα', abbrev: 'Δευ' },
    { full: 'Τρίτη', abbrev: 'Τρι' },
    { full: 'Τετάρτη', abbrev: 'Τετ' },
    { full: 'Πέμπτη', abbrev: 'Πεμ' },
    { full: 'Παρασκευή', abbrev: 'Παρ' },
    { full: 'Σάββατο', abbrev: 'Σαβ' },
    { full: 'Κυριακή', abbrev: 'Κυρ' },
  ],
};

export const ENGLISH_MONTHS: CalendarNameList<'full' | 'abbrev'> = {
  id: 'english-month',
  forms: ['full', 'abbrev'],
  entries: [
    { full: 'January', abbrev: 'Jan' },
    { full: 'February', abbrev: 'Feb' },
    { full: 'March', abbrev: 'Mar' },
    { full: 'April', abbrev: 'Apr' },
    { full: 'May', abbrev: 'May' },
    { full: 'June', abbrev: 'Jun' },
    { full: 'July', abbrev: 'Jul' },
    { full: 'August', abbrev: 'Aug' },
    { full: 'September', abbrev: 'Sep' },
    { full: 'October', abbrev: 'Oct' },
    { full: 'November', abbrev: 'Nov' },
    { full: 'December', abbrev: 'Dec' },
  ],
};

/** Ίδια σύμβαση θέσης με τις ελληνικές — Δευτέρα πρώτη, και για τον ίδιο λόγο. */
export const ENGLISH_WEEKDAYS: CalendarNameList<'full' | 'abbrev'> = {
  id: 'english-weekday',
  forms: ['full', 'abbrev'],
  entries: [
    { full: 'Monday', abbrev: 'Mon' },
    { full: 'Tuesday', abbrev: 'Tue' },
    { full: 'Wednesday', abbrev: 'Wed' },
    { full: 'Thursday', abbrev: 'Thu' },
    { full: 'Friday', abbrev: 'Fri' },
    { full: 'Saturday', abbrev: 'Sat' },
    { full: 'Sunday', abbrev: 'Sun' },
  ],
};

/** Όλοι οι πίνακες, στη σειρά που ρωτιούνται όταν ο καλών δεν περιορίζει. */
export const CALENDAR_NAME_LISTS: readonly CalendarNameList[] = [
  GREEK_MONTHS,
  GREEK_WEEKDAYS,
  ENGLISH_MONTHS,
  ENGLISH_WEEKDAYS,
];

/** Πού βρέθηκε μια γραμμένη λέξη μέσα στο λεξιλόγιο. */
export interface CalendarNameMatch {
  readonly listId: CalendarNameListId;
  /** **0-based** θέση μέσα στη λίστα: Ιανουάριος = 0, Δευτέρα = 0. */
  readonly index: number;
  /** 🔑 Ποια **στήλη** ταίριαξε. Χωρίς αυτό, «Ιανουαρίου» θα γεννούσε «Φεβρουάριος». */
  readonly form: CalendarNameForm;
}

const listById = new Map<CalendarNameListId, CalendarNameList>(
  CALENDAR_NAME_LISTS.map((list) => [list.id, list]),
);

/**
 * Κανονικοποιημένο κλειδί → **όλα** τα ταιριάσματα.
 *
 * Λίστα και όχι μονή τιμή επειδή μία γραφή μπορεί νόμιμα να ανήκει σε δύο στήλες (`May`).
 * Χτίζεται **μία φορά** στη φόρτωση: το γέμισμα 500 γραμμών ρωτά μία φορά ανά λωρίδα, αλλά
 * ο ίδιος πίνακας εξυπηρετεί και τον αναγνώστη πινακίδων, όπου η ερώτηση επαναλαμβάνεται.
 */
const MATCHES_BY_KEY: ReadonlyMap<string, readonly CalendarNameMatch[]> = (() => {
  const index = new Map<string, CalendarNameMatch[]>();
  for (const list of CALENDAR_NAME_LISTS) {
    list.entries.forEach((entry, position) => {
      for (const form of list.forms) {
        const key = normalizeForLabelMatch(entry[form]);
        const bucket = index.get(key);
        const match: CalendarNameMatch = { listId: list.id, index: position, form };
        if (bucket === undefined) index.set(key, [match]);
        else bucket.push(match);
      }
    });
  }
  return index;
})();

/**
 * Μια **λέξη** → ποια εγγραφή του λεξιλογίου. `null` για ό,τι δεν είναι ημερολογιακό όνομα.
 *
 * Τα `lists` και `forms` **στενεύουν** την ερώτηση, και το στένεμα είναι απόφαση του καλούντος
 * με συνέπειες: ο αναγνώστης πινακίδων ({@link module:lib/survey-record/survey-date}) ζητά
 * ρητά `['full','genitive']`, γιατί το δικό του regex δέχεται κάθε λέξη 3+ γραμμάτων και
 * **χωρίς** το φίλτρο θα άρχιζε σιωπηλά να διαβάζει το «ΜΑΡ 2026» ως Μάρτιο. Η διεύρυνση
 * ενός κανόνα ανάγνωσης εγγράφου πρέπει να είναι επιλογή, ποτέ παρενέργεια ανακατασκευής.
 *
 * Όταν μια γραφή ανήκει σε δύο στήλες, κερδίζει εκείνη που δηλώνεται **πρώτη** στη
 * {@link CalendarNameList.forms} — δες εκεί γιατί το `May` πρέπει να είναι `full`.
 */
export function matchCalendarName(
  word: string,
  lists?: readonly CalendarNameListId[],
  forms?: readonly CalendarNameForm[],
): CalendarNameMatch | null {
  const candidates = MATCHES_BY_KEY.get(normalizeForLabelMatch(word));
  if (candidates === undefined) return null;

  const allowed = candidates.filter(
    (match) =>
      (lists === undefined || lists.includes(match.listId)) &&
      (forms === undefined || forms.includes(match.form)),
  );
  if (allowed.length === 0) return null;
  if (allowed.length === 1) return allowed[0];

  const order = listById.get(allowed[0].listId)?.forms ?? [];
  return [...allowed].sort((a, b) => order.indexOf(a.form) - order.indexOf(b.form))[0];
}

/**
 * 🔴 ADR-828 Φ4β — **ΟΙ ΕΝΣΩΜΑΤΩΜΕΝΕΣ ΛΙΣΤΕΣ, ΩΣ ΥΠΟΨΗΦΙΕΣ ΣΑΝ ΟΛΕΣ ΤΙΣ ΑΛΛΕΣ.**
 *
 * Μία υποψήφια ανά **(λίστα × στήλη)**, γιατί μια στήλη είναι ακριβώς αυτό που είναι μια
 * λίστα ονομάτων: δώδεκα λέξεις με σειρά. Το «Ιανουαρίου, Φεβρουαρίου…» δεν είναι η ίδια
 * λίστα με το «Ιανουάριος, Φεβρουάριος…» — είναι **άλλη σειρά λέξεων**, και ο ανιχνευτής
 * που τις ξεχώριζε με πεδίο `form` τις ξεχωρίζει τώρα με **ταυτότητα**, χωρίς πεδίο.
 *
 * 🔑 Έτσι εξαφανίστηκε το `form` από τη σειρά (δες `table-fill-series-types.ts`): μια λίστα
 * που έγραψε ο άνθρωπος **δεν έχει** στήλες, και ένα πεδίο που για τα μισά είδη δεν σημαίνει
 * τίποτα είναι σημαία. Η στήλη επιλύεται **τη στιγμή της αναγνώρισης** και μετά δεν χρειάζεται.
 *
 * ⚠️ Η **σειρά** είναι σημασιολογία, διπλά: οι στήλες βγαίνουν με τη
 * {@link CalendarNameList.forms} (γι' αυτό το `May` διαβάζεται `full` και συνεχίζει `June`,
 * όχι `Jun`), και οι λίστες με τη {@link CALENDAR_NAME_LISTS}. Ο καλών που βάζει τις δικές
 * του **πριν** από αυτές δηλώνει ότι κερδίζει ο άνθρωπος — δες {@link matchNameList}.
 *
 * Υπολογίζεται **μία φορά**: τα δεδομένα είναι σταθερά, όπως και του {@link MATCHES_BY_KEY}.
 */
export const CALENDAR_NAME_CANDIDATES: readonly NameListCandidate[] = (() => {
  const out: NameListCandidate[] = [];
  for (const list of CALENDAR_NAME_LISTS) {
    for (const form of list.forms) {
      const [first, ...rest] = list.entries.map(
        (entry) => (entry as Partial<Record<CalendarNameForm, string>>)[form] ?? '',
      );
      // Κάθε δηλωμένη λίστα έχει εγγραφές — ο φρουρός υπάρχει για τον **τύπο**, ώστε η
      // μη-κενή πλειάδα να αποδεικνύεται αντί να δηλώνεται με `as`.
      if (first === undefined) continue;
      out.push({ key: `${list.id}:${form}`, entries: [first, ...rest] });
    }
  }
  return out;
})();
