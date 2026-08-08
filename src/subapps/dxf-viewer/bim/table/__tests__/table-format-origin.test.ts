/**
 * 🏆 ADR-739 §60 — **«ΠΟΙΟ ΕΠΙΠΕΔΟ ΤΟ ΑΠΟΦΑΣΙΣΕ;»**
 *
 * Η ερώτηση που το μοντέλο μπορούσε πάντα να απαντήσει και καμία επιφάνεια δεν έκανε ποτέ. Οι
 * άγκυρες εδώ κλειδώνουν **τη σειρά** (κελί ▸ γραμμή ▸ στήλη ▸ βάση) και τις δύο απαντήσεις που
 * δεν είναι επίπεδα: «διαφέρει» και «δεν έχω τι να πω».
 */

import {
  resolveTableNumberFormatOrigin,
  resolveTableStyleFieldOrigin,
} from '../table-format-origin';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import type { TableFormatScope } from '../table-format-scope';
import type { TableStyle } from '../table-style';
import type {
  PersistedTableModel,
  TableCellEntry,
  TableColumn,
  TableRow,
} from '../../../types/table';

const STANDARD: TableStyle = (() => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!style) throw new Error('missing preset: standard');
  return style;
})();

interface Overrides {
  readonly column?: TableColumn['styleOverride'];
  readonly row?: TableRow['styleOverride'];
  readonly cell?: TableCellEntry[2]['styleOverride'];
  /** Η δεύτερη γραμμή, ώστε να μπορεί ένας στόχος να είναι **ανάμεικτος** ως προς την προέλευση. */
  readonly row2?: TableRow['styleOverride'];
}

function persisted(overrides: Overrides = {}): PersistedTableModel {
  const columns: TableColumn[] = [{
    id: 'c1',
    sizing: { kind: 'fixed', widthMm: 10 },
    valueType: 'text',
    align: 'left',
    ...(overrides.column === undefined ? {} : { styleOverride: overrides.column }),
  }];
  const rows: TableRow[] = [
    {
      id: 'r1',
      rowClass: 'data',
      heightMm: 6,
      ...(overrides.row === undefined ? {} : { styleOverride: overrides.row }),
    },
    {
      id: 'r2',
      rowClass: 'data',
      heightMm: 6,
      ...(overrides.row2 === undefined ? {} : { styleOverride: overrides.row2 }),
    },
  ];
  const cells: TableCellEntry[] = overrides.cell === undefined ? [] : [
    ['r1', 'c1', { kind: 'text', value: '', styleOverride: overrides.cell }],
  ];
  return { columns, rows, cells, merges: [] };
}

/** Ένα κελί (r1,c1). */
const ONE: TableFormatScope = { kind: 'range', bounds: { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 } };
/** Και οι δύο γραμμές της στήλης. */
const BOTH: TableFormatScope = { kind: 'range', bounds: { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 0 } };

describe('§60 — η ΣΕΙΡΑ των επιπέδων στυλ', () => {
  it('🔴 κελί ▸ γραμμή ▸ στήλη ▸ βάση — και κερδίζει ΠΑΝΤΑ το στενότερο', () => {
    const all = persisted({ column: { bold: true }, row: { bold: false }, cell: { bold: true } });
    expect(resolveTableStyleFieldOrigin(all, STANDARD, ONE, 'bold')).toBe('cell');

    const rowAndColumn = persisted({ column: { bold: true }, row: { bold: false } });
    expect(resolveTableStyleFieldOrigin(rowAndColumn, STANDARD, ONE, 'bold')).toBe('row');

    const columnOnly = persisted({ column: { bold: true } });
    expect(resolveTableStyleFieldOrigin(columnOnly, STANDARD, ONE, 'bold')).toBe('column');
  });

  it('🔑 κανείς δεν το δηλώνει ⇒ το λέει η ΚΛΑΣΗ ΓΡΑΜΜΗΣ, όχι «τίποτα»', () => {
    // Το `null` σημαίνει «δεν έχω τι να πω» και είναι **άλλη** απάντηση: η τιμή υπάρχει πάντα —
    // απλώς την έδωσε το στυλ του πίνακα. Ένα `null` εδώ θα έκρυβε το τέταρτο επίπεδο.
    expect(resolveTableStyleFieldOrigin(persisted(), STANDARD, ONE, 'bold')).toBe('rowClass');
  });

  it('🔴 ΡΗΤΟ `null` (=ρητά κανένα γέμισμα) είναι ΔΗΛΩΣΗ, όχι απουσία', () => {
    // Ο έλεγχος είναι `!== undefined` και όχι truthiness. Με truthiness, το «ρητά χωρίς
    // γέμισμα» θα εμφανιζόταν ως κληρονομιά και ο χρήστης θα έψαχνε στη στήλη μια απόφαση που
    // είχε πάρει ο ίδιος στο κελί.
    const model = persisted({ column: { fillColorHex: '#ff0000' }, cell: { fillColorHex: null } });
    expect(resolveTableStyleFieldOrigin(model, STANDARD, ONE, 'fillColorHex')).toBe('cell');
  });
});

describe('§60 — οι δύο απαντήσεις που ΔΕΝ είναι επίπεδα', () => {
  it('🔴 δύο κελιά με ΔΙΑΦΟΡΕΤΙΚΗ προέλευση ⇒ «ανάμεικτο»', () => {
    const model = persisted({ row: { bold: true } });
    expect(resolveTableStyleFieldOrigin(model, STANDARD, BOTH, 'bold')).toBe('mixed');
  });

  it('🔑 ΙΔΙΑ τιμή από ΔΙΑΦΟΡΕΤΙΚΑ επίπεδα είναι πάλι «ανάμεικτο» — ορθογώνιες ερωτήσεις', () => {
    // Η στήλη λέει «έντονα» και η **μία** γραμμή το ξαναλέει: η τιμή συμφωνεί παντού, η
    // **προέλευση** όχι. Αν το `origin` κληρονομούσε το `mixed` της τιμής, αυτή η περίπτωση θα
    // απαντούσε «στήλη» και θα έστελνε τον χρήστη να αλλάξει κάτι που δεν θα άλλαζε τα μισά κελιά.
    const model = persisted({ column: { bold: true }, row: { bold: true } });
    expect(resolveTableStyleFieldOrigin(model, STANDARD, BOTH, 'bold')).toBe('mixed');
  });

  it('στόχος που δεν επιβίωσε ⇒ `null`, ποτέ μαντεψιά', () => {
    const gone: TableFormatScope = { kind: 'axis', axis: 'row', ids: [] };
    expect(resolveTableStyleFieldOrigin(persisted(), STANDARD, gone, 'bold')).toBeNull();
    expect(resolveTableNumberFormatOrigin(persisted(), STANDARD, gone)).toBeNull();
  });
});

describe('§60 — η ΑΛΛΗ αλυσίδα: η μορφή αριθμού', () => {
  it('🔴 τελειώνει στο `valueType` της στήλης, ΟΧΙ στην κλάση γραμμής', () => {
    // Είναι ο λόγος που ο τύπος έχει **πέντε** τιμές και όχι τέσσερις με κοινό «βάση»: οι δύο
    // αλυσίδες τελειώνουν σε διαφορετικό πράγμα, και ο χρήστης πρέπει να μάθει σε ποιο.
    expect(resolveTableNumberFormatOrigin(persisted(), STANDARD, ONE)).toBe('valueType');
  });

  it('η ρητή μορφή κελιού νικά τη γραμμή και τη στήλη', () => {
    const model = persisted({
      column: { numberFormat: { kind: 'percent', decimals: 0 } },
      row: { numberFormat: { kind: 'general' } },
      cell: { numberFormat: { kind: 'decimal', decimals: 2 } },
    });
    expect(resolveTableNumberFormatOrigin(model, STANDARD, ONE)).toBe('cell');
  });

  it('χωρίς κελί, η γραμμή νικά τη στήλη', () => {
    const model = persisted({
      column: { numberFormat: { kind: 'percent', decimals: 0 } },
      row: { numberFormat: { kind: 'general' } },
    });
    expect(resolveTableNumberFormatOrigin(model, STANDARD, ONE)).toBe('row');
  });
});
