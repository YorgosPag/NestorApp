/**
 * 🔴 ADR-833 §5.7 — **ΠΡΟΘΕΣΗ → ΜΟΤΙΒΟ**: `TableCellFormat` → το `numFmt` που καταλαβαίνει το Excel.
 *
 * Η υπόσχεση που έδωσε το **ADR-760** τη μέρα που διάλεξε *δομημένη πρόθεση* αντί για *μοτίβο
 * ψηφίων*, γραμμένη αυτούσια στην κεφαλίδα του `types/table-cell-format.ts`:
 *
 * > *«επειδή αποθηκεύεται **πρόθεση**, η μετάφραση προς τα έξω μένει πάντα δυνατή
 * > (`ACAD_TABLE` cell format στη Φ.Ε, **`numFmt` του `.xlsx`** στη Φ5) — ενώ η αντίστροφη,
 * > από μοτίβο σε πρόθεση, είναι μαντεψιά.»*
 *
 * Αυτό το αρχείο είναι η μισή υπόσχεση, εξοφλημένη. **Η άλλη μισή δεν γράφεται**: μοτίβο →
 * πρόθεση παραμένει μαντεψιά, γι' αυτό η εισαγωγή **δεν** προσπαθεί να διαβάσει `numFmt` πίσω
 * σε `TableCellFormat` — απαριθμεί ό,τι δεν καταλαβαίνει (§5.7.5) αντί να το μαντέψει.
 *
 * ## 🔴 ΤΟ CLDR ΑΠΟΦΑΣΙΖΕΙ ΤΗ ΘΕΣΗ, ΟΧΙ ΕΜΕΙΣ — και είναι ο λόγος που δεν υπάρχει πίνακας locale
 * Το `numFmt` του Excel είναι **κυριολεκτικό μοτίβο**: δεν μπορεί να αναβάλει τίποτα στο CLDR,
 * άρα κάποιος πρέπει να αποφασίσει *«€ πριν ή μετά;»* και *«ημέρα πριν ή μετά τον μήνα;»*. Ένας
 * χειρόγραφος πίνακας ανά locale θα ήταν **δεύτερη αυθεντία** που θα διαφωνούσε με το
 * `cellDisplayText` — δηλαδή το ίδιο κελί θα έδειχνε `1.200,50 €` στην οθόνη και `€1,200.50`
 * στο εξαγόμενο αρχείο. Αντ' αυτού η θέση **παράγεται** από το `Intl.…formatToParts` του
 * **ίδιου** locale που ζωγραφίζει την οθόνη: μία αυθεντία, δύο καταναλωτές.
 *
 * ## ⚠️ Τα κυριολεκτικά μπαίνουν σε εισαγωγικά — και δεν είναι καλλωπισμός
 * Το `dd/mm/yyyy` **ξαναερμηνεύεται** από ορισμένες εκδόσεις του Excel: το `/` θεωρείται «ο
 * διαχωριστής ημερομηνίας του locale της εφαρμογής», οπότε το ίδιο αρχείο δείχνει `05.08.2026`
 * σε γερμανικό Excel. Είναι ακριβώς η μη-φορητότητα που παραδέχεται η προδιαγραφή της Microsoft
 * (MS-OE376 §3.8.30) και που ολόκληρο το ADR-760 απέφυγε. Γραμμένο `dd"/"mm"/"yyyy`, ο
 * διαχωριστής είναι **κείμενο** και δεν τον αγγίζει κανείς.
 *
 * @module subapps/dxf-viewer/bim/table/export/table-format-to-numfmt
 * @see types/table-cell-format.ts — η πρόθεση, και η έρευνα πίσω της
 * @see bim/table/table-cell-format.ts — η **οθόνη**, ίδια αυθεντία locale
 * @see docs/centralized-systems/reference/adrs/ADR-760-table-cell-number-format.md
 */

import {
  DEFAULT_TABLE_CURRENCY,
  DEFAULT_TABLE_DATE_STYLE,
  DEFAULT_TABLE_FORMAT_LOCALE,
  type TableCellFormat,
  type TableDateStyle,
  type TableFormatLocale,
} from '../../../types/table-cell-format';

/** Το μοτίβο του Excel για «δείξε το ως κείμενο, ό,τι κι αν είναι». */
const TEXT_NUM_FMT = '@';

/**
 * Η ημερομηνία που ρωτιέται για να μαθευτεί η **σειρά** των μερών σε αυτό το locale.
 *
 * ⚠️ **Η τιμή της είναι αδιάφορη, και αυτό αποδείχθηκε** (μετάλλαξη M36, ADR-833 §5.7.6): εδώ
 * έγραφε ότι πρέπει να είναι *ασύμμετρη* (5 Νοεμβρίου) γιατί αλλιώς «η σειρά ημέρας/μήνα θα
 * ήταν αδιάκριτη». **Ψευδές για αυτή την υλοποίηση**: η αντιστοίχιση γίνεται με το
 * `part.type` που δίνει το ίδιο το `Intl` (`'day'` / `'month'` / `'year'`), όχι με ανάγνωση
 * των ψηφίων — άρα ακόμη και 3/3 θα έδινε τη σωστή σειρά. Η ασυμμετρία θα ήταν απαραίτητη
 * μόνο σε προσέγγιση που **αναλύει το αποτέλεσμα** αντί να ρωτά τα μέρη του.
 *
 * Μένει ονομασμένη σταθερά: μια ημερομηνία μέσα στη συνάρτηση θα ήταν νέο `Date` **ανά κελί**.
 */
const PROBE_DATE = new Date(Date.UTC(2026, 10, 5));

/** Το σώμα ενός αριθμού: `0.00` ή, με ομαδοποίηση, `#,##0.00`. */
function numberBody(decimals: number, grouping: boolean): string {
  const integerPart = grouping ? '#,##0' : '0';
  return decimals > 0 ? `${integerPart}.${'0'.repeat(decimals)}` : integerPart;
}

/** Ένα κυριολεκτικό μέσα σε μοτίβο — πάντα σε εισαγωγικά, δες την κεφαλίδα. */
function literal(text: string): string {
  return text.length > 0 ? `"${text.replace(/"/g, '')}"` : '';
}

/**
 * Νόμισμα: **κωδικός ISO 4217 σε `[$…]`**, με τη θέση του να προκύπτει από το CLDR.
 *
 * Ο τριγράμματος κωδικός είναι η **μία** μορφή που η τεκμηρίωση του Excel χαρακτηρίζει φορητή
 * (*«Three letter currency codes do not need the locale specified»*) — το γυμνό σύμβολο `€`
 * εξαρτάται από τη γλώσσα της εφαρμογής. Ίδια επιλογή με το {@link TableCurrencyFormat}, που
 * αποθηκεύει **κωδικό** και όχι σύμβολο, για τον ίδιο ακριβώς λόγο.
 */
function currencyPattern(
  locale: TableFormatLocale,
  decimals: number,
  currency: string,
  grouping: boolean,
): string {
  const body = numberBody(decimals, grouping);
  const tag = `[$${currency}]`;
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(1);
  const currencyIndex = parts.findIndex((part) => part.type === 'currency');
  const numberIndex = parts.findIndex((part) => part.type === 'integer');
  // Το κενό ανάμεσα στο σύμβολο και τον αριθμό είναι κι αυτό απόφαση του CLDR (στα ελληνικά
  // υπάρχει, στα αγγλικά όχι) — διαβάζεται, δεν εικάζεται.
  const gap = parts.some((part) => part.type === 'literal' && part.value.trim() === '')
    ? literal(' ')
    : '';
  return currencyIndex >= 0 && currencyIndex < numberIndex
    ? `${tag}${gap}${body}`
    : `${body}${gap}${tag}`;
}

/** Πώς γράφεται κάθε συστατικό ημερομηνίας στη γλώσσα του Excel. */
const DATE_PART_CODE: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  day: { '2-digit': 'dd', numeric: 'd' },
  month: { '2-digit': 'mm', numeric: 'm', short: 'mmm', long: 'mmmm' },
  year: { numeric: 'yyyy', '2-digit': 'yy' },
};

/**
 * Το μοτίβο μιας ημερομηνίας, **παραγμένο από τη σειρά που δίνει το CLDR** για αυτό το locale.
 *
 * ⚠️ Τα `mmm`/`mmmm` αποδίδονται στη γλώσσα **της εφαρμογής που ανοίγει το αρχείο**, όχι σε
 * αυτή που το έγραψε — δηλωμένη μη-φορητότητα του `numFmt` (MS-OE376 §3.8.30), όχι δικό μας
 * σφάλμα, και ο λόγος που το `iso` υπάρχει ως επιλογή στο {@link TableDateStyle}.
 */
function datePattern(locale: TableFormatLocale, style: TableDateStyle): string {
  if (style === 'iso') return 'yyyy"-"mm"-"dd';
  if (style === 'year') return 'yyyy';
  const options: Intl.DateTimeFormatOptions =
    style === 'monthYear'
      ? { month: 'long', year: 'numeric', timeZone: 'UTC' }
      : style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
        : style === 'medium'
          ? { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }
          : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(locale, options)
    .formatToParts(PROBE_DATE)
    .map((part) => {
      if (part.type === 'literal') return literal(part.value);
      const requested = options[part.type as 'day' | 'month' | 'year'];
      return DATE_PART_CODE[part.type]?.[String(requested)] ?? '';
    })
    .join('');
}

/**
 * **Η πρόθεση αυτού του κελιού, γραμμένη στη γλώσσα του Excel** — ή `undefined` όταν η σωστή
 * απάντηση είναι «καμία μορφή» (το `General` του Excel).
 *
 * 🔑 **Η ΤΙΜΗ ΔΕΝ ΑΓΓΙΖΕΤΑΙ ΠΟΤΕ.** Ό,τι γράφεται στο κελί είναι ο ωμός αριθμός· εδώ γράφεται
 * μόνο το *πώς διαβάζεται*. Είναι ο ίδιος κανόνας «τιμή ≠ εμφάνιση» του ADR-760, και η αιτία
 * που το round-trip κρατά ακρίβεια: το Excel παίρνει τον **ίδιο** αριθμό, όχι στρογγυλεμένο
 * κείμενο. Ένα ποσοστό ταξιδεύει ως `0,25` με μοτίβο `0.00%` — ακριβώς όπως το αποθηκεύει και
 * το ίδιο το Excel.
 *
 * ⚠️ **Οι γωνίες χάνουν τη ΜΟΝΑΔΑ τους, όχι την τιμή τους.** Το Excel δεν έχει τύπο γωνίας:
 * μοίρες/grads/ακτίνια/τοπογραφική δεν είναι εκφράσιμα σε `numFmt`. Η αποθηκευμένη τιμή είναι
 * **πάντα δεκαδικές μοίρες** (`renderAngle` μετατρέπει μόνο για την οθόνη), οπότε ο αριθμός
 * που φεύγει είναι σωστός και το `"°"` το λέει· ένα κελί DMS θα δείξει `43,51°` αντί για
 * `43°30'36"`. Απώλεια **εμφάνισης**, ποτέ τιμής — η κατηγορία «*minor loss of fidelity*».
 */
export function xlsxNumFmtForCellFormat(format: TableCellFormat): string | undefined {
  const locale = format.locale ?? DEFAULT_TABLE_FORMAT_LOCALE;
  switch (format.kind) {
    case 'general':
      return undefined;
    case 'text':
      return TEXT_NUM_FMT;
    case 'whole':
      return numberBody(0, format.grouping ?? true);
    case 'decimal':
      return numberBody(format.decimals, format.grouping ?? true);
    case 'percent':
      return `${numberBody(format.decimals, false)}%`;
    case 'currency':
      return currencyPattern(
        locale,
        format.decimals,
        format.currency ?? DEFAULT_TABLE_CURRENCY,
        format.grouping ?? true,
      );
    case 'date':
      return datePattern(locale, format.style ?? DEFAULT_TABLE_DATE_STYLE);
    case 'angle':
      return `${numberBody(format.decimals, false)}${literal('°')}`;
  }
}
