'use client';

/**
 * 🔴 ADR-739 §61 — **Η ΚΑΤΑΣΤΑΣΗ του διαλόγου «Μορφοποίηση κελιών», όχι η ιδιοκτησία του.**
 *
 * ## Τι ήταν, και γιατί άλλαξε
 * Το §60 έλυσε εδώ **μόνο** την αποκλειστικότητα: ένα `owner: string | null`, και **κάθε
 * εκκινητής ζωγράφιζε τον δικό του** `<TableFormatCellsDialog>`. Δούλευε, επειδή και οι τρεις
 * εκκινητές ήταν **κουμπιά** — δηλαδή components, δηλαδή σημεία που μπορούν να αποδώσουν JSX.
 *
 * Η ίδια η κεφαλίδα του §60 ονόμαζε τη σωστή τελική μορφή και τον λόγο που δεν γράφτηκε τότε:
 * *«ο πειρασμός είναι ένα store που κρατά `{ tab, target }` και **ένας** ξενιστής… είναι η
 * σωστή τελική μορφή (και ο δρόμος για το `Ctrl+1`, που **δεν έχει** component), αλλά απαιτεί
 * να αποφασιστεί **πού** ζει ο ξενιστής»*. Το §61 απαντά: ζει στο `DxfViewerDialogs`, τον
 * τεκμηριωμένο «growth sink» κάθε μόνιμα μονταρισμένου host του θεατή.
 *
 * ```
 *   §60:  owner: string|null            + 3 components που ζωγραφίζουν  ⇒ αδύνατο για πλήκτρο
 *   §61:  { target, tab } | null        + 1 ξενιστής                    ⇒ κάθε υποδοχή λέει `open(…)`
 * ```
 *
 * ## 🔑 ΓΙΑΤΙ Ο ΣΤΟΧΟΣ ΜΠΑΙΝΕΙ ΜΕΣΑ ΣΤΟ STORE — και δεν αρκεί η καρτέλα
 * Ο {@link FormatTarget} **δεν** είναι παράγωγος της θύρας: ο κανόνας Α22 του δεξιού κλικ δίνει
 * στόχο που μπορεί να είναι **έξω** από την επιλογή (δεξί κλικ στο `E5` με μαρκαρισμένο το
 * `B2:D4`). Ένας ξενιστής που ρωτούσε μόνος του `port.formatTarget()` θα άνοιγε τον διάλογο
 * πάνω στο `B2:D4` ενώ ο χρήστης πάτησε στο `E5` — αλλαγή μακριά από τον δείκτη, ακριβώς το
 * ελάττωμα που το §27.17 τεκμηριώνει με τα λόγια του ιδιοκτήτη («η οθόνη έλεγε τρεις, η πράξη
 * έκανε μία»). Άρα ο στόχος **ταξιδεύει με το αίτημα**, διαβασμένος τη στιγμή του πατήματος
 * (ADR-040 κανόνας #2).
 *
 * ## 🔑 Η ΤΕΛΕΥΤΑΙΑ ΚΑΡΤΕΛΑ ΕΙΝΑΙ ΣΥΜΠΕΡΙΦΟΡΑ ΤΟΥ EXCEL — μετρημένη, όχι υποτεθειμένη
 * *«When regular cells are selected, it displays the Format Cells dialog box with the "last tab
 * used" selected»* (Exceljet, «Format (almost) anything», ελέγχθηκε 2026-08-08). Άρα οι υποδοχές
 * **χωρίς** δική τους καρτέλα (`Ctrl+1`, δεξί κλικ ▸ «Μορφοποίηση κελιών…») **δεν** μαντεύουν:
 * ζητούν την τελευταία. Οι υποδοχές **με** καρτέλα (τα δύο βελάκια της κορδέλας) τη δηλώνουν,
 * όπως ακριβώς και στο Excel το βελάκι της ομάδας «Στοίχιση» ανοίγει τη «Στοίχιση».
 *
 * ⚠️ Απορρίφθηκε ρητά η «εξυπνότερη» εκδοχή («άνοιξε την καρτέλα που **ταιριάζει** στο κελί»):
 * μια συντόμευση που προσγειώνει αλλού κάθε φορά σπάει τη **μνήμη χεριού**, που είναι ακριβώς ο
 * λόγος ύπαρξης μιας συντόμευσης. Όταν οι δύο αρχές διαφωνούν, κερδίζει η μνήμη χεριού.
 *
 * 🔑 Και γι' αυτό η καρτέλα ζει **εδώ** και όχι σε `useState` του διαλόγου: η «τελευταία» δεν
 * μπορεί να θυμηθεί τι διάλεξε ο χρήστης **μέσα** στον διάλογο, αν το ξέρει μόνο ο διάλογος που
 * μόλις ξεμόνταρε.
 *
 * @module subapps/dxf-viewer/state/table-format-cells-dialog-store
 * @see ui/components/table-format-toolbar/format-cells-dialog/TableFormatCellsDialogHost.tsx — ο ΕΝΑΣ ξενιστής
 * @see state/table-format-painter-store.ts — το ίδιο μοτίβο store (ADR-768 Φ4)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../stores/createExternalStore';
import {
  TABLE_FORMAT_CELLS_DEFAULT_TAB,
  type TableFormatCellsTabId,
} from '../ui/components/table-format-toolbar/format-cells-dialog/table-format-cells-labels';
import type { FormatTarget } from '../ui/table-cell-editor/table-format-snapshot';

/**
 * Ο ανοιχτός διάλογος, ολόκληρος: **πού** γράφει και **τι** δείχνει.
 *
 * Ένα αντικείμενο και όχι δύο stores: μια κατάσταση «στόχος χωρίς καρτέλα» ή «καρτέλα χωρίς
 * στόχο» δεν σημαίνει τίποτα, και δύο ξεχωριστά stores θα την έκαναν **εκφράσιμη** — με τον
 * ξενιστή να αποδίδει για ένα καρέ διάλογο πάνω σε `null`.
 */
export interface TableFormatCellsRequest {
  /**
   * 🔴 Ο **σειριακός αριθμός του ανοίγματος** — η ταυτότητα της *ερώτησης*, όχι της κατάστασης.
   *
   * Υπάρχει για **έναν** καταναλωτή: το `key` του ξενιστή. Με έναν ξενιστή που επιβιώνει, το
   * προσχέδιο (`useState(target.model)`) θα ζούσε από άνοιγμα σε άνοιγμα — δηλαδή το «ΟΚ» θα
   * έγραφε μοντέλο που ο χρήστης δεν βλέπει. Μέχρι το §60 την εγγύηση «φρέσκο προσχέδιο ανά
   * άνοιγμα» την έδινε δωρεάν το ξεμοντάρισμα του κάθε εκκινητή· εδώ τη δίνει αυτός ο αριθμός.
   *
   * ⚠️ Αριθμός και όχι σύγκριση στόχου: δύο ανοίγματα πάνω στα **ίδια** κελιά είναι δύο
   * **διαφορετικές** ερωτήσεις (ο χρήστης έκλεισε και ξαναρώτησε), και μια σύγκριση by-reference
   * θα τα έλεγε ίδια — κρατώντας ένα προσχέδιο που ο χρήστης νομίζει ότι ακύρωσε.
   */
  readonly id: number;
  readonly target: FormatTarget;
  readonly tab: TableFormatCellsTabId;
}

const requestStore = createExternalStore<TableFormatCellsRequest | null>(null);

/** Μονότονα αύξων· δες {@link TableFormatCellsRequest.id}. Ποτέ ρολόι, ποτέ τυχαίος. */
let nextRequestId = 1;

/**
 * Η **τελευταία καρτέλα που είδε ο χρήστης** — επιβιώνει του κλεισίματος (Excel, δες κεφαλίδα).
 *
 * Εκτός του `requestStore` επίτηδες: δεν είναι κατάσταση που αποδίδεται, είναι **μνήμη**. Μέσα
 * στο store θα ανάγκαζε κάθε συνδρομητή να ξανα-αποδώσει όταν αλλάζει μια τιμή που κανείς δεν
 * ζωγραφίζει όσο ο διάλογος είναι κλειστός.
 */
let lastTab: TableFormatCellsTabId = TABLE_FORMAT_CELLS_DEFAULT_TAB;

export interface OpenTableFormatCellsOptions {
  /**
   * Πού γράφει ο διάλογος. **`null` ⇒ δεν ανοίγει** — ποτέ διάλογος πάνω σε πίνακα που δεν
   * υπάρχει πια (ένα `Ctrl+Z` ανάμεσα στο άνοιγμα του μενού και το πάτημα του item).
   */
  readonly target: FormatTarget | null;
  /** Ποια καρτέλα. **Απούσα ⇒ η τελευταία που είδε ο χρήστης** (Excel). */
  readonly tab?: TableFormatCellsTabId;
}

/**
 * Άνοιξε τον διάλογο — **η μία πράξη και των πέντε υποδοχών**.
 *
 * ⚠️ Ένα δεύτερο άνοιγμα ενόσω ο διάλογος ζει **αντικαθιστά** το αίτημα, δηλαδή γεννά φρέσκο
 * προσχέδιο. Είναι η ίδια συμπεριφορά που τεκμηρίωσε το §60 («το τελευταίο κλικ αποφασίζει τι
 * δείχνει», σαν modeless παλέτα AutoCAD/Revit) και **δεν** είναι σιωπηλή απώλεια: ο χρήστης
 * μόλις έδειξε ρητά άλλον στόχο ή άλλη καρτέλα.
 *
 * 🔴 Η **μία** υποδοχή όπου αυτό δεν ισχύει είναι το πληκτρολόγιο, και ο φύλακας ζει εκεί —
 * δες `table-format-cells-shortcut.ts`: ένα πλήκτρο, σε αντίθεση με ένα κουμπί, πατιέται δεύτερη
 * φορά από **μνήμη χεριού** («δεν έγινε τίποτα;»), και τότε το φρέσκο προσχέδιο θα ήταν σκέτη
 * απώλεια εργασίας.
 */
export function openTableFormatCellsDialog(options: OpenTableFormatCellsOptions): void {
  const { target, tab } = options;
  if (target === null) return;
  lastTab = tab ?? lastTab;
  requestStore.set({ id: nextRequestId++, target, tab: lastTab });
}

/**
 * Ο χρήστης άλλαξε καρτέλα **μέσα** στον διάλογο.
 *
 * Γράφει **και** το αίτημα **και** τη μνήμη, σε μία πράξη: αν τα δύο γράφονταν χωριστά, η μέρα
 * που κάποιος ξεχνούσε το δεύτερο θα έδινε διάλογο που δείχνει «Στοίχιση» και `Ctrl+1` που
 * ανοίγει «Αριθμό» — δύο αλήθειες για το «ποια καρτέλα είδε τελευταία ο χρήστης».
 *
 * No-op με κλειστό διάλογο: καρτέλα χωρίς στόχο δεν σημαίνει τίποτα (δες
 * {@link TableFormatCellsRequest}).
 */
export function setTableFormatCellsTab(tab: TableFormatCellsTabId): void {
  const current = requestStore.get();
  if (current === null) return;
  lastTab = tab;
  requestStore.set({ ...current, tab });
}

/** Άκυρο / `Escape` / `✕` / ΟΚ — και τα τέσσερα κλείνουν τον **έναν** διάλογο. */
export function closeTableFormatCellsDialog(): void {
  requestStore.set(null);
}

/** Τι είναι ανοιχτό **τη στιγμή της κλήσης**· `null` = κλειστός. */
export function getTableFormatCellsRequest(): TableFormatCellsRequest | null {
  return requestStore.get();
}

/** Συνδρομή για `useSyncExternalStore`· επιστρέφει την αποδέσμευση. */
export function subscribeTableFormatCellsDialog(listener: () => void): () => void {
  return requestStore.subscribe(listener);
}

/**
 * Το αίτημα ως αντιδραστική τιμή — για τον ξενιστή και για τα **βελάκια** της κορδέλας, που
 * φωτίζουν όσο δείχνουν τη δική τους καρτέλα.
 *
 * Ο server snapshot είναι `null` (κλειστός): ο διάλογος είναι καθαρά πράξη χρήστη, οπότε καμία
 * απόδοση στον διακομιστή δεν μπορεί να έχει άλλη απάντηση.
 */
export function useTableFormatCellsRequest(): TableFormatCellsRequest | null {
  return useSyncExternalStore(
    subscribeTableFormatCellsDialog,
    getTableFormatCellsRequest,
    () => null,
  );
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα υπόλοιπα stores του subapp. */
export function __resetTableFormatCellsDialogForTests(): void {
  requestStore.reset(null);
  lastTab = TABLE_FORMAT_CELLS_DEFAULT_TAB;
  nextRequestId = 1;
}
