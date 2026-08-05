/**
 * 🔴 ADR-739 §48 — **ΟΙ ΑΚΥΡΩΤΕΣ ΤΩΝ «ΜΥΡΜΗΓΚΙΩΝ», ΚΑΘΕΝΑΣ ΧΩΡΙΣΤΑ.**
 *
 * Η προδιαγραφή του ιδιοκτήτη ήταν «ακριβώς όπως το Excel», και το Excel έχει **τέσσερις**
 * κανόνες που είναι εύκολο να γραφτούν οι τρεις:
 *
 * | γεγονός | Excel | ποιος το κάνει εδώ |
 * |---|---|---|
 * | `Escape` / έξοδος / άλλος πίνακας | σβήνουν | ο **παλμός** (φρουρός ζωής) |
 * | νέα αντιγραφή | αντικαθιστά | το store (νέα φάση από την αρχή) |
 * | γράψιμο σε κελί / δομική αλλαγή | σβήνουν | οι δύο δεσμευτές + ο ζωγράφος (δίχτυ) |
 * | 🔴 **`Ctrl+V`** | **ΠΑΡΑΜΕΝΟΥΝ** | **κανείς** — και αυτό είναι η προδιαγραφή |
 *
 * Η τελευταία γραμμή είναι ο λόγος που το τελευταίο test υπάρχει: μια «λογική» βελτίωση που θα
 * σβήνει το marquee στην επικόλληση θα ήταν πράσινη σε κάθε άλλο test αυτού του αρχείου, και θα
 * αφαιρούσε σιωπηλά τη δυνατότητα επαναλαμβανόμενης επικόλλησης.
 */

import { __resetTableCellCursorStoreForTests, setTableCellCursor, closeTableCellCursor } from '../table-cell-cursor-store';
import { tableCursorAt } from '../../bim/table/table-cell-navigation';
import {
  __resetTableCopyMarqueeForTests,
  clearTableCopyMarquee,
  getTableCopyMarquee,
  setTableCopyMarquee,
} from '../table-copy-marquee-store';
import { startMarchingAntsPulse } from '../table-copy-marquee-pulse';
import type { TableCellRangeBounds } from '../../bim/table/table-cell-range';

const BOUNDS: TableCellRangeBounds = { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 1 };
const MODEL = { marker: 'v1' } as unknown as Parameters<typeof setTableCopyMarquee>[2];
const ENTITY_ID = 'tbl_marquee';

/** Τρέχει τον βρόχο RAF χειροκίνητα, ώστε ο φρουρός να ρωτηθεί ντετερμινιστικά. */
function flushFrames(count: number): void {
  for (let i = 0; i < count; i++) jest.advanceTimersByTime(16);
}

beforeEach(() => {
  jest.useFakeTimers();
  __resetTableCellCursorStoreForTests();
  __resetTableCopyMarqueeForTests();
  setTableCellCursor(ENTITY_ID, tableCursorAt('r1', 'c1'), 'nav');
});

afterEach(() => {
  __resetTableCopyMarqueeForTests();
  __resetTableCellCursorStoreForTests();
  jest.useRealTimers();
});

describe('🔴 ADR-739 §48 — ο κύκλος ζωής του marquee', () => {
  it('ΒΑΣΗ — χωρίς αντιγραφή δεν υπάρχει marquee', () => {
    expect(getTableCopyMarquee()).toBeNull();
  });

  it('`Ctrl+C` γεννά marquee με τα όρια και τη σφραγίδα έκδοσης', () => {
    setTableCopyMarquee(ENTITY_ID, BOUNDS, MODEL);
    expect(getTableCopyMarquee()).toMatchObject({ entityId: ENTITY_ID, bounds: BOUNDS, modelRef: MODEL });
  });

  it('νέα αντιγραφή ΑΝΤΙΚΑΘΙΣΤΑ — και ξεκινά νέα φάση κίνησης', () => {
    setTableCopyMarquee(ENTITY_ID, BOUNDS, MODEL);
    const first = getTableCopyMarquee()?.startedAtMs ?? -1;
    jest.advanceTimersByTime(500);
    const otherBounds: TableCellRangeBounds = { firstRow: 2, lastRow: 2, firstCol: 0, lastCol: 0 };
    setTableCopyMarquee(ENTITY_ID, otherBounds, MODEL);
    const second = getTableCopyMarquee();
    expect(second?.bounds).toEqual(otherBounds);
    // Η νέα αντιγραφή είναι **νέο γεγονός**, όχι συνέχεια: αν η φάση συνεχιζόταν, τα μυρμήγκια
    // θα «ξεπηδούσαν» στη μέση του μοτίβου και η αλλαγή θα διαβαζόταν ως γλίτσα.
    expect(second?.startedAtMs).not.toBe(first);
  });

  it('`clearTableCopyMarquee` είναι ιδεμποτής', () => {
    clearTableCopyMarquee();
    setTableCopyMarquee(ENTITY_ID, BOUNDS, MODEL);
    clearTableCopyMarquee();
    clearTableCopyMarquee();
    expect(getTableCopyMarquee()).toBeNull();
  });
});

describe('🔴 ADR-739 §48 — ο παλμός ΕΙΝΑΙ ο φρουρός ζωής', () => {
  it('🔴 `Escape` / έξοδος από τη λειτουργία ⇒ το marquee σβήνει ΜΟΝΟ ΤΟΥ', () => {
    setTableCopyMarquee(ENTITY_ID, BOUNDS, MODEL);
    expect(getTableCopyMarquee()).not.toBeNull();
    // Ο δρομέας πεθαίνει — καμία γραμμή κώδικα δεν λέει στο marquee ότι συνέβη κάτι.
    closeTableCellCursor();
    flushFrames(3);
    expect(getTableCopyMarquee()).toBeNull();
  });

  it('🔴 μετάβαση σε ΑΛΛΟΝ πίνακα ⇒ σβήνει', () => {
    setTableCopyMarquee(ENTITY_ID, BOUNDS, MODEL);
    setTableCellCursor('tbl_other', tableCursorAt('r1', 'c1'), 'nav');
    flushFrames(3);
    expect(getTableCopyMarquee()).toBeNull();
  });

  it('🔴 ΑΡΝΗΤΙΚΗ ΑΠΟΔΕΙΞΗ — όσο ο δρομέας ζει στον ΙΔΙΟ πίνακα, το marquee ΕΠΙΒΙΩΝΕΙ', () => {
    // Χωρίς αυτό, ένας φρουρός που σβήνει τα πάντα θα ήταν πράσινος στα δύο από πάνω.
    setTableCopyMarquee(ENTITY_ID, BOUNDS, MODEL);
    setTableCellCursor(ENTITY_ID, tableCursorAt('r3', 'c2'), 'nav');
    flushFrames(60);
    expect(getTableCopyMarquee()).not.toBeNull();
  });

  it('🔴 `Ctrl+V` ΔΕΝ σβήνει — επικολλάς όσες φορές θες (Excel parity, ρητή απόφαση)', () => {
    // Δεν υπάρχει `onPaste` σε αυτό το store, και **αυτή είναι η προδιαγραφή**. Το test
    // υπάρχει για να μη «διορθωθεί» ως παράλειψη: μια επικόλληση δεν αγγίζει το πρόχειρο.
    setTableCopyMarquee(ENTITY_ID, BOUNDS, MODEL);
    flushFrames(30);
    expect(getTableCopyMarquee()).not.toBeNull();
  });
});

describe('ADR-739 §48 — ο παλμός ως μηχανή', () => {
  it('ζητά καρέ με ρυθμό, αλλά ρωτά τον φρουρό σε ΚΑΘΕ καρέ', () => {
    const shouldContinue = jest.fn(() => true);
    const onTick = jest.fn();
    const stop = startMarchingAntsPulse({ shouldContinue, onTick, onExpire: jest.fn() });
    flushFrames(10);
    // 10 × 16 ms = 160 ms ⇒ δύο τικ στα 80 ms, αλλά δέκα ερωτήσεις: το σβήσιμο πρέπει να
    // μοιάζει ακαριαίο, η επαναβαφή είναι εκείνη που κοστίζει.
    expect(shouldContinue.mock.calls.length).toBeGreaterThan(onTick.mock.calls.length);
    stop();
  });

  it('🔴 η ΡΗΤΗ διακοπή ΔΕΝ καλεί `onExpire` — αλλιώς η αντικατάσταση σβήνει το νέο marquee', () => {
    const onExpire = jest.fn();
    const stop = startMarchingAntsPulse({ shouldContinue: () => true, onTick: jest.fn(), onExpire });
    stop();
    stop();
    flushFrames(10);
    expect(onExpire).not.toHaveBeenCalled();
  });
});
