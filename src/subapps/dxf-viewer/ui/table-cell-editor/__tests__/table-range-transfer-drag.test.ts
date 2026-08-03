/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 3) — **η χειρονομία της μεταφοράς** ως εκτελέσιμη προδιαγραφή.
 *
 * Τέσσερα πράγματα δοκιμάζονται εδώ και **πουθενά αλλού**, γιατί μόνο εδώ υπάρχουν μαζί:
 *
 *  1. ότι η σύρση **καλεί** τις καθαρές πράξεις της Φάσης 2 και το drop γράφει **μία** φορά·
 *  2. ότι η **πρόθεση** αλλάζει μέσα στη σύρση χωρίς να κουνηθεί το χέρι (`Ctrl`/`Shift`)·
 *  3. 🔴 ότι το `mouseup` **δεν ξαναδιαβάζει πλήκτρα** — εκτελεί ό,τι έδειχνε το φάντασμα·
 *  4. ότι η **άρνηση** φτάνει στα δύο κανάλια της (δείκτης + φάντασμα) πριν το drop.
 *
 * Το `markSystemsDirty` είναι mock-αρισμένο **επίτηδες**: το ζητούμενο δεν είναι μόνο «τι
 * κατάσταση έμεινε» αλλά «**πόσα καρέ ζητήθηκαν**». Ο φύλακας «γράψε μόνο όταν αλλάζει η
 * απάντηση» είναι απόφαση απόδοσης (ADR-735) — με 60-120 συμβάντα/δευτ., ένα καρέ ανά pixel
 * είναι επαναβαφή σκηνής ανά pixel, και ένα test κατάστασης θα ήταν πράσινο και στις δύο
 * υλοποιήσεις.
 */

import {
  activeTableRangeTransferCursor,
  beginTableRangeTransfer,
  endTableRangeTransferDrag,
  isTableRangeTransferDragging,
} from '../table-range-transfer-drag';
import { tableRangeGrabAtWorld } from '../table-cell-pointer-hit';
import {
  __resetTableRangeTransferPreviewForTests,
  getTableRangeTransferPreview,
} from '../../../state/table-range-transfer-store';
import { __resetTableCellCursorStoreForTests } from '../../../state/table-cell-cursor-store';
import { markSystemsDirty } from '../../../rendering/core/frame-scheduler-api';
import { tableFrameScreenPoint, TABLE_TEST_VIEW } from './table-screen-point';
import {
  createTableModel,
  getPersistedCellText,
  toPersistedTableModel,
} from '../../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../../../bim/table/table-style-presets';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import {
  computeTableEntityGeometryLive,
  tableFrameToWorld,
} from '../../../bim/table/table-entity-geometry';
import type { TableSelectionSpan } from '../../../bim/table/table-cell-range';
import type { TableEntity } from '../../../types/table-entity';
import type { ViewTransform } from '../../../rendering/types/Types';
import type {
  PersistedTableModel,
  TableCellEntry,
  TableColumn,
  TableColumnId,
  TableRow,
  TableRowId,
} from '../../../types/table';

/**
 * ⚠️ Ρητά **στοιχειώδες** mock, χωρίς `requireActual`: το πραγματικό module εισάγει τον
 * `UnifiedFrameScheduler`, που το ίδιο εισάγει πίσω τους τύπους του — κύκλος που σε φάση
 * `requireActual` σκάει ως «Cannot access before initialization». Το `registerRenderCallback`
 * υπάρχει μόνο για να ικανοποιήσει το auto-pan, που εδώ δεν δοκιμάζεται (το κλειδώνει ήδη το
 * `table-cell-drag-session.test.ts`).
 */
jest.mock('../../../rendering/core/frame-scheduler-api', () => ({
  markSystemsDirty: jest.fn(),
  registerRenderCallback: jest.fn(() => () => undefined),
  RENDER_PRIORITIES: { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 },
}));

const frames = markSystemsDirty as jest.MockedFunction<typeof markSystemsDirty>;

// ── Ο πίνακας: 4 × 4, στήλες 20mm, γραμμές 10mm ⇒ σύνορα u 0/20/40/60/80 · v 0/10/20/30/40 ──

const COLUMNS: TableColumn[] = ['c0', 'c1', 'c2', 'c3'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'text',
  align: 'left',
}));
const ROWS: TableRow[] = ['r0', 'r1', 'r2', 'r3'].map((id) => ({
  id,
  rowClass: 'data',
  heightMm: 10,
}));

const text = (rowId: string, colId: string, value: string): TableCellEntry => [
  rowId as TableRowId,
  colId as TableColumnId,
  { kind: 'text', value },
];

/** `A` στο κελί που ταξιδεύει, `Z` σε αυτό που θα το δεχτεί — ο διαχωριστής των δύο πράξεων. */
function persisted(): PersistedTableModel {
  return toPersistedTableModel(
    createTableModel({ columns: COLUMNS, rows: ROWS, cells: [text('r1', 'c1', 'A'), text('r2', 'c1', 'Z')] }),
  );
}

function makeEntity(): TableEntity {
  return {
    id: 'tbl_1',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 0, y: 0 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    model: persisted(),
  };
}

const CONTAINER = {
  getBoundingClientRect: () => ({
    left: 0,
    top: 0,
    width: TABLE_TEST_VIEW.viewport.width,
    height: TABLE_TEST_VIEW.viewport.height,
  }),
} as unknown as HTMLElement;

const transformRef: { current: ViewTransform } = { current: TABLE_TEST_VIEW.transform };

/** Η περιοχή που «πιάνεται»: το μονό κελί `r1c1` (§27.15 — υπάρχει επιλογή, όχι σκέτο κλικ). */
const SOURCE = { firstRow: 1, lastRow: 1, firstCol: 1, lastCol: 1 };
const GRAB = { dRow: 0, dCol: 0 };

let entity = makeEntity();
let commit: jest.Mock<void, [TableEntity, TableEntity['model']]>;

/** Ξεκινά τη χειρονομία με την ίδια γεωμετρία σε κάθε test. */
function startDrag(): void {
  beginTableRangeTransfer({ entity, source: SOURCE, grab: GRAB, container: CONTAINER, transformRef, commit });
}

/** Κίνηση με **πατημένο** αριστερό κουμπί, σε σημείο του πλαισίου (sheet-mm). */
function moveTo(u: number, v: number, modifiers: MouseEventInit = {}): void {
  const point = tableFrameScreenPoint(entity, u, v);
  document.dispatchEvent(
    new MouseEvent('mousemove', {
      buttons: 1,
      bubbles: true,
      clientX: point.x,
      clientY: point.y,
      ...modifiers,
    }),
  );
}

function release(modifiers: MouseEventInit = {}): void {
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, ...modifiers }));
}

function modifierKey(type: 'keydown' | 'keyup', key: string, init: KeyboardEventInit = {}): void {
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, ...init }));
}

/** Το κείμενο του κελιού στο μοντέλο που παραδόθηκε στο commit. */
function committedText(rowId: string, colId: string): string {
  expect(commit).toHaveBeenCalledTimes(1);
  const model = commit.mock.calls[0][1];
  return getPersistedCellText(model, rowId as TableRowId, colId as TableColumnId);
}

beforeEach(() => {
  entity = makeEntity();
  commit = jest.fn();
  frames.mockClear();
});

afterEach(() => {
  endTableRangeTransferDrag();
  __resetTableRangeTransferPreviewForTests();
  __resetTableCellCursorStoreForTests();
});

// ── 1. Η σύρση καλεί τις πράξεις της Φάσης 2 ────────────────────────────────

describe('beginTableRangeTransfer — σύρση, φάντασμα, απόθεση', () => {
  it('η χειρονομία ζει ώσπου να αφεθεί το κουμπί', () => {
    startDrag();
    expect(isTableRangeTransferDragging()).toBe(true);
    release();
    expect(isTableRangeTransferDragging()).toBe(false);
  });

  it('σύρση σε άλλο κελί ⇒ φάντασμα ΣΤΟΝ ΠΡΟΟΡΙΣΜΟ + δείκτης «μετακίνηση»', () => {
    startDrag();
    moveTo(50, 25); // κέντρο του (r2, c2)
    expect(getTableRangeTransferPreview()).toEqual({
      entityId: 'tbl_1',
      destination: { firstRow: 2, lastRow: 2, firstCol: 2, lastCol: 2 },
      insertAxis: null,
      refused: false,
    });
    expect(activeTableRangeTransferCursor()).toBe('range-move');
  });

  it('απόθεση ⇒ **ΜΙΑ** εγγραφή μοντέλου, με το περιεχόμενο μετακομισμένο', () => {
    startDrag();
    moveTo(30, 25); // (r2, c1) — εκεί κάθεται το `Z`
    release();
    expect(committedText('r2', 'c1')).toBe('A');
    expect(committedText('r1', 'c1')).toBe('');
  });

  it('🔴 απόθεση ΧΩΡΙΣ μετακίνηση ⇒ καμία εντολή, κανένα βήμα undo για το τίποτα', () => {
    startDrag();
    moveTo(30, 15); // μέσα στο ίδιο κελί (r1, c1)
    expect(activeTableRangeTransferCursor()).toBe('range-move');
    expect(getTableRangeTransferPreview()?.refused).toBe(false);
    release();
    expect(commit).not.toHaveBeenCalled();
  });

  it('το φάντασμα σβήνει στην απόθεση — δεν επιζεί ως προεπισκόπηση χωρίς σύρση', () => {
    startDrag();
    moveTo(50, 25);
    release();
    expect(getTableRangeTransferPreview()).toBeNull();
    expect(activeTableRangeTransferCursor()).toBeNull();
  });

  it('το κουμπί αφέθηκε εκτός παραθύρου ⇒ τερματισμός ΧΩΡΙΣ εκτέλεση', () => {
    startDrag();
    moveTo(50, 25);
    // Κίνηση χωρίς πατημένο κουμπί: το `mouseup` χάθηκε. Μια μεταφορά που ο χρήστης δεν
    // ολοκλήρωσε δεν επιτρέπεται να γράψει μοντέλο.
    document.dispatchEvent(new MouseEvent('mousemove', { buttons: 0, bubbles: true }));
    expect(isTableRangeTransferDragging()).toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });
});

// ── 2. Η ζωντανή πρόθεση ────────────────────────────────────────────────────

describe('η πρόθεση αλλάζει ΜΕΣΑ στη σύρση', () => {
  it('`Ctrl` πατημένο στην κίνηση ⇒ δείκτης «αντιγραφή»', () => {
    startDrag();
    moveTo(50, 25, { ctrlKey: true });
    expect(activeTableRangeTransferCursor()).toBe('range-copy');
  });

  it('🔴 `Ctrl` πατημένο ΧΩΡΙΣ να κουνηθεί το χέρι ⇒ ο δείκτης αλλάζει ΑΜΕΣΩΣ', () => {
    // Τα `ctrlKey`/`shiftKey` ενός `MouseEvent` είναι **παγωμένο στιγμιότυπο**. Επανάληψη του
    // τελευταίου `mousemove` θα απαντούσε με την **παλιά** κατάσταση πλήκτρων, δηλαδή τίποτα
    // δεν θα άλλαζε μέχρι την επόμενη κίνηση — ακριβώς αυτό που ο ακροατής καταργεί.
    startDrag();
    moveTo(50, 25);
    expect(activeTableRangeTransferCursor()).toBe('range-move');
    modifierKey('keydown', 'Control', { ctrlKey: true });
    expect(activeTableRangeTransferCursor()).toBe('range-copy');
    modifierKey('keyup', 'Control', { ctrlKey: false });
    expect(activeTableRangeTransferCursor()).toBe('range-move');
  });

  it('`Ctrl` κρατημένο στην απόθεση ⇒ η πηγή **ΜΕΝΕΙ**', () => {
    startDrag();
    moveTo(30, 25, { ctrlKey: true });
    release();
    expect(committedText('r2', 'c1')).toBe('A');
    expect(committedText('r1', 'c1')).toBe('A');
  });

  it('`Shift` ⇒ το φάντασμα αποκτά ΑΞΟΝΑ γραμμής-Ι', () => {
    startDrag();
    moveTo(30, 22, { shiftKey: true }); // κοντά στο οριζόντιο σύνορο 20
    expect(getTableRangeTransferPreview()?.insertAxis).toBe('down');
  });

  it('πλήκτρο που δεν είναι τροποποιητής αγνοείται (καμία περιττή σάρωση)', () => {
    startDrag();
    moveTo(50, 25);
    frames.mockClear();
    modifierKey('keydown', 'a');
    expect(frames).not.toHaveBeenCalled();
  });
});

// ── 3. 🔴 Το drop εκτελεί ό,τι ΕΔΕΙΞΕ, όχι ό,τι διαβάζει ξανά ───────────────

describe('🔴 η απόθεση ΔΕΝ ξαναδιαβάζει πλήκτρα — parity ΑΡΝΗΘΗΚΕ επίτηδες', () => {
  it('`Shift` στο ΙΔΙΟ το `mouseup` δεν αλλάζει την πράξη: εκτελείται η προεπισκόπηση', () => {
    // Το Excel διαβάζει την πρόθεση **τη στιγμή του `mouseup`**: «άσε πρώτα το ποντίκι, μετά
    // το `Shift`» — δηλαδή η σειρά που χαλαρώνουν δύο δάχτυλα αποφασίζει αν θα εισαχθούν
    // δεδομένα ή θα σβηστούν. Εδώ το `mouseup` δεν διαβάζει τίποτα.
    startDrag();
    moveTo(30, 25); // σκέτη μετακίνηση: το `Z` του (r2, c1) **αντικαθίσταται**
    release({ shiftKey: true });
    expect(committedText('r2', 'c1')).toBe('A');
    // Αν το `mouseup` είχε διαβάσει το `Shift`, το `Z` θα είχε σπρωχτεί και θα επιζούσε.
    expect(committedText('r3', 'c1')).toBe('');
  });

  it('`Shift` αφημένο ΠΡΙΝ την απόθεση ⇒ σκέτη μετακίνηση, όπως έδειχνε το φάντασμα', () => {
    startDrag();
    moveTo(30, 25, { shiftKey: true });
    modifierKey('keyup', 'Shift', { shiftKey: false });
    expect(getTableRangeTransferPreview()?.insertAxis).toBeNull();
    release();
    expect(committedText('r2', 'c1')).toBe('A');
  });
});

// ── 4. Η άρνηση, ορατή ──────────────────────────────────────────────────────

describe('η άρνηση φτάνει στα ΔΥΟ κανάλια της', () => {
  it('χέρι ΕΞΩ από το πλέγμα ⇒ δείκτης «not-allowed» + φάντασμα χωρίς θέση', () => {
    startDrag();
    moveTo(50, -8);
    expect(activeTableRangeTransferCursor()).toBe('range-refuse');
    expect(getTableRangeTransferPreview()).toEqual({
      entityId: 'tbl_1',
      destination: null,
      insertAxis: null,
      refused: true,
    });
  });

  it('απόθεση πάνω σε άρνηση ⇒ **καμία** εγγραφή', () => {
    startDrag();
    moveTo(50, -8);
    release();
    expect(commit).not.toHaveBeenCalled();
  });

  it('η άρνηση ΔΕΝ είναι μονόδρομος: επιστροφή μέσα στο πλέγμα την αίρει', () => {
    startDrag();
    moveTo(50, -8);
    moveTo(50, 25);
    expect(activeTableRangeTransferCursor()).toBe('range-move');
    expect(getTableRangeTransferPreview()?.refused).toBe(false);
  });
});

// ── 5. ADR-735: καρέ μόνο όταν αλλάζει η απάντηση ───────────────────────────

describe('ADR-735 — η σύρση δεν ζητά καρέ ανά pixel', () => {
  it('δύο κινήσεις ΜΕΣΑ στο ίδιο κελί προορισμού ⇒ **ένα** καρέ', () => {
    startDrag();
    frames.mockClear();
    moveTo(45, 22);
    expect(frames).toHaveBeenCalledTimes(1);
    moveTo(55, 28); // ίδιο κελί (r2, c2) — η απάντηση δεν άλλαξε
    expect(frames).toHaveBeenCalledTimes(1);
    moveTo(65, 28); // (r2, c3) — τώρα άλλαξε
    expect(frames).toHaveBeenCalledTimes(2);
  });
});

// ── 6. Η είσοδος της χειρονομίας: πού πιάνεται το περίγραμμα ────────────────

describe('tableRangeGrabAtWorld — η μετατόπιση σύλληψης', () => {
  /** Το σημείο του πλαισίου, σε συντεταγμένες **κόσμου** (ό,τι δέχεται το hit-test). */
  function worldAt(u: number, v: number) {
    const { mmToWorld } = computeTableEntityGeometryLive(entity);
    return tableFrameToWorld(entity, u, v, mmToWorld);
  }

  /** Επιλογή `r1c1:r2c2` ⇒ ορθογώνιο x 20..60, y 10..30. */
  const SELECTION: TableSelectionSpan = {
    from: { rowId: 'r1' as TableRowId, colId: 'c1' as TableColumnId },
    to: { rowId: 'r2' as TableRowId, colId: 'c2' as TableColumnId },
    kind: 'range',
  };

  const grabAt = (u: number, v: number) =>
    tableRangeGrabAtWorld(entity, worldAt(u, v), TABLE_TEST_VIEW.transform.scale, SELECTION);

  it('πάτημα ΜΕΣΑ στο σώμα της επιλογής (μακριά από το περίγραμμα) ⇒ καμία σύλληψη', () => {
    // Το κέντρο της περιοχής είναι `cell-select`, όχι `range-move` — η ζώνη ζει στη γραμμή.
    expect(grabAt(40, 20)).toBeNull();
  });

  it('χωρίς επιλογή δεν υπάρχει περίγραμμα να πιαστεί', () => {
    expect(tableRangeGrabAtWorld(entity, worldAt(20, 10), TABLE_TEST_VIEW.transform.scale, null))
      .toBeNull();
  });

  it('🔴 κάτω από το LOD του δείκτη ⇒ καμία σύλληψη (ο ΙΔΙΟΣ φύλακας, όχι δεύτερος)', () => {
    // Σε ακραίο zoom-out ο πίνακας πέφτει κάτω από το `MIN_TABLE_SCREEN_PX` και ο δείκτης
    // παύει να ζωγραφίζεται. Ένα «ναι» εδώ θα σήμαινε περίγραμμα που **πιάνεται** ενώ ο
    // δείκτης δηλώνει σταυρό — δηλαδή δείκτης που ψεύδεται (§31).
    expect(tableRangeGrabAtWorld(entity, worldAt(20, 10), 0.001, SELECTION)).toBeNull();
  });

  it('🔴 πάτημα στην ΠΑΝΩ-ΑΡΙΣΤΕΡΗ γωνία ⇒ μετατόπιση (0,0), ποτέ αρνητική', () => {
    // Το σημείο πέφτει ακριβώς πάνω σε γραμμή του πλέγματος, όπου το `tableCellAtFrame`
    // απαντά το **προηγούμενο** κελί (κλειστά διαστήματα). Ο περιορισμός σε **δείκτες** το
    // εξουδετερώνει· χωρίς αυτόν η περιοχή θα προσγειωνόταν ένα κελί παρακάτω σε κάθε κίνηση.
    const grabbed = grabAt(20, 10);
    expect(grabbed?.source).toEqual({ firstRow: 1, lastRow: 2, firstCol: 1, lastCol: 2 });
    expect(grabbed?.grab).toEqual({ dRow: 0, dCol: 0 });
  });

  it('πάτημα στην ΚΑΤΩ-ΔΕΞΙΑ γωνία ⇒ μετατόπιση (1,1), ποτέ εκτός περιοχής', () => {
    expect(grabAt(60, 30)?.grab).toEqual({ dRow: 1, dCol: 1 });
  });

  it('πάτημα στη ΜΕΣΗ της κάτω πλευράς ⇒ η γραμμή είναι η τελευταία, η στήλη ακολουθεί το χέρι', () => {
    expect(grabAt(30, 30)?.grab).toEqual({ dRow: 1, dCol: 0 });
  });
});

/** Ο μετασχηματισμός των tests πρέπει να ταιριάζει με το δοχείο — αλλιώς όλα τα παραπάνω λένε ψέματα. */
it('η προβολή των tests είναι συνεπής: κέντρο πλαισίου → κέντρο δοχείου', () => {
  const point = tableFrameScreenPoint(entity, 0, 0);
  const world = CoordinateTransforms.screenToWorld(point, TABLE_TEST_VIEW.transform, TABLE_TEST_VIEW.viewport);
  expect(world.x).toBeCloseTo(0, 6);
  expect(world.y).toBeCloseTo(0, 6);
});
