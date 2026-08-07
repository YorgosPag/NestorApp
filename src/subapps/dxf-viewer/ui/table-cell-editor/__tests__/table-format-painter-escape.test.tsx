/**
 * 🔴 **ADR-768 Α6 / §4.4 — ΤΟ `Esc` ΣΒΗΝΕΙ ΤΟ ΠΙΝΕΛΟ, ΟΧΙ ΤΗ ΣΥΝΕΔΡΙΑ.**
 *
 * ## Το ελάττωμα που ΔΕΝ έφτασε ποτέ στην οθόνη, επειδή μετρήθηκε πρώτα
 * Ο inline editor του κελιού γράφεται στο **P1000** (`MODAL_DIALOG`) με
 * `canHandle: () => !settledRef.current`, που είναι `true` σε **ολόκληρη** τη συνεδρία — και το
 * `<TableCellEditorOverlay>` μοντάρεται όποτε **υπάρχει δρομέας**, όχι μόνο σε γραφή. Σε
 * κατάσταση `nav` το `handleCancel` του καλεί `closeTableCellCursor()`.
 *
 * ⇒ **Κάθε σκαλί ≤1000 είναι δομικά σκιασμένο.** Ένα `Esc` με οπλισμένο πινέλο θα έκλεινε τον
 * πίνακα αντί να ακυρώσει το εργαλείο — δηλαδή ο χρήστης θα έχανε τη θέση του για να πατήσει
 * «άκυρο». Ίδιο σχήμα με τις μετρήσεις `GROUP_EXIT` 275→408 του ADR-364 §10.14.
 *
 * ## Η ερώτηση των anchors
 * **«Ποιος κατανάλωσε το `Esc`;»** — με **δύο** πραγματικούς handlers στον πραγματικό bus, όχι
 * με σύγκριση αριθμών. Ένα test που έγραφε `expect(TABLE_FORMAT_PAINTER).toBeGreaterThan(MODAL_DIALOG)`
 * θα ήταν πράσινο ακόμη κι αν η **εγγραφή** έλειπε ολόκληρη — και «σταθερά χωρίς εγγραφή» είναι
 * ακριβώς το τοπόσημο τεκμηρίωσης που το `escape-priority.ts` καταγγέλλει ονομαστικά.
 *
 * @see ui/table-cell-editor/use-table-format-painter-actions.ts — η ΜΙΑ εγγραφή
 * @see systems/escape-bus/escape-priority.ts — γιατί 1025 και όχι λιγότερο
 */

import { renderHook } from '@testing-library/react';
import { escapeBus } from '../../../systems/escape-bus/EscapeCommandBus';
import { ESC_PRIORITY } from '../../../systems/escape-bus/escape-priority';
import { useEscapeHandler } from '../../../systems/escape-bus/useEscapeHandler';
import { useTableFormatPainterActions } from '../use-table-format-painter-actions';
import {
  __resetTableFormatPainterForTests,
  armTableFormatPainter,
  getTableFormatPainterState,
} from '../../../state/table-format-painter-store';
import {
  __resetTableCellCursorStoreForTests,
  setTableCellCursor,
} from '../../../state/table-cell-cursor-store';
import type { TableFormatBrush } from '../../../bim/table/table-format-payload';

const BRUSH = { facets: new Set(), rows: 1, columns: 1, cells: [] } as unknown as TableFormatBrush;

/** Ό,τι κατανάλωσε το `Esc`, με τη σειρά. Η μόνη ερώτηση που έχει σημασία εδώ. */
let consumedBy: string[] = [];

/**
 * Το **πιστό** ομοίωμα του inline editor: P1000, `allowWhenEditable`, και `canHandle` που
 * απαντά **πάντα** ναι όσο ζει η συνεδρία. Δες την κεφαλίδα — αυτό ακριβώς είναι που σκιάζει.
 */
function useFakeCellEditorEscape(): void {
  useEscapeHandler({
    id: 'fake-inline-editor',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    allowWhenEditable: true,
    canHandle: () => true,
    handle: () => {
      consumedBy.push('cell-editor');
      return true;
    },
  });
}

/** Η παραγωγή και ο ανταγωνιστής της, μονταρισμένα μαζί — όπως στη ζωντανή συνεδρία. */
function useBothHandlers(): void {
  useFakeCellEditorEscape();
  useTableFormatPainterActions({ liveTable: () => null, bounds: () => null });
}

function pressEscape(): void {
  escapeBus.__dispatchForTests(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
}

describe('🔴 ADR-768 Α6 — το `Esc` του πινέλου, στο σκαλί 1025', () => {
  beforeEach(() => {
    consumedBy = [];
    escapeBus.__resetForTests();
    __resetTableFormatPainterForTests();
    __resetTableCellCursorStoreForTests();
    // Ο δρομέας είναι προϋπόθεση του οπλισμού — και ταυτόχρονα ο λόγος που ο editor ακούει.
    setTableCellCursor('t1', { rowId: 'r0', colId: 'c0', anchorColId: 'c0' }, 'nav');
  });

  afterEach(() => {
    escapeBus.__resetForTests();
    __resetTableFormatPainterForTests();
    __resetTableCellCursorStoreForTests();
  });

  it('🔴 ΟΠΛΙΣΜΕΝΟ: το `Esc` σβήνει το πινέλο και ΔΕΝ φτάνει στον επεξεργαστή κελιού', () => {
    const view = renderHook(() => useBothHandlers());
    armTableFormatPainter(BRUSH, 'locked');

    pressEscape();

    expect(getTableFormatPainterState()).toBe('idle');
    // Το κρίσιμο μισό: η συνεδρία **δεν** έκλεισε, γιατί ο editor δεν είδε ποτέ το πλήκτρο.
    expect(consumedBy).toEqual([]);
    view.unmount();
  });

  it('🔴 ΑΝΕΝΕΡΓΟ: το `Esc` περνά ακέραιο στον επεξεργαστή — ο handler είναι inert', () => {
    // Χωρίς αυτό, ένα σκαλί πάνω από τα modal που απαντά **πάντα** θα κατανάλωνε κάθε `Esc`
    // της εφαρμογής — η παλινδρόμηση §10.12 του ADR-364, ένα σκαλί ψηλότερα.
    const view = renderHook(() => useBothHandlers());

    pressEscape();

    expect(consumedBy).toEqual(['cell-editor']);
    view.unmount();
  });

  it('🔴 δεύτερο `Esc` μετά το σβήσιμο ανήκει ξανά στον επεξεργαστή', () => {
    const view = renderHook(() => useBothHandlers());
    armTableFormatPainter(BRUSH, 'once');

    pressEscape();
    pressEscape();

    expect(consumedBy).toEqual(['cell-editor']);
    view.unmount();
  });

  it('η εγγραφή ξεγράφεται στο ξεμοντάρισμα — κανένας κρεμασμένος καταναλωτής `Esc`', () => {
    const view = renderHook(() => useTableFormatPainterActions({
      liveTable: () => null,
      bounds: () => null,
    }));
    expect(escapeBus.inspect().handlers.some((h) => h.id === 'table-format-painter')).toBe(true);

    view.unmount();

    expect(escapeBus.inspect().handlers.some((h) => h.id === 'table-format-painter')).toBe(false);
  });
});
