/**
 * ADR-923 §5.6 / §21.4.3 — ο πίνακας ως μπλοκ σελίδας: συνέχεια στηλών, δηλωμένες συγχωνεύσεις, rowspan, κεφαλίδες,
 * υποδείξεις σπασίματος. Τα σενάρια είναι τα ευρήματα της Φάσης 0.
 */
import type { PreviewRow, TablePreview } from '../../table/catalog-table';
import { columnChunks, evenSegments, fitValueColumns, layoutTables, tableUsesRail, type LayoutTableOptions } from '../layout-table';
import { ZERO_WIDTH_SPACE, formatPublicationDate, formatPublicationPrice, richTextBlocks, withBreakHints } from '../layout-text';

const options: LayoutTableOptions = { id: 't', caption: 'MFP', groupStyle: 'band', maxValueColumns: 3, labelColumnMm: 52, railColumnMm: 10, priceRowIds: new Set() };
const axis: PreviewRow = { kind: 'axis', id: 'a', label: 'Μέγεθος', cells: ['34', '51', '68', '85'] };
const group: PreviewRow = { kind: 'groupHeader', id: 'g', label: 'Ψύξη' };
const attr = (id: string, cells: string[], merge: 'none' | 'equalAdjacent' | 'all' = 'none'): PreviewRow =>
  ({ kind: 'attribute', id, label: id, unit: 'kW', filter: null, merge, cells });
const preview = (rows: readonly PreviewRow[]): TablePreview => ({ columns: [new Map(), new Map(), new Map(), new Map()], hiddenColumns: 0, rows });

describe('layoutTables — συνέχεια στηλών (12 παραλλαγές, §21.1)', () => {
  it('σπάει σε μπλοκ και κάθε συνέχεια κρατά ετικέτα γραμμής και κεφαλίδα', () => {
    const tables = layoutTables(preview([axis, attr('kw', ['1', '2', '3', '4'])]), options);
    expect(tables.map((table) => [table.part, table.parts])).toEqual([[1, 2], [2, 2]]);
    expect(tables[1].rows[0].cells.map((cell) => cell.text)).toEqual(['Μέγεθος', '68', '85']);
    expect(tables[1].rows[1].cells[0].text).toBe('kw (kW)');
    expect(tables[1].rows[0].header).toBe(true);
  });

  it('🔴 η συγχώνευση «all» δεν περνά ποτέ το όριο μπλοκ', () => {
    const [first, second] = layoutTables(preview([axis, attr('v', ['230V', '230V', '230V', '230V'], 'all')]), options);
    expect(first.rows[1].cells[1]).toMatchObject({ text: '230V', colSpan: 2 });
    expect(second.rows[1].cells[1]).toMatchObject({ text: '230V', colSpan: 2 });
  });

  it('🔴 `none` ΔΕΝ συγχωνεύει ίσες τιμές: το «3/4″-3/4″» του MFP μένει σε κάθε στήλη', () => {
    const [table] = layoutTables(preview([attr('pipe', ['3/4″-3/4″', '3/4″-3/4″', '3/4″-3/4″', '3/4″-3/4″'])]), { ...options, maxValueColumns: 4 });
    expect(table.rows[0].cells).toHaveLength(5);
  });

  it('`equalAdjacent`: μόνο διαδοχικά ίσα, κενό δεν συγχωνεύεται', () => {
    const [table] = layoutTables(preview([attr('e', ['A', 'A', '', ''], 'equalAdjacent')]), { ...options, maxValueColumns: 4 });
    expect(table.rows[0].cells.slice(1).map((cell) => cell.colSpan)).toEqual([2, 1, 1]);
  });
});

describe('layoutTables — ομάδες', () => {
  const rows = [axis, group, attr('h', ['1', '2', '3', '4']), attr('m', ['1', '2', '3', '4'])];

  it('`band`: ζώνη πλάτους όλων των στηλών', () => {
    const [table] = layoutTables(preview(rows), { ...options, maxValueColumns: 4 });
    expect(table.railColumn).toBe(false);
    expect(table.rows[1].cells[0]).toMatchObject({ role: 'groupBand', colSpan: 5 });
  });

  it('🔑 `rail`: κελί με rowspan όσο οι γραμμές της ομάδας, και στήλη παραπάνω', () => {
    const [table] = layoutTables(preview(rows), { ...options, maxValueColumns: 4, groupStyle: 'rail' });
    expect(table.columnCount).toBe(6);
    const rail = table.rows.flatMap((row) => row.cells).filter((cell) => cell.role === 'groupRail');
    expect(rail.find((cell) => cell.text === 'Ψύξη')).toMatchObject({ rowSpan: 2 });
  });

  it('γεωμετρία: κάθε γραμμή `rail` αθροίζει ακριβώς στις στήλες του πίνακα, μαζί με τα rowspan από πάνω', () => {
    const [table] = layoutTables(preview(rows), { ...options, maxValueColumns: 4, groupStyle: 'rail' });
    let rowsStillCovered = 0;
    for (const row of table.rows) {
      const width = row.cells.reduce((sum, cell) => sum + cell.colSpan, 0);
      expect(width + (rowsStillCovered > 0 ? 1 : 0)).toBe(table.columnCount);
      const opened = row.cells.find((cell) => cell.rowSpan > 1);
      rowsStillCovered = opened ? opened.rowSpan - 1 : Math.max(rowsStillCovered - 1, 0);
    }
  });

  it('🔴 `rail`: rowspan δεν περνά ποτέ από κεφαλίδα σε σώμα', () => {
    const [table] = layoutTables(preview([axis, attr('x', ['1', '2', '3', '4']), group, attr('h', ['1', '2', '3', '4'])]), { ...options, maxValueColumns: 4, groupStyle: 'rail' });
    expect(table.rows[0].header).toBe(true);
    expect(table.rows[0].cells[0]).toMatchObject({ role: 'corner', rowSpan: 1 });
  });

  it('🔴 `rail`: ομάδα ψηλότερη από σελίδα χωρίζεται σε ισομερή τμήματα, και κάθε τμήμα ξαναγράφει την ετικέτα', () => {
    const tall = Array.from({ length: 45 }, (_, index) => attr(`r${index}`, ['1', '2', '3', '4']));
    const [table] = layoutTables(preview([axis, group, ...tall]), { ...options, maxValueColumns: 4, groupStyle: 'rail' });
    const segments = table.rows.flatMap((row) => row.cells).filter((cell) => cell.role === 'groupRail' && cell.text === 'Ψύξη');
    expect(segments.map((cell) => cell.rowSpan)).toEqual([15, 15, 15]);
  });

  it('τα σταθερά πλάτη περνούν στο μοντέλο: το πρότυπο δεν κρατά δικό του αριθμό', () => {
    const [table] = layoutTables(preview(rows), { ...options, maxValueColumns: 4, groupStyle: 'rail' });
    expect(table).toMatchObject({ labelColumnMm: 52, railColumnMm: 10 });
  });

  it('`tableUsesRail`: χωρίς ομάδες δεν υπάρχει στήλη ομάδας, ό,τι κι αν λέει η συνταγή', () => {
    expect(tableUsesRail(preview(rows), 'rail')).toBe(true);
    expect(tableUsesRail(preview(rows), 'band')).toBe(false);
    expect(tableUsesRail(preview([axis, attr('x', ['1', '2', '3', '4'])]), 'rail')).toBe(false);
  });
});

describe('layoutTables — κεφαλίδες και τιμές', () => {
  it('μόνο οι ΑΡΧΙΚΕΣ γραμμές αξόνων επαναλαμβάνονται· άξονας πιο κάτω είναι σώμα', () => {
    const [table] = layoutTables(preview([axis, attr('x', ['1', '2', '3', '4']), { ...axis, id: 'a2' }]), { ...options, maxValueColumns: 4 });
    expect(table.rows.map((row) => row.header)).toEqual([true, false, false]);
  });

  it('η γραμμή τιμών έχει ρόλο `price` από δήλωση, ποτέ από το κείμενο', () => {
    const [table] = layoutTables(preview([attr('p', ['10', '20', '30', '40'])]), { ...options, maxValueColumns: 4, priceRowIds: new Set(['p']) });
    expect(table.rows[0].cells[1].role).toBe('price');
  });

  it('🔴 υποδείξεις σπασίματος και στα κελιά: «1058x596x250» δεν πατά το διπλανό κελί', () => {
    const [table] = layoutTables(preview([attr('d', ['1058x596x250', '2', '3', '4'])]), { ...options, maxValueColumns: 4 });
    expect(table.rows[0].cells[1].text).toBe(`1058x${ZERO_WIDTH_SPACE}596x${ZERO_WIDTH_SPACE}250`);
  });
});

describe('fitValueColumns / columnChunks', () => {
  it('μέσα στα όρια του εκδότη', () => {
    expect(fitValueColumns({ areaMm: 180, labelMm: 52, minColumnMm: 15 })).toBe(8);
    expect(fitValueColumns({ areaMm: 60, labelMm: 52, minColumnMm: 15 })).toBe(2);
    expect(fitValueColumns({ areaMm: 2000, labelMm: 52, minColumnMm: 15 })).toBe(14);
  });

  it('πίνακας χωρίς στήλες βγάζει ένα μπλοκ, όχι κανένα', () => {
    expect(columnChunks(0, 8)).toEqual([[0, 0]]);
  });

  it('🔴 ισομερής συνέχεια: ποτέ ορφανή στήλη απλωμένη σε όλο το πλάτος', () => {
    expect(columnChunks(8, 7)).toEqual([[0, 4], [4, 8]]);
    expect(columnChunks(9, 8)).toEqual([[0, 4], [4, 9]]);
    expect(columnChunks(7, 7)).toEqual([[0, 7]]);
  });

  it('`evenSegments`: κανένα στοιχείο δεν χάνεται, και κανένα τμήμα δεν ξεπερνά το όριο', () => {
    const items = Array.from({ length: 25 }, (_, index) => index);
    const segments = evenSegments(items, 20);
    expect(segments.map((segment) => segment.length)).toEqual([12, 13]);
    expect(segments.flat()).toEqual(items);
    expect(evenSegments([], 20)).toEqual([]);
  });
});

describe('withBreakHints', () => {
  it.each([
    ['1058x596x250', `1058x${ZERO_WIDTH_SPACE}596x${ZERO_WIDTH_SPACE}250`],
    ['3/4', `3/${ZERO_WIDTH_SPACE}4`],
    ['10×20', `10×${ZERO_WIDTH_SPACE}20`],
  ])('σπάει ανάμεσα σε ψηφία: %s', (input, expected) => {
    expect(withBreakHints(input)).toBe(expected);
  });

  it.each(['kW/m²', 'BAC-1-CI', 'x10', '230V-50Hz-1Ph'])('δεν αγγίζει ό,τι δεν είναι ψηφίο-προς-ψηφίο: %s', (input) => {
    expect(withBreakHints(input)).toBe(input);
  });
});

describe('μορφή el-GR', () => {
  it('ποσό με ομαδοποίηση και δύο δεκαδικά', () => {
    expect(formatPublicationPrice(123456, 'el')).toBe('1.234,56');
    expect(formatPublicationPrice(5000, 'en')).toBe('50.00');
  });

  it('🔴 η ημερομηνία δεν εξαρτάται από τη ζώνη ώρας της διεργασίας', () => {
    expect(formatPublicationDate('2026-11-01T00:00:00.000Z', 'el')).toBe('1/11/2026');
  });
});

describe('richTextBlocks', () => {
  it('παράγραφοι, έμφαση, λίστες', () => {
    const blocks = richTextBlocks('<p>Ένα <strong>β</strong></p><ul><li>α</li><li>γ</li></ul>');
    expect(blocks[0]).toEqual({ kind: 'paragraph', inlines: [{ text: 'Ένα ' }, { text: 'β', strong: true }] });
    expect(blocks[1]).toMatchObject({ kind: 'bullets', ordered: false });
    expect(blocks[1].kind === 'bullets' && blocks[1].items).toHaveLength(2);
  });

  it('🔒 κείμενο εκτός γλώσσας τυπώνεται ως απλή παράγραφος, δεν αναλύεται', () => {
    expect(richTextBlocks('<script>alert(1)</script>')).toEqual([{ kind: 'paragraph', inlines: [{ text: '<script>alert(1)</script>' }] }]);
  });

  it('αποκωδικοποιεί οντότητες και κρατά τον σύνδεσμο', () => {
    const [block] = richTextBlocks('<p><a href="https://a.gr">Α &amp; Β</a></p>');
    expect(block).toEqual({ kind: 'paragraph', inlines: [{ text: 'Α & Β', link: 'https://a.gr' }] });
  });
});
