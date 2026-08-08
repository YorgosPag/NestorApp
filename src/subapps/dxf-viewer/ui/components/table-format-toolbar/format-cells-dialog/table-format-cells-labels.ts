/**
 * 🔴 ADR-739 §60 / ADR-750 Φ6 — **η αντιστοίχιση ταυτότητας → κλειδί i18n** για τον διάλογο
 * «Μορφοποίηση κελιών». Καθαρά δεδομένα: μηδέν React, μηδέν κατάσταση.
 *
 * ## 🔴 ΔΥΟ ΡΙΖΕΣ ΚΛΕΙΔΙΩΝ, ΚΑΙ Η ΔΙΑΙΡΕΣΗ ΕΙΝΑΙ ΣΗΜΑΣΙΟΛΟΓΙΚΗ
 * ```
 *   table.formatCells.*     το ΚΕΛΥΦΟΣ (τίτλος, καρτέλες, ΟΚ/Άκυρο) + οι καρτέλες «Αριθμός»
 *                           και «Στοίχιση» — ό,τι ανήκει στον διάλογο ως διάλογο
 *   table.borders.dialog.*  ό,τι ανήκει στην καρτέλα «Περίγραμμα» (γραμμή, υποδείγματα, ακμές,
 *                           14 στυλ) — και μένει εκεί ακριβώς επειδή είναι περιγράμματα
 * ```
 * Μέχρι το §60 ο διάλογος **ήταν** ο διάλογος περιγραμμάτων, οπότε μια ρίζα αρκούσε. Με τρεις
 * ζωντανές καρτέλες, ένα `table.borders.dialog.tabs.number` θα σήμαινε ότι η ετικέτα της
 * καρτέλας «Αριθμός» ζει κάτω από τα περιγράμματα — δηλαδή ο επόμενος που θα ψάξει την
 * «Στοίχιση» θα την έψαχνε στο λάθος υποδέντρο. Η ρίζα των περιγραμμάτων **δεν** μετακόμισε:
 * είναι 30+ κλειδιά που περιγράφουν πραγματικά περιγράμματα, και μια μετακόμιση θα ήταν
 * αναδιάταξη χωρίς κέρδος.
 *
 * ## 🔴 ΚΑΝΕΝΑ ΔΥΝΑΜΙΚΟ ΚΛΕΙΔΙ — ούτε ένα
 * Κάθε κατάλογος παρακάτω είναι `Record<ταυτότητα, κλειδί>`, **εξαντλητικός από τον τύπο**. Ένα
 * ``t(`${ROOT}.kinds.${kind}`)`` θα ήταν πιο σύντομο και θα έσπαγε **δύο** πύλες: η CHECK 3.8
 * δεν μπορεί να επαληθεύσει κλειδί που δεν βλέπει, και ο generator του i18n shell slice
 * (ADR-744) **αρνείται** να παράγει σε ανεπίλυτη δυναμική κλήση. Το τίμημα του «σύντομου» το
 * πλήρωσε ήδη το ADR-752: έξι namespaces με ωμά κλειδιά στην παραγωγή και όλες τις πύλες πράσινες.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/format-cells-dialog/table-format-cells-labels
 * @see bim/table/table-number-format-facets.ts — ο κατάλογος των οκτώ ειδών (SSoT)
 * @see bim/table/table-format-origin.ts — τα πέντε επίπεδα κληρονομιάς
 */

import type { TableBorderDialogPositionId } from '../../../../bim/table/table-border-dialog-positions';
import type { TableBorderDialogPresetId } from '../../../../bim/table/table-border-dialog-draft';
import type { TableFormatOrigin } from '../../../../bim/table/table-format-origin';
import type { TableCellAlign } from '../../../../types/table';
import type {
  TableCellFormatKind,
  TableDateStyle,
} from '../../../../types/table-cell-format';
import type { AngularUnitType } from '../../../../config/number-format-config';
import type {
  TableHorizontalAlign,
  TableVerticalAlign,
} from '../../../../bim/table/table-align-ops';

/** Το κοινό πρόθεμα του **κελύφους** και των δύο νέων καρτελών — γραμμένο **μία** φορά. */
export const TABLE_FORMAT_CELLS_KEY = 'table.formatCells';

/** Το πρόθεμα της καρτέλας **«Περίγραμμα»** — αμετάβλητο από το ADR-750 Φ6. */
export const TABLE_BORDER_DIALOG_KEY = 'table.borders.dialog';

/**
 * Οι έξι καρτέλες του Excel, **στη σειρά του**.
 *
 * ⚠️ Η σειρά **δεν** είναι η σειρά υλοποίησης: το «Αριθμός» είναι πρώτο στο Excel και έγινε
 * ζωντανό τελευταίο. Μια λίστα ταξινομημένη κατά «τι δουλεύει» θα μετακινούσε καρτέλες κάτω από
 * το χέρι του χρήστη σε κάθε φάση — ακριβώς το «ο διάλογος άλλαξε σχήμα» που η Φ6 απέφυγε
 * δηλώνοντας εξαρχής και τις έξι.
 */
export const TABLE_FORMAT_CELLS_TABS = [
  'number',
  'alignment',
  'font',
  'border',
  'fill',
  'protection',
] as const;

export type TableFormatCellsTabId = (typeof TABLE_FORMAT_CELLS_TABS)[number];

/**
 * Οι **ζωντανές** καρτέλες. Οι υπόλοιπες μένουν `aria-disabled` — ανακοινώσιμες, μη διαθέσιμες.
 *
 * `Set` και όχι πίνακας: η ερώτηση είναι «είναι ζωντανή;» και γίνεται μία φορά ανά καρτέλα ανά
 * απόδοση. Ένα `includes` θα ήταν το ίδιο σε τρία στοιχεία και θα κρύβε την **πρόθεση**.
 */
export const TABLE_FORMAT_CELLS_LIVE_TABS: ReadonlySet<TableFormatCellsTabId> = new Set([
  'number',
  'alignment',
  'border',
]);

/**
 * 🔴 Η καρτέλα που ανοίγει **από προεπιλογή** όταν ο καλών δεν ζητά κάποια.
 *
 * Η πρώτη ζωντανή, δηλαδή του Excel. Ονομασμένη σταθερά ώστε η μέρα που θα ζωντανέψει η
 * «Γραμματοσειρά» να μην αλλάξει τίποτα εδώ κατά λάθος.
 */
export const TABLE_FORMAT_CELLS_DEFAULT_TAB: TableFormatCellsTabId = 'number';

/**
 * Ταυτότητα καρτέλας → κλειδί ετικέτας.
 *
 * ⚠️ Ήταν ``t(`${ROOT}.tabs.${tab}`)`` από τη Φ6 — δυναμικό κλειδί που *τύχαινε* να δουλεύει
 * επειδή οι έξι ταυτότητες είναι κατά γράμμα τα ονόματα των κλειδιών τους. Η σύμπτωση δεν είναι
 * εγγύηση: η πρώτη καρτέλα με σύνθετη ταυτότητα θα έβαφε ωμό κλειδί, και μέχρι τότε ούτε η CHECK
 * 3.8 ούτε ο generator του shell slice θα είχαν δει ποτέ αυτά τα έξι κλειδιά.
 */
export const TABLE_FORMAT_CELLS_TAB_KEY: Readonly<Record<TableFormatCellsTabId, string>> = {
  number: `${TABLE_FORMAT_CELLS_KEY}.tabs.number`,
  alignment: `${TABLE_FORMAT_CELLS_KEY}.tabs.alignment`,
  font: `${TABLE_FORMAT_CELLS_KEY}.tabs.font`,
  border: `${TABLE_FORMAT_CELLS_KEY}.tabs.border`,
  fill: `${TABLE_FORMAT_CELLS_KEY}.tabs.fill`,
  protection: `${TABLE_FORMAT_CELLS_KEY}.tabs.protection`,
};

// ──────────────────────────────────────────────────────────────────────────────
// Καρτέλα «Αριθμός»
// ──────────────────────────────────────────────────────────────────────────────

/** Είδος μορφής → ετικέτα κατηγορίας. Εξαντλητικός: ένατο είδος δεν μεταγλωττίζεται. */
export const TABLE_FORMAT_KIND_KEY: Readonly<Record<TableCellFormatKind, string>> = {
  general: `${TABLE_FORMAT_CELLS_KEY}.number.kinds.general`,
  whole: `${TABLE_FORMAT_CELLS_KEY}.number.kinds.whole`,
  decimal: `${TABLE_FORMAT_CELLS_KEY}.number.kinds.decimal`,
  currency: `${TABLE_FORMAT_CELLS_KEY}.number.kinds.currency`,
  percent: `${TABLE_FORMAT_CELLS_KEY}.number.kinds.percent`,
  angle: `${TABLE_FORMAT_CELLS_KEY}.number.kinds.angle`,
  date: `${TABLE_FORMAT_CELLS_KEY}.number.kinds.date`,
  text: `${TABLE_FORMAT_CELLS_KEY}.number.kinds.text`,
};

/**
 * Μορφή ημερομηνίας → ετικέτα.
 *
 * ⚠️ Οι ετικέτες **δεν** είναι παραδείγματα (`05/08/2026`): αυτά τα δείχνει το «Δείγμα», με τη
 * γλώσσα του σχεδίου και την πραγματική τιμή του κελιού. Ετικέτα-παράδειγμα θα ήταν δεύτερη,
 * χειρόγραφη απόδοση δίπλα στη μηχανή — και θα έλεγε ψέματα σε κάθε άλλο locale.
 */
export const TABLE_DATE_STYLE_KEY: Readonly<Record<TableDateStyle, string>> = {
  short: `${TABLE_FORMAT_CELLS_KEY}.number.dateStyles.short`,
  medium: `${TABLE_FORMAT_CELLS_KEY}.number.dateStyles.medium`,
  long: `${TABLE_FORMAT_CELLS_KEY}.number.dateStyles.long`,
  iso: `${TABLE_FORMAT_CELLS_KEY}.number.dateStyles.iso`,
  monthYear: `${TABLE_FORMAT_CELLS_KEY}.number.dateStyles.monthYear`,
  year: `${TABLE_FORMAT_CELLS_KEY}.number.dateStyles.year`,
};

/**
 * Μονάδα γωνίας → ετικέτα. Το λεξιλόγιο είναι **αυτούσιο** του ADR-082 (`AUNITS` του AutoCAD),
 * όχι δικό μας: η ίδια γωνία γράφεται ίδια σε διάσταση και σε κελί.
 */
export const TABLE_ANGLE_UNIT_KEY: Readonly<Record<AngularUnitType, string>> = {
  degrees: `${TABLE_FORMAT_CELLS_KEY}.number.angleUnits.degrees`,
  dms: `${TABLE_FORMAT_CELLS_KEY}.number.angleUnits.dms`,
  grads: `${TABLE_FORMAT_CELLS_KEY}.number.angleUnits.grads`,
  radians: `${TABLE_FORMAT_CELLS_KEY}.number.angleUnits.radians`,
  surveyor: `${TABLE_FORMAT_CELLS_KEY}.number.angleUnits.surveyor`,
};

// ──────────────────────────────────────────────────────────────────────────────
// Καρτέλα «Στοίχιση»
// ──────────────────────────────────────────────────────────────────────────────

/** Οριζόντια θέση → ετικέτα. Τα ονόματα είναι του Excel («Αριστερά», όχι «L»). */
export const TABLE_HORIZONTAL_ALIGN_KEY: Readonly<Record<TableHorizontalAlign, string>> = {
  L: `${TABLE_FORMAT_CELLS_KEY}.alignment.horizontal.left`,
  C: `${TABLE_FORMAT_CELLS_KEY}.alignment.horizontal.center`,
  R: `${TABLE_FORMAT_CELLS_KEY}.alignment.horizontal.right`,
};

export const TABLE_VERTICAL_ALIGN_KEY: Readonly<Record<TableVerticalAlign, string>> = {
  T: `${TABLE_FORMAT_CELLS_KEY}.alignment.vertical.top`,
  M: `${TABLE_FORMAT_CELLS_KEY}.alignment.vertical.middle`,
  B: `${TABLE_FORMAT_CELLS_KEY}.alignment.vertical.bottom`,
};

/**
 * 🔴 Τα **εννέα σημεία** ως ονομασμένη λίστα — για την άγκυρα, όχι για την οθόνη.
 *
 * Η οθόνη δείχνει **δύο πτυσσόμενα** (κάθετη × οριζόντια), όπως ακριβώς το Excel: εννέα κουμπιά
 * θα ήταν το πλέγμα στοίχισης του AutoCAD, δηλαδή άλλο χειριστήριο. Η λίστα υπάρχει ώστε ένα
 * test να μπορεί να απαιτήσει ότι κάθε συνδυασμός των δύο πτυσσόμενων είναι **εκφράσιμος** στο
 * μοντέλο — ο τύπος `TableCellAlign` το εγγυάται, αλλά μόνο αν κανείς δεν γράψει τον συνδυασμό
 * με το χέρι.
 */
export const TABLE_ALIGN_CODES: readonly TableCellAlign[] = [
  'TL', 'TC', 'TR',
  'ML', 'MC', 'MR',
  'BL', 'BC', 'BR',
];

// ──────────────────────────────────────────────────────────────────────────────
// Η προέλευση — η ερώτηση που κανένα εργαλείο πίνακα δεν απαντά
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Επίπεδο κληρονομιάς → ετικέτα.
 *
 * ⚠️ Το `'mixed'` **δεν** είναι εδώ και δεν είναι παράλειψη: δεν είναι επίπεδο, είναι η δήλωση
 * «δεν υπάρχει ένα». Έχει δικό του κλειδί, ώστε ο τύπος {@link TableFormatOrigin} να μένει ο
 * κατάλογος των **πραγματικών** επιπέδων.
 */
export const TABLE_FORMAT_ORIGIN_KEY: Readonly<Record<TableFormatOrigin, string>> = {
  cell: `${TABLE_FORMAT_CELLS_KEY}.origin.cell`,
  row: `${TABLE_FORMAT_CELLS_KEY}.origin.row`,
  column: `${TABLE_FORMAT_CELLS_KEY}.origin.column`,
  rowClass: `${TABLE_FORMAT_CELLS_KEY}.origin.rowClass`,
  valueType: `${TABLE_FORMAT_CELLS_KEY}.origin.valueType`,
};

// ──────────────────────────────────────────────────────────────────────────────
// Καρτέλα «Περίγραμμα» — αμετάβλητα από το ADR-750 Φ6
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Τα τρία υποδείγματα **στη σειρά του Excel** (Κανένα · Πλαίσιο · Πλέγμα).
 *
 * Η σειρά είναι παρουσίαση, άρα ζει εδώ και όχι στη μηχανή — εκείνη ρωτιέται ανά ταυτότητα και
 * δεν έχει λόγο να ξέρει πώς παρατάσσονται. Ο τύπος όμως είναι **της μηχανής**: μια ταυτότητα
 * που δεν υπάρχει δεν μεταγλωττίζεται.
 */
export const TABLE_BORDER_DIALOG_PRESETS: readonly TableBorderDialogPresetId[] = [
  'none',
  'outline',
  'inside',
];

/**
 * Ταυτότητα θέσης → κλειδί ετικέτας. Εξαντλητικός επίτηδες.
 *
 * ## 🔴 Γιατί ΡΗΤΟΣ χάρτης
 * Οι ταυτότητες θέσης είναι του **μοντέλου** (`insideH`, `diagonal:down`) και οι ετικέτες είναι
 * του **χρήστη** («Οριζόντιο περίγραμμα στο μέσο»). Τα δύο λεξιλόγια δεν συμπίπτουν — και δεν
 * επιτρέπεται να συμπέσουν: το `diagonal:down` έχει άνω-κάτω τελεία, δηλαδή δεν είναι καν
 * νόμιμο τμήμα κλειδιού i18n. Ένα `t(\`edges.${id}\`)` θα έβαφε **ωμό κλειδί** στην οθόνη με
 * όλες τις πύλες πράσινες (το σχήμα του CHECK 3.36 / ADR-752).
 *
 * ⚠️ Τα ονόματα του χρήστη είναι του **Excel** («στο μέσο»), όχι του μοντέλου («εσωτερικό»):
 * ο χρήστης δεν μαθαίνει ποτέ τη λέξη «ακμή» (Α5).
 */
export const TABLE_BORDER_DIALOG_EDGE_KEY: Readonly<
  Record<TableBorderDialogPositionId, string>
> = {
  top: `${TABLE_BORDER_DIALOG_KEY}.edges.top`,
  bottom: `${TABLE_BORDER_DIALOG_KEY}.edges.bottom`,
  left: `${TABLE_BORDER_DIALOG_KEY}.edges.left`,
  right: `${TABLE_BORDER_DIALOG_KEY}.edges.right`,
  insideH: `${TABLE_BORDER_DIALOG_KEY}.edges.middleHorizontal`,
  insideV: `${TABLE_BORDER_DIALOG_KEY}.edges.middleVertical`,
  'diagonal:down': `${TABLE_BORDER_DIALOG_KEY}.edges.diagonalDown`,
  'diagonal:up': `${TABLE_BORDER_DIALOG_KEY}.edges.diagonalUp`,
};
