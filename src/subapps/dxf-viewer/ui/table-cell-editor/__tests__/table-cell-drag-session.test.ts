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
import {
  isDragEdgeAutoPanActive,
  __runDragEdgeAutoPanFrameForTest,
} from '../../../systems/navigation/drag-edge-autopan';
import { EventBus } from '../../../systems/events';
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

/** Ένα δοχείο 1000×800 με τη γωνία του στο (0,0) — αρκετό για γεωμετρία άκρης. */
const CONTAINER = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800 }),
} as unknown as HTMLElement;

/** Κίνηση με **πατημένο** αριστερό κουμπί — ό,τι στέλνει ο browser κατά τη σύρση. */
function move(clientX = 500, clientY = 400): void {
  document.dispatchEvent(
    new MouseEvent('mousemove', { buttons: 1, bubbles: true, clientX, clientY }),
  );
}

/** Οι δύο υποχρεωτικές παράμετροι που δεν αφορούν το εκάστοτε test. */
const BASE = { anchor: ANCHOR, container: CONTAINER } as const;

afterEach(() => {
  endTableCellDrag();
  write.mockClear();
});

describe('startTableCellDrag — το κινούμενο άκρο ακολουθεί το χέρι', () => {
  it('σύρση σε ΑΛΛΟ κελί γράφει επιλογή με άγκυρα το κελί ΕΚΚΙΝΗΣΗΣ', () => {
    startTableCellDrag({ ...BASE, kind: 'range', resolveAt: () => ref('r3', 'c2') });
    move();
    expect(write).toHaveBeenCalledTimes(1);
    // Excel: μετά τη σύρση `A1→F1`, ενεργό κελί παραμένει το `A1`. Η άγκυρα ΜΕΝΕΙ.
    expect(write).toHaveBeenCalledWith({ from: ANCHOR, to: ref('r3', 'c2'), kind: 'range' });
  });

  it('🔴 κίνηση ΜΕΣΑ στο ίδιο κελί δεν γράφει ΤΙΠΟΤΑ — ADR-735', () => {
    startTableCellDrag({ ...BASE, kind: 'range', resolveAt: () => ANCHOR });
    move();
    move();
    move();
    expect(write).not.toHaveBeenCalled();
  });

  it('🔴 δεύτερη κίνηση στο ΙΔΙΟ νέο κελί δεν ξαναγράφει', () => {
    startTableCellDrag({ ...BASE, kind: 'range', resolveAt: () => ref('r3', 'c2') });
    move();
    move();
    move();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('έξω από το πλέγμα (`null`) η επιλογή ΜΕΝΕΙ — καμία εγγραφή, κανένα σβήσιμο', () => {
    let target: TableCellRef | null = ref('r2', 'c2');
    startTableCellDrag({ ...BASE, kind: 'range', resolveAt: () => target });
    move();
    target = null;
    move();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('η σύρση άξονα περνά το δικό της είδος αυτούσιο', () => {
    startTableCellDrag({ ...BASE, kind: 'column', resolveAt: () => ref('r3', 'c2') });
    move();
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ kind: 'column' }));
  });
});

describe('ο κύκλος ζωής — καμία σύρση-φάντασμα', () => {
  it('το `mouseup` τερματίζει: η επόμενη κίνηση δεν γράφει', () => {
    startTableCellDrag({ ...BASE, kind: 'range', resolveAt: () => ref('r3', 'c2') });
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(isTableCellDragActive()).toBe(false);
    move();
    expect(write).not.toHaveBeenCalled();
  });

  it('🔴 κίνηση ΧΩΡΙΣ πατημένο κουμπί τερματίζει — το `mouseup` χάθηκε εκτός παραθύρου', () => {
    startTableCellDrag({ ...BASE, kind: 'range', resolveAt: () => ref('r3', 'c2') });
    document.dispatchEvent(new MouseEvent('mousemove', { buttons: 0, bubbles: true }));
    expect(isTableCellDragActive()).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it('🔴 δεύτερη σύρση ΚΛΕΙΝΕΙ την πρώτη — ποτέ δύο ζευγάρια ακροατών', () => {
    startTableCellDrag({ ...BASE, kind: 'range', resolveAt: () => ref('r3', 'c2') });
    startTableCellDrag({ ...BASE, anchor: ref('r0', 'c0'), kind: 'range', resolveAt: () => ref('r3', 'c2') });
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

/**
 * 🔴 ADR-739 §27.16 Ε1 — **η άκρη**. Εδώ δεν ελέγχεται η ταχύτητα (αυτό το κάνει το
 * `drag-edge-autopan.test.ts`) αλλά το **ράψιμο**: ζει όσο η σύρση, ξέρει πού είναι το
 * χέρι, και — το κρίσιμο — **ξαναρωτά** μετά από κάθε μετακίνηση κάδρου.
 */
describe('🔴 §27.16 Ε1 — auto-pan στην άκρη: το ράψιμο με τη σύρση', () => {
  it('το auto-pan ζει ΟΣΟ η σύρση και σβήνει μαζί της', () => {
    expect(isDragEdgeAutoPanActive()).toBe(false);
    startTableCellDrag({ ...BASE, kind: 'range', resolveAt: () => ANCHOR });
    expect(isDragEdgeAutoPanActive()).toBe(true);
    endTableCellDrag();
    expect(isDragEdgeAutoPanActive()).toBe(false);
  });

  it('🔴 ΠΡΙΝ την πρώτη κίνηση δεν υπάρχει δείγμα ⇒ σκέτο πάτημα στην άκρη ΔΕΝ μετακινεί το κάδρο', () => {
    const emitted = jest.fn();
    const off = EventBus.on('canvas-pan', emitted);
    startTableCellDrag({ ...BASE, kind: 'range', resolveAt: () => ANCHOR });
    __runDragEdgeAutoPanFrameForTest(16);
    off();
    expect(emitted).not.toHaveBeenCalled();
  });

  it('κίνηση στο ΚΕΝΤΡΟ ⇒ καμία μετακίνηση κάδρου (νεκρή ζώνη)', () => {
    const emitted = jest.fn();
    const off = EventBus.on('canvas-pan', emitted);
    startTableCellDrag({ ...BASE, kind: 'range', resolveAt: () => ANCHOR });
    move(500, 400);
    __runDragEdgeAutoPanFrameForTest(16);
    off();
    expect(emitted).not.toHaveBeenCalled();
  });

  it('κίνηση στην ΑΡΙΣΤΕΡΗ άκρη ⇒ το κάδρο μετακινείται προς τα εκεί', () => {
    const emitted = jest.fn();
    const off = EventBus.on('canvas-pan', emitted);
    startTableCellDrag({ ...BASE, kind: 'range', resolveAt: () => ANCHOR });
    move(2, 400);
    __runDragEdgeAutoPanFrameForTest(16);
    off();
    expect(emitted).toHaveBeenCalledTimes(1);
    expect(emitted.mock.calls[0][0].dx).toBeGreaterThan(0);
  });

  it('🔴 ΤΟ ΚΛΕΙΔΙ: μετά τη μετακίνηση κάδρου η επιλογή ΞΑΝΑΛΥΝΕΤΑΙ — χωρίς κανένα νέο `mousemove`', () => {
    // Ο δείκτης μένει ΑΚΙΝΗΤΟΣ στην άκρη· ο κόσμος γλιστράει από κάτω του, άρα το κελί
    // αλλάζει. Χωρίς το `onPanned`, η επιλογή θα πάγωνε ενώ το κάδρο ταξιδεύει.
    const cells = [ref('r2', 'c2'), ref('r3', 'c3'), ref('r4', 'c4')];
    let index = -1;
    startTableCellDrag({
      ...BASE,
      kind: 'range',
      resolveAt: () => cells[Math.min(++index, cells.length - 1)],
    });
    move(2, 400);
    expect(write).toHaveBeenCalledTimes(1);
    __runDragEdgeAutoPanFrameForTest(16);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith(expect.objectContaining({ to: ref('r3', 'c3') }));
    __runDragEdgeAutoPanFrameForTest(16);
    expect(write).toHaveBeenCalledTimes(3);
    expect(write).toHaveBeenLastCalledWith(expect.objectContaining({ to: ref('r4', 'c4') }));
  });

  it('🔴 ο ΦΥΛΑΚΑΣ ισχύει και στο auto-pan: ίδιο κελί μετά τη μετακίνηση ⇒ καμία εγγραφή', () => {
    startTableCellDrag({ ...BASE, kind: 'range', resolveAt: () => ref('r2', 'c2') });
    move(2, 400);
    expect(write).toHaveBeenCalledTimes(1);
    __runDragEdgeAutoPanFrameForTest(16);
    __runDragEdgeAutoPanFrameForTest(16);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('🔴 η άγκυρα ΔΕΝ κουνιέται από το auto-pan', () => {
    const cells = [ref('r2', 'c2'), ref('r9', 'c9')];
    let index = -1;
    startTableCellDrag({
      ...BASE,
      kind: 'column',
      resolveAt: () => cells[Math.min(++index, cells.length - 1)],
    });
    move(2, 400);
    __runDragEdgeAutoPanFrameForTest(16);
    expect(write).toHaveBeenLastCalledWith({ from: ANCHOR, to: ref('r9', 'c9'), kind: 'column' });
  });

  it('το `mouseup` σβήνει και το auto-pan — κανένα κάδρο που ταξιδεύει μόνο του', () => {
    const emitted = jest.fn();
    const off = EventBus.on('canvas-pan', emitted);
    startTableCellDrag({ ...BASE, kind: 'range', resolveAt: () => ANCHOR });
    move(2, 400);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(isDragEdgeAutoPanActive()).toBe(false);
    __runDragEdgeAutoPanFrameForTest(16);
    off();
    expect(emitted).not.toHaveBeenCalled();
  });
});
