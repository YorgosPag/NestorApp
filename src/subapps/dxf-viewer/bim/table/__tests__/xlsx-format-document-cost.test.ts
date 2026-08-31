/**
 * 🔴 ADR-833 §5.7 → **η ΕΙΣΟΔΟΣ ΤΗΣ ΦΑΣΗΣ 5Β**: πόσο μεγάλωσε το κελί όταν απέκτησε μορφή.
 *
 * Το §5.6.4 έδωσε τη βάση με **σκέτο κείμενο**: γεμάτο 256×1000 ≈ 12,1 MB, δηλαδή **οριακό**
 * (χωράει στα 25 MB, ξεπερνά μόνο του το κατώφλι των 10 MB). Το ίδιο ADR προειδοποίησε ότι ο
 * αριθμός **θα παλιώσει**, γιατί «η Φάση 6 μεγαλώνει το κάθε κελί».
 *
 * 🔑 Αυτή η μέτρηση είναι η εξόφληση εκείνης της προειδοποίησης. Χρησιμοποιεί το **ίδιο**
 * όργανο (`table-document-cost`), το **ίδιο** ελληνικό περιεχόμενο μηχανικού και το **ίδιο**
 * σχήμα — αλλάζει **μόνο** ό,τι πρόσθεσε η Φάση 6 στο κελί.
 *
 * ⚠️ Οι άγκυρες εδώ δηλώνουν **σχέσεις**, όχι απόλυτα megabyte: ένα καρφωμένο «12,1 MB» θα
 * κοκκίνιζε σε κάθε αλλαγή διατύπωσης του δείγματος και θα έλεγε ψέματα για την αιτία. Ο
 * **απόλυτος** αριθμός γράφεται στο ADR (§5.7.7), όπου διαβάζεται από άνθρωπο.
 *
 * @see bim/table/table-document-cost.ts — το όργανο (Φάση 5Α)
 */

import {
  SCENE_DOCUMENT_LIMIT_BYTES,
  SCENE_DOCUMENT_WARN_BYTES,
  measureTableDocumentCost,
  projectTableBytes,
} from '../table-document-cost';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import { tableWorksheetId } from '../../../types/table-worksheet';
import type { TableWorksheet } from '../../../types/table-worksheet';
import type {
  PersistedTableModel,
  TableCell,
  TableCellStyleOverride,
  TableColumn,
  TableRow,
} from '../../../types/table';

/** Το σημερινό όριο, γραμμένο ως αριθμός: 256 στήλες × 1000 γραμμές. */
const TODAY_COLUMNS = 256;
const TODAY_ROWS = 1000;

/** Ρεαλιστικό ελληνικό περιεχόμενο μηχανικού — το ίδιο δείγμα με το §5.6.4. */
const SAMPLE = ['Δοκός Δ1', 'Κ12', '4Ø20'];

/** Η μορφοποίηση που φέρνει ένα **τυπικό** κελί από το Excel μετά τη Φάση 6. */
const TYPICAL_FORMAT: TableCellStyleOverride = {
  numberFormat: { kind: 'decimal', decimals: 2, grouping: true },
  textHeightMm: 3.88,
  textColorHex: '#1E293B',
  bold: true,
  align: 'MR',
};

function model(withFormat: boolean): PersistedTableModel {
  const columns: TableColumn[] = SAMPLE.map((_, i) => ({
    id: `c${i}`,
    sizing: { kind: 'fixed', widthMm: 40 },
    valueType: 'text',
    align: 'left',
  }));
  const rows: TableRow[] = [{ id: 'r0', rowClass: 'data' }];
  const cells: (readonly [string, string, TableCell])[] = SAMPLE.map((value, i) => [
    'r0',
    `c${i}`,
    withFormat
      ? ({ kind: 'text', value, styleOverride: TYPICAL_FORMAT } as TableCell)
      : ({ kind: 'text', value } as TableCell),
  ]);
  return toPersistedTableModel(createTableModel({ columns, rows, cells, merges: [] }));
}

function worksheet(persisted: PersistedTableModel): TableWorksheet {
  return { id: tableWorksheetId('ws0'), model: persisted };
}

function fullTableBytes(withFormat: boolean): number {
  const cost = measureTableDocumentCost([worksheet(model(withFormat))]);
  return projectTableBytes(cost, {
    columnCount: TODAY_COLUMNS,
    rowCount: TODAY_ROWS,
    filledCellCount: TODAY_COLUMNS * TODAY_ROWS,
  });
}

describe('ADR-833 §5.7.7 — τι κόστισε η parity, μετρημένο με το ΙΔΙΟ όργανο', () => {
  it('🔴 το μορφοποιημένο κελί είναι ΑΚΡΙΒΟΤΕΡΟ — η προειδοποίηση του §5.6.4 ήταν σωστή', () => {
    expect(fullTableBytes(true)).toBeGreaterThan(fullTableBytes(false));
  });

  it('🔴 …και ΞΕΠΕΡΝΑ ΤΟ ΤΑΒΑΝΙ: το σημερινό όριο ΔΕΝ αντέχει γεμάτο μορφοποιημένο πίνακα', () => {
    // Αυτό είναι το εύρημα που παραδίδεται στη Φάση 5Β. Το §5.6.4 έλεγε «οριακό αλλά χωράει»·
    // με τη μορφοποίηση μέσα, ο **γεμάτος** πίνακας παύει να χωρά. Το όριο δεν είναι πια
    // ζήτημα άνεσης — είναι ζήτημα **ορθότητας**.
    expect(fullTableBytes(true)).toBeGreaterThan(SCENE_DOCUMENT_LIMIT_BYTES);
  });

  it('🔑 …ενώ ο ΑΡΑΙΟΣ πίνακας ίδιων διαστάσεων εξακολουθεί να χωρά — το όριο είναι ΓΙΝΟΜΕΝΟ', () => {
    // Η ίδια απόδειξη με το §5.6.4, τώρα με τη μορφοποίηση μέσα: το «256×1000» άλλοτε χωράει
    // και άλλοτε όχι, άρα **ζεύγος ορίων διαστάσεων δεν μπορεί να προστατεύσει το έγγραφο**.
    const cost = measureTableDocumentCost([worksheet(model(true))]);
    const sparse = projectTableBytes(cost, {
      columnCount: TODAY_COLUMNS,
      rowCount: TODAY_ROWS,
      filledCellCount: Math.round(0.05 * TODAY_COLUMNS * TODAY_ROWS),
    });
    expect(sparse).toBeLessThan(SCENE_DOCUMENT_WARN_BYTES);
  });

  it('🔑 ο ΛΟΓΟΣ των δύο είναι το νούμερο που παραδίδεται στη Φ5Β', () => {
    const ratio = fullTableBytes(true) / fullTableBytes(false);
    // Η μορφοποίηση **πολλαπλασιάζει**, δεν προσθέτει λίγο: ένα κελί με μορφή και στυλ είναι
    // πολλαπλάσιο ενός κελιού με σκέτο «Κ12». Ο ακριβής αριθμός στο ADR §5.7.7.
    expect(ratio).toBeGreaterThan(2);
    expect(ratio).toBeLessThan(12);
  });
});
