/**
 * 🔴 ADR-739 §69 — **ΤΟ ΠΛΑΙΣΙΟ ΟΝΟΜΑΤΟΣ ΣΤΗΝ ΟΘΟΝΗ**: τι διαβάζει και τι δέχεται ο άνθρωπος.
 *
 * Η σύρση εδώ **εκτελείται** (`startTableCellDrag` + πραγματικά συμβάντα ποντικιού) αντί να
 * γραφτεί το store με το χέρι. Η διαφορά είναι το νόημα του test: μια απευθείας εγγραφή θα
 * έμενε πράσινη ακόμα κι αν **καμία** χειρονομία δεν ανακοίνωνε ποτέ τίποτα — δηλαδή θα
 * επικύρωνε τη μετάφραση και θα άφηνε το ράψιμο ακάλυπτο, που είναι το μισό της αλλαγής.
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({
  // Το κλειδί **είναι** η απόδοση, με τις παραμέτρους δίπλα: έτσι ένα κλειδί που λείπει από
  // τα locales φαίνεται ως κλειδί στο assertion αντί να πέσει σε σιωπηλό κενό (N.11).
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key}(${Object.values(values).join(',')})` : key,
  }),
}));

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { TableNameBox } from '../TableNameBox';
import {
  endTableCellDrag,
  startTableCellDrag,
  TABLE_DRAG_SIZE_AS_DRAGGED,
} from '../table-cell-drag-session';
import { __resetTableDragSpanStoreForTests } from '../../../state/table-drag-span-store';
import { createTableModel } from '../../../bim/table/table-model-helpers';
import type { TableCellReference } from '../../../bim/table/table-cell-reference';
import type { TableCellRef } from '../../../bim/table/table-cell-range';
import type { TableColumn, TableColumnId, TableRow, TableRowId } from '../../../types/table';

jest.mock('../../../state/table-cell-cursor-store', () => ({
  setTableCellSelection: jest.fn(),
}));

const MODEL = createTableModel({
  columns: ['c0', 'c1', 'c2'].map((id): TableColumn => ({
    id, sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'text', align: 'left',
  })),
  rows: ['r0', 'r1', 'r2', 'r3'].map((id): TableRow => ({ id, rowClass: 'data', heightMm: 8 })),
});

const REFERENCE: TableCellReference = { a1: 'B2', anchorA1: 'B2', columnHeader: 'ΠΕΡΙΓΡΑΦΗ' };

const ref = (rowId: string, colId: string): TableCellRef => ({
  rowId: rowId as TableRowId,
  colId: colId as TableColumnId,
});

const CONTAINER = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800 }),
} as unknown as HTMLElement;

function mount(onGoTo: (text: string) => boolean = () => true): HTMLInputElement {
  render(<TableNameBox model={MODEL} reference={REFERENCE} onGoTo={onGoTo} />);
  const field = screen.getByLabelText('table.formulaBar.referenceAriaLabel');
  if (!(field instanceof HTMLInputElement)) throw new Error('το πλαίσιο ονόματος δεν αποδόθηκε');
  return field;
}

/** Ξεκινά **αληθινή** σύρση `r1,c1 → to` και στέλνει την κίνηση που τη μετακινεί. */
function dragTo(to: TableCellRef): void {
  startTableCellDrag({
    anchor: ref('r1', 'c1'),
    container: CONTAINER,
    kind: 'range',
    sizeReadout: TABLE_DRAG_SIZE_AS_DRAGGED,
    resolveAt: () => to,
  });
  fireEvent(document, new MouseEvent('mousemove', { buttons: 1, bubbles: true, clientX: 500, clientY: 400 }));
}

afterEach(() => {
  endTableCellDrag();
  __resetTableDragSpanStoreForTests();
});

describe('🔴 §69 — τι δείχνει το πλαίσιο ονόματος', () => {
  it('σε ηρεμία: η διεύθυνση του ενεργού κελιού + η κεφαλίδα ως συμφραζόμενο', () => {
    expect(mount().value).toBe('B2');
    expect(screen.getByText('ΠΕΡΙΓΡΑΦΗ')).toBeInTheDocument();
  });

  it('🔴 ΟΣΟ ΣΕΡΝΕΤΑΙ: `2R x 2C` — το μέγεθος, όχι η διεύθυνση', () => {
    const field = mount();
    dragTo(ref('r2', 'c2'));
    expect(field.value).toBe('table.formulaBar.dragSize(2,2)');
  });

  it('🔴 ΜΟΛΙΣ ΑΦΗΣΕΙ: επιστρέφει η διεύθυνση (Excel)', () => {
    const field = mount();
    dragTo(ref('r2', 'c2'));
    fireEvent(document, new MouseEvent('mouseup', { bubbles: true }));
    expect(field.value).toBe('B2');
  });

  it('🔴 όσο σέρνεται το πεδίο είναι ΜΟΝΟ ΓΙΑ ΑΝΑΓΝΩΣΗ — δεν πληκτρολογείς σε μέτρηση', () => {
    const field = mount();
    dragTo(ref('r2', 'c2'));
    expect(field.readOnly).toBe(true);
  });

  it('🔴 η κεφαλίδα ΚΡΥΒΕΤΑΙ όσο σέρνεται — δεν υπάρχει ΜΙΑ στήλη να ονομαστεί', () => {
    mount();
    dragTo(ref('r2', 'c2'));
    expect(screen.queryByText('ΠΕΡΙΓΡΑΦΗ')).not.toBeInTheDocument();
  });
});

describe('🔴 §69 — το πλαίσιο ονόματος ως ΠΟΡΤΑ', () => {
  it('πληκτρολογείς και το πεδίο σε ακολουθεί — δεν σου σβήνει τα γράμματα', () => {
    const field = mount();
    fireEvent.change(field, { target: { value: 'B7' } });
    expect(field.value).toBe('B7');
  });

  it('🔴 `Enter` ζητά τη μετάβαση με ΑΚΡΙΒΩΣ ό,τι γράφτηκε, και επιστρέφει την αλήθεια', () => {
    const goTo = jest.fn(() => true);
    const field = mount(goTo);
    fireEvent.change(field, { target: { value: 'B7' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(goTo).toHaveBeenCalledWith('B7');
    // Το πεδίο ξαναδείχνει τη **νέα** αλήθεια — που εδώ έρχεται από το `reference` prop, άρα
    // παραμένει `B2`: η μετακίνηση του δρομέα ανήκει στον καλούντα, όχι στο φύλλο.
    expect(field.value).toBe('B2');
  });

  it('🔴 άκυρη αναφορά: το πεδίο επαναφέρεται και ΤΙΠΟΤΑ δεν μετακινείται', () => {
    const goTo = jest.fn(() => false);
    const field = mount(goTo);
    fireEvent.change(field, { target: { value: 'ΣΥΝΟΛΟ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(goTo).toHaveBeenCalledWith('ΣΥΝΟΛΟ');
    expect(field.value).toBe('B2');
  });

  it('🔴 `Escape` ακυρώνει ΧΩΡΙΣ μετάβαση, και ΔΕΝ φτάνει στον escape-bus', () => {
    const goTo = jest.fn(() => true);
    const field = mount(goTo);
    fireEvent.change(field, { target: { value: 'B7' } });
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    fireEvent(field, event);
    expect(goTo).not.toHaveBeenCalled();
    expect(field.value).toBe('B2');
    // Αν το `Escape` συνέχιζε προς τα πάνω, ο κοινός χειριστής θα ακύρωνε τη **συνεδρία
    // γραφής του κελιού** — δηλαδή θα πετούσε δουλειά που ζει σε άλλο κουτί.
    expect(event.defaultPrevented).toBe(true);
  });

  it('🔴 φυγή εστίασης ΧΩΡΙΣ `Enter`: καμία μετάβαση (Excel) — ήταν πρόθεση, όχι εντολή', () => {
    const goTo = jest.fn(() => true);
    const field = mount(goTo);
    fireEvent.change(field, { target: { value: 'B7' } });
    fireEvent.blur(field);
    expect(goTo).not.toHaveBeenCalled();
    expect(field.value).toBe('B2');
  });

  it('🔴 φέρει το σημάδι συνεδρίας — αλλιώς η εστίαση σε αυτό ΚΛΕΙΝΕΙ τον δρομέα', () => {
    expect(mount().dataset.tableCellCursor).toBe('true');
  });
});
