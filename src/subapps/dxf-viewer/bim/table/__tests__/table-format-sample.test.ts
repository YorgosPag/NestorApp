/**
 * 🔴 ADR-739 §60 — **το «Δείγμα»**: πραγματική τιμή όταν υπάρχει, παράδειγμα όταν όχι.
 *
 * ⚠️ Η **βαθμονόμηση** αυτού του αρχείου είναι η πρώτη άγκυρα: το δείγμα δεν επιτρέπεται να
 * αποδίδεται από δεύτερη μηχανή. Περνά από την **ίδια** `cellDisplayText` που ζωγραφίζει το
 * κελί, άρα ό,τι δείχνει ο διάλογος είναι κατά λέξη ό,τι θα δει ο χρήστης στο σχέδιο.
 */

import { tableFormatSample } from '../table-format-sample';
import { cellDisplayText } from '../table-cell-format';
import type { TableFormatScope } from '../table-format-scope';
import type {
  PersistedTableModel,
  TableCellEntry,
  TableColumn,
  TableRow,
} from '../../../types/table';
import type { TableCellFormat } from '../../../types/table-cell-format';

function persisted(cells: readonly TableCellEntry[] = []): PersistedTableModel {
  const columns: TableColumn[] = [
    { id: 'c1', sizing: { kind: 'fixed', widthMm: 10 }, valueType: 'text', align: 'left' },
    { id: 'c2', sizing: { kind: 'fixed', widthMm: 10 }, valueType: 'text', align: 'left' },
  ];
  const rows: TableRow[] = [
    { id: 'r1', rowClass: 'data', heightMm: 6 },
    { id: 'r2', rowClass: 'data', heightMm: 6 },
  ];
  return { columns, rows, cells, merges: [] };
}

const RANGE: TableFormatScope = {
  kind: 'range',
  bounds: { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 1 },
};

const EURO: TableCellFormat = { kind: 'currency', decimals: 2, locale: 'el-GR' };

describe('§60 — από πού έρχεται το δείγμα', () => {
  it('🔴 η ΠΡΑΓΜΑΤΙΚΗ τιμή του κελιού — όπως το «Sample» του Excel', () => {
    const model = persisted([['r1', 'c1', { kind: 'text', value: 1234.5 }]]);
    const sample = tableFormatSample(model, RANGE, EURO);
    expect(sample.source).toBe('cell');
    expect(sample.text).toBe(cellDisplayText({ kind: 'text', value: 1234.5 }, EURO));
  });

  it('🔴 η ΑΓΚΥΡΑ της περιοχής, όχι «το πρώτο μη κενό»', () => {
    // Το πάνω-αριστερά κελί είναι κενό και το διπλανό έχει τιμή. Το «χρήσιμο» θα ήταν να
    // δείξουμε εκείνο — και θα ήταν τιμή από κελί που ο χρήστης δεν κοιτά.
    const model = persisted([['r1', 'c2', { kind: 'text', value: 99 }]]);
    expect(tableFormatSample(model, RANGE, EURO).source).toBe('example');
  });

  it('🏆 κενό κελί ⇒ ΠΑΡΑΔΕΙΓΜΑ, και δηλώνεται ως τέτοιο', () => {
    // Εδώ το Excel σιωπά: το «Δείγμα» μένει άδειο και ο χρήστης που μορφοποιεί **πριν**
    // πληκτρολογήσει δεν μαθαίνει τίποτα. Το `source` υπάρχει ώστε η επιφάνεια να ονομάσει το
    // κείμενο — αλλιώς το `1.234,50 €` θα διαβαζόταν ως περιεχόμενο του κελιού.
    const sample = tableFormatSample(persisted(), RANGE, EURO);
    expect(sample.source).toBe('example');
    expect(sample.text).not.toBe('');
  });

  it('🔴 ΚΑΘΕ είδος έχει παράδειγμα — κανένα δεν αφήνει το πλαίσιο κενό', () => {
    const kinds: readonly TableCellFormat[] = [
      { kind: 'general' },
      { kind: 'text' },
      { kind: 'whole' },
      { kind: 'decimal', decimals: 2 },
      { kind: 'percent', decimals: 0 },
      { kind: 'currency', decimals: 2 },
      { kind: 'angle', decimals: 2 },
      { kind: 'date' },
    ];
    for (const format of kinds) {
      const sample = tableFormatSample(persisted(), RANGE, format);
      expect(sample.text).not.toBe('');
    }
  });

  it('🔑 το ποσοστό δείχνει ΚΛΑΣΜΑ — η μορφή πολλαπλασιάζει, το παράδειγμα δεν το κάνει δύο φορές', () => {
    const sample = tableFormatSample(persisted(), RANGE, { kind: 'percent', decimals: 0 });
    expect(sample.text).toContain('25');
  });

  it('στόχος που δεν επιβίωσε ⇒ πέφτει στο παράδειγμα αντί να πετάξει', () => {
    const gone: TableFormatScope = { kind: 'axis', axis: 'row', ids: [] };
    expect(tableFormatSample(persisted(), gone, EURO).source).toBe('example');
  });
});
