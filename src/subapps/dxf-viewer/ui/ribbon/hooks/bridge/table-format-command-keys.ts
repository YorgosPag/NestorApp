/**
 * ADR-739 §52 — **Command-key registry για τις δύο contextual καρτέλες πίνακα.**
 *
 * Τα `commandKey` strings που μοιράζονται οι δηλώσεις δεδομένων (`contextual-table-tab.ts` /
 * `contextual-table-format-tab.ts`) με τον bridge (`useRibbonTableFormatBridge`). Ίδιο μοτίβο
 * με το `SCALE_TOOL_RIBBON_KEYS` και τα άλλα ~42 μητρώα.
 *
 * ## Γιατί ΔΥΟ μητρώα σε ΕΝΑ αρχείο
 * Οι δύο καρτέλες είναι **μία** λειτουργία με σύνθετο trigger, τις εξυπηρετεί **ένας** bridge,
 * και τα κλειδιά τους απαντούν στην ίδια ερώτηση («τι μπορεί να πατηθεί για αυτόν τον
 * πίνακα;»). Δύο αρχεία θα σήμαιναν δύο σημεία να ξεχαστεί ένα κλειδί όταν μια εντολή
 * μετακομίσει από τη μια καρτέλα στην άλλη — και η μετακόμιση είναι πιθανή, γιατί η διάκριση
 * «ιδιότητες» / «μορφοποίηση» είναι σχεδιαστική, όχι τεχνική.
 *
 * ⚠️ Τα δύο σύνολα μένουν **ξένα μεταξύ τους** (κανένα κοινό κλειδί): ο bridge τα δρομολογεί
 * με ξεχωριστούς φύλακες, και μια επικάλυψη θα έκανε τη σειρά των `if` να έχει σημασία.
 */

import { makeKeySetGuard } from './make-key-set-guard';
import type { TableAlignChoice } from '../../../../bim/table/table-align-ops';
import type {
  TableDecimalStepDirection,
  TableNumberFormatCommandId,
} from '../../../../bim/table/table-number-format-ops';
import type { TableToggleFormatKey } from '../../../components/table-format-toolbar/TableFormatToolbar';

/** Καρτέλα «Μορφοποίηση» — ό,τι γράφει στυλ (§28 / §52). */
export const TABLE_FORMAT_RIBBON_KEYS = {
  /** Editable numeric combobox — ύψος κειμένου σε **sheet-mm** (`paper-length`, ποτέ σε mm μοντέλου). */
  textHeight: 'tableFormat.textHeight',
  /**
   * 🔴 ADR-739 §56 — η **οικογένεια** γραμματοσειράς: η πρώτη θέση της ομάδας «Γραμματοσειρά»
   * του Excel, και το μόνο πεδίο του {@link TableCellStyle} που δεν είχε χειριστήριο στην
   * κορδέλα ενώ το είχε στο mini toolbar.
   */
  fontFamily: 'tableFormat.fontFamily',
  toggles: {
    bold: 'tableFormat.toggles.bold',
    italic: 'tableFormat.toggles.italic',
    underline: 'tableFormat.toggles.underline',
  },
  /**
   * 🔴 ADR-739 §56 — **οι έξι θέσεις στοίχισης, ως έξι κουμπιά.**
   *
   * ## Γιατί ΕΞΙ κουμπιά εδώ ενώ το mini toolbar έχει ΕΝΑ πτυσσόμενο
   * Δεν είναι ασυνέπεια — είναι η **ίδια** απόφαση που παίρνει το Excel: πτυσσόμενο όπου δεν
   * υπάρχει πλάτος, έξι κουμπιά στην κορδέλα όπου υπάρχει. Ο χρήστης που ξέρει Excel φτάνει με
   * μνήμη χεριού, και ένα πτυσσόμενο εδώ θα κόστιζε δύο κλικ για κάθε στοίχιση.
   *
   * ⚠️ Είναι **toggles και όχι actions**, παρότι συμπεριφέρονται ως ραδιόφωνο: η κορδέλα
   * οφείλει να δείξει **ποια** θέση ισχύει (`aria-pressed`), και σε ανάμεικτο στόχο **καμία**.
   * Μια `action` δεν έχει κατάσταση να δείξει — θα ήταν έξι κουμπιά που δεν λένε ποτέ πού
   * βρίσκεσαι.
   */
  align: {
    left: 'tableFormat.align.left',
    center: 'tableFormat.align.center',
    right: 'tableFormat.align.right',
    top: 'tableFormat.align.top',
    middle: 'tableFormat.align.middle',
    bottom: 'tableFormat.align.bottom',
  },
  /**
   * 🔴 ADR-739 §56 / ADR-760 — τα **τρία «τι είδους αριθμός»**, στη σειρά του Excel.
   *
   * Τα δεκαδικά **δεν** είναι εδώ και δεν είναι παράλειψη: δεν αλλάζουν το είδος, μετακινούν
   * την ακρίβεια μέσα σε ό,τι ισχύει ήδη — γι' αυτό ζουν στα {@link actions}, όπως ακριβώς τα
   * χωρίζει και το `TableNumberFormatCommandId` του SSoT.
   */
  numberFormat: {
    accounting: 'tableFormat.numberFormat.accounting',
    percent: 'tableFormat.numberFormat.percent',
    grouping: 'tableFormat.numberFormat.grouping',
  },
  actions: {
    sizeUp: 'tableFormat.actions.sizeUp',
    sizeDown: 'tableFormat.actions.sizeDown',
    reset: 'tableFormat.actions.reset',
    /** §56 — ένα σκαλί ακρίβειας· στεπερ, ποτέ διακόπτης (καμία `aria-pressed`). */
    decimalUp: 'tableFormat.actions.decimalUp',
    decimalDown: 'tableFormat.actions.decimalDown',
    /**
     * 🔴 ADR-739 §57 — η ομάδα «Πρόχειρο». **Actions και όχι toggles**: δεν έχουν κατάσταση να
     * δείξουν — μια περιοχή δεν είναι «αντιγραμμένη» ή «μη αντιγραμμένη», απλώς αντιγράφεται.
     *
     * ⚠️ **Η «Επικόλληση» ΔΕΝ είναι εδώ**, και δεν είναι παράλειψη: είναι split button με μενού
     * τεσσάρων εντολών και checklist όψεων, άρα widget (δες `RibbonTablePasteWidget`). Ένα
     * κλειδί εδώ θα υποσχόταν εντολή που καμία διαδρομή dispatch δεν δρομολογεί.
     */
    cut: 'tableFormat.actions.cut',
    copy: 'tableFormat.actions.copy',
  },
} as const;

/** Καρτέλα «Ιδιότητες Πίνακα» — ό,τι αλλάζει **σχήμα** ή **ταυτότητα στυλ**. */
export const TABLE_PROPERTIES_RIBBON_KEYS = {
  /** Combobox ονοματισμένου στυλ (`table-style-registry`) — γράφει `TableEntity.styleId`. */
  style: 'tableProps.style',
  actions: {
    insertRowAbove: 'tableProps.actions.insertRowAbove',
    insertRowBelow: 'tableProps.actions.insertRowBelow',
    insertColumnLeft: 'tableProps.actions.insertColumnLeft',
    insertColumnRight: 'tableProps.actions.insertColumnRight',
    deleteRow: 'tableProps.actions.deleteRow',
    deleteColumn: 'tableProps.actions.deleteColumn',
    selectAll: 'tableProps.actions.selectAll',
    /**
     * 🔴 ADR-767 Δ3 — «Ανανέωση»: ο πίνακας **ξαναρωτά** την πηγή του.
     *
     * Ζει στην καρτέλα «Ιδιότητες Πίνακα» και όχι στη «Μορφοποίηση», γιατί απαντά στο «τι
     * **είναι** ο πίνακας» (από πού ήρθαν τα νούμερα) και όχι στο «πώς φαίνεται». Ίδια
     * οικογένεια με το στυλ και τις δομικές πράξεις — πρότυπο: AutoCAD, καρτέλα *Table* →
     * panel *Data* → «Download from Source».
     */
    refreshBinding: 'tableProps.actions.refreshBinding',
  },
  /**
   * 🔴 Τα δύο panels που **κρύβονται χωρίς δρομέα**.
   *
   * Η καρτέλα εμφανίζεται με σκέτη επιλογή του πίνακα (εκεί το στυλ έχει νόημα), αλλά η
   * «Εισαγωγή γραμμής» χρειάζεται απάντηση στο «**ποιας** γραμμής;» — και μόνο ο δρομέας τη
   * δίνει. Απόντα panels αντί για γκρίζα κουμπιά: ο ίδιος κανόνας «μην υπόσχεσαι ό,τι δεν
   * κάνεις» που κρατά και το mini toolbar καθαρό.
   */
  panels: {
    rowsColumns: 'tableProps.panel.rowsColumns',
    selection: 'tableProps.panel.selection',
    /**
     * 🔴 ADR-767 — το panel «Δεδομένα» **δεν υπάρχει** σε πίνακα χωρίς δεσμό.
     *
     * Τρίτος καταναλωτής του ίδιου μηχανισμού, με **άλλη** ερώτηση από τους δύο από πάνω:
     * εκείνοι ρωτούν «υπάρχει δρομέας;», αυτός ρωτά «δηλώνει ο πίνακας πηγή;». Ένα γκρίζο
     * «Ανανέωση» σε στατικό πίνακα θα υποσχόταν λειτουργία που δεν υπάρχει — και θα άφηνε
     * τον χρήστη να ψάχνει τι λείπει για να ενεργοποιηθεί.
     */
    data: 'tableProps.panel.data',
  },
} as const;

export type TableFormatToggleKey =
  | typeof TABLE_FORMAT_RIBBON_KEYS.toggles.bold
  | typeof TABLE_FORMAT_RIBBON_KEYS.toggles.italic
  | typeof TABLE_FORMAT_RIBBON_KEYS.toggles.underline;

export type TableFormatActionKey =
  typeof TABLE_FORMAT_RIBBON_KEYS.actions[keyof typeof TABLE_FORMAT_RIBBON_KEYS.actions];

/** §56 — τα έξι κουμπιά στοίχισης. */
export type TableFormatAlignKey =
  typeof TABLE_FORMAT_RIBBON_KEYS.align[keyof typeof TABLE_FORMAT_RIBBON_KEYS.align];

/** §56 — τα τρία «τι είδους αριθμός». */
export type TableFormatNumberKey =
  typeof TABLE_FORMAT_RIBBON_KEYS.numberFormat[keyof typeof TABLE_FORMAT_RIBBON_KEYS.numberFormat];

/** §56 — τα δύο combobox της καρτέλας: ύψος κειμένου και οικογένεια. */
export type TableFormatComboboxKey =
  | typeof TABLE_FORMAT_RIBBON_KEYS.textHeight
  | typeof TABLE_FORMAT_RIBBON_KEYS.fontFamily;

export type TablePropertiesActionKey =
  typeof TABLE_PROPERTIES_RIBBON_KEYS.actions[keyof typeof TABLE_PROPERTIES_RIBBON_KEYS.actions];

export type TablePropertiesVisibilityKey =
  typeof TABLE_PROPERTIES_RIBBON_KEYS.panels[keyof typeof TABLE_PROPERTIES_RIBBON_KEYS.panels];

/**
 * 🔴 Το κλειδί κορδέλας → το **πεδίο του μοντέλου**. Χάρτης και όχι τριαδικό: με τρία δίτιμα
 * πεδία σήμερα και το `strikethrough` να περιμένει στη Φ2, μια αλυσίδα `if` είναι το σημείο
 * όπου η επόμενη προσθήκη ξεχνά μια περίπτωση και το κουμπί σιωπά χωρίς σφάλμα.
 */
export const TABLE_FORMAT_TOGGLE_FIELD: Readonly<Record<TableFormatToggleKey, TableToggleFormatKey>> = {
  [TABLE_FORMAT_RIBBON_KEYS.toggles.bold]: 'bold',
  [TABLE_FORMAT_RIBBON_KEYS.toggles.italic]: 'italic',
  [TABLE_FORMAT_RIBBON_KEYS.toggles.underline]: 'underline',
};

/**
 * 🔴 §56 — **ποιο κουμπί στοίχισης ζητά ποια μισή αλλαγή.**
 *
 * Χάρτης προς το {@link TableAlignChoice} του SSoT και **όχι** προς έξι σταθερές `'TL'`/`'ML'`/…:
 * ένα κουμπί «αριστερά» δεν ξέρει — και δεν επιτρέπεται να μαντέψει — την κάθετη θέση του
 * κελιού. Δες `bim/table/table-align-ops.ts` για το τι σπάει αν τη μαντέψει.
 */
export const TABLE_FORMAT_ALIGN_CHOICE: Readonly<Record<TableFormatAlignKey, TableAlignChoice>> = {
  [TABLE_FORMAT_RIBBON_KEYS.align.left]: { axis: 'horizontal', code: 'L' },
  [TABLE_FORMAT_RIBBON_KEYS.align.center]: { axis: 'horizontal', code: 'C' },
  [TABLE_FORMAT_RIBBON_KEYS.align.right]: { axis: 'horizontal', code: 'R' },
  [TABLE_FORMAT_RIBBON_KEYS.align.top]: { axis: 'vertical', code: 'T' },
  [TABLE_FORMAT_RIBBON_KEYS.align.middle]: { axis: 'vertical', code: 'M' },
  [TABLE_FORMAT_RIBBON_KEYS.align.bottom]: { axis: 'vertical', code: 'B' },
};

/** §56 — το κλειδί κορδέλας → η εντολή του SSoT. Ίδιο σχήμα με το {@link TABLE_FORMAT_TOGGLE_FIELD}. */
export const TABLE_FORMAT_NUMBER_COMMAND: Readonly<
  Record<TableFormatNumberKey, TableNumberFormatCommandId>
> = {
  [TABLE_FORMAT_RIBBON_KEYS.numberFormat.accounting]: 'accounting',
  [TABLE_FORMAT_RIBBON_KEYS.numberFormat.percent]: 'percent',
  [TABLE_FORMAT_RIBBON_KEYS.numberFormat.grouping]: 'grouping',
};

/**
 * §56 — «ένα σκαλί πάνω» / «ένα σκαλί κάτω» για την **ακρίβεια**.
 *
 * ⚠️ Ξεχωριστός χάρτης από το `STEP_DIRECTION` του **μεγέθους** στον bridge, παρότι και οι δύο
 * απεικονίζουν σε `1 | -1`: είναι δύο διαφορετικές ερωτήσεις (πόσο **μεγάλο** φαίνεται · πόσο
 * **ακριβές** είναι) με δύο διαφορετικούς τύπους προορισμού. Ένας κοινός χάρτης θα δεχόταν
 * σιωπηλά το κλειδί του ενός στη διαδρομή του άλλου.
 */
export const TABLE_FORMAT_DECIMAL_DIRECTION: Readonly<
  Record<string, TableDecimalStepDirection>
> = {
  [TABLE_FORMAT_RIBBON_KEYS.actions.decimalUp]: 1,
  [TABLE_FORMAT_RIBBON_KEYS.actions.decimalDown]: -1,
};

/**
 * 🔴 §57 — «αντιγραφή» ή «αποκοπή»; Χάρτης, για τον **τρίτο** λόγο μέσα σε αυτό το αρχείο.
 *
 * ⚠️ Είναι επίσης ο φύλακας της **παγίδας των `actions`**: τα δύο κλειδιά ζουν μέσα στο
 * `TABLE_FORMAT_RIBBON_KEYS.actions`, άρα το {@link isTableFormatActionKey} τα δέχεται — και ο
 * κλάδος του στέλνει ό,τι δεν είναι «επαναφορά» στο `stepTextHeight`. Χωρίς ρητή δρομολόγηση
 * **πριν** από εκείνον, η «Αντιγραφή» θα **μεγάλωνε τη γραμματοσειρά**, χωρίς κανένα σφάλμα και
 * με το κουμπί να φαίνεται ότι δουλεύει. Ακριβώς το ίδιο συνέβη στα δεκαδικά του §56.
 */
export const TABLE_FORMAT_CLIPBOARD_COMMAND: Readonly<Record<string, 'cut' | 'copy'>> = {
  [TABLE_FORMAT_RIBBON_KEYS.actions.cut]: 'cut',
  [TABLE_FORMAT_RIBBON_KEYS.actions.copy]: 'copy',
};

export const isTableFormatComboboxKey = makeKeySetGuard<TableFormatComboboxKey>([
  TABLE_FORMAT_RIBBON_KEYS.textHeight,
  TABLE_FORMAT_RIBBON_KEYS.fontFamily,
]);

export const isTableFormatToggleKey = makeKeySetGuard<TableFormatToggleKey>([
  TABLE_FORMAT_RIBBON_KEYS.toggles.bold,
  TABLE_FORMAT_RIBBON_KEYS.toggles.italic,
  TABLE_FORMAT_RIBBON_KEYS.toggles.underline,
]);

/**
 * §56 — οι φύλακες παράγονται από τους **χάρτες**, όχι από χειρόγραφες λίστες.
 *
 * Είναι το ίδιο idiom που ήδη χρησιμοποιούν οι φύλακες της «Ιδιότητες Πίνακα»
 * (`Object.values(...)`), και εδώ έχει έξτρα δόντια: ένα έβδομο κουμπί στοίχισης **δεν
 * μεταγλωττίζεται** χωρίς εγγραφή στον χάρτη, άρα δεν μπορεί να υπάρξει κλειδί που ο φύλακας
 * δέχεται και ο δρομολογητής δεν ξέρει τι να το κάνει.
 */
export const isTableFormatAlignKey = makeKeySetGuard<TableFormatAlignKey>(
  Object.keys(TABLE_FORMAT_ALIGN_CHOICE) as readonly TableFormatAlignKey[],
);

export const isTableFormatNumberKey = makeKeySetGuard<TableFormatNumberKey>(
  Object.keys(TABLE_FORMAT_NUMBER_COMMAND) as readonly TableFormatNumberKey[],
);

export const isTableFormatActionKey = makeKeySetGuard<TableFormatActionKey>(
  Object.values(TABLE_FORMAT_RIBBON_KEYS.actions),
);

export const isTablePropertiesComboboxKey = makeKeySetGuard<typeof TABLE_PROPERTIES_RIBBON_KEYS.style>([
  TABLE_PROPERTIES_RIBBON_KEYS.style,
]);

export const isTablePropertiesActionKey = makeKeySetGuard<TablePropertiesActionKey>(
  Object.values(TABLE_PROPERTIES_RIBBON_KEYS.actions),
);

export const isTablePropertiesVisibilityKey = makeKeySetGuard<TablePropertiesVisibilityKey>(
  Object.values(TABLE_PROPERTIES_RIBBON_KEYS.panels),
);
