/**
 * ADR-739 Φ.Δ βήμα 6 — 🔴 **ΤΟ TEST ΤΟΥ ΒΗΜΑΤΟΣ: η επέκταση είναι ΜΟΝΟ διεπαφή.**
 *
 * ## Τι αποδεικνύει, και γιατί δεν αρκούν τα unit tests του κουτιού
 * Το `table-cell-editor-expansion.test.ts` αποδεικνύει ότι το **κουτί** βγαίνει σωστό. Δεν
 * αποδεικνύει ότι το κουτί δεν **παρασύρει** τίποτα μαζί του. Το επικίνδυνο σενάριο αυτού
 * του βήματος δεν είναι «μεγαλώνει λάθος» — είναι «μεγαλώνει **και μαζί του ο πίνακας**»:
 * μια γεωμετρία που άλλαξε επειδή ο χρήστης πάτησε ένα πλήκτρο, δηλαδή αναίρεση του βήματος
 * 5 και, χειρότερα, **σιωπηλή αλλαγή σε παραδοτέο σχέδιο**.
 *
 * Εδώ τρέχει η **πραγματική** διάταξη με τον **πραγματικό** μετρητή (καμία ένεση) πριν, κατά
 * τη διάρκεια και μετά την επέκταση, και συγκρίνεται **ολόκληρο** το αποτέλεσμα.
 *
 * ## Η αρχιτεκτονική που το κάνει ΔΟΜΗ και όχι σύμπτωση
 * Η διάταξη είναι καθαρή συνάρτηση `(μοντέλο, στυλ)`. Ο επεξεργαστής δεν είναι ούτε το ένα
 * ούτε το άλλο: παίρνει το κουτί του **από** τη διάταξη και δεν έχει κανέναν δρόμο επιστροφής.
 * Αυτό το αρχείο κλειδώνει την ιδιότητα — αν κάποιος αύριο περάσει το πλάτος του
 * επεξεργαστή πίσω στη διάταξη (π.χ. «να μεγαλώνει η στήλη όσο γράφεις»), γίνεται κόκκινο.
 *
 * @see bim/table/__tests__/table-cell-clipping.test.ts — το αντίστοιχο test του βήματος 5
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §24
 */

import { layoutTable } from '../../../bim/table/table-layout';
import {
  createTableModel,
  getPersistedCellText,
  setPersistedCellText,
  toPersistedTableModel,
} from '../../../bim/table/table-model-helpers';
import { CELL_CLIP_ELLIPSIS } from '../../../bim/table/table-cell-overflow';
import { resolveTableCellEditTargetById } from '../../../bim/table/table-cell-edit-session';
import {
  BUILTIN_TABLE_STYLES,
  BUILTIN_TABLE_STYLE_IDS,
} from '../../../bim/table/table-style-presets';
import type { TableStyle } from '../../../bim/table/table-style';
import { computeTableCellEditorFrame } from '../table-cell-editor-frame';
import { cellFontBandPx, cellTextWidthPx } from '../table-cell-text-metrics';
import type { TableCell, TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';

/** Πολύ μακρύ για στήλη 20 mm σε **κάθε** βαθμίδα μέτρησης — πρέπει να κόβει πάντα. */
const LONG_TEXT = 'ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ ΠΟΛΥ ΜΑΚΡΙΑ ΓΙΑ ΤΟ ΚΕΛΙ ΤΗΣ';

const STANDARD: TableStyle = (() => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!style) throw new Error('missing preset: standard');
  return style;
})();

const COLUMN: TableColumn = {
  id: 'c1',
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'text',
  align: 'left',
};
const ROW: TableRow = { id: 'r1', rowClass: 'data' };

function modelWith(cell: TableCell): ReturnType<typeof createTableModel> {
  return createTableModel({ columns: [COLUMN], rows: [ROW], cells: [['r1', 'c1', cell]] });
}

function entityWith(cell: TableCell): TableEntity {
  return {
    id: 'ent_expand_test',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 0, y: 0 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    model: toPersistedTableModel(modelWith(cell)),
  };
}

/** Το κουτί του επεξεργαστή με ΑΥΤΟ το πρόχειρο — ο πραγματικός δρόμος του `projectBox`. */
function editorFrameFor(entity: TableEntity, draft: string | undefined) {
  const target = resolveTableCellEditTargetById(entity, 'r1', 'c1');
  if (!target) throw new Error('το κελί χάθηκε από τη διάταξη');
  return computeTableCellEditorFrame({
    target,
    pxPerMm: 4,
    angleRad: 0,
    resolveBand: cellFontBandPx,
    backgroundHex: '#101010',
    draft,
    maxWidthPx: 4000,
    resolveWidth: cellTextWidthPx,
  });
}

const CELL: TableCell = { kind: 'text', value: LONG_TEXT };

describe('🔴 ADR-739 Φ.Δ βήμα 6 — ο επεκτεταμένος επεξεργαστής ΔΕΝ αγγίζει τη διάταξη', () => {
  it('η επέκταση ΟΝΤΩΣ συμβαίνει — αλλιώς κάθε επόμενος έλεγχος είναι κενός', () => {
    // Χωρίς αυτό, όλα τα παρακάτω θα ήταν πράσινα και με την επέκταση **απενεργοποιημένη**.
    expect(editorFrameFor(entityWith(CELL), LONG_TEXT).expanded).toBe(true);
    expect(editorFrameFor(entityWith(CELL), undefined).expanded).toBe(false);
  });

  it('η ΔΙΑΤΑΞΗ είναι byte-ίδια πριν και μετά το άνοιγμα του επεξεργαστή', () => {
    const before = layoutTable(modelWith(CELL), STANDARD);
    editorFrameFor(entityWith(CELL), LONG_TEXT);
    const after = layoutTable(modelWith(CELL), STANDARD);
    expect(after).toEqual(before);
  });

  it('το `TableTextRun.text` μένει ΠΕΡΙΚΟΜΜΕΝΟ όσο ο επεξεργαστής δείχνει το πλήρες κείμενο', () => {
    const entity = entityWith(CELL);
    const frame = editorFrameFor(entity, LONG_TEXT);
    const run = layoutTable(modelWith(CELL), STANDARD).cells[0]?.texts[0];

    // Ο επεξεργαστής δείχνει ΟΛΟ το κείμενο…
    expect(frame.expanded).toBe(true);
    // …ενώ ο πίνακας εξακολουθεί να ζωγραφίζει το κομμένο, με τον δείκτη του βήματος 5.
    expect(run?.text).not.toBe(LONG_TEXT);
    expect(run?.text.endsWith(CELL_CLIP_ELLIPSIS)).toBe(true);
    expect(run?.clipped).toBe(true);
  });

  it('το ΜΟΝΤΕΛΟ μένει ακέραιο — καμία απώλεια δεδομένων του χρήστη', () => {
    const entity = entityWith(CELL);
    editorFrameFor(entity, LONG_TEXT);
    expect(getPersistedCellText(entity.model, 'r1', 'c1')).toBe(LONG_TEXT);
  });

  it('🔴 ΜΕΤΑ ΤΟ COMMIT ο πίνακας ξαναδείχνει κομμένο (η επέκταση δεν «κόλλησε» πουθενά)', () => {
    const entity = entityWith(CELL);
    editorFrameFor(entity, `${LONG_TEXT} ΚΑΙ ΑΛΛΟ`);

    const committed = setPersistedCellText(entity.model, 'r1', 'c1', `${LONG_TEXT} ΚΑΙ ΑΛΛΟ`).model;
    const run = layoutTable(modelWith({ kind: 'text', value: `${LONG_TEXT} ΚΑΙ ΑΛΛΟ` }), STANDARD)
      .cells[0]?.texts[0];

    expect(getPersistedCellText(committed, 'r1', 'c1')).toBe(`${LONG_TEXT} ΚΑΙ ΑΛΛΟ`);
    expect(run?.clipped).toBe(true);
    expect(run?.text.endsWith(CELL_CLIP_ELLIPSIS)).toBe(true);
  });

  it('το πλάτος της ΣΤΗΛΗΣ δεν ακολουθεί το πρόχειρο, όσο μακρύ κι αν γίνει', () => {
    const entity = entityWith(CELL);
    const widthOf = (): number => layoutTable(modelWith(CELL), STANDARD).columns[0]?.widthMm ?? 0;
    const before = widthOf();
    for (const draft of ['Α', LONG_TEXT, LONG_TEXT.repeat(4)]) editorFrameFor(entity, draft);
    expect(widthOf()).toBe(before);
  });
});
