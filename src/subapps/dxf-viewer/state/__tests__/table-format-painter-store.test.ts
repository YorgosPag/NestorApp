/**
 * 🔴 ADR-768 Φ4 — `table-format-painter-store`: **η ΛΕΙΤΟΥΡΓΙΑ του πινέλου μορφοποίησης**.
 *
 * Οι άγκυρες εδώ **δεν** είναι «θέτω και διαβάζω». Κάθε μία φυλάει μία απόφαση που, αν
 * σπάσει, δίνει σφάλμα **ορατό μόνο στην οθόνη**:
 *
 *  1. **Η διάρκεια** (Α1). `once` καταναλώνεται, `locked` όχι. Αν το `locked` κατανάλωνε, το
 *     διπλό κλικ θα ήταν λειτουργικά ίδιο με το μονό — δηλαδή μια ολόκληρη χειρονομία του
 *     Excel θα εξαφανιζόταν χωρίς κανένα σφάλμα πουθενά.
 *  2. **Ο φύλακας της συνεδρίας.** Θάνατος δρομέα ⇒ σβήνει· **αλλαγή πίνακα ⇒ ΔΕΝ σβήνει**.
 *     Οι δύο μαζί, ποτέ η μία: η πρώτη μόνη της προσκαλεί έναν «διορθωτή» να την κάνει
 *     `entityId`-φύλακα, που σκοτώνει σιωπηλά το βάψιμο από πίνακα σε πίνακα (§2 της
 *     κεφαλίδας του store) — και το cross-table το κάνουν **και οι πέντε** μεγάλοι.
 *  3. **Η άρνηση χωρίς στόχο.** Οπλισμένο πινέλο χωρίς συνεδρία = κολλημένη διεπαφή.
 *  4. **Η σιωπή του `locked`.** Κατανάλωση που δεν αλλάζει κατάσταση δεν επιτρέπεται να
 *     ειδοποιεί — αλλιώς κουμπί και δείκτης ξανα-αποδίδονται σε **κάθε** βάψιμο.
 *
 * Ο δρομέας κελιού δεν είναι test double: είναι το **πραγματικό** SSoT store, γιατί ακριβώς η
 * σύζευξη με αυτό είναι το αντικείμενο των αγκυρών 2 και 3.
 */

import {
  __resetTableFormatPainterForTests,
  armTableFormatPainter,
  consumeTableFormatPainterBrush,
  disarmTableFormatPainter,
  getTableFormatPainter,
  getTableFormatPainterState,
  isTableFormatPainterArmed,
  subscribeTableFormatPainter,
} from '../table-format-painter-store';
import {
  __resetTableCellCursorStoreForTests,
  closeTableCellCursor,
  setTableCellCursor,
} from '../table-cell-cursor-store';
import { tableCursorAt } from '../../bim/table/table-cell-navigation';
import { ALL_TABLE_FORMAT_FACETS, type TableFormatBrush } from '../../bim/table/table-format-payload';
import { TABLE_GENERAL_FORMAT } from '../../types/table-cell-format';
import type { TableBorderSpec } from '../../types/table-edges';

jest.mock('../../rendering/core/frame-scheduler-api', () => ({
  markSystemsDirty: jest.fn(),
}));

const EDGE: TableBorderSpec = { visible: true, colorHex: '#000000', widthMm: 0.25 };

/**
 * Ένα ελάχιστο φορτίο 1×1. Το `textColorHex` παίζει τον ρόλο **σφραγίδας**: όταν δύο φορτία
 * πρέπει να ξεχωρίζουν (ξαναρούφηγμα), η άγκυρα κοιτά τη σφραγίδα και όχι την ταυτότητα
 * αντικειμένου — αλλιώς θα περνούσε και με store που κρατά το **παλιό** φορτίο.
 */
function brushStamped(stamp: string): TableFormatBrush {
  return {
    facets: ALL_TABLE_FORMAT_FACETS,
    rows: 1,
    columns: 1,
    cells: [
      {
        style: {
          textHeightMm: 2.5,
          textColorHex: stamp,
          bold: false,
          italic: false,
          underline: false,
          align: 'ML',
        },
        numberFormat: TABLE_GENERAL_FORMAT,
        overflow: 'clip',
        diagonal: undefined,
        borders: { top: EDGE, right: EDGE, bottom: EDGE, left: EDGE },
      },
    ],
  };
}

/** Ανοίγει συνεδρία κελιού στον πίνακα `entityId` — η προϋπόθεση κάθε οπλισμού. */
function openSessionOn(entityId: string): void {
  setTableCellCursor(entityId, tableCursorAt('r1', 'c1'), 'nav');
}

beforeEach(() => {
  __resetTableFormatPainterForTests();
  __resetTableCellCursorStoreForTests();
});

// ──────────────────────────────────────────────────────────────────────────────

describe('οι τρεις καταστάσεις', () => {
  it('ξεκινά ανενεργό — κανένα φορτίο, καμία λέξη κατάστασης πέρα από «idle»', () => {
    expect(getTableFormatPainter()).toBeNull();
    expect(getTableFormatPainterState()).toBe('idle');
    expect(isTableFormatPainterArmed()).toBe(false);
  });

  it('μονό κλικ ⇒ οπλισμένο «μία χρήση», με το φορτίο ακέραιο', () => {
    openSessionOn('tbl_1');
    const brush = brushStamped('#ff0000');

    expect(armTableFormatPainter(brush, 'once')).toBe(true);

    expect(getTableFormatPainterState()).toBe('once');
    expect(isTableFormatPainterArmed()).toBe(true);
    expect(getTableFormatPainter()).toEqual({ mode: 'once', brush });
  });

  it('διπλό κλικ ⇒ οπλισμένο «κλειδωμένο»', () => {
    openSessionOn('tbl_1');
    armTableFormatPainter(brushStamped('#00ff00'), 'locked');

    expect(getTableFormatPainterState()).toBe('locked');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 η διάρκεια — Α1 («μονό = μία χρήση, διπλό = κλειδωμένο»)', () => {
  it('«μία χρήση»: η κατανάλωση δίνει το φορτίο ΚΑΙ σβήνει το πινέλο', () => {
    openSessionOn('tbl_1');
    const brush = brushStamped('#ff0000');
    armTableFormatPainter(brush, 'once');

    expect(consumeTableFormatPainterBrush()).toBe(brush);
    expect(getTableFormatPainterState()).toBe('idle');
  });

  it('«μία χρήση» σημαίνει ΜΙΑ: η δεύτερη κατανάλωση δεν δίνει τίποτα', () => {
    openSessionOn('tbl_1');
    armTableFormatPainter(brushStamped('#ff0000'), 'once');

    consumeTableFormatPainterBrush();

    expect(consumeTableFormatPainterBrush()).toBeNull();
  });

  it('🔴 «κλειδωμένο»: βάφει ξανά και ξανά — τρεις καταναλώσεις, ίδιο φορτίο, ακόμη οπλισμένο', () => {
    openSessionOn('tbl_1');
    const brush = brushStamped('#00ff00');
    armTableFormatPainter(brush, 'locked');

    expect(consumeTableFormatPainterBrush()).toBe(brush);
    expect(consumeTableFormatPainterBrush()).toBe(brush);
    expect(consumeTableFormatPainterBrush()).toBe(brush);
    expect(getTableFormatPainterState()).toBe('locked');
  });

  it('ανενεργό πινέλο δεν έχει τι να καταναλώσει', () => {
    expect(consumeTableFormatPainterBrush()).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ο ιδιοκτήτης κύκλου ζωής — ο ΔΡΟΜΕΑΣ, όχι ο πίνακας', () => {
  it('ο θάνατος της συνεδρίας σβήνει το πινέλο, χωρίς να το ζητήσει κανείς', () => {
    openSessionOn('tbl_1');
    armTableFormatPainter(brushStamped('#ff0000'), 'locked');

    closeTableCellCursor();

    expect(getTableFormatPainterState()).toBe('idle');
  });

  it('🔴 Η ΑΛΛΑΓΗ ΠΙΝΑΚΑ ΔΕΝ ΤΟ ΣΒΗΝΕΙ — βάψιμο από πίνακα σε πίνακα (Excel μεταξύ φύλλων)', () => {
    openSessionOn('tbl_1');
    const brush = brushStamped('#ff0000');
    armTableFormatPainter(brush, 'locked');

    openSessionOn('tbl_2');

    expect(getTableFormatPainter()).toEqual({ mode: 'locked', brush });
  });

  it('ούτε η μετακίνηση μέσα στον ίδιο πίνακα το σβήνει (ο δρομέας γράφεται σε κάθε πλήκτρο)', () => {
    openSessionOn('tbl_1');
    armTableFormatPainter(brushStamped('#ff0000'), 'once');

    setTableCellCursor('tbl_1', tableCursorAt('r9', 'c9'), 'edit', 'πληκτρολογώ');

    expect(getTableFormatPainterState()).toBe('once');
  });

  it('🔴 χωρίς ζωντανή συνεδρία ο οπλισμός ΑΡΝΕΙΤΑΙ και το λέει', () => {
    expect(armTableFormatPainter(brushStamped('#ff0000'), 'once')).toBe(false);
    expect(getTableFormatPainterState()).toBe('idle');
  });

  it('ο φύλακας ΞΑΝΑ-εγκαθίσταται μετά από κύκλο οπλισμός→σβήσιμο→οπλισμός', () => {
    openSessionOn('tbl_1');
    armTableFormatPainter(brushStamped('#ff0000'), 'locked');
    disarmTableFormatPainter();

    armTableFormatPainter(brushStamped('#0000ff'), 'locked');
    closeTableCellCursor();

    expect(getTableFormatPainterState()).toBe('idle');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('ιδεμποτία και ειδοποιήσεις', () => {
  it('το σβήσιμο είναι ιδεμποτές — η δεύτερη κλήση δεν ειδοποιεί κανέναν', () => {
    openSessionOn('tbl_1');
    armTableFormatPainter(brushStamped('#ff0000'), 'once');
    const listener = jest.fn();
    subscribeTableFormatPainter(listener);

    disarmTableFormatPainter();
    disarmTableFormatPainter();
    disarmTableFormatPainter();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ο οπλισμός ΔΕΝ είναι ιδεμποτής — δεύτερο ρούφηγμα αντικαθιστά το φορτίο και ειδοποιεί', () => {
    openSessionOn('tbl_1');
    const listener = jest.fn();
    subscribeTableFormatPainter(listener);

    armTableFormatPainter(brushStamped('#ff0000'), 'once');
    armTableFormatPainter(brushStamped('#0000ff'), 'locked');

    expect(listener).toHaveBeenCalledTimes(2);
    expect(getTableFormatPainter()?.brush.cells[0].style.textColorHex).toBe('#0000ff');
    expect(getTableFormatPainterState()).toBe('locked');
  });

  it('🔴 η κατανάλωση σε «κλειδωμένο» ΣΙΩΠΑ — τίποτα δεν άλλαξε, κανείς δεν ξανα-αποδίδει', () => {
    openSessionOn('tbl_1');
    armTableFormatPainter(brushStamped('#00ff00'), 'locked');
    const listener = jest.fn();
    subscribeTableFormatPainter(listener);

    consumeTableFormatPainterBrush();
    consumeTableFormatPainterBrush();

    expect(listener).not.toHaveBeenCalled();
  });

  it('η κατανάλωση σε «μία χρήση» ειδοποιεί ΜΙΑ φορά (το κουμπί σβήνει)', () => {
    openSessionOn('tbl_1');
    armTableFormatPainter(brushStamped('#ff0000'), 'once');
    const listener = jest.fn();
    subscribeTableFormatPainter(listener);

    consumeTableFormatPainterBrush();
    consumeTableFormatPainterBrush();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
