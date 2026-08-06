/**
 * 🔴 ADR-760 — **ΤΟ ΣΤΡΩΜΑ ΕΜΦΑΝΙΣΗΣ ΤΟΥ ΚΕΛΙΟΥ**: από ωμή τιμή σε αυτό που διαβάζει το μάτι.
 *
 * ## Γιατί ΔΕΝ μπήκε μέσα στο `cellText`
 * Ο πρώτος σχεδιασμός έλεγε «το `cellText` είναι το ένα σημείο, εκεί μπαίνει η μορφή». Ο
 * κώδικας το διέψευσε: από τις **32** κλήσεις του, μόνο **δύο** ρωτούν «πώς φαίνεται» (ο
 * μετρητής πλάτους και ο ζωγράφος). Οι υπόλοιπες ρωτούν **σημασιολογία** — «είναι κενό;»
 * (`hasContent`, `clearPersistedCells`), «άλλαξε;», «τι κείμενο έχει η κεφαλίδα;».
 *
 * 🔴 Και μία από αυτές θα έσπαγε θανάσιμα: το `table-cell-content.ts` κρίνει την **ταυτότητα**
 * με `cellText(existing) === text`. Σε κελί που δείχνει `5,00`, η πληκτρολόγηση `5` θα
 * διαβαζόταν «τίποτα δεν άλλαξε» — και επειδή η ταυτότητα παρακάμπτει τον γραφέα, το κελί θα
 * **έμενε τύπος με μπαγιάτικο δέντρο** και ο πρώτος επαναϋπολογισμός θα έσβηνε ό,τι έγραψε ο
 * χρήστης. Είναι ακριβώς το σφάλμα που έλυσε η Φ.Ζ με το `asTextCell`, ξαναγεννημένο από την
 * άλλη πλευρά.
 *
 * Άρα **δεν είναι διπλότυπο**: το `cellText` απαντά «τι **γράφει** το κελί», αυτό εδώ «τι
 * **δείχνει**». Δύο ερωτήσεις, δύο συναρτήσεις — και η δεύτερη **καλεί** την πρώτη, ώστε να μην
 * υπάρχει δεύτερη απάντηση στο «τι σημαίνει κενό κελί».
 *
 * ## Τι ΔΕΝ γεννιέται εδώ
 * - **Ανάγνωση αριθμού** → {@link cellValueToNumber} (ADR-576 πίσω από την πύλη αυστηρότητας).
 *   Ο **ίδιος** κριτής με τη μηχανή τύπων: ό,τι αθροίζει η `SUM` είναι ό,τι μορφοποιείται εδώ.
 *   Δεύτερος αναγνώστης θα σήμαινε κελί που *φαίνεται* αριθμός και δεν αθροίζεται, ή αντίστροφα.
 * - **Γωνίες** → οι καθαρές `formatDMS` / `formatGrads` / `formatRadians` / `formatSurveyor`
 *   του ADR-082. Ίδια γωνία, ίδια γραφή σε διάσταση και σε κελί, μέσα στο ίδιο σχέδιο.
 * - **Ημερομηνία** → {@link dateFromExcelSerial}, δίπλα στην εποχή που τη γεννά (§49.6.3).
 * - **Τα ίδια τα ψηφία** → `Intl` (CLDR). Καμία χειροποίητη υποδιαστολή, κανένα `replace(',')`.
 *
 * ## ⚠️ Γιατί ΟΧΙ μέσω του `FormatterRegistry`
 * Ο `FormatterRegistry` (ADR-082) είναι singleton με **καθολική** ρύθμιση σχεδίου: locale
 * `'auto'` (δηλαδή `getCurrentLocale()`), zero-suppression, DIMPOST templates. Είναι σωστός για
 * τις **ενδείξεις του σχεδίου** (μήκη, γωνίες, συντεταγμένες στη γραμμή κατάστασης) — και
 * λάθος για **δεδομένα εγγράφου**: ένα κελί πίνακα οφείλει να δείχνει το ίδιο ανεξάρτητα από
 * τη γλώσσα του χρήστη και από ρυθμίσεις που κανείς δεν σύνδεσε μαζί του. Είναι η ίδια διάκριση
 * που έχει ήδη πληρωθεί μέσα στον ίδιο τον Registry: το `formatArea` είναι `@deprecated` υπέρ
 * του `formatAreaForDisplay`, ακριβώς επειδή «γενική μορφοποίηση» και «μορφοποίηση που ακολουθεί
 * συγκεκριμένο κανόνα» δεν είναι η ίδια ερώτηση.
 *
 * Οι **καθαρές** συναρτήσεις γωνίας του ADR-082 δεν έχουν αυτό το πρόβλημα (δεν διαβάζουν
 * ρύθμιση), γι' αυτό καταναλώνονται αυτούσιες.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-format
 * @see types/table-cell-format.ts — ο τύπος, η έρευνα και ο κανόνας «τιμή ≠ εμφάνιση»
 * @see bim/table/table-cell-content.ts — το `cellText`, η **σημασιολογική** ανάγνωση
 * @see docs/centralized-systems/reference/adrs/ADR-760-table-cell-number-format.md
 */

import {
  DEFAULT_TABLE_CURRENCY,
  DEFAULT_TABLE_DATE_STYLE,
  DEFAULT_TABLE_FORMAT_LOCALE,
  TABLE_GENERAL_FORMAT,
  type TableCellFormat,
  type TableDateStyle,
  type TableFormatLocale,
} from '../../types/table-cell-format';
import type { ScheduleColumnValueType } from '../schedule/types';
import type { TableAxisStyleOverride, TableCell, TableCellStyleOverride } from '../../types/table';
import { cellText } from './table-cell-content';
import { cellValueToNumber } from './formula/table-formula-value';
import { dateFromExcelSerial } from './formula/excel-serial-date';
import {
  formatDMS,
  formatGrads,
  formatRadians,
  formatSurveyor,
} from '../../formatting/formatter-unit-formats';

// ──────────────────────────────────────────────────────────────────────────────
// Η επίλυση — ΠΟΙΑ μορφή ισχύει σε αυτό το κελί
// ──────────────────────────────────────────────────────────────────────────────

/** Οι τρεις ρητές παρακάμψεις, στη σειρά προτεραιότητας του §28.4. */
export interface TableFormatOverrides {
  readonly cell?: TableCellStyleOverride;
  readonly row?: TableAxisStyleOverride;
  readonly column?: TableAxisStyleOverride;
}

/**
 * 🔑 **Ποια μορφή ισχύει** — πέντε επίπεδα, κανένα νέο μηχανισμό κληρονομικότητας.
 *
 * ```
 *   1. κελί            (ρητή παράκαμψη)          ┐
 *   2. γραμμή          (ρητή παράκαμψη)          ├─ η ΙΔΙΑ σειρά με το `resolveCellStyle`
 *   3. στήλη           (ρητή παράκαμψη)          ┘
 *   4. TableColumn.valueType   (σημασιολογική βάση — «τι είδους τιμή είναι η στήλη»)
 *   5. general                 (καμία γνώμη)
 * ```
 *
 * ## Γιατί έτσι, και όχι αλλιώς
 * Το AutoCAD κληρονομεί σε **τρία** επίπεδα (κελί / στήλη / TABLESTYLE), το Revit σε **δύο**
 * (πεδίο με ρητό «Use project settings» πάνω από τα project units), το ArchiCAD σε **ένα**
 * (ολόκληρο το schedule). Εδώ είναι πέντε — αλλά δεν γράφτηκε καμία νέα μηχανική: τα επίπεδα
 * 1-3 είναι το ίδιο `styleOverride` που ήδη κουβαλά χρώμα, έντονα και στοίχιση, και το επίπεδο
 * 4 αντιγράφει **κατά γράμμα** το μοτίβο της στοίχισης στο `table-layout-place.ts` («η
 * σημασιολογική `TableColumn.align` κερδίζει μόνο όταν καμία ρητή παράκαμψη δεν έχει άποψη»).
 *
 * 🔑 Ως δώρο, το «νέα γραμμή κληρονομεί τη μορφή» βγαίνει **δωρεάν**: η μορφή της στήλης ζει
 * στη στήλη, όχι σε N αντίγραφα στα κελιά — που είναι ο ρητά γραμμένος λόγος ύπαρξης του
 * `TableAxisStyleOverride`.
 */
export function resolveCellNumberFormat(
  overrides: TableFormatOverrides,
  columnValueType: ScheduleColumnValueType,
): TableCellFormat {
  return explicitCellNumberFormat(overrides) ?? SEMANTIC_FORMAT_BY_VALUE_TYPE[columnValueType];
}

/**
 * 🔴 ADR-739 §55 — **Η ΡΗΤΗ μορφή** αυτού του κελιού: τα επίπεδα 1-3 μόνα τους, χωρίς τη
 * σημασιολογική βάση. `undefined` ⇒ κανείς δεν έχει άποψη ⇒ κληρονομιά.
 *
 * Ξεχωριστή συνάρτηση επειδή τη ρωτά **δεύτερος** καταναλωτής με άλλη πρόθεση: το χειριστήριο
 * μορφής αριθμού ανάβει την κουκκίδα «ρητό» ακριβώς όταν αυτή δεν είναι `undefined` — η ίδια
 * σημασιολογία με το `overridden` των Β/Ι/Υ. Γραμμένη δεύτερη φορά εκεί, η αλυσίδα
 * προτεραιότητας θα ήταν δύο εκφράσεις που *τυχαίνει* να συμφωνούν, και η μία θα ξεχνούσε το
 * επίπεδο που θα προστεθεί αύριο.
 */
export function explicitCellNumberFormat(
  overrides: TableFormatOverrides,
): TableCellFormat | undefined {
  return overrides.cell?.numberFormat ?? overrides.row?.numberFormat ?? overrides.column?.numberFormat;
}

/**
 * Επίπεδο 4 — η **σημασιολογική** βάση, όταν κανείς δεν έχει πει κάτι ρητά.
 *
 * ## 🔴 ΓΙΑΤΙ ΤΑ `dimension-mm-to-*` ΔΙΝΟΥΝ `general` ΚΑΙ ΔΕΝ ΜΕΤΑΤΡΕΠΟΥΝ
 * Στους exporters του ADR-363 το `dimension-mm-to-m` **διαιρεί διά 1000**, και εκεί είναι
 * σωστό: η τιμή έρχεται από το μοντέλο BIM, όπου η μονάδα είναι **εγγυημένα** χιλιοστά.
 *
 * Ένα κελί καμβά δεν έχει τέτοια εγγύηση — το γράφει ο χρήστης. Εφαρμοσμένη εδώ, η ίδια
 * μετατροπή θα διαιρούσε **σιωπηλά διά 1000** έναν αριθμό που κανείς δεν δήλωσε ότι είναι
 * χιλιοστά: **σφάλμα τιμής μεταμφιεσμένο σε μορφοποίηση**, ακριβώς αυτό που ολόκληρο το
 * ADR-760 υπάρχει για να αποκλείσει.
 *
 * 🔑 Και είναι η απόδειξη γιατί το `ScheduleColumnValueType` **δεν μπορούσε** να γίνει το
 * λεξιλόγιο της μορφής: συγχέει **μετατροπή μονάδας** με **ακρίβεια εμφάνισης**. Η δομημένη
 * μορφή τα ξεχωρίζει, και η μετατροπή αποκτά σωστό σπίτι στη φάση των **μονάδων** (δικό της
 * ADR: τύπος ποσότητας + διαστατική ανάλυση), αντί να λαθρεπιβατεύει εδώ.
 */
const SEMANTIC_FORMAT_BY_VALUE_TYPE: Readonly<Record<ScheduleColumnValueType, TableCellFormat>> = {
  text: TABLE_GENERAL_FORMAT,
  number: { kind: 'decimal', decimals: 2 },
  count: { kind: 'whole' },
  'area-m2': { kind: 'decimal', decimals: 2 },
  'volume-m3': { kind: 'decimal', decimals: 3 },
  'dimension-mm-to-m': TABLE_GENERAL_FORMAT,
  'dimension-mm-to-cm': TABLE_GENERAL_FORMAT,
};

// ──────────────────────────────────────────────────────────────────────────────
// Η απόδοση — ΤΙ δείχνει το κελί
// ──────────────────────────────────────────────────────────────────────────────

/**
 * **Το κείμενο ενός κελιού για μέτρηση και ζωγραφική**, με τη μορφή του εφαρμοσμένη.
 *
 * Η αντικατάσταση του `cellText` στα **δύο** σημεία εμφάνισης — και μόνο εκεί.
 *
 * ## Τι περνά ΑΝΕΠΑΦΟ, και γιατί κάθε ένα ρητά
 * - **Κενό κελί** ⇒ κενό αλφαριθμητικό. Η ίδια, μοναδική απάντηση με το {@link cellText}.
 * - **Ό,τι δεν είναι εξ ολοκλήρου αριθμός** ⇒ αυτούσιο. Το `'Δοκός Δ12'` είναι περιγραφή, το
 *   `'>15'` είναι **κριτήριο** της `SUMIF`, και το `#VALUE!` είναι κωδικός σφάλματος που
 *   ταξιδεύει σε DXF. Καμία μορφή αριθμού δεν αγγίζει τίποτα από αυτά — ίδιος κανόνας με
 *   Excel και AutoCAD: η μορφή αριθμού ισχύει για **αριθμούς**.
 * - **Μορφή που δεν μπορεί να αποδοθεί** (σειριακός εκτός ημερολογίου, `NaN`) ⇒ ο ωμός
 *   αριθμός. 🔑 **Ποτέ** `"Invalid Date"` ή `"NaN"` μέσα σε κελί: ένα σχέδιο δεν τυπώνει
 *   αγγλικά μηνύματα σφάλματος σε στήλη ημερομηνιών. Η αστοχία της μορφής **δεν καταπίνει το
 *   δεδομένο** — ο χρήστης βλέπει τον αριθμό του και καταλαβαίνει ότι η μορφή δεν ταιριάζει.
 *
 * ⚠️ Ο κριτής «είναι αριθμός;» είναι ο **ίδιος** που χρησιμοποιεί η μηχανή τύπων
 * ({@link cellValueToNumber}): ό,τι αθροίζει η `SUM` είναι ό,τι μορφοποιείται εδώ. Δεύτερος
 * κριτής θα σήμαινε κελί που *φαίνεται* αριθμός αλλά δεν αθροίζεται.
 */
export function cellDisplayText(cell: TableCell | undefined, format: TableCellFormat): string {
  const raw = cellText(cell);
  if (raw === '') return raw;

  const effective = format.kind === 'general' ? inferredFormat(cell, format) : format;
  if (effective.kind === 'general' || effective.kind === 'text') return raw;

  const numeric = cellValueToNumber(cell?.value ?? null);
  if (numeric === null) return raw;

  return renderNumber(numeric, effective) ?? raw;
}

/**
 * 🔴 ADR-760 Φ3 — **ο κανόνας του Excel**: τύπος που επιστρέφει ημερομηνία δείχνει ημερομηνία,
 * ακόμη κι όταν το κελί δεν έχει μορφή.
 *
 * Χωρίς αυτό, το `=DATE(2026,8,5)` δείχνει `46239` σε κάθε νέο πίνακα μέχρι να πάει κάποιος
 * να ορίσει μορφή — δηλαδή **πάντα**, γιατί κανείς δεν το κάνει προτού δει το πρόβλημα. Ο ίδιος
 * κανόνας υπάρχει στο Excel ακριβώς γι' αυτόν τον λόγο, και είναι η μόνη περίπτωση όπου η
 * μορφή δεν έρχεται από τον χρήστη.
 *
 * ## Γιατί είναι ασφαλές, ενώ η «αναγνώριση από την τιμή» δεν θα ήταν
 * Δεν μαντεύεται τίποτα από τον **αριθμό** — αυτό θα ήταν το `46239` που μπορεί να είναι τιμή
 * σε ευρώ. Ρωτιέται ο **τύπος**: το `DATE(...)` επιστρέφει ημερομηνία εξ ορισμού της
 * συνάρτησης, όχι κατά πιθανότητα. Είναι πληροφορία που ο χρήστης **έγραψε**, όχι εικασία.
 *
 * ## Και γιατί μένει στην ΕΜΦΑΝΙΣΗ
 * Το Excel **γράφει** τη μορφή στο κελί (και ο χρήστης μένει με μια μορφή που δεν ζήτησε, την
 * οποία πρέπει να καθαρίσει αν αλλάξει τον τύπο). Εδώ ο συμπερασμός υπολογίζεται στη ροή
 * απόδοσης: το μοντέλο δεν αποκτά τίποτα, καμία εντολή undo δεν γεννιέται, και η στιγμή που ο
 * χρήστης γράψει `=A1*2` πάνω από το `=DATE(...)` το κελί επιστρέφει μόνο του σε αριθμό.
 * **Πιο σωστό από το Excel**, με λιγότερη κατάσταση.
 *
 * ⚠️ Ρητή παράκαμψη (ακόμη και ρητό `general` σε κελί/γραμμή/στήλη) **κερδίζει πάντα** — ο
 * συμπερασμός τρέχει μόνο όταν κανείς δεν έχει άποψη, δηλαδή είναι το επίπεδο **5,5**.
 */
function inferredFormat(cell: TableCell | undefined, fallback: TableCellFormat): TableCellFormat {
  if (cell?.kind !== 'formula' || cell.formula === undefined) return fallback;
  const root = cell.formula.root;
  if (root.kind !== 'call' || !DATE_RETURNING_FUNCTIONS.has(root.name)) return fallback;
  return { kind: 'date', locale: fallback.locale };
}

/**
 * Οι συναρτήσεις της βιβλιοθήκης που επιστρέφουν **ημερομηνία**, όχι αριθμό.
 *
 * Μικρός, ρητός κατάλογος και όχι ιδιότητα της βιβλιοθήκης: το `@formulajs/formulajs` δεν
 * δηλώνει τύπο επιστροφής πουθενά (§49 το μέτρησε — επιστρέφει `Date` εκεί που το Excel
 * επιστρέφει αριθμό, και η γέφυρα το **διορθώνει**). Τα ονόματα είναι ήδη κανονικοποιημένα σε
 * κεφαλαία από τον αναλυτή.
 *
 * ⚠️ **Δεν** περιλαμβάνονται οι `DATEDIF`/`DAYS`/`YEARFRAC`/`NETWORKDAYS`: επιστρέφουν
 * **πλήθος ημερών**, δηλαδή σκέτο αριθμό. Ένα `=DAYS(A1,B1)` μορφοποιημένο ως ημερομηνία θα
 * έδειχνε «31 Ιανουαρίου 1900» αντί για «31» — το κλασικό σφάλμα που κάνει το Excel όταν ο
 * χρήστης αντιγράφει μορφή, και το οποίο εδώ αποφεύγεται **επειδή** ο κατάλογος γράφτηκε με
 * κριτήριο «τι *είναι* το αποτέλεσμα», όχι «ποια συνάρτηση αφορά ημερομηνίες».
 */
const DATE_RETURNING_FUNCTIONS: ReadonlySet<string> = new Set([
  'DATE',
  'EDATE',
  'EOMONTH',
  'WORKDAY',
  'WORKDAY.INTL',
  'WORKDAYINTL',
]);

/** `null` ⇒ «αυτή η μορφή δεν αποδίδεται γι' αυτόν τον αριθμό» ⇒ ο καλών δείχνει τον ωμό. */
function renderNumber(value: number, format: TableCellFormat): string | null {
  const locale = format.locale ?? DEFAULT_TABLE_FORMAT_LOCALE;

  switch (format.kind) {
    case 'general':
    case 'text':
      return null;
    case 'whole':
      return decimalOf(locale, 0, format.grouping).format(Math.round(value));
    case 'decimal':
      return decimalOf(locale, format.decimals, format.grouping).format(value);
    case 'percent':
      return percentOf(locale, format.decimals).format(value);
    case 'currency':
      return currencyOf(
        locale,
        format.decimals,
        format.currency ?? DEFAULT_TABLE_CURRENCY,
        format.grouping,
      ).format(value);
    case 'date':
      return renderDate(value, locale, format.style ?? DEFAULT_TABLE_DATE_STYLE);
    case 'angle':
      return renderAngle(value, locale, format);
  }
}

/**
 * Σειριακός Excel → ημερομηνία, γραμμένη κατά CLDR.
 *
 * ⚠️ **`timeZone: 'UTC'` παντού, χωρίς εξαίρεση.** Ο σειριακός φτιάχνεται σε UTC (δες
 * `excel-serial-date.ts`): διαβασμένος τοπικά, το ίδιο αρχείο θα έδειχνε **προηγούμενη μέρα**
 * σε κάθε υπολογιστή δυτικά του Γκρίνουιτς — το κλασικό off-by-one που κάνει τις «ημερομηνίες
 * έκδοσης» να χορεύουν ανά μηχάνημα.
 *
 * Το `iso` δεν περνά από `Intl`: το ISO 8601 είναι **ίδιο σε κάθε locale** εξ ορισμού, οπότε
 * ένας μορφοποιητής locale θα ήταν αντίφαση. Χτίζεται από τα μέρη UTC.
 */
function renderDate(serial: number, locale: TableFormatLocale, style: TableDateStyle): string | null {
  const date = dateFromExcelSerial(serial);
  if (date === null) return null;

  if (style === 'iso') {
    const iso = date.toISOString();
    return iso.slice(0, iso.indexOf('T'));
  }
  return dateOf(locale, style).format(date);
}

/** Οι πέντε γραφές γωνίας του ADR-082 — καταναλωμένες, ποτέ ξαναγραμμένες. */
function renderAngle(
  degrees: number,
  locale: TableFormatLocale,
  format: { readonly unit?: string; readonly decimals: number },
): string {
  switch (format.unit ?? 'degrees') {
    case 'dms':
      return formatDMS(degrees, format.decimals as Parameters<typeof formatDMS>[1]);
    case 'grads':
      return formatGrads(degrees, format.decimals as Parameters<typeof formatGrads>[1]);
    case 'radians':
      return formatRadians(degrees, format.decimals as Parameters<typeof formatRadians>[1]);
    case 'surveyor':
      return formatSurveyor(degrees, format.decimals as Parameters<typeof formatSurveyor>[1]);
    default:
      // Δεκαδικές μοίρες: το `°` είναι το `templates.angle.symbol` του ADR-082, γραμμένο εδώ
      // ως σταθερά επειδή η **καθολική** ρύθμιση σχεδίου δεν επιτρέπεται να μπει στη διάταξη.
      return `${decimalOf(locale, format.decimals, false).format(degrees)}°`;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Οι μορφοποιητές CLDR — χτισμένοι μία φορά ο καθένας
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Η κατασκευή ενός `Intl.NumberFormat` είναι από τις ακριβότερες κλήσεις του runtime (φορτώνει
 * δεδομένα CLDR). Ένας πίνακας 500 × 8 τη ζητά **4.000 φορές ανά διάταξη** — και η διάταξη
 * τρέχει σε κάθε αλλαγή μοντέλου. Ο χάρτης είναι στο επίπεδο του module και **ποτέ** δεν
 * ακυρώνεται: το κλειδί περιέχει κάθε παράμετρο, οπότε δύο διαφορετικές μορφές δεν μπορούν να
 * μοιραστούν εγγραφή.
 */
const INTL_CACHE = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat>(key: string, build: () => T): T {
  const hit = INTL_CACHE.get(key);
  if (hit) return hit as T;
  const made = build();
  INTL_CACHE.set(key, made);
  return made;
}

function decimalOf(locale: string, decimals: number, grouping?: boolean): Intl.NumberFormat {
  const useGrouping = grouping ?? true;
  return cached(`d|${locale}|${decimals}|${useGrouping}`, () =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping,
    }),
  ) as Intl.NumberFormat;
}

function percentOf(locale: string, decimals: number): Intl.NumberFormat {
  return cached(`p|${locale}|${decimals}`, () =>
    new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  ) as Intl.NumberFormat;
}

function currencyOf(
  locale: string,
  decimals: number,
  currency: string,
  grouping?: boolean,
): Intl.NumberFormat {
  const useGrouping = grouping ?? true;
  return cached(`c|${locale}|${decimals}|${currency}|${useGrouping}`, () =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping,
    }),
  ) as Intl.NumberFormat;
}

/** Οι επιλογές CLDR ανά στυλ καταλόγου — η **μία** αντιστοίχιση πρόθεσης σε `Intl`. */
const DATE_OPTIONS: Readonly<Record<Exclude<TableDateStyle, 'iso'>, Intl.DateTimeFormatOptions>> = {
  short: { day: '2-digit', month: '2-digit', year: 'numeric' },
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  monthYear: { month: 'long', year: 'numeric' },
  year: { year: 'numeric' },
};

function dateOf(locale: string, style: Exclude<TableDateStyle, 'iso'>): Intl.DateTimeFormat {
  return cached(
    `t|${locale}|${style}`,
    () => new Intl.DateTimeFormat(locale, { ...DATE_OPTIONS[style], timeZone: 'UTC' }),
  ) as Intl.DateTimeFormat;
}
