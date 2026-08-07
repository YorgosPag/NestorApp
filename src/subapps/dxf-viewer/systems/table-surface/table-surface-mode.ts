/**
 * 🔴 ADR-771 Φ.2 — **ΠΑΝΩ ΣΕ ΤΙ ΠΑΡΟΥΣΙΑΖΕΤΑΙ Ο ΠΙΝΑΚΑΣ**: τρεις καταστάσεις, ένας ιδιοκτήτης.
 *
 * ## Η αρχή (ADR-771 §2)
 * Η επιφάνεια είναι **κατάσταση θέασης· το έγγραφο δεν την ξέρει**. Γι' αυτό ζει εδώ, σε
 * μονάδα-store, και **ποτέ** σε πεδίο του `PersistedTableModel`: καμία επίδραση σε DXF,
 * Firestore ή εξαγωγή. Αν αυτή η τιμή καταλήξει ποτέ σε έγγραφο, η φάση έγινε λάθος.
 *
 * ## 🔑 Τι κάνουν οι μεγάλοι — μετρημένο, και οι δύο έχουν από ένα λάθος
 * | | πλήθος καταστάσεων | πού ζει |
 * |---|---|---|
 * | **Excel 2024** | **δύο** (`View > Switch Modes`) ⇒ **αναγκάζεται να προειδοποιεί** *«your information will print with the light mode page color»* | ✅ **θέαση** — *«your Dark Mode settings do not impact your collaborators»* |
 * | **AutoCAD** | **τρεις**: Model space · `Paper background` (Options → Display → Colors → Context **Sheet/Layout**) · `Display Plot Styles` (*«see on screen how the drawing will appear when plotted»*) | 🔴 **στο Page Setup**, δηλαδή **μέσα στο DWG** — ταξιδεύει στους συνεργάτες |
 *
 * Το Excel έχει σωστό **μοντέλο** με λάθος **πλήθος**· το AutoCAD σωστό **πλήθος** με λάθος
 * **μοντέλο**. Εδώ παίρνουμε και τα δύο: **τρεις** καταστάσεις, **έξω** από το έγγραφο.
 *
 * ## 🔴 Η μέτρηση που όρισε τον σχεδιασμό — το χρώμα ΔΕΝ μπορεί να είναι ο φορέας
 * Κάθε ουδέτερο ανοιχτό γκρι απέχει **1,09–1,23:1** από το λευκό χαρτί (μετρημένο με το
 * `lib/contrast/wcag-contrast`, βαθμονομημένο στο 21,00 λευκό/μαύρο). Δηλαδή «Φύλλο» και
 * «Χαρτί» είναι **οπτικά αδιάκριτα** — το ίδιο ελάττωμα με τη **Φ.1** (WCAG 1.4.1: *ξέρω
 * ποιο είναι ποιο χωρίς χρώμα;*), σε κλίμακα ολόκληρης επιφάνειας αντί για σήμα 6 px.
 * Και τα «σημάδια ζωντάνιας» **δεν το σώζουν**: πίνακας χωρίς δεσμούς δεν έχει κανένα, άρα
 * οι δύο καταστάσεις γίνονται ταυτόσημες ακριβώς για τους απλούς πίνακες.
 *
 * Γι' αυτό ο φορέας της διάκρισης είναι **μόνιμα ορατός δείκτης κατάστασης** στη γραμμή
 * κατάστασης — η ίδια λύση με το `MODEL`/`PAPER` του AutoCAD, και ο λόγος που αυτό το store
 * **οφείλει** να είναι subscribable: ένας δείκτης που δεν ξαναζωγραφίζεται λέει ψέματα.
 *
 * @module subapps/dxf-viewer/systems/table-surface/table-surface-mode
 * @see bim/table/table-ink.ts — `liveTableSurface()`, ο ΕΝΑΣ κόμβος που καταναλώνει αυτή την τιμή
 * @see docs/centralized-systems/reference/adrs/ADR-771-table-surface-doctrine.md §4
 */

import { createExternalStore } from '../../stores/createExternalStore';
import { storageGet, storageSet, STORAGE_KEYS } from '../../utils/storage-utils';

/**
 * Οι τρεις επιφάνειες παρουσίασης.
 *
 * - `canvas` — **προεπιλογή, ιστορική συμπεριφορά**: ο πίνακας ανήκει στο σχέδιο και παίρνει
 *   το φόντο του καμβά. Κανένα φύλλο δεν ζωγραφίζεται· ό,τι είναι από κάτω φαίνεται.
 * - `sheet` — ανοιχτό αδιαφανές φύλλο για ανάγνωση, **με** τα βοηθήματα οθόνης.
 * - `paper` — προεπισκόπηση εκτύπωσης: λευκή σελίδα, **χωρίς** βοηθήματα.
 */
export type TableSurfaceMode = 'canvas' | 'sheet' | 'paper';

/** Η προεπιλογή είναι ρητά η ιστορική συμπεριφορά — το ADR-771 δεν αλλάζει καμία εμφάνιση. */
export const DEFAULT_TABLE_SURFACE_MODE: TableSurfaceMode = 'canvas';

const VALID_MODES: ReadonlySet<string> = new Set<TableSurfaceMode>(['canvas', 'sheet', 'paper']);

/**
 * Καθαρίζει ό,τι διαβάστηκε από τον δίσκο.
 *
 * ⚠️ Το `localStorage` είναι **αναξιόπιστη είσοδος**: μια παλιότερη έκδοση, άλλη καρτέλα ή
 * χειροκίνητη επεξεργασία μπορεί να έχει αφήσει άγνωστη συμβολοσειρά. Ένα `as TableSurfaceMode`
 * εδώ θα ήταν ψέμα τύπου που καταλήγει σε `switch` **χωρίς κλάδο** — δηλαδή πίνακας που
 * σταματά να ζωγραφίζεται. Άγνωστο ⇒ προεπιλογή.
 */
function sanitize(value: string | null | undefined): TableSurfaceMode {
  return value !== null && value !== undefined && VALID_MODES.has(value)
    ? (value as TableSurfaceMode)
    : DEFAULT_TABLE_SURFACE_MODE;
}

const store = createExternalStore<TableSurfaceMode>(
  sanitize(storageGet<string>(STORAGE_KEYS.TABLE_SURFACE_MODE, DEFAULT_TABLE_SURFACE_MODE)),
  { equals: Object.is },
);

/**
 * **Ανάγνωση τη στιγμή του γεγονότος** (ADR-040): ο ζωγράφος του καμβά δεν είναι React και
 * δεν επιτρέπεται να κρατά στιγμιότυπο — ένα μπαγιάτικο στιγμιότυπο εδώ σημαίνει πίνακας
 * ζωγραφισμένος πάνω σε επιφάνεια που δεν ισχύει πια.
 */
export function getTableSurfaceMode(): TableSurfaceMode {
  return store.get();
}

/**
 * Ο **μοναδικός** συγγραφέας. Γράφει στον δίσκο **μετά** τη μνήμη: αν το `localStorage` είναι
 * γεμάτο ή απενεργοποιημένο, η οθόνη έχει ήδη ενημερωθεί και ο χρήστης χάνει μόνο τη μνήμη
 * της επόμενης συνεδρίας — όχι την ίδια την εντολή που μόλις έδωσε.
 */
export function setTableSurfaceMode(mode: TableSurfaceMode): void {
  store.set(sanitize(mode));
  storageSet(STORAGE_KEYS.TABLE_SURFACE_MODE, store.get());
}

/** Συνδρομή για τον δείκτη κατάστασης (`useSyncExternalStore`). */
export const subscribeTableSurfaceMode = store.subscribe;

/** Απομόνωση jest — καθαρίζει ΚΑΙ τους συνδρομητές, όπως κάθε άλλο store του viewer. */
export function resetTableSurfaceModeForTest(
  mode: TableSurfaceMode = DEFAULT_TABLE_SURFACE_MODE,
): void {
  store.reset(mode);
}
