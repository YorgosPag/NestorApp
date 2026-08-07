/**
 * 🔴 ADR-769 Δ7 — **Η ΓΡΑΨΙΜΟΤΗΤΑ ΦΤΑΝΕΙ ΣΤΟ ΜΕΛΑΝΙ.**
 *
 * Ο κριτής (`boundColumnStripsMm`) ήδη δηλώνει `writable` ανά λωρίδα και το φυλάει το
 * `table-bound-marks.test.ts`. Αυτό όμως είναι **δεδομένο σε αντικείμενο**: αν ο ζωγράφος το
 * αγνοούσε, ο χρήστης θα έβλεπε **τέσσερις ταυτόσημες λωρίδες** και η απόφαση Δ7 θα ζούσε
 * αποκλειστικά μέσα σε ένα test — δηλαδή θα ήταν σχόλιο (ADR-587 §6.1).
 *
 * Η μόνη απόδειξη είναι το **`fillStyle` που όντως τέθηκε**, σε σειρά, ανά λωρίδα.
 *
 * ## Γιατί ένταση και όχι χρώμα
 * Το μπλε της λωρίδας είναι πιασμένο (`INDICATOR_BLUE`, το χρώμα «δείκτη» όλου του viewer).
 * Έντονη = «γράψε μου και θα το πω στην οντότητα»· ξεθωριασμένη = «μόνο διαβάζεις» — η λέξη
 * που χρησιμοποιεί το ίδιο το Revit για τα calculated values: *«read-only… greyed out»*.
 *
 * @see rendering/entities/table/stamp-table-bound-state.ts — ο ζωγράφος
 * @see config/color-config.ts — `TABLE_BOUND_STATE.readOnlyColumnAlpha`
 */

import { stampTableBoundState } from '../stamp-table-bound-state';
import { clearPrintColorPolicy, setPrintColorPolicy } from '../../../../config/print-color-policy';
import { TABLE_BOUND_STATE } from '../../../../config/color-config';
import type { StampTableContext } from '../stamp-table-layout';
import type { BoundColumnStrip } from '../../../../bim/table/binding/table-bound-marks';

/** Κάθε `fillStyle` που τέθηκε, με τη σειρά — η μόνη απόδειξη «τι χρώμα πήρε ποια λωρίδα». */
function recorder(): { rc: StampTableContext; fills: string[] } {
  const fills: string[] = [];
  const noop = () => undefined;
  const ctx = {
    save: noop, restore: noop, beginPath: noop, moveTo: noop, lineTo: noop,
    closePath: noop, stroke: noop, setLineDash: noop,
    // Καταγράφεται στο **fill**, όχι στο setter: μας ενδιαφέρει τι ίσχυε τη στιγμή της
    // ζωγραφικής, όχι πόσες φορές ανατέθηκε.
    fill: () => { fills.push(String((ctx as { fillStyle?: unknown }).fillStyle)); },
    fillStyle: '',
    canvas: { width: 800, height: 600 },
  } as unknown as CanvasRenderingContext2D;

  return {
    fills,
    rc: {
      ctx,
      toScreen: (u: number, v: number) => ({ x: u, y: v }),
      pxPerMm: 4,
      textAngleRad: 0,
      surfaceHex: '#1d283a',
    },
  };
}

/** `cIdx` παράγωγη (δεν γράφεται) · `cX` γράψιμη · `cZ` χωρίς ιδιοκτήτη. */
const STRIPS: readonly BoundColumnStrip[] = [
  { colId: 'cIdx', xMm: 0, widthMm: 15, writable: false },
  { colId: 'cX', xMm: 15, widthMm: 25, writable: true },
  { colId: 'cZ', xMm: 40, widthMm: 25, writable: false },
];

afterEach(() => { clearPrintColorPolicy(); });

describe('ADR-769 Δ7 — το μελάνι ξεχωρίζει τη γράψιμη στήλη', () => {
  it('🔴 ΤΡΕΙΣ λωρίδες, ΔΥΟ εντάσεις — η γράψιμη είναι η μόνη έντονη', () => {
    const { rc, fills } = recorder();
    stampTableBoundState(rc, { strips: STRIPS, marks: [], stale: false });

    expect(fills).toHaveLength(3);
    expect(fills[0]).toBe(fills[2]);      // οι δύο μη γράψιμες συμφωνούν
    expect(fills[1]).not.toBe(fills[0]);  // η γράψιμη ξεχωρίζει
  });

  it('η ένταση είναι ΑΚΡΙΒΩΣ αυτή που δηλώνει το SSoT χρωμάτων — όχι νούμερο στον ζωγράφο', () => {
    const { rc, fills } = recorder();
    stampTableBoundState(rc, { strips: STRIPS, marks: [], stale: false });

    expect(fills[1]).toContain(String(TABLE_BOUND_STATE.columnAlpha));
    expect(fills[0]).toContain(String(TABLE_BOUND_STATE.readOnlyColumnAlpha));
  });

  it('🔴 η ξεθωριασμένη λωρίδα παραμένει ΟΡΑΤΗ — «greyed out», όχι «σβησμένη»', () => {
    // Μηδενική διαφάνεια θα έκρυβε ότι η στήλη τρέφεται από πηγή, δηλαδή θα έσβηνε την
    // πληροφορία του ADR-767 Δ4 για να πει αυτή του Δ7. Οι δύο συνυπάρχουν.
    expect(TABLE_BOUND_STATE.readOnlyColumnAlpha).toBeGreaterThan(0.1);
    expect(TABLE_BOUND_STATE.readOnlyColumnAlpha).toBeLessThan(TABLE_BOUND_STATE.columnAlpha);
  });

  it('🔴🔴 ΤΙΠΟΤΑ ΑΠΟ ΑΥΤΑ ΔΕΝ ΦΤΑΝΕΙ ΣΤΟ ΧΑΡΤΙ — ο φρουρός είναι πάνω από όλα', () => {
    setPrintColorPolicy({ mode: 'monochrome' });
    const { rc, fills } = recorder();
    stampTableBoundState(rc, { strips: STRIPS, marks: [], stale: false });
    expect(fills).toEqual([]);
  });
});
