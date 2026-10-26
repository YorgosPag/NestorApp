/**
 * ADR-923 §5.10.4 Β1 — το γενικό πλέγμα δεδομένων σε jsdom: πληκτρολόγιο Excel, εγγενές πρόχειρο TSV, κλειδωμένα
 * κελιά, ευρήματα, αναίρεση μέσω του καταναλωτή, `aria-*` του APG, virtualization.
 */
import React, { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import { TooltipProvider } from '@/components/ui/tooltip';
import { emptyHistory, recordHistory, redoHistory, undoHistory, type History } from '@/lib/spreadsheet/grid-history';

import { DataGrid } from '../DataGrid';
import type { DataGridChange, DataGridColumn, DataGridWords } from '../data-grid-types';
import { DATA_GRID_ROW_PX, VIRTUALIZE_ABOVE_ROWS } from '../use-grid-virtual-rows';

interface Row { readonly id: string; readonly code: string; readonly watts: number | null; readonly on: boolean; readonly inherited: boolean }

const WORDS: DataGridWords = {
  pasted: (report, rejected) => `pasted ${report.offeredRows}x${report.offeredCols} +${report.appendedRows} clip ${report.clippedRows}/${report.clippedCols} rejected ${rejected}`,
  locked: (reason) => `locked: ${reason}`,
  choicesLabel: (column) => `choices ${column}`,
  empty: 'empty',
};

const COLUMNS: readonly DataGridColumn<Row>[] = [
  { id: 'code', header: 'Code', label: 'Code', width: 'md', text: (row) => row.code,
    parse: (text, row) => ({ ok: true, row: { ...row, code: text.trim() } }) },
  { id: 'watts', header: 'W', label: 'Watts', width: 'sm', align: 'end', text: (row) => (row.watts === null ? '' : String(row.watts)),
    parse: (text, row) => {
      if (text.trim() === '') return { ok: true, row: { ...row, watts: null } };
      const value = Number(text.replace(',', '.'));
      return Number.isFinite(value) ? { ok: true, row: { ...row, watts: value } } : { ok: false, issue: `not a number: ${text}` };
    },
    lock: (row) => (row.inherited ? { reason: 'MFP-TM' } : null) },
  { id: 'on', header: 'On', label: 'On', width: 'xs', text: (row) => (row.on ? 'yes' : 'no'),
    parse: (text, row) => (text === 'yes' || text === 'no' ? { ok: true, row: { ...row, on: text === 'yes' } } : { ok: false, issue: 'yes/no' }),
    toggle: (row) => ({ ...row, on: !row.on }) },
];

const seed = (count: number, over: Partial<Row> = {}): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: `r${i}`, code: `c${i}`, watts: i * 10, on: false, inherited: false, ...over }));

let changes: DataGridChange<Row>[] = [];

function Harness({ initial }: { readonly initial: Row[] }) {
  const [rows, setRows] = useState<readonly Row[]>(initial);
  const [history, setHistory] = useState<History<readonly Row[]>>(emptyHistory());
  const step = (next: { history: History<readonly Row[]>; apply: readonly Row[] | null }) => {
    setHistory(next.history);
    if (next.apply) setRows(next.apply);
  };
  return (
    <TooltipProvider>
      <DataGrid<Row> label="grid" rows={rows} rowKey={(row) => row.id} columns={COLUMNS} words={WORDS} maxRows={6}
        createRow={(i) => ({ id: `new${i}`, code: '', watts: null, on: false, inherited: false })}
        issuesOf={(row, _i, col) => (col === 'code' && row.code === 'bad' ? ['dup code'] : [])}
        onChange={(change) => { changes.push(change); setHistory(recordHistory(history, { before: rows, after: change.rows })); setRows(change.rows); }}
        onUndo={() => step(undoHistory(history))} onRedo={() => step(redoHistory(history))} />
      <output data-testid="dump">{rows.map((r) => `${r.code}|${r.watts ?? ''}|${r.on ? 1 : 0}`).join(';')}</output>
    </TooltipProvider>
  );
}

const dump = () => screen.getByTestId('dump').textContent;
const grid = () => screen.getByRole('grid');
const activeInput = () => grid().querySelector('input') as HTMLInputElement;
const key = (k: string, extra: Partial<KeyboardEventInit> & { code?: string } = {}) => fireEvent.keyDown(activeInput() ?? grid(), { key: k, ...extra });
const clipboard = (text = '') => {
  const data = new Map<string, string>([['text/plain', text]]);
  return { getData: (type: string) => data.get(type) ?? '', setData: (type: string, value: string) => { data.set(type, value); }, data };
};

function focusFirst() {
  fireEvent.pointerDown(within(grid()).getAllByRole('gridcell')[0], { button: 0 });
  act(() => activeInput().focus());
}

beforeEach(() => { changes = []; });

describe('DataGrid — APG grid', () => {
  it('ρόλοι + aria-rowcount/colcount/rowindex/colindex · ενεργό κελί με όνομα στήλης', () => {
    render(<Harness initial={seed(3)} />);
    expect(grid().getAttribute('aria-rowcount')).toBe('4');
    expect(grid().getAttribute('aria-colcount')).toBe('3');
    const rows = within(grid()).getAllByRole('row');
    expect(rows[1].getAttribute('aria-rowindex')).toBe('2');
    expect(within(rows[1]).getAllByRole('gridcell')[2].getAttribute('aria-colindex')).toBe('3');
    expect(screen.getByRole('textbox', { name: 'Code' })).toBeTruthy();
  });
});

describe('DataGrid — πληκτρολόγιο του Excel', () => {
  it('πληκτρολόγηση σε πλοήγηση ⇒ γραφή · Enter δεσμεύει και κατεβαίνει · Tab κρατά τη στήλη αγκύρωσης', () => {
    render(<Harness initial={seed(3)} />);
    focusFirst();
    fireEvent.change(activeInput(), { target: { value: 'MFP' } });
    key('Tab');
    expect(screen.getByRole('textbox', { name: 'Watts' })).toBeTruthy();
    fireEvent.change(activeInput(), { target: { value: '2,5' } });
    key('Enter');
    expect(dump()).toBe('MFP|2.5|0;c1|10|0;c2|20|0');
    expect(screen.getByRole('textbox', { name: 'Code' })).toBeTruthy();
    expect(changes.map((c) => c.kind)).toEqual(['type', 'type']);
  });

  it('απορριπτέο κείμενο ⇒ ΔΕΝ δεσμεύεται, ΔΕΝ κινείται, το μήνυμα στο κελί · Esc ακυρώνει και καταναλώνεται', () => {
    render(<Harness initial={seed(2)} />);
    focusFirst();
    key('ArrowRight');
    fireEvent.change(activeInput(), { target: { value: 'abc' } });
    key('Enter');
    expect(dump()).toBe('c0|0|0;c1|10|0');
    expect(activeInput().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getAllByText('not a number: abc').length).toBeGreaterThan(0);
    const outer = jest.fn();
    document.addEventListener('keydown', outer);
    key('Escape');
    expect(outer).not.toHaveBeenCalled();
    key('Escape');
    expect(outer).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', outer);
    expect(activeInput().value).toBe('');
  });

  it('F2 ξεκινά με το κείμενο του κελιού · Delete αδειάζει την επιλογή · Ctrl+D γεμίζει προς τα κάτω (φυσική θέση)', () => {
    render(<Harness initial={seed(3)} />);
    focusFirst();
    key('F2');
    expect(activeInput().value).toBe('c0');
    key('Escape');
    key('ArrowRight');
    key('ArrowDown', { shiftKey: true });
    key('ArrowDown', { shiftKey: true });
    key('δ', { ctrlKey: true, code: 'KeyD' });
    expect(dump()).toBe('c0|0|0;c1|0|0;c2|0|0');
    key('Delete');
    expect(dump()).toBe('c0||0;c1||0;c2||0');
  });

  it('Space εναλλάσσει διακόπτη · σε στήλη κειμένου το κενό ΔΕΝ καταπίνεται', () => {
    render(<Harness initial={seed(1)} />);
    focusFirst();
    expect(key(' ')).toBe(true);
    key('End');
    expect(key(' ')).toBe(false);
    expect(dump()).toBe('c0|0|1');
  });

  it('Ctrl+Z / Ctrl+Y μέσω του καταναλωτή — μία ενέργεια = μία αναίρεση (ελληνική διάταξη)', () => {
    render(<Harness initial={seed(2)} />);
    focusFirst();
    act(() => { grid().dispatchEvent(new Event('noop')); });
    fireEvent.paste(activeInput(), { clipboardData: clipboard('A\t1\nB\t2') });
    expect(dump()).toBe('A|1|0;B|2|0');
    key('ζ', { ctrlKey: true, code: 'KeyZ' });
    expect(dump()).toBe('c0|0|0;c1|10|0');
    key('υ', { ctrlKey: true, code: 'KeyY' });
    expect(dump()).toBe('A|1|0;B|2|0');
  });

  it('Tab στην τελευταία θέση ΒΓΑΙΝΕΙ από το πλέγμα (καμία παγίδα πληκτρολογίου)', () => {
    render(<Harness initial={seed(1)} />);
    focusFirst();
    key('End');
    expect(key('Tab')).toBe(true);
  });
});

describe('DataGrid — εγγενές πρόχειρο', () => {
  it('επικόλληση TSV του Excel: εισαγωγικά, νέες γραμμές ως το maxRows, αποκοπή στηλών ΔΗΛΩΜΕΝΗ', () => {
    render(<Harness initial={seed(1)} />);
    focusFirst();
    fireEvent.paste(activeInput(), { clipboardData: clipboard('"X ""1"""\t5\tyes\textra\r\nY\t6\tno\textra\r\n') });
    expect(dump()).toBe('X "1"|5|1;Y|6|0');
    expect(changes[0]).toMatchObject({ kind: 'paste', report: { appendedRows: 1, clippedCols: 1 } });
    expect(screen.getByText('pasted 2x4 +1 clip 0/1 rejected 0')).toBeTruthy();
  });

  it('κελιά που απορρίπτουν το κείμενο μένουν ως ήταν και ΜΕΤΡΩΝΤΑΙ', () => {
    render(<Harness initial={seed(2)} />);
    focusFirst();
    key('ArrowRight');
    fireEvent.paste(activeInput(), { clipboardData: clipboard('7\nlol') });
    expect(dump()).toBe('c0|7|0;c1|10|0');
    expect(changes[0].rejected).toEqual([expect.objectContaining({ row: 1, columnId: 'watts', text: 'lol' })]);
  });

  it('αντιγραφή εύρους = TSV που ξαναδιαβάζεται ίδιο · αποκοπή αδειάζει', () => {
    render(<Harness initial={seed(2)} />);
    focusFirst();
    key('ArrowRight', { shiftKey: true });
    key('ArrowDown', { shiftKey: true });
    const copied = clipboard();
    expect(fireEvent.copy(activeInput(), { clipboardData: copied })).toBe(false);
    expect(copied.data.get('text/plain')).toBe('c0\t0\r\nc1\t10');
    fireEvent.cut(activeInput(), { clipboardData: clipboard() });
    expect(dump()).toBe('||0;||0');
  });

  it('σε γραφή το πρόχειρο ανήκει στο ΚΕΙΜΕΝΟ του πεδίου (κανένα preventDefault)', () => {
    render(<Harness initial={seed(1)} />);
    focusFirst();
    key('F2');
    expect(fireEvent.paste(activeInput(), { clipboardData: clipboard('zzz') })).toBe(true);
    expect(changes).toEqual([]);
  });
});

describe('DataGrid — κλειδωμένα (κληρονομημένα) κελιά', () => {
  it('aria-readonly + λόγος · επικόλληση τα ΠΑΡΑΛΕΙΠΕΙ και τα μετρά · F2 δεν ανοίγει γραφή', () => {
    render(<Harness initial={seed(1, { inherited: true })} />);
    const cell = within(grid()).getAllByRole('gridcell')[1];
    expect(cell.getAttribute('aria-readonly')).toBe('true');
    expect(within(cell).getByText('locked: MFP-TM')).toBeTruthy();
    focusFirst();
    fireEvent.paste(activeInput(), { clipboardData: clipboard('K\t99') });
    expect(dump()).toBe('K|0|0');
    expect(changes[0].report?.skippedReadOnly).toBe(1);
    key('ArrowRight');
    key('F2');
    expect(activeInput().value).toBe('');
  });

  it('ευρήματα του καταναλωτή στο κελί: aria-invalid + περιγραφή', () => {
    render(<Harness initial={seed(1, { code: 'bad' })} />);
    const cell = within(grid()).getAllByRole('gridcell')[0];
    expect(cell.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(cell.getAttribute('aria-describedby')!)?.textContent).toBe('dup code');
  });
});

describe('DataGrid — virtualization', () => {
  it(`πάνω από ${VIRTUALIZE_ABOVE_ROWS} γραμμές: όχι όλες στο DOM, αλλά aria-rowcount = όλες και σωστά aria-rowindex`, () => {
    const many = seed(500);
    // Το jsdom δεν έχει διάταξη (`offsetHeight` = 0) — ο virtualizer μετρά το παράθυρο ακριβώς έτσι.
    const height = jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(20 * DATA_GRID_ROW_PX);
    render(<DataGrid<Row> label="big" rows={many} rowKey={(row) => row.id} columns={COLUMNS} words={WORDS} />);
    const rendered = within(grid()).getAllByRole('row').filter((row) => row.getAttribute('aria-rowindex') !== '1');
    expect(rendered.length).toBeLessThan(many.length);
    expect(grid().getAttribute('aria-rowcount')).toBe('501');
    expect(rendered[0].getAttribute('aria-rowindex')).toBe('2');
    height.mockRestore();
  });

  it('πρώτο καρέ (SSR, πριν μετρηθεί το παράθυρο) ⇒ ΓΡΑΜΜΕΣ, όχι κενός πίνακας', () => {
    const html = renderToString(<DataGrid<Row> label="ssr" rows={seed(500)} rowKey={(row) => row.id} columns={COLUMNS} words={WORDS} />);
    expect(html).toContain('aria-rowindex="2"');
    expect(html).not.toContain('aria-rowindex="501"');
  });

  it(`ως ${VIRTUALIZE_ABOVE_ROWS} γραμμές: ΟΛΕΣ στο DOM (Ctrl+F, αναγνώστες οθόνης) · το ύψος γραμμής = h-9`, () => {
    render(<DataGrid<Row> label="small" rows={seed(VIRTUALIZE_ABOVE_ROWS)} rowKey={(row) => row.id} columns={COLUMNS} words={WORDS} />);
    expect(within(grid()).getAllByRole('row')).toHaveLength(VIRTUALIZE_ABOVE_ROWS + 1);
    expect(within(grid()).getAllByRole('gridcell')[0].className).toContain(`h-${DATA_GRID_ROW_PX / 4}`);
  });

  it('πλέγμα μόνο για ανάγνωση: aria-readonly, καμία γραφή, Enter ενεργοποιεί τη γραμμή', () => {
    const open = jest.fn();
    render(<DataGrid<Row> label="ro" rows={seed(2)} rowKey={(row) => row.id} columns={COLUMNS} words={WORDS} onActivateRow={open} />);
    expect(grid().getAttribute('aria-readonly')).toBe('true');
    focusFirst();
    fireEvent.change(activeInput(), { target: { value: 'x' } });
    expect(activeInput().value).toBe('');
    key('ArrowDown');
    key('Enter');
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }), 1);
    fireEvent.doubleClick(within(grid()).getAllByRole('gridcell')[0]);
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'r0' }), 0);
  });
});
