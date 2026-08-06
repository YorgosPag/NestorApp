/**
 * ADR-739 §43 / ADR-755 — **η διάταξη του μενού δεξιού κλικ πάνω σε κελιά**, μετρημένη 1:1 από
 * το Excel (στιγμιότυπα ιδιοκτήτη 04/08 + Excel 365 el).
 *
 * ## Γιατί μητρώο και όχι JSX με τη σειρά γραμμένη μέσα του
 * Η **σειρά** και οι **ομάδες** είναι το ίδιο το προϊόν της μέτρησης: είναι η γνώση που ο
 * ιδιοκτήτης παρήγγειλε («1:1 με το Excel»), όχι λεπτομέρεια απόδοσης. Γραμμένη μέσα σε JSX
 * θα ήταν αδύνατο να ελεγχθεί χωρίς να στηθεί DOM, και κάθε μελλοντική προσθήκη θα σήμαινε
 * ανάγνωση 200 γραμμών markup για να απαντηθεί το «πού μπαίνει». Ίδια απόφαση, ίδιος λόγος
 * με το {@link tableBorderMenuItems}: **η γνώση χωριστά από την υποδοχή**.
 *
 * ## 🔴 Τι ΔΕΝ ξέρει αυτό το αρχείο — και δεν επιτρέπεται να μάθει
 *  1. **Ποιες εντολές είναι πατήσιμες.** Το ξέρει ο καλών, τη στιγμή του ανοίγματος
 *     ({@link TableRangeMenuEnabled} πάνω στον στόχο). Το μητρώο δηλώνει **μόνο** τη διάταξη·
 *     μια σταθερά «disabled» εδώ θα ήταν ψέμα την ημέρα που η πράξη θα γραφτεί.
 *  2. **Εικονίδια.** Ζουν στο `.tsx`, γιατί είναι `lucide-react` — δηλαδή React. Αυτό εδώ
 *     οφείλει να είναι εισαγώγιμο από καθαρό test χωρίς DOM, χωρίς JSX runtime, χωρίς μία
 *     γραμμή React (ίδιος λόγος με το `table-border-menu-items.ts`).
 *
 * ## Όψη τώρα, λειτουργία σταδιακά — **με ίχνος**
 * Ο ιδιοκτήτης αποφάσισε ρητά ολόκληρη την όψη **σήμερα** και τις πράξεις σταδιακά. Ό,τι δεν
 * έχει πράξη εμφανίζεται **γκρίζο**, ακριβώς όπως το «Γρήγορη ανάλυση» είναι γκρίζο και μέσα
 * στο ίδιο το Excel: ο χρήστης βλέπει πού θα βρει την εντολή όταν υπάρξει, και **δεν** πατά
 * κάτι που δεν κάνει τίποτα (Α17 του ADR-750: «όλα ή τίποτα, με ίχνος»).
 *
 * @module subapps/dxf-viewer/ui/components/table-range-menu/table-range-menu-commands
 * @see ui/components/table-range-menu/TableRangeMenuItems.tsx — η υποδοχή (εικονίδια + JSX)
 * @see ui/components/table-format-toolbar/table-border-menu-items.ts — το ίδιο σχήμα, Φ3/Φ4
 */

/** Οι **δεκαπέντε** εντολές του μενού. Η ταυτότητα είναι και το κλειδί i18n (δες παρακάτω). */
export type TableRangeMenuCommandId =
  | 'cut' | 'copy' | 'pasteAll' | 'pasteSpecial' | 'smartLookup'
  | 'insert' | 'delete' | 'clearContents' | 'quickAnalysis'
  | 'newComment' | 'newNote' | 'formatCells' | 'pickFromList' | 'defineName' | 'link';

/**
 * «Επιλογές επικόλλησης:» — **ετικέτα, όχι εντολή**.
 *
 * Το Excel δείχνει εκεί μια επικεφαλίδα και από κάτω μια σειρά εικονιδίων επικόλλησης. Είναι
 * ξεχωριστό είδος και όχι «disabled command» επειδή δεν θα αποκτήσει ποτέ πράξη: το να
 * μπορούσε να πάρει χειριστή θα ήταν εκφράσιμη μια κατάσταση που δεν υπάρχει.
 */
export type TableRangeMenuHeadingId = 'pasteOptions';

export type TableRangeMenuSubmenuId = 'filter' | 'sort';

export type TableRangeMenuFilterChildId = 'byCellValue' | 'byColor' | 'byFontColor' | 'byIcon';

export type TableRangeMenuSortChildId =
  | 'ascending' | 'descending' | 'byColor' | 'byFontColor' | 'custom';

export type TableRangeMenuChildId = TableRangeMenuFilterChildId | TableRangeMenuSortChildId;

/**
 * **Ποιες εντολές έχουν νόημα τώρα** — η απάντηση του καλούντος, ανά άνοιγμα.
 *
 * `Partial` επίτηδες: η απουσία σημαίνει «δεν το ρώτησε κανείς», που είναι **διαφορετικό** από
 * το `false` («ρωτήθηκε και δεν γίνεται»). Ο κανόνας ενεργοποίησης ({@link TableRangeMenuItems})
 * απαιτεί χειριστή *και* μη-`false`, οπότε η απουσία δεν μπορεί ποτέ να ανοίξει εντολή που δεν
 * υπάρχει — αλλά διατηρεί τη διάκριση για όποιον διαβάζει το αντικείμενο.
 */
export type TableRangeMenuEnabled = Readonly<Partial<Record<TableRangeMenuCommandId, boolean>>>;

export interface TableRangeMenuCommandEntry {
  readonly kind: 'command';
  readonly id: TableRangeMenuCommandId;
  readonly labelKey: string;
}

export interface TableRangeMenuHeadingEntry {
  readonly kind: 'heading';
  readonly id: TableRangeMenuHeadingId;
  readonly labelKey: string;
}

export interface TableRangeMenuSubmenuChild {
  readonly id: TableRangeMenuChildId;
  readonly labelKey: string;
}

export interface TableRangeMenuSubmenuEntry {
  readonly kind: 'submenu';
  readonly id: TableRangeMenuSubmenuId;
  readonly labelKey: string;
  readonly children: readonly TableRangeMenuSubmenuChild[];
}

export type TableRangeMenuEntry =
  | TableRangeMenuCommandEntry
  | TableRangeMenuHeadingEntry
  | TableRangeMenuSubmenuEntry;

/**
 * Μια ομάδα = ό,τι ζει **ανάμεσα σε δύο διαχωριστές**.
 *
 * Τύπος μη-κενής πλειάδας και όχι σκέτος πίνακας: το διαχωριστικό μπαίνει *πριν* από κάθε
 * ομάδα πλην της πρώτης, άρα μια κενή ομάδα θα ζωγράφιζε **δύο γραμμές κολλητά** — σφάλμα
 * που φαίνεται μόνο με το μάτι. Έτσι είναι αδύνατο να γραφτεί.
 */
export type TableRangeMenuGroup = readonly [TableRangeMenuEntry, ...TableRangeMenuEntry[]];

const ITEM_PREFIX = 'table.rangeMenu.items';
const FILTER_PREFIX = 'table.rangeMenu.filterSub';
const SORT_PREFIX = 'table.rangeMenu.sortSub';

/**
 * Το κλειδί είναι **παράγωγο της ταυτότητας**, ποτέ δεύτερος χειρόγραφος πίνακας 15 γραμμών.
 * Ο δεύτερος πίνακας είναι ακριβώς το σχήμα που απέκλινε στο 3.34 (δύο λίστες namespace που
 * κανείς δεν συνέκρινε): εδώ δεν υπάρχει τίποτα να αποκλίνει.
 */
function command(id: TableRangeMenuCommandId): TableRangeMenuCommandEntry {
  return { kind: 'command', id, labelKey: `${ITEM_PREFIX}.${id}` };
}

function submenu(
  id: TableRangeMenuSubmenuId,
  prefix: string,
  childIds: readonly TableRangeMenuChildId[],
): TableRangeMenuSubmenuEntry {
  return {
    kind: 'submenu',
    id,
    labelKey: `${ITEM_PREFIX}.${id}`,
    children: childIds.map((childId) => ({ id: childId, labelKey: `${prefix}.${childId}` })),
  };
}

/**
 * 🔴 **Η ΔΙΑΤΑΞΗ** — επτά ομάδες, με τη σειρά που τις δείχνει το Excel.
 *
 * ⚠️ Η σειρά **δεν** είναι αισθητική: είναι η σειρά που ο χρήστης έχει στα δάχτυλά του μετά από
 * χρόνια Excel. Η μετακίνηση ενός item «γιατί ταιριάζει καλύτερα» ακυρώνει ακριβώς αυτό που
 * παρήγγειλε ο ιδιοκτήτης. Αν αλλάξει, αλλάζει επειδή άλλαξε **το Excel**, με νέα μέτρηση.
 */
export const TABLE_RANGE_MENU_GROUPS: readonly TableRangeMenuGroup[] = [
  [
    command('cut'),
    command('copy'),
    { kind: 'heading', id: 'pasteOptions', labelKey: `${ITEM_PREFIX}.pasteOptions` },
    command('pasteAll'),
    command('pasteSpecial'),
  ],
  [command('smartLookup')],
  [command('insert'), command('delete'), command('clearContents')],
  [command('quickAnalysis')],
  [
    submenu('filter', FILTER_PREFIX, ['byCellValue', 'byColor', 'byFontColor', 'byIcon']),
    submenu('sort', SORT_PREFIX, ['ascending', 'descending', 'byColor', 'byFontColor', 'custom']),
  ],
  [command('newComment'), command('newNote')],
  [
    command('formatCells'),
    command('pickFromList'),
    command('defineName'),
    command('link'),
  ],
];
