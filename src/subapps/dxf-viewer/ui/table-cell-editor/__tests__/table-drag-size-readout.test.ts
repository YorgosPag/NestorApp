/**
 * 🔴 ADR-739 §69 — **Η ΖΩΝΤΑΝΗ ΑΝΑΚΟΙΝΩΣΗ ΜΕΓΕΘΟΥΣ**, ως εκτελέσιμη προδιαγραφή.
 *
 * ## Τι φυλάει αυτό το αρχείο, και γιατί ΔΕΝ αρκούσε το `table-cell-drag-session.test.ts`
 * Εκείνο μετρά **πόσες φορές** γράφτηκε επιλογή (ο φύλακας απόδοσης του ADR-735). Εδώ
 * μετριέται **τι ανακοινώθηκε και πότε** — τρεις ερωτήσεις που ένα test καταμέτρησης δεν
 * βλέπει καθόλου:
 *
 *  1. **η ανακοίνωση υπάρχει πριν κουνηθεί το χέρι** (`1R x 1C` στο πάτημα, Excel)·
 *  2. **σβήνει σε ΚΑΘΕ τερματισμό** — και στον φυσικό (`mouseup`) και στην **ακύρωση**·
 *  3. **η λαβή συμπλήρωσης ανακοινώνει ΑΛΛΟ εύρος απ' ό,τι σέρνει** — το μόνο σημείο όπου
 *     το `sizeReadout` δεν είναι ταυτοτικό, και το μόνο που δεν πιάνεται με το μάτι.
 *
 * ⚠️ Το store **δεν** είναι mock-αρισμένο εδώ (σε αντίθεση με το αδελφό αρχείο): το
 * ζητούμενο είναι ακριβώς η κατάσταση που **έμεινε**, δηλαδή αυτό που θα διαβάσει το φύλλο.
 */

import {
  endTableCellDrag,
  startTableCellDrag,
  TABLE_DRAG_SIZE_AS_DRAGGED,
} from '../table-cell-drag-session';
import {
  getTableDragSpan,
  __resetTableDragSpanStoreForTests,
} from '../../../state/table-drag-span-store';
import type { TableCellRef, TableSelectionSpan } from '../../../bim/table/table-cell-range';
import type { TableColumnId, TableRowId } from '../../../types/table';

jest.mock('../../../state/table-cell-cursor-store', () => ({
  setTableCellSelection: jest.fn(),
}));

const ref = (rowId: string, colId: string): TableCellRef => ({
  rowId: rowId as TableRowId,
  colId: colId as TableColumnId,
});

const ANCHOR = ref('r1', 'c1');

const CONTAINER = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800 }),
} as unknown as HTMLElement;

function move(clientX = 500, clientY = 400): void {
  document.dispatchEvent(
    new MouseEvent('mousemove', { buttons: 1, bubbles: true, clientX, clientY }),
  );
}

const BASE = {
  anchor: ANCHOR,
  container: CONTAINER,
  kind: 'range',
  sizeReadout: TABLE_DRAG_SIZE_AS_DRAGGED,
} as const;

afterEach(() => {
  endTableCellDrag();
  __resetTableDragSpanStoreForTests();
});

describe('🔴 §69 — η ανακοίνωση μεγέθους ακολουθεί τη χειρονομία', () => {
  it('πριν από κάθε σύρση δεν ανακοινώνεται τίποτα', () => {
    expect(getTableDragSpan()).toBeNull();
  });

  it('🔴 ΤΟ ΠΑΤΗΜΑ ΑΝΑΚΟΙΝΩΝΕΙ ΗΔΗ — το `1R x 1C` του Excel, χωρίς καμία κίνηση', () => {
    startTableCellDrag({ ...BASE, resolveAt: () => ANCHOR });
    // Άγκυρα = άκρο ⇒ ένα κελί. Χωρίς αυτή τη γραμμή το πλαίσιο ονόματος θα άλλαζε νόημα
    // μόνο αφού το χέρι έφτανε σε **δεύτερο** κελί — δηλαδή θα έδειχνε διεύθυνση όσο ο
    // χρήστης έχει ήδη αρχίσει να σέρνει.
    expect(getTableDragSpan()).toEqual({ from: ANCHOR, to: ANCHOR, kind: 'range' });
  });

  it('η κίνηση σε άλλο κελί ανακοινώνει το νέο εύρος, με την άγκυρα να ΜΕΝΕΙ', () => {
    startTableCellDrag({ ...BASE, resolveAt: () => ref('r3', 'c2') });
    move();
    expect(getTableDragSpan()).toEqual({ from: ANCHOR, to: ref('r3', 'c2'), kind: 'range' });
  });

  it('η σύρση άξονα ανακοινώνει το δικό της είδος — η μέτρηση θα το ερμηνεύσει χωρίς κούμπωμα', () => {
    startTableCellDrag({ ...BASE, kind: 'column', resolveAt: () => ref('r3', 'c1') });
    move();
    expect(getTableDragSpan()).toEqual(expect.objectContaining({ kind: 'column' }));
  });

  it('🔴 το `mouseup` ΣΒΗΝΕΙ την ανακοίνωση — επιστρέφει η διεύθυνση (Excel)', () => {
    startTableCellDrag({ ...BASE, resolveAt: () => ref('r3', 'c2') });
    move();
    expect(getTableDragSpan()).not.toBeNull();
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(getTableDragSpan()).toBeNull();
  });

  it('🔴 και η ΑΚΥΡΩΣΗ σβήνει: `endTableCellDrag()` από αποπροσάρτηση συνεδρίας', () => {
    // Ο διαχωρισμός φυσικού/ακυρωτικού τερματισμού υπάρχει για να μη γράφει **μοντέλο** μια
    // ακύρωση (ADR-754 Γ4). Η ανακοίνωση δεν είναι μοντέλο — αν έμενε, το πλαίσιο ονόματος
    // θα κρατούσε για πάντα το `2R x 2C` μιας σύρσης που κανείς δεν ολοκλήρωσε.
    startTableCellDrag({ ...BASE, resolveAt: () => ref('r3', 'c2') });
    move();
    endTableCellDrag();
    expect(getTableDragSpan()).toBeNull();
  });

  it('🔴 κίνηση ΧΩΡΙΣ πατημένο κουμπί (χαμένο `mouseup`) σβήνει κι αυτή', () => {
    startTableCellDrag({ ...BASE, resolveAt: () => ref('r3', 'c2') });
    move();
    document.dispatchEvent(new MouseEvent('mousemove', { buttons: 0, bubbles: true }));
    expect(getTableDragSpan()).toBeNull();
  });

  it('έξω από το πλέγμα η ανακοίνωση ΜΕΝΕΙ εκεί που έφτασε — ίδια σύμβαση με την επιλογή', () => {
    let target: TableCellRef | null = ref('r2', 'c2');
    startTableCellDrag({ ...BASE, resolveAt: () => target });
    move();
    target = null;
    move();
    expect(getTableDragSpan()).toEqual({ from: ANCHOR, to: ref('r2', 'c2'), kind: 'range' });
  });
});

/**
 * 🔴 §69 — **Η ΜΟΝΗ ΧΕΙΡΟΝΟΜΙΑ ΠΟΥ ΔΕΝ ΑΝΑΚΟΙΝΩΝΕΙ Ο,ΤΙ ΣΕΡΝΕΙ.**
 *
 * Η λαβή συμπλήρωσης σέρνει από τη γωνία της προς το χέρι, αλλά ο χρήστης βλέπει (και θα
 * πάρει) την **προεπισκόπηση**, που περιλαμβάνει και την πηγή. Εδώ η διαφορά αναπαράγεται
 * χωρίς γεωμετρία: μια `sizeReadout` που επιστρέφει **άλλο** εύρος από αυτό που της δόθηκε.
 *
 * Το ουσιώδες που κλειδώνει αυτή η ομάδα δεν είναι η μετάφραση καθαυτή — είναι η **σειρά**
 * μέσα στον βρόχο: το `announce` τρέχει **μετά** το `write`, ώστε η ανακοίνωση να μπορεί να
 * διαβάσει ό,τι μόλις υπολόγισε το `write`. Αντεστραμμένη, η λαβή θα ανακοίνωνε ένα κελί
 * πίσω σε κάθε καρέ — σφάλμα αόρατο σε κάθε test που δεν κοιτά **και τα δύο** μαζί.
 */
describe('🔴 §69 — `sizeReadout` που μεταφράζει: η λαβή συμπλήρωσης', () => {
  it('ανακοινώνεται η ΠΡΟΕΠΙΣΚΟΠΗΣΗ, όχι η διαδρομή του χεριού', () => {
    /** Ό,τι «υπολόγισε το write» — εδώ, το γέμισμα **μαζί με** την πηγή. */
    let promised: TableCellRef = ref('r1', 'c1');
    startTableCellDrag({
      ...BASE,
      resolveAt: () => ref('r3', 'c1'),
      write: (span) => { promised = span.to; },
      // Η πηγή ξεκινά στο `r0`: το γέμισμα είναι `r0 → όπου έφτασε το χέρι`.
      sizeReadout: (): TableSelectionSpan => ({
        from: ref('r0', 'c1'), to: promised, kind: 'range',
      }),
    });
    move();
    // Το χέρι σέρνει `r1 → r3` (τρεις γραμμές)· ανακοινώνεται `r0 → r3` (τέσσερις) — αυτό
    // ακριβώς που θα μαρκαριστεί όταν αφεθεί το κουμπί.
    expect(getTableDragSpan()).toEqual({ from: ref('r0', 'c1'), to: ref('r3', 'c1'), kind: 'range' });
  });

  it('`null` από τη μετάφραση σβήνει την ανακοίνωση — καμία ένδειξη αντί για μαντεψιά', () => {
    startTableCellDrag({ ...BASE, resolveAt: () => ref('r3', 'c2'), sizeReadout: () => null });
    expect(getTableDragSpan()).toBeNull();
    move();
    expect(getTableDragSpan()).toBeNull();
  });
});
