/**
 * ADR-923 §5.10.4 Β1 — σχέδιο επικόλλησης / Ctrl+D / αντιγραφή + στοίβα αναίρεσης.
 */
import { canRedo, canUndo, emptyHistory, recordHistory, redoHistory, undoHistory } from '../grid-history';
import { clipboardGrid, planFillDown, planPaste, rangeToGrid } from '../paste-plan';
import { formatTsv } from '../tsv';

/** Όπως το γράφει το Excel: CRLF, κελί με αλλαγή γραμμής και εισαγωγικά σε «"…"», τελικό CRLF. */
const EXCEL = 'MFP 1\t"2,50"\t"Σημ. ""Α""\r\nγραμμή 2"\r\nMFP 2\t3,10\t\r\n';

const size = { rows: 3, cols: 3 };
const one = (row: number, col: number) => ({ top: row, left: col, bottom: row, right: col });
const texts = (plan: ReturnType<typeof planPaste>) => plan.cells.map((cell) => `${cell.row},${cell.col}=${cell.text}`);

describe('clipboardGrid — ο ΥΠΑΡΧΩΝ αναλυτής, ορθογώνιο', () => {
  it('πραγματικό TSV του Excel: εισαγωγικά, αλλαγή γραμμής μέσα σε κελί, κενό τελευταίο κελί', () => {
    expect(clipboardGrid(EXCEL)).toEqual([
      ['MFP 1', '2,50', 'Σημ. "Α"\r\nγραμμή 2'],
      ['MFP 2', '3,10', ''],
    ]);
    expect(clipboardGrid('')).toEqual([]);
  });
});

describe('planPaste', () => {
  it('μπλοκ από την άγκυρα · γραμμές πέρα από το τέλος ⇒ ΝΕΕΣ γραμμές όταν επιτρέπεται', () => {
    const plan = planPaste(clipboardGrid(EXCEL), one(2, 0), { size, appendableRows: 5 });
    expect(texts(plan)).toEqual(['2,0=MFP 1', '2,1=2,50', '2,2=Σημ. "Α"\r\nγραμμή 2', '3,0=MFP 2', '3,1=3,10', '3,2=']);
    expect(plan.report).toMatchObject({ appendedRows: 1, clippedRows: 0, clippedCols: 0 });
    expect(plan.range).toEqual({ top: 2, left: 0, bottom: 3, right: 2 });
  });

  it('χωρίς άδεια προσθήκης ⇒ ΔΗΛΩΜΕΝΗ αποκοπή γραμμών και στηλών (ποτέ σιωπηλά)', () => {
    const plan = planPaste(clipboardGrid(EXCEL), one(2, 1), { size });
    expect(texts(plan)).toEqual(['2,1=MFP 1', '2,2=2,50']);
    expect(plan.report).toMatchObject({ appendedRows: 0, clippedRows: 1, clippedCols: 1, offeredRows: 2, offeredCols: 3 });
  });

  it('μία τιμή ⇒ γεμίζει ΟΛΗ την επιλογή', () => {
    const plan = planPaste(clipboardGrid('7'), { top: 0, left: 0, bottom: 1, right: 1 }, { size });
    expect(texts(plan)).toEqual(['0,0=7', '0,1=7', '1,0=7', '1,1=7']);
  });

  it('μπλοκ 1×2 σε επιλογή 2×2 (πολλαπλάσιο) ⇒ πλακίδια · σε 3×3 (όχι πολλαπλάσιο) ⇒ μία φορά', () => {
    const tiled = planPaste(clipboardGrid('a\tb'), { top: 0, left: 0, bottom: 1, right: 1 }, { size });
    expect(texts(tiled)).toEqual(['0,0=a', '0,1=b', '1,0=a', '1,1=b']);
    const once = planPaste(clipboardGrid('a\tb'), { top: 0, left: 0, bottom: 2, right: 2 }, { size });
    expect(texts(once)).toEqual(['0,0=a', '0,1=b']);
  });

  it('κελιά μόνο για ανάγνωση (κληρονομημένα) ΠΑΡΑΛΕΙΠΟΝΤΑΙ και ΜΕΤΡΩΝΤΑΙ', () => {
    const plan = planPaste(clipboardGrid('x\ty'), one(0, 0), { size, isReadOnly: (cell) => cell.col === 0 });
    expect(texts(plan)).toEqual(['0,1=y']);
    expect(plan.report.skippedReadOnly).toBe(1);
  });

  it('κενό πρόχειρο ⇒ τίποτα, χωρίς εύρος', () => {
    expect(planPaste([], one(0, 0), { size })).toMatchObject({ cells: [], range: null });
  });
});

describe('planFillDown — Ctrl+D', () => {
  const grid = [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']];
  const textAt = (cell: { row: number; col: number }) => grid[cell.row][cell.col];

  it('πολλές γραμμές ⇒ η ΠΡΩΤΗ της επιλογής προς τις υπόλοιπες', () => {
    expect(texts(planFillDown({ top: 0, left: 1, bottom: 2, right: 2 }, textAt))).toEqual(['1,1=b', '1,2=c', '2,1=b', '2,2=c']);
  });
  it('μία γραμμή ⇒ η γραμμή ΑΠΟ ΠΑΝΩ · στην πρώτη γραμμή ⇒ τίποτα', () => {
    expect(texts(planFillDown(one(2, 0), textAt))).toEqual(['2,0=d']);
    expect(planFillDown(one(0, 0), textAt).cells).toEqual([]);
  });
});

describe('rangeToGrid + formatTsv — αντιγραφή που το Excel ξαναδιαβάζει ίδια', () => {
  it('round-trip μέσα από τον ίδιο αναλυτή', () => {
    const grid = clipboardGrid(EXCEL);
    const copied = formatTsv(rangeToGrid({ top: 0, left: 0, bottom: 1, right: 2 }, (cell) => grid[cell.row][cell.col]));
    expect(clipboardGrid(copied)).toEqual(grid);
  });
});

describe('grid-history', () => {
  it('μία ενέργεια = μία μονάδα · νέα ενέργεια σβήνει το μέλλον · όριο', () => {
    let history = recordHistory(recordHistory(emptyHistory<string>(2), { before: 'a', after: 'b' }), { before: 'b', after: 'c' });
    const undone = undoHistory(history);
    expect(undone.apply).toBe('b');
    expect(canRedo(undone.history)).toBe(true);
    expect(redoHistory(undone.history).apply).toBe('c');
    history = recordHistory(undone.history, { before: 'b', after: 'x' });
    expect(canRedo(history)).toBe(false);
    history = recordHistory(history, { before: 'x', after: 'y' });
    expect(history.past.map((entry) => entry.after)).toEqual(['x', 'y']);
  });
  it('άδεια στοίβα ⇒ τίποτα να εφαρμοστεί, ίδια στοίβα', () => {
    const empty = emptyHistory<string>();
    expect(undoHistory(empty)).toEqual({ history: empty, apply: null });
    expect(redoHistory(empty).apply).toBeNull();
    expect(canUndo(empty)).toBe(false);
  });
});
