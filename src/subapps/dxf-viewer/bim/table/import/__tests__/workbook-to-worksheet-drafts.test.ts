/**
 * ADR-833 Φάση 4 — **ΤΟ ΒΙΒΛΙΟ ΜΠΑΙΝΕΙ ΟΛΟΚΛΗΡΟ**, και ό,τι δεν χώρεσε **λέγεται**.
 *
 * Η σουίτα καρφώνει ακριβώς τη **σιωπή που έφυγε**: μέχρι τη Φάση 3, ο καλών κρατούσε
 * επίτηδες μόνο το **πρώτο** φύλλο και το ανακοίνωνε με μήνυμα (`tableXlsx.onlyFirstSheet`).
 * Η ανάγνωση δεν άλλαξε ποτέ — άλλαξε ο **προορισμός**.
 *
 * @see ../workbook-to-worksheet-drafts.ts
 */

import { workbookToWorksheetDrafts } from '../workbook-to-worksheet-drafts';
import { MAX_TABLE_COLUMN_COUNT, MAX_TABLE_DATA_ROW_COUNT, TABLE_FIXED_ROW_COUNT } from '../../build-table-entity';
import { resolveTableModel } from '../../table-model-helpers';
import type { ImportedWorksheet } from '../xlsx-to-worksheets';

/** Πλέγμα `rows × cols` με μοναδικό κείμενο ανά κελί — ώστε η **θέση** να ελέγχεται. */
function grid(rows: number, cols: number, tag: string): string[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => `${tag}:${r},${c}`),
  );
}

const BOOK: readonly ImportedWorksheet[] = [
  { name: 'Πωλήσεις', grid: grid(3, 2, 'A') },
  { name: 'Κόστη', grid: grid(4, 3, 'B') },
  { name: '', grid: grid(2, 2, 'C') },
];

describe('🔴 ADR-833 Φ4 — ΟΛΑ τα φύλλα, στη σειρά του βιβλίου', () => {
  it('τρία φύλλα μέσα ⇒ τρία προσχέδια έξω (η σιωπή της Φάσης 1 έφυγε)', () => {
    expect(workbookToWorksheetDrafts(BOOK).drafts).toHaveLength(3);
  });

  it('η σειρά διατηρείται — και τα δεδομένα ΔΕΝ ανακατεύονται ανάμεσα σε φύλλα', () => {
    const { drafts } = workbookToWorksheetDrafts(BOOK);
    drafts.forEach((draft, index) => {
      const tag = ['A', 'B', 'C'][index];
      // Οι τιμές διαβάζονται από το **λυμένο** μοντέλο, με τη μορφή που όντως αποθηκεύεται
      // (`{ kind: 'text', value }`) — όχι από φανταστικό πεδίο `text`.
      const values = [...resolveTableModel(draft.model).cells.values()]
        .map((cell) => (cell.kind === 'text' ? cell.value : ''));
      expect(values.some((value) => value.startsWith(`${tag}:`))).toBe(true);
      expect(values.every((value) => value === '' || value.startsWith(`${tag}:`))).toBe(true);
    });
  });

  it('το όνομα του Excel ταξιδεύει αυτούσιο', () => {
    const { drafts } = workbookToWorksheetDrafts(BOOK);
    expect(drafts[0].name).toBe('Πωλήσεις');
    expect(drafts[1].name).toBe('Κόστη');
  });

  it('🔴 ΚΕΝΟ όνομα ⇒ ΑΠΟΝ πεδίο, ποτέ `name: ""` (Firestore-safe, και «ανώνυμο» για κάθε αναγνώστη)', () => {
    const { drafts } = workbookToWorksheetDrafts(BOOK);
    expect(drafts[2]).not.toHaveProperty('name');
  });

  it('κενό βιβλίο ⇒ κενά προσχέδια, μηδενικό κόψιμο, καμία απόφαση', () => {
    expect(workbookToWorksheetDrafts([])).toEqual({ drafts: [], droppedRows: 0, droppedColumns: 0 });
  });
});

describe('🔴 ADR-833 Φ4 — ΚΑΜΙΑ ΣΙΩΠΗΛΗ ΑΠΩΛΕΙΑ: το κόψιμο ΑΘΡΟΙΖΕΤΑΙ', () => {
  const tooManyRows = TABLE_FIXED_ROW_COUNT + MAX_TABLE_DATA_ROW_COUNT + 5;

  it('βιβλίο που χωρά ⇒ μηδέν κόψιμο', () => {
    const { droppedRows, droppedColumns } = workbookToWorksheetDrafts(BOOK);
    expect(droppedRows).toBe(0);
    expect(droppedColumns).toBe(0);
  });

  it('🔴 ΕΝΑ μεγάλο φύλλο ανάμεσα σε μικρά ΔΕΝ κρύβεται πίσω τους', () => {
    const book: readonly ImportedWorksheet[] = [
      { name: 'μικρό', grid: grid(2, 2, 'A') },
      { name: 'τεράστιο', grid: grid(tooManyRows, 2, 'B') },
      { name: 'μικρό 2', grid: grid(2, 2, 'C') },
    ];
    expect(workbookToWorksheetDrafts(book).droppedRows).toBe(5);
  });

  it('το κόψιμο ΔΥΟ φύλλων προστίθεται, δεν αντικαθίσταται από το τελευταίο', () => {
    const book: readonly ImportedWorksheet[] = [
      { name: 'α', grid: grid(tooManyRows, 2, 'A') },
      { name: 'β', grid: grid(tooManyRows, 2, 'B') },
    ];
    expect(workbookToWorksheetDrafts(book).droppedRows).toBe(10);
  });

  it('οι στήλες μετριούνται χωριστά από τις γραμμές', () => {
    const book: readonly ImportedWorksheet[] = [
      { name: 'πλατύ', grid: grid(2, MAX_TABLE_COLUMN_COUNT + 3, 'A') },
    ];
    const result = workbookToWorksheetDrafts(book);
    expect(result.droppedColumns).toBe(3);
    expect(result.droppedRows).toBe(0);
  });
});
