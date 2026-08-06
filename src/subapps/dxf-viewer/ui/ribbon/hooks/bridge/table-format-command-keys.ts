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
import type { TableToggleFormatKey } from '../../../components/table-format-toolbar/TableFormatToolbar';

/** Καρτέλα «Μορφοποίηση» — ό,τι γράφει στυλ (§28 / §52). */
export const TABLE_FORMAT_RIBBON_KEYS = {
  /** Editable numeric combobox — ύψος κειμένου σε **sheet-mm** (`paper-length`, ποτέ σε mm μοντέλου). */
  textHeight: 'tableFormat.textHeight',
  toggles: {
    bold: 'tableFormat.toggles.bold',
    italic: 'tableFormat.toggles.italic',
    underline: 'tableFormat.toggles.underline',
  },
  actions: {
    sizeUp: 'tableFormat.actions.sizeUp',
    sizeDown: 'tableFormat.actions.sizeDown',
    reset: 'tableFormat.actions.reset',
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
  },
} as const;

export type TableFormatToggleKey =
  | typeof TABLE_FORMAT_RIBBON_KEYS.toggles.bold
  | typeof TABLE_FORMAT_RIBBON_KEYS.toggles.italic
  | typeof TABLE_FORMAT_RIBBON_KEYS.toggles.underline;

export type TableFormatActionKey =
  | typeof TABLE_FORMAT_RIBBON_KEYS.actions.sizeUp
  | typeof TABLE_FORMAT_RIBBON_KEYS.actions.sizeDown
  | typeof TABLE_FORMAT_RIBBON_KEYS.actions.reset;

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

export const isTableFormatComboboxKey = makeKeySetGuard<typeof TABLE_FORMAT_RIBBON_KEYS.textHeight>([
  TABLE_FORMAT_RIBBON_KEYS.textHeight,
]);

export const isTableFormatToggleKey = makeKeySetGuard<TableFormatToggleKey>([
  TABLE_FORMAT_RIBBON_KEYS.toggles.bold,
  TABLE_FORMAT_RIBBON_KEYS.toggles.italic,
  TABLE_FORMAT_RIBBON_KEYS.toggles.underline,
]);

export const isTableFormatActionKey = makeKeySetGuard<TableFormatActionKey>([
  TABLE_FORMAT_RIBBON_KEYS.actions.sizeUp,
  TABLE_FORMAT_RIBBON_KEYS.actions.sizeDown,
  TABLE_FORMAT_RIBBON_KEYS.actions.reset,
]);

export const isTablePropertiesComboboxKey = makeKeySetGuard<typeof TABLE_PROPERTIES_RIBBON_KEYS.style>([
  TABLE_PROPERTIES_RIBBON_KEYS.style,
]);

export const isTablePropertiesActionKey = makeKeySetGuard<TablePropertiesActionKey>(
  Object.values(TABLE_PROPERTIES_RIBBON_KEYS.actions),
);

export const isTablePropertiesVisibilityKey = makeKeySetGuard<TablePropertiesVisibilityKey>(
  Object.values(TABLE_PROPERTIES_RIBBON_KEYS.panels),
);
