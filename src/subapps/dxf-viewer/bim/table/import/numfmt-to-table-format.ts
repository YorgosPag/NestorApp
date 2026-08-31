/**
 * 🔴 ADR-833 §5.7 — **ΜΟΤΙΒΟ → ΠΡΟΘΕΣΗ**: `numFmt` του Excel → `TableCellFormat`, **όσο είναι
 * βέβαιο** — και `undefined` όταν δεν είναι.
 *
 * ## Η ένσταση του ADR-760, και γιατί δεν καταργείται αλλά **περιορίζεται**
 * Η κεφαλίδα του `types/table-cell-format.ts` λέει ρητά: *«η μετάφραση προς τα έξω μένει πάντα
 * δυνατή … ενώ η **αντίστροφη, από μοτίβο σε πρόθεση, είναι μαντεψιά**»*. Ισχύει — για
 * **αυθαίρετο** μοτίβο. Ένα `[Red][<-100]0.0;;"—"` δεν αντιστοιχεί σε καμία πρόθεση που ξέρουμε
 * να εκφράσουμε, και μια «κοντινή» απάντηση θα ήταν ακριβώς η μαντεψιά που απαγορεύεται.
 *
 * 🔑 **Αλλά δεν είναι όλα τα μοτίβα αυθαίρετα.** Το `0.00` σημαίνει *δεκαδικός με δύο ψηφία* και
 * τίποτε άλλο· το `@` σημαίνει *κείμενο*· το `#,##0.00` προσθέτει *ομαδοποίηση*. Άρα αυτό το
 * αρχείο δεν είναι **αναλυτής**, είναι **ΑΝΑΓΝΩΡΙΣΤΗΣ**: αναγνωρίζει ένα κλειστό σύνολο
 * μοτίβων και **αρνείται ρητά** τα υπόλοιπα. Η άρνηση δεν χάνεται — γίνεται γραμμή στην
 * απαρίθμηση (§5.7.5), δηλαδή ο χρήστης τη μαθαίνει **πριν** την εισαγωγή.
 *
 * ## 🔑 Η ΑΝΑΛΛΟΙΩΤΗ ΠΟΥ ΤΟ ΚΑΝΕΙ ΑΞΙΟΠΙΣΤΟ, ΚΑΙ ΤΗΝ ΚΑΡΦΩΝΕΙ ΑΓΚΥΡΑ
 * ```
 *   για κάθε f:  recognize( xlsxNumFmtForCellFormat(f) )  ≡  f      (mod ισοδυναμίας)
 * ```
 * Δηλαδή: **ό,τι γράφουμε, το ξαναδιαβάζουμε**. Ένα σχέδιο που έφυγε σε `.xlsx` και γύρισε
 * κρατά τις μορφές του ακέραιες — κάτι που κανένας από τους τρεις μεγάλους δεν εγγυάται. Η
 * ιδιότητα ελέγχεται σε **όλες** τις παραλλαγές, όχι σε δείγμα.
 *
 * ## ⚠️ Η ΜΙΑ ΙΣΟΔΥΝΑΜΙΑ, ΔΗΛΩΜΕΝΗ: `decimal(0)` ≡ `whole`
 * Η άγκυρα την **ανακάλυψε** και δεν αποσιωπήθηκε. Το Excel δεν έχει δύο μοτίβα για «ακέραιος»:
 * και οι δύο προθέσεις γράφουν `0` (ή `#,##0` με ομαδοποίηση), οπότε η επιστροφή **δεν μπορεί**
 * να τις ξεχωρίσει. Η σύμπτωση είναι **αβλαβής και αποδεδειγμένα τέτοια**: το `renderNumber`
 * περνά και τις δύο από `decimalOf(locale, 0, grouping)` — ίδια ψηφία, ίδιο κείμενο, ίδιο
 * πλάτος στήλης. Επιλέγεται το `whole` γιατί είναι η **ονομασμένη** πρόθεση («Whole Number»
 * του AutoCAD, «Number με 0 δεκαδικά» του Excel)· το `decimal(0)` είναι η εκφυλισμένη γραφή της.
 *
 * 🔴 Δεν είναι «απώλεια που δεχτήκαμε»: είναι **ταυτότητα του πεδίου προορισμού**. Μια
 * υποτιθέμενη διάσωση (π.χ. αόρατο κυριολεκτικό `""` για να ξεχωρίζει το ένα) θα μόλυνε κάθε
 * αρχείο με σημάδι που **μόνο εμείς** διαβάζουμε — δηλαδή θα ήταν grab bag από την πίσω πόρτα,
 * ακριβώς αυτό που το §5.6.5 απέρριψε.
 *
 * @module subapps/dxf-viewer/bim/table/import/numfmt-to-table-format
 * @see bim/table/export/table-format-to-numfmt.ts — η άλλη κατεύθυνση, η ασφαλής
 * @see docs/centralized-systems/reference/adrs/ADR-760-table-cell-number-format.md
 */

import type { Precision } from '../../../config/number-format-config';
import type { TableCellFormat, TableDateStyle } from '../../../types/table-cell-format';

/** Το μέγιστο πλήθος δεκαδικών που εκφράζει ο τύπος `Precision`. */
const MAX_PRECISION = 8;

/**
 * Τα κυριολεκτικά του μοτίβου, βγαλμένα από τη μέση.
 *
 * Χωρίς αυτό, ένα `0.00" μ"` θα διαβαζόταν ως μοτίβο που περιέχει `μ` — και ένα
 * `dd"/"mm"/"yyyy` θα φαινόταν να περιέχει `/`, που σε άλλα συμφραζόμενα σημαίνει «κλάσμα».
 * Αφαιρούνται και οι διαφυγές με `\`, που είναι ο δεύτερος τρόπος του Excel να γράψει
 * κυριολεκτικό χαρακτήρα.
 */
function stripLiterals(pattern: string): string {
  return pattern.replace(/"[^"]*"/g, '').replace(/\\./g, '');
}

/**
 * Πλήθος δεκαδικών από το σώμα ενός αριθμητικού μοτίβου, φραγμένο στο εκφράσιμο.
 *
 * ⚠️ **Δηλωμένη ισοδύναμη μετάλλαξη (M29)**: το `replace(/[^0]/g, '')` είναι σήμερα **no-op**
 * για κάθε είσοδο που φτάνει εδώ, γιατί ο φρουρός {@link NUMBER_BODY} δέχεται **μόνο** μηδενικά
 * μετά την υποδιαστολή (`/^(?:#,##0|0)(?:\.0+)?$/`). Η μετάλλαξη «μέτρα όλους τους χαρακτήρες»
 * έμεινε πράσινη και **δεν φταίει η άγκυρα**: καμία έγκυρη είσοδος δεν ξεχωρίζει τους κλάδους.
 * Μένει, με την απόδειξη δίπλα — ίδια στάση με το `TextEncoder(undefined)` του §5.6.6: την
 * ημέρα που ο φρουρός δεχτεί `0.0#` (Excel: «έως δύο δεκαδικά»), αυτή η γραμμή είναι ήδη σωστή.
 */
function decimalsOf(body: string): Precision {
  const dot = body.indexOf('.');
  if (dot < 0) return 0;
  const zeros = body.slice(dot + 1).replace(/[^0]/g, '').length;
  return Math.min(zeros, MAX_PRECISION) as Precision;
}

/** Το `#,##0` δηλώνει ομαδοποίηση χιλιάδων· το σκέτο `0` όχι. */
function hasGrouping(body: string): boolean {
  return body.includes('#,##');
}

/** Ένα καθαρά αριθμητικό σώμα: `0`, `0.00`, `#,##0`, `#,##0.000`. */
const NUMBER_BODY = /^(?:#,##0|0)(?:\.0+)?$/;

/** Ο κωδικός νομίσματος όπως τον γράφει η εξαγωγή: `[$EUR]`. */
const CURRENCY_TAG = /\[\$([A-Za-z]{3})\]/;

/** Η γωνία αναγνωρίζεται από το σύμβολό της, που είναι **κυριολεκτικό** στο μοτίβο. */
const DEGREE_LITERAL = /"°"|\\°/;

/**
 * Ποιο ύφος ημερομηνίας περιγράφει αυτό το μοτίβο.
 *
 * Η σειρά των ελέγχων είναι η **στενότερη πρώτα**: το `mmmm` περιέχει `mmm` ως υποσυμβολοσειρά,
 * οπότε ένας έλεγχος `mmm` πρώτος θα κατέτασσε κάθε «Αύγουστος» ως «Αυγ».
 */
function dateStyleOf(bare: string): TableDateStyle {
  const hasDay = bare.includes('d');
  // 🔴 Εδώ ζητούσε **και** `pattern.includes('"-"')` — δηλαδή αναγνώριζε ISO μόνο όταν τα
  // εισαγωγικά ήταν δικά μας. Η μετάλλαξη M33 έμεινε πράσινη και το αποκάλυψε: ένα ξένο
  // `yyyy-mm-dd` (η συνηθέστερη γραφή ISO στο Excel) έπεφτε σε `short`. Η **σειρά** έτος →
  // μήνας → ημέρα είναι από μόνη της η υπογραφή του ISO 8601· τα εισαγωγικά είναι δική μας
  // συνήθεια γραφής, όχι κριτήριο ταυτότητας.
  if (/y{2,4}.*m{1,2}.*d{1,2}/.test(bare)) return 'iso';
  if (!/[md]/.test(bare)) return 'year';
  if (bare.includes('mmmm')) return hasDay ? 'long' : 'monthYear';
  if (bare.includes('mmm')) return 'medium';
  return 'short';
}

/**
 * **Η πρόθεση πίσω από αυτό το μοτίβο, ή `undefined` όταν δεν είναι βέβαιη.**
 *
 * ⚠️ Το `undefined` έχει **δύο** νόμιμες αιτίες και ο καλών οφείλει να τις ξεχωρίζει:
 * απών `numFmt` (⇒ το κελί δεν είχε μορφή, τίποτα δεν χάνεται) και **μη αναγνωρίσιμο** μοτίβο
 * (⇒ υπήρχε μορφή και δεν την κρατάμε ⇒ **μπαίνει στην απαρίθμηση**). Γι' αυτό η συνάρτηση
 * δέχεται `string` και όχι `string | undefined`: ο έλεγχος της απουσίας ανήκει στον καλούντα,
 * όπου η διάκριση έχει νόημα.
 *
 * 🔴 **Το `'General'` δεν είναι «καμία μορφή που δεν καταλάβαμε»** — είναι η ρητή δήλωση του
 * Excel ότι το κελί δείχνει τον αριθμό ως έχει, δηλαδή ακριβώς το `TABLE_GENERAL_FORMAT`.
 */
export function tableCellFormatForNumFmt(numFmt: string): TableCellFormat | undefined {
  const pattern = numFmt.trim();
  if (pattern === '' || pattern.toLowerCase() === 'general') return { kind: 'general' };
  if (pattern === '@') return { kind: 'text' };

  const bare = stripLiterals(pattern);

  if (DEGREE_LITERAL.test(pattern)) {
    const body = bare.replace(/%/g, '');
    return NUMBER_BODY.test(body) ? { kind: 'angle', decimals: decimalsOf(body) } : undefined;
  }

  const currency = CURRENCY_TAG.exec(bare);
  if (currency) {
    const body = bare.replace(CURRENCY_TAG, '').trim();
    return NUMBER_BODY.test(body)
      ? {
          kind: 'currency',
          decimals: decimalsOf(body),
          currency: currency[1].toUpperCase(),
          grouping: hasGrouping(body),
        }
      : undefined;
  }

  if (bare.endsWith('%')) {
    const body = bare.slice(0, -1);
    return NUMBER_BODY.test(body) ? { kind: 'percent', decimals: decimalsOf(body) } : undefined;
  }

  // Ημερομηνία: μόνο σύμβολα ημερολογίου και διαχωριστικά — καμία `0`/`#`, που θα σήμαινε
  // ότι το μοτίβο μιλά **και** για αριθμό (π.χ. ώρα με δευτερόλεπτα), δηλαδή δεν είναι δικό μας.
  if (/^[ymd\s\-/.,]+$/i.test(bare) && /[ymd]/i.test(bare)) {
    return { kind: 'date', style: dateStyleOf(bare.toLowerCase()) };
  }

  if (NUMBER_BODY.test(bare)) {
    const decimals = decimalsOf(bare);
    return decimals === 0
      ? { kind: 'whole', grouping: hasGrouping(bare) }
      : { kind: 'decimal', decimals, grouping: hasGrouping(bare) };
  }

  return undefined;
}
