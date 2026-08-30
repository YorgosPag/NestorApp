/**
 * ADR-833 Φάση 2 — **ΤΟ ΚΟΙΝΟ ΔΕΙΓΜΑ ΟΝΤΟΤΗΤΑΣ ΠΙΝΑΚΑ**, στις δύο μορφές που υπάρχουν.
 *
 * ## Γιατί ΕΝΑ αρχείο
 * Πριν από τη Φάση 2, ~40 αρχεία tests έγραφαν το καθένα τον δικό του
 * `{ id, type:'table', layerId, position, angleRad, styleId, model }`. Η αλλαγή σχήματος
 * `model` → `worksheets[]` θα ήταν **40 χειρόγραφες μεταφράσεις**, δηλαδή 40 ευκαιρίες να
 * αποκλίνουν — και η επόμενη αλλαγή σχήματος θα κόστιζε ξανά τα ίδια. Το ίδιο σχήμα
 * διπλότυπου που ο N.18 απαγορεύει, απλώς σε αρχεία δοκιμών.
 *
 * ## Οι τρεις πόρτες, και γιατί είναι τρεις
 * ```
 *   tableWorksheetFields(model)   →  η ΜΙΑ γραμμή που μεταφράζει ένα υπάρχον `model: X`
 *   makeTableEntity({…})          →  πλήρης οντότητα ΝΕΑΣ μορφής, με προεπιλογές
 *   makePreWorksheetsTableEntity  →  οντότητα ΠΑΛΙΑΣ μορφής — η **είσοδος** των αγκυρών μετανάστευσης
 * ```
 * Η τρίτη είναι η σημαντική: χωρίς αυτήν, καμία άγκυρα δεν θα μπορούσε να **αποδείξει** ότι ένα
 * σχέδιο γραμμένο πριν από τη Φάση 2 εξακολουθεί να διαβάζεται — και η συμβατότητα θα ήταν
 * ισχυρισμός. 🔴 Είναι επίτηδες **η μόνη** εκτός παραγωγής χρήση της παλιάς μορφής, και είναι
 * test fixture: η άγκυρα «ένας μη-test εισαγωγέας» (`table-worksheet-migration.test.ts`) την
 * εξαιρεί ρητά, γιατί ένας μηχανισμός συμβατότητας χωρίς δείγμα παλιών δεδομένων δεν ελέγχεται.
 *
 * @module subapps/dxf-viewer/bim/table/__tests__/make-table-entity
 * @see ../table-worksheet-resolve.ts — αυτό που τα δείγματα ταΐζουν
 * @see ../../../types/table-entity-legacy.ts — η παλιά μορφή, ορισμένη μία φορά
 */

import { BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import { setTableCellCursor } from '../../../state/table-cell-cursor-store';
import { buildTableModel } from '../build-table-entity';
import { FIRST_TABLE_WORKSHEET_ID, tableWorksheetId } from '../../../types/table-worksheet';
import type { PersistedTableModel, TableBinding } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import type { TableWorksheet, TableWorksheetId } from '../../../types/table-worksheet';
import type { TableCursorPosition } from '../table-cell-navigation';
import type { TableCellCursorMode } from '../../../state/table-cell-cursor-state';

/**
 * **Η μία γραμμή που μεταφράζει ένα παλιό `model: X`** σε φύλλα εργασίας.
 *
 * Χρήση σε υπάρχον δείγμα:
 * ```ts
 *   -  model: persistedModel({ columns, rows }),
 *   +  ...tableWorksheetFields(persistedModel({ columns, rows })),
 * ```
 * Ο δεσμός περνά μαζί, γιατί ζει **στο φύλλο** (ADR-833 §5.2) — ένα δείγμα που τα χώριζε θα
 * έγραφε σχήμα που η παραγωγή δεν παράγει ποτέ.
 */
export function tableWorksheetFields(
  model: PersistedTableModel,
  binding?: TableBinding,
): Pick<TableEntity, 'worksheets' | 'activeWorksheetId'> {
  const worksheet: TableWorksheet = binding === undefined
    ? { id: FIRST_TABLE_WORKSHEET_ID, model }
    : { id: FIRST_TABLE_WORKSHEET_ID, model, binding };
  return { worksheets: [worksheet], activeWorksheetId: FIRST_TABLE_WORKSHEET_ID };
}

/** Πολλαπλά φύλλα, με ντετερμινιστικές ταυτότητες `ws0`, `ws1`, … — το σχήμα των Φάσεων 3+. */
export function tableWorksheetsFields(
  models: readonly PersistedTableModel[],
  activeIndex = 0,
): Pick<TableEntity, 'worksheets' | 'activeWorksheetId'> {
  const worksheets = models.map((model, index) => ({
    id: tableWorksheetId(`ws${index}`),
    model,
  }));
  return { worksheets, activeWorksheetId: worksheets[activeIndex].id };
}

/**
 * 🔴 Οι παρακάμψεις που δέχεται ένα **τοπικό** `makeEntity(...)` δείγματος.
 *
 * Τα `model`/`binding` **δεν** είναι πεδία του `TableEntity` από τη Φάση 2 και μετά. Παραμένουν
 * όμως ο φυσικός τρόπος να πει ένα test *«ίδιος πίνακας, άλλα κελιά»* — οπότε δηλώνονται εδώ
 * **μία φορά** ως παρακάμψεις **δείγματος**, και το κάθε δείγμα τα μεταφράζει με το
 * {@link tableWorksheetFields}. Η εναλλακτική — να γράφει κάθε test literal φύλλα — θα έκανε τα
 * ~40 δείγματα να επαναλαμβάνουν τη μετάφραση, δηλαδή θα ξαναγεννούσε το διπλότυπο που αυτό το
 * αρχείο υπάρχει για να λύσει.
 */
export type TableEntityTestOverrides = Partial<TableEntity> & {
  readonly model?: PersistedTableModel;
  readonly binding?: TableBinding;
};

export interface MakeTableEntityOptions {
  readonly id?: string;
  readonly layerId?: string;
  readonly model?: PersistedTableModel;
  readonly binding?: TableBinding;
  readonly position?: { readonly x: number; readonly y: number };
  readonly angleRad?: number;
  readonly styleId?: string;
}

/** Πλήρης οντότητα **νέας** μορφής, με προεπιλογές που δεν κρύβουν τίποτα ουσιώδες. */
export function makeTableEntity(options: MakeTableEntityOptions = {}): TableEntity {
  const {
    id = 'tbl_1',
    layerId = 'lyr_test',
    model = buildTableModel({}),
    binding,
    position = { x: 0, y: 0 },
    angleRad = 0,
    styleId = BUILTIN_TABLE_STYLE_IDS.STANDARD,
  } = options;
  return {
    id,
    type: 'table',
    layerId,
    position,
    angleRad,
    styleId,
    ...tableWorksheetFields(model, binding),
  };
}

/**
 * 🔴 Οντότητα **ΠΑΛΙΑΣ** μορφής — ακριβώς όπως ήταν γραμμένη στον δίσκο πριν από τη Φάση 2.
 *
 * Ο τύπος επιστροφής είναι `TableEntity` **με στένωση**, όχι επειδή είναι: επειδή έτσι ακριβώς
 * φτάνει στην παραγωγή. Το `JSON.parse` μιας αποθηκευμένης σκηνής δίνει αντικείμενο που ο
 * compiler βλέπει ως `TableEntity` ενώ του **λείπουν** τα φύλλα — και το να το κρύψουμε από τα
 * tests θα σήμαινε ότι δοκιμάζουμε μια κατάσταση που δεν συμβαίνει.
 */
export function makePreWorksheetsTableEntity(
  model: PersistedTableModel,
  binding?: TableBinding,
  options: { readonly id?: string; readonly layerId?: string } = {},
): TableEntity {
  const legacy = {
    id: options.id ?? 'tbl_legacy',
    type: 'table' as const,
    layerId: options.layerId ?? 'lyr_test',
    position: { x: 0, y: 0 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    model,
    ...(binding !== undefined ? { binding } : {}),
  };
  return legacy as unknown as TableEntity;
}

/** Η ταυτότητα του πρώτου φύλλου — για assertions που τη χρειάζονται ονομαστικά. */
export const FIRST_WORKSHEET_ID: TableWorksheetId = FIRST_TABLE_WORKSHEET_ID;

/**
 * 🔴 Δρομέας σε δείγμα **ενός φύλλου**, από σκέτη ταυτότητα οντότητας.
 *
 * ## Γιατί υπάρχει — και γιατί ΔΕΝ είναι παράκαμψη του φύλακα
 * Το `setTableCellCursor` δέχεται **οντότητα** και όχι `entityId`, επίτηδες: η μισή ταυτότητα
 * («ποιος πίνακας» χωρίς «ποιο φύλλο») δεν επιτρέπεται να είναι κάτι που ένας καλών μπορεί να
 * ξεχάσει να δώσει. Δεκάδες δείγματα όμως στήνουν τον δρομέα **πριν** υπάρξει οντότητα στη
 * σκηνή, με σκέτο id — και η πρόθεσή τους είναι πάντα *«ο πίνακας του δείγματος, το μοναδικό
 * του φύλλο»*.
 *
 * Αυτό ακριβώς παραδίδει: μια εφήμερη οντότητα με **ένα** φύλλο. Η ταυτότητα του φύλλου είναι
 * {@link FIRST_TABLE_WORKSHEET_ID} — **ντετερμινιστική**, η ίδια που δίνει και ο πραγματικός
 * κατασκευαστής, άρα ο δρομέας ταιριάζει με τον πίνακα του δείγματος χωρίς καμία σύμπτωση.
 *
 * ⚠️ Δείγματα με **περισσότερα** φύλλα ΔΕΝ το χρησιμοποιούν: εκεί το «ποιο φύλλο» είναι το
 * ερώτημα, και πρέπει να περάσει η πραγματική οντότητα (δες
 * `state/__tests__/table-cell-cursor-scope.test.ts`).
 */
export function setTableCellCursorById(
  entityId: string,
  position: TableCursorPosition,
  mode: TableCellCursorMode,
  draft?: string,
  caretIndex?: number,
): void {
  setTableCellCursor(makeTableEntity({ id: entityId }), position, mode, draft, caretIndex);
}
