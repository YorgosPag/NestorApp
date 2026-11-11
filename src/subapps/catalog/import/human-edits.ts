/**
 * @fileoverview **Ο κατάλογος των ανθρώπινων διορθώσεων** μιας πρότασης (ADR-923 §5.5.2 Β6).
 *
 * Η ανάγνωση της πηγής (`ExtractedGroup`) είναι **παράγωγη**: ξαναχτίζεται σε κάθε αναίρεση/απόφαση γραμμής, αναβάθμιση σελίδας και
 * επανασχεδιασμό. Η διόρθωση του ανθρώπου ζει **έξω** από αυτήν (πρότυπο Figma overrides / Revit type overrides) και εφαρμόζεται από
 * **ΕΝΑ** σημείο, `applyHumanEdits`, σε κάθε δρόμο που φτιάχνει πρόταση. Πριν, η διόρθωση συγχωνευόταν μέσα στην ανάγνωση και το
 * ξαναχτίσιμο την έσβηνε (μαζί με τον κωδικό μοντέλου).
 *
 * Κάθε διόρθωση θυμάται τι έλεγε η πηγή όταν πάρθηκε (`sourceText`). Αν η πηγή ξαναδιαβαστεί και πει **άλλο**, η διόρθωση **δεν**
 * εφαρμόζεται σιωπηλά: το κελί κρατά τη νέα τιμή της πηγής με εύρημα `editSourceChanged`, και ο άνθρωπος διαλέγει.
 * @module subapps/catalog/import/human-edits
 */

import type { ExtractedCell, ExtractedGroup, ImportModelCodeEdit, ImportValueEdit } from '../types/catalog-import';
import type { ImportFieldEditInput } from '../types/catalog-import-requests';
import { importCellText, importTargetKey } from './proposal-values';

/** Η διεύθυνση ενός πεδίου μέσα στην πρόταση: γραμμή × στόχος. */
export const fieldAddress = (rowKey: string, targetKey: string): string => `${rowKey}\u0000${targetKey}`;

/** Οι διορθώσεις ανά διεύθυνση πεδίου (§5.5.2 Β6) — η ίδια διεύθυνση με τον γραφέα. Τη ρωτούν η λίστα και η στοίβα αναίρεσης (Β9β). */
export const editsByAddress = (edits: readonly ImportValueEdit[] | undefined): ReadonlyMap<string, ImportValueEdit> =>
  new Map((edits ?? []).map((edit) => [fieldAddress(edit.rowKey, edit.targetKey), edit]));

/** Τα κοινά κελιά του μοντέλου έχουν δική τους «γραμμή». */
export const sharedRowKey = (groupKey: string): string => `model:${groupKey}`;

/** Ποιος και πότε: η σφραγίδα κάθε εγγραφής του καταλόγου. */
export interface EditStamp {
  readonly by: string;
  readonly at: string;
}

/** Όλα τα κείμενα της πηγής ανά διεύθυνση, με τη σειρά της. Δύο κελιά στην ίδια διεύθυνση (δύο «ΚΩΔΙΚΟΣ») ⇒ δύο κείμενα. */
function sourceTexts(group: ExtractedGroup): ReadonlyMap<string, readonly (string | null)[]> {
  const texts = new Map<string, readonly (string | null)[]>();
  const add = (rowKey: string, cells: readonly ExtractedCell[]): void => {
    for (const [address, same] of cellsByAddress(rowKey, cells)) texts.set(address, same.map((cell) => cell.text));
  };
  for (const row of group.rows) add(row.rowKey, row.cells);
  add(sharedRowKey(group.groupKey), group.sharedCells);
  return texts;
}

/** Τι έλεγε η πηγή, για τον άνθρωπο: ένα κείμενο, ή όλα ενωμένα όπως στο μήνυμα `attributeRepeated`. */
function sourceOf(texts: readonly (string | null)[]): Pick<ImportValueEdit, 'sourceText' | 'sourceTexts'> {
  if (texts.length === 1) return { sourceText: texts[0] };
  const printed = texts.filter((text): text is string => text !== null);
  return { sourceText: printed.length > 0 ? printed.join(' · ') : null, sourceTexts: texts };
}

const editKey = (edit: Pick<ImportValueEdit, 'rowKey' | 'targetKey'>): string => fieldAddress(edit.rowKey, edit.targetKey);

/**
 * Νέες διορθώσεις πάνω στον κατάλογο. Ίδια διεύθυνση ⇒ αντικατάσταση (ιδεμπότητο)· `revert` ή κείμενο ίσο με της πηγής ⇒ η
 * διόρθωση **φεύγει** και ισχύει ξανά η πηγή. Διεύθυνση που η πηγή δεν έχει αγνοείται: δεν υπάρχει κελί να διορθωθεί.
 */
export function recordEdits(
  previous: readonly ImportValueEdit[],
  inputs: readonly ImportFieldEditInput[],
  source: ExtractedGroup,
  stamp: EditStamp,
): ImportValueEdit[] {
  const texts = sourceTexts(source);
  const edits = new Map(previous.map((edit) => [editKey(edit), edit]));
  for (const input of inputs) {
    const key = editKey(input);
    if (!texts.has(key)) continue;
    const source = sourceOf(texts.get(key) ?? [null]);
    const unchanged = source.sourceTexts === undefined && input.text === (source.sourceText ?? '');
    if (input.revert === true || unchanged) edits.delete(key);
    else edits.set(key, { rowKey: input.rowKey, targetKey: input.targetKey, text: input.text, ...source, ...stamp });
  }
  return [...edits.values()];
}

/**
 * **Ο ΕΝΑΣ κανόνας** για το τι γίνεται ο κωδικός μοντέλου που ζήτησε ο άνθρωπος: η διόρθωση που θα φυλαχτεί, ή `null` = καμία
 * (κενό κείμενο, ή ίδιο με την πηγή). Τον ρωτούν ο γραφέας και η στοίβα αναίρεσης (§5.5.2 Β9δ), ώστε να μην υπάρχουν δύο.
 */
export function normalizedModelCodeEdit(requested: string, sourceModelCode: string | null): string | null {
  const modelCode = requested.trim();
  return modelCode === '' || modelCode === sourceModelCode ? null : modelCode;
}

/**
 * Ο κωδικός μοντέλου του ανθρώπου. `null` στο αίτημα = καμία αλλαγή (το συμβόλαιο του `UpdateImportProposalRequest`)·
 * κενό κείμενο = αφαίρεση της διόρθωσης.
 */
export function recordModelCodeEdit(
  previous: ImportModelCodeEdit | null,
  requested: string | null,
  source: ExtractedGroup,
  stamp: EditStamp,
): ImportModelCodeEdit | null {
  if (requested === null) return previous;
  const modelCode = normalizedModelCodeEdit(requested, source.modelCode);
  return modelCode === null ? null : { modelCode, sourceModelCode: source.modelCode, ...stamp };
}

/** Λέει η πηγή σήμερα ό,τι έλεγε όταν πάρθηκε η διόρθωση; Κρίνεται με **όλα** τα κελιά της διεύθυνσης. */
function sourceUnchanged(edit: ImportValueEdit, cells: readonly ExtractedCell[]): boolean {
  const now = cells.map((cell) => cell.text);
  if (edit.sourceTexts === undefined) return now.length === 1 && now[0] === edit.sourceText;
  return now.length === edit.sourceTexts.length && now.every((text, index) => text === edit.sourceTexts?.[index]);
}

function sourceChanged(cell: ExtractedCell, edit: ImportValueEdit, cells: readonly ExtractedCell[]): ExtractedCell {
  const now = sourceOf(cells.map((each) => each.text)).sourceText;
  const params = { edited: edit.text, was: edit.sourceText ?? '', now: now ?? '' };
  return { ...cell, flags: [...cell.flags, { code: 'editSourceChanged', path: edit.targetKey, params }] };
}

/** Το κελί που κρατά τη διόρθωση: αυτό που τύπωσε ήδη την τιμή του ανθρώπου («Κράτα …»), ώστε η άγκυρα να δείχνει το σωστό σημείο. */
const keptCell = (cells: readonly ExtractedCell[], text: string): ExtractedCell =>
  cells.find((cell) => printsText(cell, text.trim())) ?? cells[0];

/** Η τιμή όπως την τύπωσε το κελί — και με τη μονάδα της στήλης, όπως τη δείχνει η εναλλακτική (`importCellText`). */
const printsText = ({ text, unitCode }: ExtractedCell, wanted: string): boolean =>
  text !== null && (text.trim() === wanted || importCellText({ text, unitCode }).trim() === wanted);

function editedCell(cell: ExtractedCell, edit: ImportValueEdit): ExtractedCell {
  // Η αμφισβητούμενη μονάδα δεν ντύνει ό,τι έγραψε ο άνθρωπος: γυμνός αριθμός εκεί ξαναζητά μονάδα.
  const unitDoubted = cell.flags.some((flag) => flag.code === 'unitUnconfirmed');
  return { ...cell, text: edit.text.trim() === '' ? null : edit.text, confidence: 1, flags: [], unitCode: unitDoubted ? null : cell.unitCode };
}

function cellsByAddress(rowKey: string, cells: readonly ExtractedCell[]): Map<string, ExtractedCell[]> {
  const byAddress = new Map<string, ExtractedCell[]>();
  for (const cell of cells) {
    const address = fieldAddress(rowKey, importTargetKey(cell.target));
    byAddress.set(address, [...(byAddress.get(address) ?? []), cell]);
  }
  return byAddress;
}

/**
 * Η διόρθωση ισχύει για τη διεύθυνση **ολόκληρη**: τα κελιά της γίνονται **ένα**, με την τιμή του ανθρώπου (Figma override). Έτσι η
 * επανάληψη δεν ξανακρίνεται από τη σειρά της πηγής. Πηγή που άλλαξε ⇒ όλα τα κελιά μένουν, με εύρημα, και διαλέγει ο άνθρωπος.
 */
function editedCells(rowKey: string, cells: readonly ExtractedCell[], edits: ReadonlyMap<string, ImportValueEdit>): ExtractedCell[] {
  const byAddress = cellsByAddress(rowKey, cells);
  return cells.flatMap((cell) => {
    const address = fieldAddress(rowKey, importTargetKey(cell.target));
    const edit = edits.get(address);
    const same = byAddress.get(address) ?? [cell];
    if (edit === undefined) return [cell];
    if (!sourceUnchanged(edit, same)) return [sourceChanged(cell, edit, same)];
    const kept = keptCell(same, edit.text);
    return kept === cell ? [editedCell(cell, edit)] : [];
  });
}

/** **Η ΜΙΑ εφαρμογή** των διορθώσεων πάνω σε καθαρή ανάγνωση. Καθαρή συνάρτηση: ίδια είσοδος ⇒ ίδια ομάδα. */
export function applyHumanEdits(group: ExtractedGroup, edits: readonly ImportValueEdit[], modelCodeEdit: ImportModelCodeEdit | null): ExtractedGroup {
  if (edits.length === 0 && modelCodeEdit === null) return group;
  const byAddress = new Map(edits.map((edit) => [editKey(edit), edit]));
  return {
    ...group,
    modelCode: modelCodeEdit?.modelCode ?? group.modelCode,
    rows: group.rows.map((row) => ({ ...row, cells: editedCells(row.rowKey, row.cells, byAddress) })),
    sharedCells: editedCells(sharedRowKey(group.groupKey), group.sharedCells, byAddress),
  };
}

/**
 * Τα πεδία του καταλόγου για το έγγραφο της πρότασης: απόντα όταν είναι άδεια (η Firestore δεν δέχεται `undefined`). Το «απόν»
 * **σβήνει** την αποθηκευμένη διόρθωση επειδή το `stageReplace` αντικαθιστά τον ορισμό ολόκληρο (μέχρι 2026-11-09 το παλιό κλειδί
 * επιβίωνε και η «Επαναφορά» δεν έφτανε στην αποθήκευση).
 */
export function humanEditFields(edits: readonly ImportValueEdit[], modelCodeEdit: ImportModelCodeEdit | null): {
  readonly edits?: readonly ImportValueEdit[];
  readonly modelCodeEdit?: ImportModelCodeEdit;
} {
  return { ...(edits.length > 0 ? { edits } : {}), ...(modelCodeEdit !== null ? { modelCodeEdit } : {}) };
}
