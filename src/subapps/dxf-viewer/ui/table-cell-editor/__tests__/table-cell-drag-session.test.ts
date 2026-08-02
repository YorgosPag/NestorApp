/**
 * 🔴 ADR-739 §27.15 — **η σύρση επιλογής** ως εκτελέσιμη προδιαγραφή.
 *
 * Το store είναι mock-αρισμένο **επίτηδες**: το ζητούμενο εδώ δεν είναι «τι κατάσταση
 * έμεινε» (αυτό το κλειδώνει το `table-cell-range.test.ts`) αλλά «**πόσες φορές γράφτηκε**».
 * Ο φύλακας «γράψε μόνο όταν αλλάξει κελί» είναι απόφαση **απόδοσης** (ADR-735): με 60-120
 * συμβάντα/δευτ., μια εγγραφή ανά pixel ζητά επαναβαφή σκηνής ανά pixel. Ένα test κατάστασης
 * θα ήταν **πράσινο** και στις δύο υλοποιήσεις — δηλαδή δεν θα έλεγχε τίποτα.
 */

import {
  endTableCellDrag,
  isTableCellDragActive,
  startTableCellDrag,
} from '../table-cell-drag-session';
import { setTableCellSelection } from '../../../state/table-cell-cursor-store';
import type { TableCellRef } from '../../../bim/table/table-cell-range';
import type { TableColumnId, TableRowId } from '../../../types/table';

jest.mock('../../../state/table-cell-cursor-store', () => ({
  setTableCellSelection: jest.fn(),
}));

const write = setTableCellSelection as jest.MockedFunction<typeof setTableCellSelection>;

const ref = (rowId: string, colId: string): TableCellRef => ({
  rowId: rowId as TableRowId,
  colId: colId as TableColumnId,
});

const ANCHOR = ref('r1', 'c1');

/** Κίνηση με **πατημένο** αριστερό κουμπί — ό,τι στέλνει ο browser κατά τη σύρση. */
function move(): void {
  document.dispatchEvent(new MouseEvent('mousemove', { buttons: 1, bubbles: true }));
}

afterEach(() => {
  endTableCellDrag();
  write.mockClear();
});

describe('startTableCellDrag — το κινούμενο άκρο ακολουθεί το χέρι', () => {
  it('σύρση σε ΑΛΛΟ κελί γράφει επιλογή με άγκυρα το κελί ΕΚΚΙΝΗΣΗΣ', () => {
    startTableCellDrag({ anchor: ANCHOR, kind: 'range', resolveAt: () => ref('r3', 'c2') });
    move();
    expect(write).toHaveBeenCalledTimes(1);
    // Excel: μετά τη σύρση `A1→F1`, ενεργό κελί παραμένει το `A1`. Η άγκυρα ΜΕΝΕΙ.
    expect(write).toHaveBeenCalledWith({ from: ANCHOR, to: ref('r3', 'c2'), kind: 'range' });
  });

  it('🔴 κίνηση ΜΕΣΑ στο ίδιο κελί δεν γράφει ΤΙΠΟΤΑ — ADR-735', () => {
    startTableCellDrag({ anchor: ANCHOR, kind: 'range', resolveAt: () => ANCHOR });
    move();
    move();
    move();
    expect(write).not.toHaveBeenCalled();
  });

  it('🔴 δεύτερη κίνηση στο ΙΔΙΟ νέο κελί δεν ξαναγράφει', () => {
    startTableCellDrag({ anchor: ANCHOR, kind: 'range', resolveAt: () => ref('r3', 'c2') });
    move();
    move();
    move();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('έξω από το πλέγμα (`null`) η επιλογή ΜΕΝΕΙ — καμία εγγραφή, κανένα σβήσιμο', () => {
    let target: TableCellRef | null = ref('r2', 'c2');
    startTableCellDrag({ anchor: ANCHOR, kind: 'range', resolveAt: () => target });
    move();
    target = null;
    move();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('η σύρση άξονα περνά το δικό της είδος αυτούσιο', () => {
    startTableCellDrag({ anchor: ANCHOR, kind: 'column', resolveAt: () => ref('r3', 'c2') });
    move();
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ kind: 'column' }));
  });
});

describe('ο κύκλος ζωής — καμία σύρση-φάντασμα', () => {
  it('το `mouseup` τερματίζει: η επόμενη κίνηση δεν γράφει', () => {
    startTableCellDrag({ anchor: ANCHOR, kind: 'range', resolveAt: () => ref('r3', 'c2') });
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(isTableCellDragActive()).toBe(false);
    move();
    expect(write).not.toHaveBeenCalled();
  });

  it('🔴 κίνηση ΧΩΡΙΣ πατημένο κουμπί τερματίζει — το `mouseup` χάθηκε εκτός παραθύρου', () => {
    startTableCellDrag({ anchor: ANCHOR, kind: 'range', resolveAt: () => ref('r3', 'c2') });
    document.dispatchEvent(new MouseEvent('mousemove', { buttons: 0, bubbles: true }));
    expect(isTableCellDragActive()).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it('🔴 δεύτερη σύρση ΚΛΕΙΝΕΙ την πρώτη — ποτέ δύο ζευγάρια ακροατών', () => {
    startTableCellDrag({ anchor: ANCHOR, kind: 'range', resolveAt: () => ref('r3', 'c2') });
    startTableCellDrag({ anchor: ref('r0', 'c0'), kind: 'range', resolveAt: () => ref('r3', 'c2') });
    move();
    // Με διπλούς ακροατές θα γράφονταν ΔΥΟ φορές ανά κίνηση — και η πρώτη με λάθος άγκυρα.
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ from: ref('r0', 'c0') }));
  });

  it('`endTableCellDrag` είναι ιδεμποτής και ασφαλής χωρίς ενεργή σύρση', () => {
    expect(() => { endTableCellDrag(); endTableCellDrag(); }).not.toThrow();
    expect(isTableCellDragActive()).toBe(false);
  });
});
