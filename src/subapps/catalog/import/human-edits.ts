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
import { importTargetKey } from './proposal-values';

/** Η διεύθυνση ενός πεδίου μέσα στην πρόταση: γραμμή × στόχος. */
export const fieldAddress = (rowKey: string, targetKey: string): string => `${rowKey}\u0000${targetKey}`;

/** Τα κοινά κελιά του μοντέλου έχουν δική τους «γραμμή». */
export const sharedRowKey = (groupKey: string): string => `model:${groupKey}`;

/** Ποιος και πότε: η σφραγίδα κάθε εγγραφής του καταλόγου. */
export interface EditStamp {
  readonly by: string;
  readonly at: string;
}

function sourceTexts(group: ExtractedGroup): ReadonlyMap<string, string | null> {
  const texts = new Map<string, string | null>();
  const add = (rowKey: string, cells: readonly ExtractedCell[]): void => {
    for (const cell of cells) texts.set(fieldAddress(rowKey, importTargetKey(cell.target)), cell.text);
  };
  for (const row of group.rows) add(row.rowKey, row.cells);
  add(sharedRowKey(group.groupKey), group.sharedCells);
  return texts;
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
    const sourceText = texts.get(key) ?? null;
    if (input.revert === true || input.text === (sourceText ?? '')) edits.delete(key);
    else edits.set(key, { rowKey: input.rowKey, targetKey: input.targetKey, text: input.text, sourceText, ...stamp });
  }
  return [...edits.values()];
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
  const modelCode = requested.trim();
  if (modelCode === '' || modelCode === source.modelCode) return null;
  return { modelCode, sourceModelCode: source.modelCode, ...stamp };
}

function editedCell(cell: ExtractedCell, edit: ImportValueEdit): ExtractedCell {
  if (edit.sourceText !== cell.text) {
    const params = { edited: edit.text, was: edit.sourceText ?? '', now: cell.text ?? '' };
    return { ...cell, flags: [...cell.flags, { code: 'editSourceChanged', path: edit.targetKey, params }] };
  }
  // Η αμφισβητούμενη μονάδα δεν ντύνει ό,τι έγραψε ο άνθρωπος: γυμνός αριθμός εκεί ξαναζητά μονάδα.
  const unitDoubted = cell.flags.some((flag) => flag.code === 'unitUnconfirmed');
  return { ...cell, text: edit.text.trim() === '' ? null : edit.text, confidence: 1, flags: [], unitCode: unitDoubted ? null : cell.unitCode };
}

function editedCells(rowKey: string, cells: readonly ExtractedCell[], edits: ReadonlyMap<string, ImportValueEdit>): ExtractedCell[] {
  return cells.map((cell) => {
    const edit = edits.get(fieldAddress(rowKey, importTargetKey(cell.target)));
    return edit === undefined ? cell : editedCell(cell, edit);
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

/** Τα πεδία του καταλόγου για το έγγραφο της πρότασης: απόντα όταν είναι άδεια (η Firestore δεν δέχεται `undefined`). */
export function humanEditFields(edits: readonly ImportValueEdit[], modelCodeEdit: ImportModelCodeEdit | null): {
  readonly edits?: readonly ImportValueEdit[];
  readonly modelCodeEdit?: ImportModelCodeEdit;
} {
  return { ...(edits.length > 0 ? { edits } : {}), ...(modelCodeEdit !== null ? { modelCodeEdit } : {}) };
}
