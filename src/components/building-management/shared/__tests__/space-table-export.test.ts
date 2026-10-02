/**
 * `space-table-export` — ADR-898 Φ4β: το αρχείο έχει **ό,τι βλέπει ο άνθρωπος** (ίδιες στήλες · ίδια σειρά · στήλες
 * `exportOnly` στη θέση τους) και γραμμή συνόλου που **ποτέ** δεν παρουσιάζει μερικό άθροισμα ως σύνολο.
 */

import { spaceScheduleSpec, spaceScheduleTotals, type SpaceTotalsLabels } from '../space-table-export';
import type { SpaceColumn } from '../types';

interface Row {
  readonly id: string;
  readonly area: number | null;
}

const none = () => null;
const COLUMNS: SpaceColumn<Row>[] = [
  { key: 'id', label: 'Κωδικός', render: none, sortValue: (r) => r.id, exportCell: (r) => r.id },
  { key: 'actions', label: 'Ενέργειες', render: none },
  { key: 'area', label: 'Επιφάνεια', render: none, sortValue: (r) => r.area, exportCell: (r) => r.area, exportFormat: 'number', exportTotal: 'sum' },
  { key: 'note', label: 'Σημείωση', render: none, exportOnly: true, exportCell: (r) => `σ-${r.id}` },
];

const LABELS: SpaceTotalsLabels = {
  totalRow: (rows) => `total:${rows}`,
  missing: (pending, rows) => `missing:${pending}/${rows}`,
};

describe('spaceScheduleSpec', () => {
  it('εξάγει μόνο στήλες με `exportCell` — και τις `exportOnly` στη θέση τους', () => {
    const spec = spaceScheduleSpec({ name: 'Θέσεις', columns: COLUMNS, items: [{ id: 'A', area: 12 }], sort: null });
    expect(spec.columns.map((c) => c.header)).toEqual(['Κωδικός', 'Επιφάνεια', 'Σημείωση']);
    expect(spec.rows).toEqual([['A', 12, 'σ-A']]);
  });

  it('η σειρά του αρχείου = η σειρά της οθόνης (κενά τελευταία και προς τις δύο κατευθύνσεις)', () => {
    const items: Row[] = [{ id: 'A', area: 20 }, { id: 'B', area: null }, { id: 'C', area: 5 }];
    const desc = spaceScheduleSpec({ name: 'x', columns: COLUMNS, items, sort: { key: 'area', direction: 'desc' } });
    expect(desc.rows.map((r) => r[0])).toEqual(['A', 'C', 'B']);
    const asc = spaceScheduleSpec({ name: 'x', columns: COLUMNS, items, sort: { key: 'area', direction: 'asc' } });
    expect(asc.rows.map((r) => r[0])).toEqual(['C', 'A', 'B']);
  });
});

describe('spaceScheduleTotals', () => {
  it('πλήρες ⇒ `SUM` (χωρίς θόρυβο κινητής υποδιαστολής) + πλήθος στην πρώτη στήλη', () => {
    const totals = spaceScheduleTotals(COLUMNS, [{ id: 'A', area: 0.1 }, { id: 'B', area: 0.2 }], LABELS);
    expect(totals).toEqual({ id: 'total:2', area: { sum: 0.3 } });
  });

  it('ένα κενό ⇒ «λείπουν Ν από Μ», ΚΑΝΕΝΑΣ αριθμός (ποτέ μερικό άθροισμα ως σύνολο)', () => {
    const totals = spaceScheduleTotals(COLUMNS, [{ id: 'A', area: 10 }, { id: 'B', area: null }], LABELS);
    expect(totals.area).toBe('missing:1/2');
  });

  it('καμία γραμμή ⇒ κανένα άθροισμα (ένα «0» θα έλεγε «μετρήθηκε μηδέν»)', () => {
    expect(spaceScheduleTotals(COLUMNS, [], LABELS)).toEqual({ id: 'total:0' });
  });

  it('στήλη χωρίς `exportTotal` δεν αθροίζεται ποτέ', () => {
    const totals = spaceScheduleTotals(COLUMNS, [{ id: 'A', area: 1 }], LABELS);
    expect(totals).not.toHaveProperty('note');
  });
});
