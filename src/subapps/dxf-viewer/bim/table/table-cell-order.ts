/**
 * ADR-739 Φ.Δ — **η σειρά γραμμή × στήλη**, σε ένα σημείο.
 *
 * Η ντετερμινιστική σειρά των κελιών δεν είναι λεπτομέρεια σειριοποίησης: είναι η εγγύηση
 * ότι δύο ταυτόσημοι πίνακες παράγουν **ταυτόσημο JSON**. Χωρίς αυτήν, η σειρά με την
 * οποία έτυχε να πληκτρολογηθούν τα κελιά θα γεννούσε άχρηστα diffs, ασταθή snapshots
 * και — το χειρότερο — ψευδείς «αλλαγές» που πυροδοτούν auto-save.
 *
 * ## Γιατί ξεχωριστό αρχείο
 * Την **ίδια** ερώτηση («ποια θέση έχει αυτό το κελί;») την έκαναν ήδη **δύο** ανεξάρτητα
 * σημεία του `table-model-helpers`: το `toPersistedTableModel`, που ταξινομεί ολόκληρο τον
 * χάρτη πριν τον γράψει, και ο εγγραφέας κειμένου, που πρέπει να βρει πού **παρεμβάλλεται**
 * ένα νέο κελί. Δύο ανεξάρτητες υλοποιήσεις της ίδιας διάταξης είναι ακριβώς το σχήμα που ο
 * ADR-739 §15 ονομάζει «τέταρτη μηχανή πίνακα»: την ώρα που θα άλλαζε η μία, η άλλη θα
 * έμενε πίσω και ο πίνακας θα γραφόταν με **δύο** διαφορετικές σειρές ανάλογα με το αν το
 * κελί προϋπήρχε ή όχι.
 *
 * ## Ορφανές αναφορές ⇒ `undefined`, ποτέ σφάλμα
 * Κελί που δείχνει σε σβησμένη γραμμή/στήλη **δεν έχει** θέση — και αυτό είναι φυσιολογικό
 * ενδιάμεσο στάδιο μιας επεξεργασίας, όχι λόγος να χαθεί ολόκληρος ο πίνακας. Ίδια σύμβαση
 * ανοχής με το `buildMergeIndex`.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-order
 * @see bim/table/table-model-helpers.ts — ο μοναδικός καταναλωτής (σειριοποίηση + εγγραφέας)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md
 */

import type { TableCellEntry, TableColumnId, TableRowId } from '../../types/table';

/**
 * **Ποιος από τους δύο άξονες** — γραμμές ή στήλες.
 *
 * Ζει εδώ επειδή αυτό το αρχείο είναι ήδη ο ιδιοκτήτης της «σειράς γραμμή × στήλη»: ο άξονας
 * δεν είναι τίποτε άλλο από «ποια από τις δύο διατάξεις εννοούμε». Τον ρωτούν η δομική πράξη
 * (`table-row-column-ops.ts`) και ο μετασχηματισμός τύπων της διαγραφής
 * (`formula/table-formula-structural-heal.ts`) — δύο αρχεία που **οφείλουν** να εννοούν το ίδιο
 * πράγμα, αφού το ένα καλεί το άλλο με αυτή ακριβώς την τιμή.
 *
 * ⚠️ Δεν είναι ακόμη το ΜΟΝΟ όνομα των δύο αξόνων στον πίνακα: συνυπάρχουν `TableEdgeAxis`
 * (ADR-750) και `TableStyleAxis`, συν ενσωματωμένα `'row' | 'column'` σε ~8 σημεία. Η
 * ενοποίησή τους είναι καταγεγραμμένη ως εκκρεμότητα ratchet — **μην** προσθέσεις ένατο.
 */
export type TableAxis = 'row' | 'column';

/**
 * Ό,τι χρειάζεται η κατάταξη — και **μόνο** αυτό. Δέχεται τόσο `TableModel` όσο και
 * `PersistedTableModel` επειδή τα δύο σχήματα διαφέρουν μόνο στα `cells`, που εδώ δεν
 * διαβάζονται καθόλου.
 *
 * Εξαγόμενο (ADR-750 Φ1): την **ίδια** στενή όψη χρειάζεται και η μετάφραση θέσης πλέγματος
 * σε ταυτότητα ακμής (`table-edge-model.ts`). Δεύτερη δήλωση των δύο αξόνων θα ήταν το
 * ακριβές σχήμα που πιάνει το CHECK 3.28 — και, χειρότερα, δεύτερη απάντηση στο «τι είναι
 * το ελάχιστο σχήμα πίνακα».
 */
export interface CellOrderSource {
  readonly rows: readonly { readonly id: string }[];
  readonly columns: readonly { readonly id: string }[];
}

/**
 * Κατάταξη κελιού σε **έναν** αριθμό: `γραμμή × πλήθος στηλών + στήλη`. Η σύγκριση δύο
 * τέτοιων αριθμών **είναι** η σειρά γραμμή × στήλη, χωρίς δεύτερο κριτήριο που θα μπορούσε
 * να ξεχαστεί σε κάποιον από τους καλούντες.
 *
 * Επιστρέφει `undefined` για ορφανή αναφορά (άγνωστη γραμμή ή στήλη).
 */
export type CellRanker = (rowId: TableRowId, colId: TableColumnId) => number | undefined;

/**
 * Χτίζει τον κατατάκτη **μία φορά** ανά πέρασμα. Οι δύο χάρτες `id → δείκτης` κοστίζουν
 * O(γραμμές + στήλες)· χωρίς αυτούς κάθε ερώτηση θα ήταν γραμμική σάρωση, δηλαδή
 * O(κελιά × γραμμές) σε κάθε αποθήκευση.
 */
export function createCellRanker(source: CellOrderSource): CellRanker {
  const rowOrder = indexById(source.rows);
  const colOrder = indexById(source.columns);
  const columnCount = source.columns.length;

  return (rowId, colId) => {
    const r = rowOrder.get(rowId);
    const c = colOrder.get(colId);
    return r === undefined || c === undefined ? undefined : r * columnCount + c;
  };
}

/**
 * Θέση → ταυτότητα, για O(1) αναζήτηση δείκτη από id.
 *
 * Εξαγόμενο (ADR-739 Φ.Δ βήμα 2): το χρειάζεται και η πλοήγηση δρομέα
 * (`table-cell-navigation.ts`), που μεταφράζει διαρκώς `rowId`/`colId` σε δείκτες για να
 * βηματίσει. Το CHECK 3.28 (jscpd) χαρακτήρισε **σωστά** ως clone το τοπικό αντίγραφο που
 * γεννήθηκε εκεί — η απάντηση σε αυτό είναι εξαγωγή, όχι δεύτερο δίδυμο.
 */
export function indexById(items: readonly { readonly id: string }[]): ReadonlyMap<string, number> {
  const cached = indexByIdCache.get(items);
  if (cached) return cached;
  const map = new Map<string, number>();
  for (let i = 0; i < items.length; i++) map.set(items[i].id, i);
  indexByIdCache.set(items, map);
  return map;
}

/**
 * 🔴 ADR-739 §36 / ADR-735 — **ΤΟ ΕΥΡΕΤΗΡΙΟ ΧΤΙΖΕΤΑΙ ΜΙΑ ΦΟΡΑ ΑΝΑ ΠΙΝΑΚΑ, ΟΧΙ ΑΝΑ ΕΡΩΤΗΣΗ.**
 *
 * ## Δεν είναι προληπτική βελτιστοποίηση — το κόστος ήταν ήδη πληρωμένο, ανά καρέ
 * Το `TableRenderer.selectionOf` καλεί `resolveTableSelectionBounds` σε **κάθε καρέ** όσο
 * υπάρχει επιλογή, και εκείνο καλεί `indexById` **δύο** φορές (γραμμές + στήλες), συν άλλη
 * μία ζευγαρωτή μέσα στο `snapToWholeMerges` και άλλη μέσα στο `tableRangeMembership`. Σε
 * πίνακα 500 γραμμών αυτό ήταν ~2.000 εισαγωγές σε `Map` ανά καρέ, για ευρετήριο που **δεν
 * αλλάζει** όσο δεν αλλάζει το μοντέλο. Ακριβώς το σχήμα «δουλειά ανάλογη του **χρόνου**,
 * όχι της **αλλαγής**» που ο ADR-735 πλήρωσε σε παραγωγή.
 *
 * Ο §36 το έκανε **ορατό** αντί για νέο: ο δείκτης του περιγράμματος ρωτά την ίδια αλυσίδα σε
 * κάθε `mousemove` (60-120/δευτ.), δηλαδή θα διπλασίαζε μια δαπάνη που ήδη υπήρχε.
 *
 * ## 🔴 Η ΠΡΟΫΠΟΘΕΣΗ, ΡΗΤΑ: ΟΙ ΠΙΝΑΚΕΣ ΕΙΝΑΙ ΑΜΕΤΑΒΛΗΤΟΙ
 * Το κλειδί είναι η **ταυτότητα του πίνακα**, άρα η ορθότητα στηρίζεται σε αναλλοίωτο που το
 * μοντέλο ήδη δηλώνει στους τύπους του (`readonly TableRow[]`, `readonly TableColumn[]`) και
 * τηρεί στην πράξη: κάθε γραφέας (`setPersistedCellText`, `insertTableRow`, `deleteTableColumn`)
 * παράγει **νέο** πίνακα. Ένα `push`/`splice` επί τόπου θα έδινε μπαγιάτικο ευρετήριο —
 * γι' αυτό γράφεται εδώ αντί να υπονοείται.
 *
 * `WeakMap` και όχι `Map`: το κλειδί είναι το ίδιο το αντικείμενο, οπότε η μνήμη ελευθερώνεται
 * μαζί με το μοντέλο. Ίδιο μοτίβο με τα `resolveTableModel` / `resolveTableLayout`, που ήδη
 * απομνημονεύουν με τον ίδιο τρόπο για τον ίδιο λόγο.
 */
const indexByIdCache = new WeakMap<readonly { readonly id: string }[], ReadonlyMap<string, number>>();

/**
 * Θέση εισαγωγής ενός **νέου** κελιού ώστε η ακολουθία `cells` να μείνει στη σειρά γραμμή ×
 * στήλη. Ένα `splice` στο τέλος (ή στη σειρά εισαγωγής) θα έσπαζε ακριβώς τη ντετερμινιστική
 * σειρά που εγγυάται η σειριοποίηση — δύο ταυτόσημοι πίνακες θα κατέληγαν με διαφορετικό
 * JSON ανάλογα με τη **σειρά** με την οποία πληκτρολογήθηκαν τα κελιά τους.
 *
 * Κελιά με άγνωστη γραμμή/στήλη αγνοούνται στη σύγκριση: δεν έχουν καθορισμένη θέση, άρα δεν
 * μπορούν να «σπρώξουν» το νέο κελί πουθενά. Το ίδιο ισχύει αν το ίδιο το νέο κελί δείχνει σε
 * γραμμή/στήλη που δεν υπάρχει — τότε δεν υπάρχει έγκυρη θέση και η συνάρτηση προσθέτει στο
 * τέλος αντί να ρίξει σφάλμα.
 */
export function insertionIndexFor(
  source: CellOrderSource,
  entries: readonly TableCellEntry[],
  targetRowId: TableRowId,
  targetColId: TableColumnId,
): number {
  const rank = createCellRanker(source);
  const targetRank = rank(targetRowId, targetColId);
  if (targetRank === undefined) return entries.length;

  for (let i = 0; i < entries.length; i++) {
    const [rowId, colId] = entries[i];
    const entryRank = rank(rowId, colId);
    if (entryRank !== undefined && entryRank > targetRank) return i;
  }
  return entries.length;
}

/**
 * Η θέση ενός κελιού ως **ζεύγος ταυτοτήτων** — ό,τι χρειάζεται μια μετάφραση σε δείκτες,
 * τίποτα άλλο.
 *
 * Δομικά συμβατό με τον δρομέα (`TableCursorPosition`, που κουβαλά επιπλέον την άγκυρα
 * στήλης), με την επιλογή (`TableCellRef`) και με την αναφορά τύπου (`TableFormulaCellRef`).
 * Ζει στο **χαμηλότερο** module ακριβώς γι' αυτό: όποιος μεταφράζει ταυτότητα σε θέση δεν
 * έχει λόγο να ξέρει τι είναι δρομέας, τι είναι επιλογή ή τι είναι τύπος.
 */
export interface TableCellAddress {
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
}

/** Οι τέσσερις δείκτες δύο γωνιών, **ακατέργαστοι**: καμία κανονικοποίηση, κανένα κούμπωμα. */
export interface CellPairIndices {
  readonly fromRow: number;
  readonly toRow: number;
  readonly fromCol: number;
  readonly toCol: number;
}

/**
 * 🔴 Η **μία** μετάφραση «δύο κελιά → τέσσερις δείκτες».
 *
 * ## Γιατί εξάγεται (ADR-754 Γ1, CHECK 3.28)
 * Οι ίδιες έξι γραμμές (`indexById` × 2, τέσσερα `get`, δύο φρουροί `undefined`) είχαν ήδη
 * γεννηθεί **τρεις** φορές: στα όρια περιοχής (`table-cell-range.ts`), στην ονομασία εύρους
 * (`table-cell-reference.ts`) και στη μετατόπιση τύπου (`table-formula-offset.ts`). Το
 * σχήμα είναι το ίδιο που ο σχολιασμός του `rawTableCellRangeBounds` **είχε ήδη
 * προβλέψει** — «εξαγωγή, όχι δίδυμο» — και παρ' όλα αυτά ξαναγεννήθηκε δύο φορές, γιατί
 * κάθε καλών έγραφε δικά του ονόματα (`r0/c1`, `fromRow/toCol`) και το `ssot:discover`
 * είναι τυφλό στα ονόματα. Ένα token-based δίδυμο χρειάζεται token-based απάντηση.
 *
 * ## Επιστρέφει ακατέργαστους δείκτες επίτηδες
 * Ο ένας καλών θέλει `Math.min/max` (ορθογώνιο), ο άλλος **προσημασμένη διαφορά**
 * (μετατόπιση: «μία γραμμή πάνω» είναι `-1`, όχι `1`). Αν εδώ γινόταν κανονικοποίηση, η
 * μετατόπιση θα έχανε τη φορά της — δηλαδή η συμπλήρωση προς τα πάνω θα αντέγραφε τύπους
 * σαν να πήγαινε προς τα κάτω. Η κανονικοποίηση είναι **σημασιολογία του καλούντος**.
 *
 * `null` όταν **οποιοδήποτε** άκρο δεν υπάρχει στο μοντέλο — ίδια σύμβαση ανοχής με το
 * {@link indexById}: μπαγιάτικη ταυτότητα μετά από undo/διαγραφή δεν είναι σφάλμα, είναι
 * απάντηση «δεν ξέρω», και ο καλών οφείλει να μη μαντέψει.
 */
export function cellPairIndices(
  source: CellOrderSource,
  from: TableCellAddress,
  to: TableCellAddress,
): CellPairIndices | null {
  const rowIndex = indexById(source.rows);
  const colIndex = indexById(source.columns);
  const fromRow = rowIndex.get(from.rowId);
  const toRow = rowIndex.get(to.rowId);
  const fromCol = colIndex.get(from.colId);
  const toCol = colIndex.get(to.colId);
  if (fromRow === undefined || toRow === undefined) return null;
  if (fromCol === undefined || toCol === undefined) return null;
  return { fromRow, toRow, fromCol, toCol };
}
