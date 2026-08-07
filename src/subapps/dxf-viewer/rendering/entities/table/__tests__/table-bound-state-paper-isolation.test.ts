/**
 * 🔴🔴 ADR-767 Δ4 — **Η ΔΕΥΤΕΡΗ ΠΟΡΤΑ ΠΡΟΣ ΤΟ ΧΑΡΤΙ**, που κανένα υπάρχον test δεν φυλούσε.
 *
 * ## Το εύρημα (07/08, μετρημένο με grep — όχι διαβασμένο από ADR)
 * Το ADR-767 §8 #5 φυλάει τη διαρροή της ένδειξης στο παραδοτέο, και το υπάρχον
 * `table-binding-export.test.ts` το κάνει σωστά: εκτελεί την **πραγματική** `decomposeTable`
 * και απαιτεί **ταυτόσημα** primitives με πίνακα χωρίς δεσμό.
 *
 * 🔴 Αυτό όμως φυλάει **μία** από τις **δύο** πόρτες. Η εκτύπωση σε PDF **δεν** περνά από το
 * `tableLayoutToPrimitives`: το `print/capture/capture-2d.ts` ρασταροποιεί **μέσα από τους
 * ίδιους renderers**, καλώντας `renderer.render(...)` σε offscreen καμβά. Δηλαδή ένας
 * ζωγράφος μέσα στον `TableRenderer` καταλήγει **αυτούσιος στο χαρτί**, με το test της
 * εξαγωγής να μένει **πράσινο**.
 *
 * Θα ήταν η πέμπτη εμφάνιση του «πράσινο = κανείς δεν κοίταξε **εκεί**».
 *
 * ## Ο φρουρός: `getPrintColorPolicy()`, όχι νέα σημαία
 * Η ερώτηση «είμαι πάνω σε χαρτί;» έχει **ήδη** έναν ιδιοκτήτη, που το `table-ink.ts` ήδη
 * ρωτά για να διαλέξει επιφάνεια (`liveTableSurfaceHex`). Μια δεύτερη σημαία θα ήταν δεύτερη
 * απάντηση στην ίδια ερώτηση, δηλαδή ένα σημείο όπου το μελάνι και ο δείκτης μπορούν να
 * διαφωνήσουν για το αν τυπώνονται.
 *
 * ⚠️ Το `skipInteractive` **δεν** χρησιμεύει εδώ: το καταναλώνει ο `DxfRenderer` για να
 * μηδενίσει επιλογή/hover/λαβές και **δεν φτάνει** στους επιμέρους renderers· επιπλέον το
 * περνά **και** το bitmap cache, που είναι οθόνη — άρα θα έσβηνε τον δείκτη εκεί που πρέπει
 * να φαίνεται.
 *
 * @see rendering/entities/table/stamp-table-bound-state.ts — ο ζωγράφος
 * @see print/capture/capture-2d.ts — η δεύτερη πόρτα
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ4, §8 #5
 */

import { stampTableBoundState } from '../stamp-table-bound-state';
import { clearPrintColorPolicy, setPrintColorPolicy } from '../../../../config/print-color-policy';
import type { StampTableContext } from '../stamp-table-layout';
import type { BoundColumnStrip, BoundExceptionMark } from '../../../../bim/table/binding/table-bound-marks';

/** Κάθε κλήση ζωγραφικής, καταγεγραμμένη — η μόνη απόδειξη ότι «δεν ζωγραφίστηκε τίποτα». */
interface Recorder {
  readonly rc: StampTableContext;
  readonly calls: string[];
}

function recorder(): Recorder {
  const calls: string[] = [];
  const record = (name: string) => () => { calls.push(name); };
  const ctx = {
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    fill: record('fill'),
    stroke: record('stroke'),
    setLineDash: record('setLineDash'),
    canvas: { width: 800, height: 600 },
  } as unknown as CanvasRenderingContext2D;

  return {
    calls,
    rc: {
      ctx,
      toScreen: (u: number, v: number) => ({ x: u, y: v }),
      pxPerMm: 4,
      textAngleRad: 0,
      surfaceHex: '#1d283a',
    },
  };
}

const STRIPS: readonly BoundColumnStrip[] = [
  { colId: 'cIdx', xMm: 0, widthMm: 15, writable: false },
  { colId: 'cX', xMm: 15, widthMm: 25, writable: true },
];
const MARKS: readonly BoundExceptionMark[] = [
  { rowId: 'r1', colId: 'cX', state: 'overridden', rect: { x: 15, y: 8, w: 25, h: 6 } },
  { rowId: 'r2', colId: 'cX', state: 'conflict', rect: { x: 15, y: 14, w: 25, h: 6 } },
];

/** Ό,τι βάζει μελάνι στον καμβά — `save`/`restore` δεν μετρούν ως ζωγραφική. */
const INK = ['fill', 'stroke'];

afterEach(() => {
  clearPrintColorPolicy();
});

// ─── 1. Η οθόνη — ο δείκτης ΥΠΑΡΧΕΙ ───────────────────────────────────────────

describe('stampTableBoundState — στην οθόνη ζωγραφίζει', () => {
  it('η λωρίδα της δεμένης στήλης βάζει μελάνι', () => {
    const r = recorder();

    stampTableBoundState(r.rc, { strips: STRIPS, marks: [], stale: false });

    expect(r.calls.filter((c) => INK.includes(c)).length).toBeGreaterThan(0);
  });

  it('τα σημάδια εξαίρεσης βάζουν μελάνι', () => {
    const r = recorder();

    stampTableBoundState(r.rc, { strips: [], marks: MARKS, stale: false });

    expect(r.calls.filter((c) => INK.includes(c)).length).toBeGreaterThan(0);
  });

  it('ο μπαγιάτικος πίνακας αλλάζει το μοτίβο της λωρίδας — δεν προσθέτει σχήμα', () => {
    const fresh = recorder();
    const stale = recorder();

    stampTableBoundState(fresh.rc, { strips: STRIPS, marks: [], stale: false });
    stampTableBoundState(stale.rc, { strips: STRIPS, marks: [], stale: true });

    expect(stale.calls).toContain('setLineDash');
    expect(fresh.calls).not.toContain('setLineDash');
  });
});

// ─── 2. 🔴 ΤΟ ΧΑΡΤΙ — Ο ΔΕΙΚΤΗΣ ΔΕΝ ΥΠΑΡΧΕΙ ──────────────────────────────────

describe('🔴 stampTableBoundState — με ενεργή πολιτική εκτύπωσης ΔΕΝ ζωγραφίζει ΤΙΠΟΤΑ', () => {
  beforeEach(() => {
    setPrintColorPolicy({ style: 'colour', dpi: 300 });
  });

  it('🔴 ΛΩΡΙΔΕΣ ΣΤΗΛΩΝ: μηδέν μελάνι στο χαρτί', () => {
    const r = recorder();

    stampTableBoundState(r.rc, { strips: STRIPS, marks: [], stale: false });

    expect(r.calls).toEqual([]);
  });

  it('🔴 ΣΗΜΑΔΙΑ ΠΑΡΑΚΑΜΨΗΣ/ΣΥΓΚΡΟΥΣΗΣ: μηδέν μελάνι στο χαρτί', () => {
    const r = recorder();

    stampTableBoundState(r.rc, { strips: [], marks: MARKS, stale: false });

    expect(r.calls).toEqual([]);
  });

  it('🔴 ΜΠΑΓΙΑΤΙΚΟΣ ΠΙΝΑΚΑΣ: το σήμα ΔΕΝ φτάνει στο υπογεγραμμένο παραδοτέο', () => {
    const r = recorder();

    stampTableBoundState(r.rc, { strips: STRIPS, marks: MARKS, stale: true });

    expect(r.calls).toEqual([]);
  });

  it('ισχύει σε ΚΑΘΕ στυλ εκτύπωσης — όχι μόνο στο έγχρωμο', () => {
    for (const style of ['monochrome', 'grayscale', 'by-pen'] as const) {
      clearPrintColorPolicy();
      setPrintColorPolicy({ style, dpi: 300 });
      const r = recorder();

      stampTableBoundState(r.rc, { strips: STRIPS, marks: MARKS, stale: true });

      expect(r.calls).toEqual([]);
    }
  });

  it('🔴 ΜΟΛΙΣ ΚΑΘΑΡΙΣΕΙ Η ΠΟΛΙΤΙΚΗ, Ο ΔΕΙΚΤΗΣ ΓΥΡΝΑΕΙ — ο φρουρός δεν είναι μονόδρομος', () => {
    clearPrintColorPolicy();
    const r = recorder();

    stampTableBoundState(r.rc, { strips: STRIPS, marks: [], stale: false });

    expect(r.calls.length).toBeGreaterThan(0);
  });
});

// ─── 3. Το τίποτα ─────────────────────────────────────────────────────────────

describe('stampTableBoundState — καμία δουλειά σε πίνακα χωρίς δεσμό', () => {
  it('χωρίς λωρίδες και χωρίς σημάδια δεν αγγίζει καν τον καμβά', () => {
    const r = recorder();

    stampTableBoundState(r.rc, { strips: [], marks: [], stale: false });

    expect(r.calls).toEqual([]);
  });
});
