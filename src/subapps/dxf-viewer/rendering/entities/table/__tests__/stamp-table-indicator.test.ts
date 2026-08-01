/**
 * ADR-739 Φ.Δ βήμα 7 — ο **δείκτης πίνακα** στον καμβά (AutoCAD `TABLEINDICATOR`).
 *
 * Ελέγχεται **τι ζωγραφίστηκε πραγματικά**, όχι τι επιστράφηκε: ο stamper δεν επιστρέφει
 * τίποτα, οπότε η μόνη έγκυρη μαρτυρία είναι οι κλήσεις πάνω στο context. Ίδια στάση με
 * τον καταγραφέα ζωγραφικής που χρησιμοποιεί η ζωντανή επαλήθευση.
 */

import { stampTableIndicator } from '../stamp-table-indicator';
import { TABLE_INDICATOR } from '../../../../config/color-config';
import type { StampTableContext } from '../stamp-table-layout';
import type { TableIndicatorTick } from '../../../../bim/table/table-cell-reference';

interface Painted {
  readonly text: string;
  readonly fillStyle: string;
  readonly font: string;
}

/** Ένα context που καταγράφει· `pxPerMm` περνά απ' έξω ώστε να δοκιμάζεται το LOD. */
function fakeContext(pxPerMm: number): {
  readonly rc: StampTableContext;
  readonly painted: Painted[];
  readonly fills: string[];
} {
  const painted: Painted[] = [];
  const fills: string[] = [];
  const state = { fillStyle: '', font: '', strokeStyle: '', lineWidth: 0 };
  const ctx = {
    get fillStyle() { return state.fillStyle; },
    set fillStyle(v: string) { state.fillStyle = v; },
    get font() { return state.font; },
    set font(v: string) { state.font = v; },
    strokeStyle: '',
    lineWidth: 0,
    textAlign: '' as CanvasTextAlign,
    textBaseline: '' as CanvasTextBaseline,
    save: (): void => undefined,
    restore: (): void => undefined,
    beginPath: (): void => undefined,
    closePath: (): void => undefined,
    moveTo: (): void => undefined,
    lineTo: (): void => undefined,
    setLineDash: (): void => undefined,
    stroke: (): void => undefined,
    fill: (): void => { fills.push(state.fillStyle); },
    fillText: (text: string): void => {
      painted.push({ text, fillStyle: state.fillStyle, font: state.font });
    },
  } as unknown as CanvasRenderingContext2D;

  return {
    painted,
    fills,
    // Ταυτοτική προβολή επί την κλίμακα: το `toScreen` δεν είναι το αντικείμενο του test —
    // η περιστροφή ελέγχεται ήδη στους αδελφούς stampers.
    rc: { ctx, pxPerMm, toScreen: (u, v) => ({ x: u * pxPerMm, y: v * pxPerMm }) },
  };
}

function tick(label: string, startMm: number, sizeMm: number, active = false): TableIndicatorTick {
  return { label, startMm, sizeMm, active };
}

const COLUMNS = [tick('A', 0, 20), tick('B', 20, 30, true)];
const ROWS = [tick('1', 0, 10), tick('2', 10, 8, true)];

describe('stampTableIndicator', () => {
  it('ζωγραφίζει γράμματα στηλών ΚΑΙ αριθμούς γραμμών', () => {
    const { rc, painted } = fakeContext(4);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 });
    expect(painted.map((p) => p.text)).toEqual(['A', 'B', '1', '2']);
  });

  it('η ενεργή στήλη/γραμμή παίρνει το χρώμα του ΔΡΟΜΕΑ — ίδια ερώτηση, ίδιο λεξιλόγιο', () => {
    const { rc, painted, fills } = fakeContext(4);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 });
    const b = painted.find((p) => p.text === 'B');
    const a = painted.find((p) => p.text === 'A');
    expect(b?.fillStyle).toBe(TABLE_INDICATOR.activeTextHex);
    expect(a?.fillStyle).toBe(TABLE_INDICATOR.textHex);
    expect(fills).toContain(TABLE_INDICATOR.activeFillHex);
  });

  it('η ενεργή ετικέτα είναι έντονη — η διαφορά διαβάζεται και σε ασπρόμαυρη εκτύπωση', () => {
    const { rc, painted } = fakeContext(4);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 });
    expect(painted.find((p) => p.text === 'B')?.font).toContain('bold');
    expect(painted.find((p) => p.text === 'A')?.font).not.toContain('bold');
  });

  it('🔴 LOD: πίνακας-κουκκίδα ⇒ ΚΑΜΙΑ ζώνη', () => {
    // Οι ζώνες έχουν σταθερό πάχος σε px· σε έντονο zoom-out θα ήταν πλατύτερες από τον
    // ίδιο τον πίνακα — ένα γκρίζο πλαίσιο γύρω από το τίποτα.
    const { rc, painted, fills } = fakeContext(0.2);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 });
    expect(painted).toHaveLength(0);
    expect(fills).toHaveLength(0);
  });

  it('στενή στήλη ⇒ το ορθογώνιο μένει, η ετικέτα φεύγει', () => {
    // Η ζώνη πρέπει να φαίνεται **συνεχής**: μια τρύπα εκεί μοιάζει με σφάλμα ζωγραφικής.
    const { rc, painted, fills } = fakeContext(1);
    stampTableIndicator(rc, {
      columns: [tick('A', 0, 2), tick('B', 2, 60)],
      rows: [tick('1', 0, 30), tick('2', 30, 30, true)],
      widthMm: 62,
      heightMm: 60,
    });
    expect(painted.map((p) => p.text)).not.toContain('A');
    expect(painted.map((p) => p.text)).toContain('B');
    expect(fills.length).toBeGreaterThan(painted.length);
  });

  it('ζωγραφίζει και τη γωνία που ενώνει τις δύο ζώνες', () => {
    const { rc, fills } = fakeContext(4);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 });
    // 1 γωνία + 2 στήλες + 2 γραμμές = 5 γεμίσματα.
    expect(fills).toHaveLength(5);
  });
});
