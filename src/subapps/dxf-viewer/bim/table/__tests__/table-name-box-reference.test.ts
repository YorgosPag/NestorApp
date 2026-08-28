/**
 * 🔴 ADR-739 §69 — **ΤΟ ΠΛΑΙΣΙΟ ΟΝΟΜΑΤΟΣ ΩΣ ΠΟΡΤΑ**: τι σημαίνει ό,τι πληκτρολογήθηκε.
 *
 * Δύο πράγματα κλειδώνονται εδώ και **κανένα** από τα δύο δεν φαίνεται με το μάτι:
 *
 *  1. **Το `$` περνά.** Ο μεταφραστής δεν είναι το `parseTableCellReference` (που δεν δέχεται
 *     δολάρια) αλλά ο ΕΝΑΣ `resolveWrittenCellRef`. Ο χρήστης που αντιγράφει `$B$7` από τύπο
 *     του δικού του σχεδίου **πρέπει** να μπορεί να το επικολλήσει εδώ. Μια μελλοντική
 *     «απλοποίηση» προς τον κοντινότερο μεταφραστή θα το έσπαγε σιωπηλά.
 *  2. **Το σκέτο κελί ΔΕΝ μαρκάρει.** §27.15: «καμία επιλογή ≠ επιλογή 1×1» — ένα `B7` που
 *     γεννούσε `B7:B7` θα άλλαζε το αντικείμενο του επόμενου `Ctrl+C` χωρίς ο χρήστης να το
 *     ζητήσει.
 */

import { parseTableNameBoxReference } from '../table-name-box-reference';
import { createTableModel } from '../table-model-helpers';
import type { TableColumn, TableModel, TableRow } from '../../../types/table';

const COLUMNS: TableColumn[] = ['c0', 'c1', 'c2'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'text',
  align: 'left',
}));

const ROWS: TableRow[] = ['r0', 'r1', 'r2', 'r3'].map((id) => ({
  id,
  rowClass: 'data',
  heightMm: 8,
}));

const MODEL: TableModel = createTableModel({ columns: COLUMNS, rows: ROWS });

describe('parseTableNameBoxReference — πού με στέλνει ο άνθρωπος', () => {
  it('`B2` πάει στο κελί και ΔΕΝ μαρκάρει τίποτα', () => {
    expect(parseTableNameBoxReference(MODEL, 'B2')).toEqual({
      position: { rowId: 'r1', colId: 'c1', anchorColId: 'c1' },
      selection: null,
    });
  });

  it('πεζά γράμματα και κενά γύρω γίνονται δεκτά — ο άνθρωπος πληκτρολογεί, δεν προγραμματίζει', () => {
    expect(parseTableNameBoxReference(MODEL, '  b2 ')?.position.rowId).toBe('r1');
  });

  it('🔴 το `$` ΠΕΡΝΑ — ο ΕΝΑΣ αναγνώστης γραμμένης αναφοράς, όχι δεύτερο regex', () => {
    expect(parseTableNameBoxReference(MODEL, '$B$2')?.position).toEqual({
      rowId: 'r1', colId: 'c1', anchorColId: 'c1',
    });
    // Μεικτή μορφή: το ίδιο. Αν κάποτε μπει δεύτερη γραμματική εδώ, αυτή είναι η γραμμή που
    // θα κοκκινίσει πρώτη.
    expect(parseTableNameBoxReference(MODEL, 'B$2')?.position.rowId).toBe('r1');
  });

  it('🔴 οι σημαίες `$` ΔΕΝ επιβιώνουν στην έξοδο — μια θέση δρομέα δεν είναι απόλυτη', () => {
    const target = parseTableNameBoxReference(MODEL, '$B$2');
    expect(target?.position).not.toHaveProperty('absoluteRow');
    expect(target?.position).not.toHaveProperty('absoluteCol');
  });

  it('`A1:B3` πάει στην ΑΡΧΗ και μαρκάρει ως το τέλος', () => {
    expect(parseTableNameBoxReference(MODEL, 'A1:B3')).toEqual({
      position: { rowId: 'r0', colId: 'c0', anchorColId: 'c0' },
      selection: {
        from: { rowId: 'r0', colId: 'c0' },
        to: { rowId: 'r2', colId: 'c1' },
        kind: 'range',
      },
    });
  });

  it('🔴 ανάποδο εύρος περνά ΑΥΤΟΥΣΙΟ — η κανονικοποίηση ζει στον ΕΝΑ ερμηνευτή', () => {
    // `resolveTableSelectionBounds` είναι εκείνος που ταξινομεί. Μια δεύτερη κανονικοποίηση
    // εδώ θα μετακινούσε το ενεργό κελί σε γωνία που ο χρήστης δεν πληκτρολόγησε ποτέ.
    const target = parseTableNameBoxReference(MODEL, 'B3:A1');
    expect(target?.position.rowId).toBe('r2');
    expect(target?.selection?.to).toEqual({ rowId: 'r0', colId: 'c0' });
  });

  it.each([
    ['κενό', ''],
    ['όχι διεύθυνση', 'ΣΥΝΟΛΟ'],
    ['εκτός πλέγματος — στήλη', 'Z1'],
    ['εκτός πλέγματος — γραμμή', 'A99'],
    ['μισό εύρος', 'A1:'],
    ['άκυρο δεύτερο άκρο', 'A1:ΩΨ'],
    ['τρία άκρα', 'A1:B2:C3'],
    ['μόνο ψηφία', '7'],
  ])('«%s» δεν με στέλνει πουθενά', (_name, text) => {
    expect(parseTableNameBoxReference(MODEL, text)).toBeNull();
  });
});
