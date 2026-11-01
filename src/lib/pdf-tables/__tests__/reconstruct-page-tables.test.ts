/**
 * Η ανασύνθεση πίνακα πάνω στο **πραγματικό** περιεχόμενο των σελίδων 85–86 της Aries (ADR-923 §5.5.1), χωρίς κανένα μοντέλο. Το
 * fixture το παράγει ο κώδικας της παραγωγής (`scripts/generate-catalog-page-fixture.cjs`). Οι ετικέτες είναι ανεξάρτητος μάρτυρας:
 * αν η γεωμετρία μετακινήσει κελί, κοκκινίζει η σύγκριση με αυτές.
 */

import ARIES from '@/subapps/catalog/__tests__/fixtures/aries-page-structure.data.json';
import { tokenizePage } from '@/subapps/catalog/import/page-tokens';
import { alignedTables } from '../aligned-grid';
import { cellText, tableCellAt } from '../cell-text';
import type { PageRule, PageTable, PageWord } from '../page-table-types';
import { reconstructPageTables } from '../reconstruct-page-tables';

type AriesPage = '85' | '86';

const wordsOf = (page: AriesPage): readonly PageWord[] => tokenizePage(ARIES[page].items);
const tablesOf = (page: AriesPage): PageTable[] =>
  reconstructPageTables({ words: wordsOf(page), rules: ARIES[page].rules as readonly PageRule[], tagTables: ARIES[page].tagTables });

const textAt = (table: PageTable, row: number, col: number): string => tableCellAt(table, row, col)?.text ?? '';
const rowTexts = (table: PageTable, row: number): readonly string[] => table.cells.filter((cell) => cell.row === row).map((cell) => cell.text);
const findRow = (table: PageTable, printed: string): number => {
  const cell = table.cells.find((candidate) => candidate.text === printed);
  if (!cell) throw new Error(`ο πίνακας δεν τυπώνει «${printed}»`);
  return cell.row;
};

describe.each([['85', 7], ['86', 4]] as const)('σελίδα %s', (page, variants) => {
  const tables = tablesOf(page);
  const [main, accessories] = tables;

  it('δύο πίνακες, χωριστοί: ο κύριος και τα εξαρτήματα δεν μπλέκουν τις στήλες τους', () => {
    expect(tables).toHaveLength(2);
    expect(main.source).toBe('ruled');
    expect(rowTexts(accessories, 0).filter((text) => text !== '')).toEqual(['ΚΩΔΙΚΟΣ', 'ΠΕΡΙΓΡΑΦΗ', 'ΤΙΜΗ (€)']);
    expect(rowTexts(main, 0)).toHaveLength(variants + 1);
  });

  it('οι ετικέτες, ανεξάρτητη πηγή, επιβεβαιώνουν ΚΑΘΕ κελί και των δύο πινάκων', () => {
    expect(tables.map((table) => table.witness)).toEqual(['agrees', 'agrees']);
  });
});

describe('ενώσεις κελιών', () => {
  const [main] = tablesOf('85');

  it('το «m³/h» καλύπτει και τις τρεις γραμμές H/M/L', () => {
    const unit = main.cells.find((cell) => cell.text === 'm³/h' && cell.rowSpan > 1);
    expect(unit?.rowSpan).toBe(3);
    const row = unit?.row ?? -1;
    expect(tableCellAt(main, row + 2, unit?.col ?? -1)).toBe(unit);
  });

  it('το «230V-50Hz-1Ph» ανήκει σε όλες τις παραλλαγές', () => {
    const voltage = main.cells.find((cell) => cell.text === '230V-50Hz-1Ph');
    expect(voltage?.colSpan).toBeGreaterThanOrEqual(7);
  });

  it('τιμή τυπωμένη σε δύο γραμμές μένει μία τιμή, και ετικέτα σε δύο γραμμές μένει δύο λέξεις', () => {
    expect(main.cells.some((cell) => cell.text === '858x596x250')).toBe(true);
    expect(main.cells.some((cell) => cell.text === 'ΠAΡΟΧΗ ΑΕΡΑ')).toBe(true);
  });
});

describe('κάθε τιμή στη γραμμή της', () => {
  const [main] = tablesOf('85');
  const [slim] = tablesOf('86');

  it('🔴 σελ. 85: 1458 W είναι ΤΗ Μ, στη στήλη του `099-01-001`', () => {
    const row = findRow(main, '1458');
    const col = main.cells.find((cell) => cell.text === '1458')?.col ?? -1;
    expect(rowTexts(main, row).slice(0, 3)).toEqual(['TH', 'M', 'W']);
    expect(textAt(main, findRow(main, '099-01-001'), col)).toBe('099-01-001');
    expect(textAt(main, 0, col)).toBe('MFP-34ΤΜ');
  });

  it('🔴 σελ. 86: 1000 με W στη γραμμή του, 3412 με Btu/h στην επόμενη', () => {
    // Η ενωμένη ετικέτα «ΑΠΟΔΟΣΗ ΨΥΞΗΣ» ξεκινά στη γραμμή του 1000: το κελί ανήκει στη γραμμή όπου αρχίζει.
    expect(rowTexts(slim, findRow(slim, '1000')).slice(1, 4)).toEqual(['ΤΗ', 'Η', 'W']);
    expect(rowTexts(slim, findRow(slim, '3412')).slice(0, 3)).toEqual(['ΤΗ', 'Η', 'Btu/h']);
  });
});

describe('καμία ψευδής δομή', () => {
  it('πλαίσιο φωτογραφίας ή μόνο του κουτί δεν γίνεται πίνακας', () => {
    const box: readonly PageRule[] = [
      { axis: 'h', at: 0.1, from: 0.1, to: 0.5 }, { axis: 'h', at: 0.3, from: 0.1, to: 0.5 },
      { axis: 'v', at: 0.1, from: 0.1, to: 0.3 }, { axis: 'v', at: 0.5, from: 0.1, to: 0.3 },
    ];
    const words = [{ id: 't1', text: 'κείμενο', x: 0.2, y: 0.2, width: 0.1, height: 0.01 }];
    expect(reconstructPageTables({ words, rules: box, tagTables: [] })).toEqual([]);
  });

  it('χωρίς ετικέτες δεν υπάρχει μάρτυρας, όχι διαφωνία', () => {
    const tables = reconstructPageTables({ words: wordsOf('85'), rules: ARIES['85'].rules as readonly PageRule[], tagTables: [] });
    expect(tables.map((table) => table.witness)).toEqual(['absent', 'absent']);
  });

  it('🔴 ετικέτες που λένε άλλο κελί: διαφωνία, ποτέ σιωπηλή εμπιστοσύνη', () => {
    const tagTables = ARIES['85'].tagTables.map((table) => ({ rows: table.rows.map((row) => row.map((text) => (text === '1458' ? '1485' : text))) }));
    const [main] = reconstructPageTables({ words: wordsOf('85'), rules: ARIES['85'].rules as readonly PageRule[], tagTables });
    expect(main.witness).toBe('disputed');
  });
});

describe('χωρίς γραμμές: στοίχιση', () => {
  it('🔴 οι ίδιοι αριθμοί μένουν στη στήλη τους όταν αφαιρεθούν όλες οι γραμμές', () => {
    const [table] = alignedTables(wordsOf('85')).filter((candidate) => candidate.cells.some((cell) => cell.text === '1458'));
    expect(table?.source).toBe('aligned');
    const [thousand] = [table.cells.find((cell) => cell.text === '1800')];
    const sameColumn = table.cells.filter((cell) => cell.col === thousand?.col).map((cell) => cell.text);
    expect(sameColumn).toEqual(expect.arrayContaining(['1800', '6142', '1458', '1134']));
  });

  it('παράγραφος δεν γίνεται πίνακας', () => {
    const lines = [0.1, 0.12, 0.14, 0.16].map((y, index) => ({ id: `t${index}`, text: 'μια μόνο φράση', x: 0.1, y, width: 0.5, height: 0.01 }));
    expect(alignedTables(lines)).toEqual([]);
  });
});

describe('κείμενο κελιού', () => {
  it('κομμάτια χωρίς κενό ενώνονται: το «m³/h» δεν γίνεται τρεις λέξεις', () => {
    const word = (id: string, text: string, x: number, width: number) => ({ id, text, x, y: 0.1, width, height: 0.01 });
    expect(cellText([word('a', 'm', 0.2, 0.014), word('b', '³', 0.214, 0.007), word('c', '/h', 0.221, 0.016)])).toBe('m³/h');
    expect(cellText([word('a', 'dn', 0.2, 0.02), word('b', '20', 0.23, 0.02)])).toBe('dn 20');
  });
});
