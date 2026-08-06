'use client';

/**
 * 🔴 ADR-739 §52 — **Η ΘΥΡΑ ΤΗΣ ΜΟΡΦΟΠΟΙΗΣΗΣ ΠΙΝΑΚΑ**: η μία επιφάνεια που μοιράζονται το
 * floating mini toolbar (δεξί κλικ) και οι **δύο** contextual καρτέλες της κορδέλας.
 *
 * ## Γιατί θύρα και όχι props
 * Η κορδέλα ζει στο `DxfViewerTopBar`· η συνεδρία πίνακα στο `CanvasSection`. Κοινός γονέας
 * είναι **μόνο** ο orchestrator, οπότε ένα prop θα ανέβαζε την κατάσταση εκεί — ακριβώς η
 * παλινδρόμηση που έκλεισαν τα ADR-040 / ADR-532 (κάθε αλλαγή δρομέα θα ξανα-απέδιδε
 * ολόκληρο το δέντρο του καμβά). Και τα ribbon widgets είναι κυριολεκτικά **χωρίς props**
 * (`() => React.ReactNode` στο `ribbon-widget-registry.tsx`), δηλαδή η θύρα είναι ο **μόνος**
 * δρόμος να ξαναχρησιμοποιηθούν αυτούσια τα `TableBorderMenu` / `TableMergeMenu` /
 * `TableAxisColorMenu` χωρίς δεύτερη υλοποίησή τους για την κορδέλα.
 *
 * Ίδιο μοτίβο και ίδια αιτιολόγηση με τις υπάρχουσες `table-header-menu-port` /
 * `table-range-menu-port` — με **μία** προσθήκη που εκείνες δεν χρειάζονταν: αυτή η θύρα
 * **διαβάζεται σε render**, όχι μόνο τη στιγμή ενός συμβάντος, άρα οφείλει να ειδοποιεί.
 *
 * ## 🔴 ΚΑΘΕ ΜΕΘΟΔΟΣ ΕΙΝΑΙ GETTER — ποτέ στιγμιότυπο (ADR-040 κανόνας #2)
 * Ο στόχος (`scope`), ο πίνακας (`table`) και κάθε κατάσταση απαντιούνται **τη στιγμή της
 * κλήσης**. Ένα παγωμένο `scope` θα σήμαινε ότι το «Β» της κορδέλας βάφει τα κελιά που ήταν
 * μαρκαρισμένα στο τελευταίο render — δηλαδή, μετά από ένα `Ctrl+Z` ή ένα `Shift+βέλος` που
 * δεν πρόλαβε να ξανα-αποδώσει, **άλλα** κελιά από αυτά που φωτίζουν στην οθόνη.
 *
 * ## 🔴 ΤΟ ΣΗΜΑ: αριθμός έκδοσης, ΟΧΙ αντιγραμμένη κατάσταση
 * Οι καταναλωτές συνδράμουν με `useSyncExternalStore(subscribeTableFormatPort,
 * getTableFormatRevision)` και μετά **ξαναρωτούν τη θύρα**. Ένα store που κρατούσε την ίδια
 * την κατάσταση θα ήταν δεύτερη αλήθεια δίπλα στο μοντέλο — και θα παλιώνε σε κάθε undo,
 * ακριβώς όπως τεκμηριώνει το `table-cell-cursor-store` για το κείμενο του κελιού.
 *
 * ⚠️ **Ο παλμός ΔΕΝ γίνεται ανά χαρακτήρα.** Ο δρομέας αλλάζει σε κάθε πλήκτρο (`draft`), ενώ
 * η μορφοποίηση εξαρτάται μόνο από `entityId|θέση|επιλογή|mode` και από την **ταυτότητα του
 * μοντέλου**. Το φίλτρο ζει στον εκδότη ({@link
 * ../table-cell-editor/use-table-format-actions}); εδώ μένει μόνο το κανάλι.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-format-port
 * @see bim/table/table-format-scope.ts — ο ΕΝΑΣ δρόμος «τι διάλεξε ο χρήστης → πού γράφεται»
 * @see ui/table-cell-editor/use-table-format-actions.ts — ο εκδότης
 */

import { createExternalStore } from '../../stores/createExternalStore';
import type { TableFormatScope } from '../../bim/table/table-format-scope';
import type {
  TableCellStyleKey,
  TableFormatState,
} from '../../bim/table/table-cell-style-scan';
import type { TableCellStyle } from '../../bim/table/table-style';
import type { TableCellRangeBounds } from '../../bim/table/table-cell-range';
import type { TextHeightStepDirection } from '../../bim/table/table-text-height-scale';
import type { TableAxisStyleOverride } from '../../types/table';
import type { TableEntity } from '../../types/table-entity';
import type { TableAxisColorState } from '../components/table-format-toolbar/table-color-menu-selection';
import type { TableToggleFormatKey } from '../components/table-format-toolbar/TableFormatSection';
import type { TableBindingPort } from './use-table-binding-actions';
import type { TableBorderActions } from './use-table-border-actions';
import type { TableMergeActions } from './use-table-merge-actions';

/**
 * Οι **δομικές** πράξεις της καρτέλας «Ιδιότητες Πίνακα».
 *
 * Ξεχωριστό υπο-αντικείμενο και όχι επτά ακόμη μέθοδοι στο ίδιο επίπεδο: απαντούν σε άλλη
 * ερώτηση («τι σχήμα έχει ο πίνακας») και έχουν άλλη προϋπόθεση — η μορφοποίηση χρειάζεται
 * **στόχο** (δρομέα), η αλλαγή στυλ χρειάζεται μόνο **επιλεγμένη οντότητα**. Ο διαχωρισμός
 * κάνει τη διαφορά ορατή στον τύπο αντί να ζει σε σχόλιο.
 */
export interface TableStructurePort {
  /** Το ενεργό ονοματισμένο στυλ του πίνακα· `null` χωρίς πίνακα. */
  readonly styleId: () => string | null;
  /** Αλλάζει στυλ — μία εντολή, ένα `Ctrl+Z`, καμία απώλεια παρακάμψεων. */
  readonly setStyleId: (styleId: string) => void;
  /**
   * Εισαγωγή γραμμής/στήλης **γύρω από τον στόχο του δρομέα** — η ίδια σημασιολογία με το
   * δεξί κλικ στη ζώνη δείκτη (§27.17: ολόκληρη η επιλογή, αν είναι του ίδιου είδους).
   */
  readonly insertAxis: (axis: 'row' | 'column', side: 'before' | 'after') => void;
  readonly deleteAxis: (axis: 'row' | 'column') => void;
  /** Επιτρέπεται η διαγραφή; (ο πίνακας δεν μένει ποτέ χωρίς γραμμή ή στήλη). */
  readonly canDeleteAxis: (axis: 'row' | 'column') => boolean;
  /** `Ctrl+A` του πίνακα — ο ΕΝΑΣ γραφέας του §43. */
  readonly selectAll: () => void;
}

/**
 * Ό,τι μπορεί να ζητήσει μια επιφάνεια μορφοποίησης πίνακα.
 *
 * Τα `borders` / `merge` περνούν **αυτούσια** τα υπάρχοντα συμβόλαια (ADR-750 / ADR-755): οι
 * πράξεις τους είναι ήδη παραμετρικές ως προς τα **όρια**, οπότε η κορδέλα δεν χρειάζεται
 * τίποτα δικό της — μόνο το {@link TableFormatPort.bounds} να τους δώσει τον στόχο.
 */
export interface TableFormatPort {
  /**
   * Ο πίνακας που αφορούν οι εντολές: ο πίνακας του **δρομέα**, αλλιώς ο **μοναδικός
   * επιλεγμένος**. `null` όταν δεν υπάρχει ούτε το ένα ούτε το άλλο.
   *
   * Η σειρά έχει σημασία και είναι η σειρά του Excel: μόλις μπεις σε κελί, οι εντολές
   * αφορούν **αυτόν** τον πίνακα, ακόμη κι αν η επιλογή οντοτήτων λέει κάτι άλλο.
   */
  readonly table: () => TableEntity | null;
  /** Πού γράφει η **μορφοποίηση**· `null` χωρίς δρομέα ή σε μπαγιάτικη επιλογή. */
  readonly scope: () => TableFormatScope | null;
  /** Ο ίδιος στόχος ως **ορθογώνιο** — ό,τι δέχονται περιγράμματα και συγχώνευση. */
  readonly bounds: () => TableCellRangeBounds | null;
  /** Τι δείχνει ένα χειριστήριο· `null` όταν δεν υπάρχει στόχος (⇒ σβηστό, ποτέ μαντεψιά). */
  readonly state: <K extends TableCellStyleKey>(
    key: K,
  ) => TableFormatState<TableCellStyle[K]> | null;
  /**
   * Οι **τέσσερις** ερωτήσεις ενός πεδίου χρώματος (§34/§35), για την ίδια παλέτα.
   *
   * ⚠️ Δεν παίρνει `PlotColorRole`: ο ρόλος **προκύπτει** από το πεδίο (`textColorHex` ⇒ μελάνι,
   * `fillColorHex` ⇒ γέμισμα) και τον ξέρει ήδη το στιγμιότυπο. Μια δεύτερη παράμετρος θα ήταν
   * ευκαιρία να ζητηθεί «χρώμα κειμένου με ρόλο γεμίσματος» — κατάσταση που δεν σημαίνει
   * τίποτα, και που θα έδινε λάθος «χρώματα του σχεδίου» χωρίς κανένα σφάλμα.
   */
  readonly colorState: (key: 'textColorHex' | 'fillColorHex') => TableAxisColorState;
  /**
   * Πάτημα δίτιμου χειριστηρίου. Ο κανόνας «**μεικτό ⇒ όλα ναι**» ζει **μέσα** (μέσω
   * `nextBooleanFormat`) και όχι στον καλούντα: με δύο επιφάνειες να τον εφαρμόζουν, η μία
   * θα μπορούσε κάποτε να μάθει «αντίστροφη» σημασιολογία και η οθόνη δεν θα το έδειχνε.
   */
  readonly toggle: (key: TableToggleFormatKey) => void;
  /** Ρητή τιμή / `null` ρητά κανένα / `undefined` αφαίρεση — οι τρεις καταστάσεις αυτούσιες. */
  readonly setField: <K extends keyof TableAxisStyleOverride>(
    key: K,
    value: TableAxisStyleOverride[K] | undefined,
  ) => void;
  readonly stepTextHeight: (direction: TextHeightStepDirection) => void;
  /** Το τρέχον ύψος κειμένου σε sheet-mm· `null` όταν τα κελιά δεν συμφωνούν ή δεν υπάρχει στόχος. */
  readonly textHeightMm: () => number | null;
  readonly reset: () => void;
  /** Υπάρχει **οτιδήποτε** να επαναφερθεί; (`some`, όχι `every` — δες `canResetTableFormatScope`.) */
  readonly canReset: () => boolean;
  readonly borders: TableBorderActions;
  readonly merge: TableMergeActions;
  readonly structure: TableStructurePort;
  /**
   * 🔴 ADR-767 Δ3 — ο **δεσμός** του πίνακα: «τρέφεται από πηγή;» και «ξαναρώτησέ την».
   *
   * Ξεχωριστό υπο-αντικείμενο για τον ίδιο λόγο που ξεχωρίζει το {@link TableStructurePort}:
   * απαντά σε **άλλη ερώτηση** («από πού ήρθαν τα νούμερα») και έχει **άλλη προϋπόθεση** — η
   * μορφοποίηση θέλει δρομέα, η δομή θέλει δρομέα, ο δεσμός θέλει μόνο **δεμένο πίνακα**.
   */
  readonly binding: TableBindingPort;
}

let port: TableFormatPort | null = null;

/**
 * Το κανάλι ειδοποίησης — **version signal** πάνω στο SSoT εργοστάσιο (ADR-294, module
 * `create-external-store`). Χειρόγραφο `Set<() => void>` εδώ θα ήταν η ~100ή αντιγραφή της
 * ίδιας μηχανικής· η κατάσταση που **διαβάζεται** δεν ζει ποτέ μέσα του (δες παραπάνω),
 * οπότε το store κρατά μόνο τον αριθμό έκδοσης.
 */
const revisionStore = createExternalStore<number>(0);

function emit(): void {
  revisionStore.set(revisionStore.get() + 1);
}

/**
 * Ο κάτοχος δηλώνεται όσο είναι μονταρισμένος· `null` τον αποσύρει.
 *
 * ## 🔴 ΕΙΔΟΠΟΙΕΙ ΜΟΝΟ ΟΤΑΝ ΑΛΛΑΖΕΙ Η **ΠΑΡΟΥΣΙΑ** — ΑΛΛΙΩΣ ΕΙΝΑΙ ΑΠΕΙΡΟΣ ΒΡΟΧΟΣ
 *
 * Η ταυτότητα του αντικειμένου-θύρας εξαρτάται από `levelManager` /
 * `getSelectedEntityIds`, δηλαδή από τιμές που **δεν εγγυάται** κανείς ότι είναι σταθερές ανά
 * render του `CanvasSection`. Ένα άνευ όρων `emit()` εδώ κλείνει τον κύκλο:
 *
 * ```
 *   νέα θύρα → emit → re-render του bridge → re-render DxfViewerContent → CanvasSection
 *            → νέα θύρα → emit → …
 * ```
 *
 * Και οι αναγνώστες **δεν το χρειάζονται**: κάθε μέθοδος είναι getter, οπότε μια θύρα με νέα
 * ταυτότητα αλλά ίδιο περιεχόμενο δίνει τις ίδιες απαντήσεις. Ό,τι όντως αλλάζει απάντηση
 * φτάνει από τα δύο ρητά σήματα του εκδότη ({@link notifyTableFormatPort}).
 *
 * Η **παρουσία** είναι η εξαίρεση: `null → θύρα` σημαίνει «η συνεδρία πίνακα ξεκίνησε» και
 * κανένα άλλο σήμα δεν το λέει· χωρίς αυτό το emit, η κορδέλα θα έμενε αδρανής μέχρι το
 * επόμενο πάτημα πλήκτρου.
 */
export function setTableFormatPort(next: TableFormatPort | null): void {
  const presenceChanged = (port === null) !== (next === null);
  port = next;
  if (presenceChanged) emit();
}

/** Ανάγνωση **τη στιγμή** που χρειάζεται — ποτέ στιγμιότυπο σε κλείσιμο. */
export function getTableFormatPort(): TableFormatPort | null {
  return port;
}

/**
 * «Κάτι που βλέπει η θύρα άλλαξε» — ο δρομέας μετακινήθηκε, η επιλογή άλλαξε, ή γράφτηκε νέο
 * μοντέλο. Το **φίλτρο** (τι μετράει ως αλλαγή) ανήκει στον εκδότη, όχι εδώ: αυτό το module
 * δεν ξέρει τι είναι «πρόχειρο κείμενο», και δεν πρέπει να μάθει.
 */
export function notifyTableFormatPort(): void {
  emit();
}

/** Συνδρομή για `useSyncExternalStore`· επιστρέφει την αποδέσμευση. */
export function subscribeTableFormatPort(listener: () => void): () => void {
  return revisionStore.subscribe(listener);
}

/**
 * Ο αριθμός έκδοσης — το **μόνο** στιγμιότυπο που επιτρέπεται να κρατήσει καταναλωτής.
 *
 * Πρωτόγονος επίτηδες: το `Object.is` του `useSyncExternalStore` κάνει τη σύγκριση χωρίς
 * cache υπογραφής, και ένα αντικείμενο-στιγμιότυπο θα ξανα-απέδιδε σε κάθε παλμό ακόμη κι
 * όταν τίποτα δεν άλλαξε.
 */
export function getTableFormatRevision(): number {
  return revisionStore.get();
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα stores του subapp. */
export function __resetTableFormatPortForTests(): void {
  port = null;
  revisionStore.reset(0);
}
