/**
 * 🔴 ADR-751 Φ8 — **το ευρετήριο συνδέσμων του πίνακα**: ποιοι σύνδεσμοι υπάρχουν και πού.
 *
 * Ο αδελφός του {@link resolveTableCellLinkAtWorld}, με **αντίστροφη ερώτηση**. Εκείνος ρωτά
 * *«τι υπάρχει σε αυτό το σημείο;»* — ερώτηση **ποντικιού**. Εδώ ρωτάμε *«τι υπάρχει σε αυτό
 * το κελί / σε όλο τον πίνακα;»* — ερώτηση **πληκτρολογίου**, που δεν έχει σημείο να δείξει.
 *
 * ## 🔑 Γιατί ΕΝΑΣ επιλυτής για τρεις καταναλωτές
 * Τρία χαρακτηριστικά της Φ8 ρωτούν το ίδιο πράγμα και θα το ρωτούσαν αλλιώς το καθένα:
 *
 * | Καταναλωτής | Τι ζητά |
 * |---|---|
 * | `Alt+Enter` (Google Sheets) | οι σύνδεσμοι **ενός** κελιού — του δρομέα |
 * | «Άνοιγμα εντοπισμένου συνδέσμου…» (VS Code) | **όλοι** οι σύνδεσμοι, σε σειρά ανάγνωσης |
 * | Mirror DOM (Figma) | **όλοι**, ως εστιάσιμοι κόμβοι με ετικέτα |
 *
 * Τρεις ανεξάρτητες διελεύσεις του `layout.cells` θα ήταν τρεις ευκαιρίες να διαφωνήσουν για
 * το **ποιο κελί έχει σύνδεσμο** — ακριβώς η κατηγορία απόκλισης που το CHECK 3.28 έπιασε ήδη
 * μία φορά σε αυτό το ADR (§8, το `wholeRunLink` γραμμένο δύο φορές). Η διέλευση ζει εδώ,
 * **μία**, και το «ενός κελιού» είναι φίλτρο πάνω της.
 *
 * ## Γιατί διαβάζει τη ΔΙΑΤΑΞΗ και όχι το μοντέλο
 * Θα ήταν φθηνότερο να τρέξει ο ανιχνευτής πάνω στο `TableCell.value` κάθε κελιού. Θα ήταν
 * όμως **δεύτερη απάντηση**: η διάταξη έχει ήδη εφαρμόσει τον φραγμό ψευδών τηλεφώνων (§4,
 * `numeric`) και τον κανόνα «όλο ή τίποτα» της περικοπής (§5). Ένα ευρετήριο χτισμένο από το
 * μοντέλο θα διαφήμιζε συνδέσμους που **δεν είναι μπλε στην οθόνη** — δηλαδή το πληκτρολόγιο
 * θα έβλεπε άλλον πίνακα από το ποντίκι.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-link-index
 * @see bim/table/table-cell-link-hit.ts — η ίδια ερώτηση από τη μεριά του δείκτη
 * @see bim/table/table-cell-reference.ts — από πού βγαίνει το `B3` και η κεφαλίδα στήλης
 */

import type { SceneUnits } from '../../utils/scene-units';
import type { TableColumnId, TableRowId } from '../../types/table';
import type { TableEntity } from '../../types/table-entity';
import type { TableTextLinkSpan } from './table-layout-types';
import { computeTableEntityGeometryLive } from './table-entity-geometry';
import { tableCellReference } from './table-cell-reference';
import { resolveTableModel } from './table-model-helpers';

/**
 * Ένας σύνδεσμος μαζί με **πού κάθεται**, σε γλώσσα που καταλαβαίνει ο χρήστης.
 *
 * Κουβαλά και `a1` και `columnHeader` γιατί οι δύο απαντούν σε **διαφορετικές** ερωτήσεις και
 * καμία δεν αρκεί μόνη της: το `B3` λέει *πού* (και είναι η μόνη σταθερή ονομασία σε πίνακα
 * χωρίς κεφαλίδες), η κεφαλίδα λέει *τι* (`E-mail`, `Τηλέφωνο`) και είναι αυτό που ψάχνει
 * πραγματικά ο άνθρωπος. Η επιλογή ποιο θα δειχθεί ανήκει στην επιφάνεια, όχι εδώ.
 */
export interface TableCellLinkEntry {
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
  /** `'B3'` — ή `'B3:C4'` σε συγχώνευση, από τον SSoT ονομασίας. */
  readonly a1: string;
  /** Το κείμενο της κεφαλίδας της στήλης· κενό όταν ο πίνακας δεν έχει κεφαλίδα. */
  readonly columnHeader: string;
  readonly span: TableTextLinkSpan;
}

/**
 * Όλοι οι σύνδεσμοι του πίνακα, σε **σειρά ανάγνωσης** (γραμμή προς γραμμή, στήλη προς
 * στήλη), και μέσα στο κελί με τη σειρά που εμφανίζονται στο κείμενο.
 *
 * Η σειρά **είναι** χαρακτηριστικό, όχι παρενέργεια: η λίστα του `Ctrl+Shift+L` και η σειρά
 * του `Tab` στο Mirror DOM πρέπει να συμφωνούν με το τι βλέπει ο χρήστης από πάνω προς τα
 * κάτω. Το `layout.rows` / `layout.columns` είναι **ήδη** ταξινομημένα κατά `yMm` / `xMm`
 * (αύξοντα, τεκμηριωμένα στο `TableRowLayout`), οπότε η σειρά βγαίνει από τη γεωμετρία και
 * δεν χρειάζεται δεύτερη ταξινόμηση που κάποτε θα αποκλίνει.
 */
export function collectTableCellLinks(
  entity: TableEntity,
  sceneUnits: SceneUnits = 'mm',
): readonly TableCellLinkEntry[] {
  const { layout } = computeTableEntityGeometryLive(entity, sceneUnits);
  const model = resolveTableModel(entity.model);

  const rowOrder = orderIndex(layout.rows);
  const colOrder = orderIndex(layout.columns);

  const withLinks = layout.cells.filter((cell) => cell.text?.links?.length);
  withLinks.sort(
    (a, b) =>
      (rowOrder.get(a.rowId) ?? 0) - (rowOrder.get(b.rowId) ?? 0)
      || (colOrder.get(a.colId) ?? 0) - (colOrder.get(b.colId) ?? 0),
  );

  const entries: TableCellLinkEntry[] = [];
  for (const cell of withLinks) {
    // Η αναφορά μπορεί να λείπει σε μπαγιάτικη ταυτότητα (undo ανάμεσα σε διάταξη και
    // ερώτηση). Υποβαθμίζουμε σε κενή ονομασία αντί να πετάξουμε τον σύνδεσμο: ο χρήστης
    // **βλέπει** το μπλε κείμενο, οπότε μια λίστα που το παραλείπει θα ήταν το ελάττωμα.
    const reference = tableCellReference(model, cell.rowId, cell.colId);
    for (const span of cell.text?.links ?? []) {
      entries.push({
        rowId: cell.rowId,
        colId: cell.colId,
        a1: reference?.a1 ?? '',
        columnHeader: reference?.columnHeader ?? '',
        span,
      });
    }
  }
  return entries;
}

/**
 * Οι σύνδεσμοι **ενός** κελιού — ό,τι χρειάζεται το `Alt+Enter` του δρομέα.
 *
 * Φίλτρο πάνω στην **ίδια** διέλευση και όχι δεύτερη υλοποίηση: το κόστος είναι η διάταξη
 * (που υπολογίζεται έτσι κι αλλιώς και είναι memoized ανά μοντέλο), όχι το πέρασμα των
 * κελιών. Μια «βελτιστοποιημένη» εκδοχή που κοιτά μόνο το ένα κελί θα ήταν δεύτερη απάντηση
 * στο «τι μετράει ως σύνδεσμος» με κέρδος που κανείς δεν θα μετρούσε ποτέ.
 */
export function tableCellLinksAt(
  entity: TableEntity,
  rowId: TableRowId,
  colId: TableColumnId,
  sceneUnits: SceneUnits = 'mm',
): readonly TableCellLinkEntry[] {
  return collectTableCellLinks(entity, sceneUnits).filter(
    (entry) => entry.rowId === rowId && entry.colId === colId,
  );
}

/** Ταυτότητα → θέση, για ταξινόμηση σε σειρά ανάγνωσης. */
function orderIndex(items: readonly { readonly id: string }[]): ReadonlyMap<string, number> {
  return new Map(items.map((item, index) => [item.id, index]));
}
