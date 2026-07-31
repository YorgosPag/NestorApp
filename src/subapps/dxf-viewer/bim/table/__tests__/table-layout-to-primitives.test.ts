/**
 * ADR-739 Φάση Β — unit tests της γέφυρας `TableLayout` → `DetailPrimitive[]`.
 *
 * Η **σειρά** δεν είναι λεπτομέρεια: σε καμβά και PDF είναι το z-order, και είναι το ένα
 * πράγμα που ο χαρακτηρισμός του ADR-622 δεν θα μπορούσε να επαληθεύσει μόνος του αν η
 * γέφυρα την έβγαζε τυχαία (θα έδειχνε απλώς «κάτι άλλαξε»). Εδώ ελέγχεται ρητά.
 */

import { layoutTable } from '../table-layout';
import { tableLayoutToPrimitives } from '../table-layout-to-primitives';
import { createTableModel } from '../table-model-helpers';
import {
  BUILTIN_TABLE_STYLES,
  BUILTIN_TABLE_STYLE_IDS,
  DETAIL_SHEET_RULE,
} from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { TableTextMeasurer } from '../table-layout-types';
import type { TableColumn, TableRow } from '../../../types/table';

const measureText: TableTextMeasurer = (text, heightMm) => text.length * heightMm * 0.6;

function styleById(id: string): TableStyle {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`missing preset: ${id}`);
  return style;
}

const STANDARD = styleById(BUILTIN_TABLE_STYLE_IDS.STANDARD);
const DETAIL_SHEET = styleById(BUILTIN_TABLE_STYLE_IDS.DETAIL_SHEET);

const col = (id: string, widthMm: number): TableColumn => ({
  id,
  sizing: { kind: 'fixed', widthMm },
  valueType: 'text',
  align: 'left',
});

const row = (id: string, rowClass: TableRow['rowClass'] = 'data', extra?: Partial<TableRow>): TableRow =>
  ({ id, rowClass, ...extra });

const kinds = (prims: readonly { kind: string }[]): string[] => prims.map((p) => p.kind);

describe('tableLayoutToPrimitives — σειρά εξόδου (= z-order)', () => {
  it('ανά γραμμή: πρώτα η πάνω ακμή, μετά τα κελιά της', () => {
    const model = createTableModel({
      columns: [col('a', 20)],
      rows: [row('h', 'header'), row('d0'), row('t', 'data', { borderTop: DETAIL_SHEET_RULE })],
      cells: [['h', 'a', { kind: 'text', value: 'H' }], ['d0', 'a', { kind: 'text', value: 'D' }],
        ['t', 'a', { kind: 'text', value: 'T' }]],
    });
    const prims = tableLayoutToPrimitives(layoutTable(model, DETAIL_SHEET, { measureText }));
    // Η ακολουθία του ADR-622: κεφαλίδα → γραμμή → δεδομένα → γραμμή → σύνολο.
    expect(kinds(prims)).toEqual(['text', 'line', 'text', 'line', 'text']);
    expect(prims.filter((p) => p.kind === 'text').map((p) => (p as { text: string }).text))
      .toEqual(['H', 'D', 'T']);
  });

  it('οι κατακόρυφες έρχονται τελευταίες, μετά την κάτω ακμή', () => {
    const model = createTableModel({
      columns: [col('a', 10), col('b', 10)],
      rows: [row('r1')],
    });
    const prims = tableLayoutToPrimitives(layoutTable(model, STANDARD, { measureText }));
    // 2 οριζόντιες (πάνω + κάτω) + 3 κατακόρυφες· καμία δεν λείπει, καμία διπλή.
    expect(prims).toHaveLength(5);
    const horizontals = prims.filter((p) => p.kind === 'line' && p.a.y === p.b.y);
    expect(horizontals).toHaveLength(2);
    expect(kinds(prims.slice(2))).toEqual(['line', 'line', 'line']);
  });

  it('κενά κελιά και αόρατες ακμές δεν παράγουν τίποτα', () => {
    const model = createTableModel({ columns: [col('a', 10)], rows: [row('r1'), row('r2')] });
    expect(tableLayoutToPrimitives(layoutTable(model, DETAIL_SHEET, { measureText }))).toHaveLength(0);
  });

  it('άδειος πίνακας → κανένα primitive', () => {
    const model = createTableModel({ columns: [], rows: [] });
    expect(tableLayoutToPrimitives(layoutTable(model, STANDARD, { measureText }))).toHaveLength(0);
  });
});

describe('tableLayoutToPrimitives — μετατόπιση στην άγκυρα', () => {
  const model = createTableModel({
    columns: [col('a', 20)],
    rows: [row('r1')],
    cells: [['r1', 'a', { kind: 'text', value: 'X' }]],
  });

  it('κάθε συντεταγμένη μετατοπίζεται κατά την origin — κείμενο και γραμμές', () => {
    const layout = layoutTable(model, STANDARD, { measureText });
    const at0 = tableLayoutToPrimitives(layout);
    const moved = tableLayoutToPrimitives(layout, { xMm: 100, yMm: 50 });
    expect(moved).toHaveLength(at0.length);
    moved.forEach((prim, i) => {
      const origin = at0[i];
      if (prim.kind === 'text' && origin.kind === 'text') {
        expect(prim.position.x - origin.position.x).toBeCloseTo(100, 6);
        expect(prim.position.y - origin.position.y).toBeCloseTo(50, 6);
      } else if (prim.kind === 'line' && origin.kind === 'line') {
        expect(prim.a.x - origin.a.x).toBeCloseTo(100, 6);
        expect(prim.b.y - origin.b.y).toBeCloseTo(50, 6);
      }
    });
  });

  it('χωρίς dash στο μολύβι, το stroke ΔΕΝ αποκτά ρητό dashMm (ταυτότητα σχήματος)', () => {
    const line = tableLayoutToPrimitives(layoutTable(model, STANDARD, { measureText }))
      .find((p) => p.kind === 'line');
    expect(line && 'stroke' in line ? Object.keys(line.stroke).sort() : []).toEqual(['colorHex', 'widthMm']);
  });
});
