/**
 * Test helper — **ο ένας καταγραφέας ζωγραφικής πίνακα** (ADR-739).
 *
 * Δεν είναι σουίτα: το `testMatch` του jest απαιτεί `*.test.ts` μέσα στο `__tests__`, οπότε
 * αυτό το αρχείο φορτώνεται μόνο ως εισαγωγή.
 *
 * ## Γιατί κοινό και όχι ένα αντίγραφο ανά σουίτα (N.0.2 / N.18)
 * Δύο σουίτες χρειάζονται **το ίδιο** ψεύτικο `CanvasRenderingContext2D`: το
 * `stamp-table-layout.test.ts` (μελάνι/σιλουέτα, ADR-739 §19.8) και το
 * `table-cell-clipping.test.ts` (ισοτιμία τεσσάρων backends, Φ.Δ βήμα 5). Ένα δεύτερο
 * αντίγραφο ~35 γραμμών με ταυτόσημα stubs είναι ακριβώς ο structural clone που πιάνει το
 * CHECK 3.28 (jscpd, ADR-584) — **ανεξάρτητα ονόματος**.
 *
 * @module rendering/entities/table/__tests__/table-paint-recorder
 */

import type { StampTableContext } from '../stamp-table-layout';

/** Μία διαδρομή που χαράχτηκε: με τι μολύβι και σε ποια σημεία **οθόνης**. */
export interface StrokeRecord {
  readonly color: string;
  readonly lineWidth: number;
  readonly points: ReadonlyArray<{ readonly x: number; readonly y: number }>;
}

/** Καταγράφει κάθε `fillStyle` τη στιγμή που χρησιμοποιείται — όχι στο τέλος. */
export interface PaintLog {
  readonly fills: string[];
  readonly texts: Array<{ readonly text: string; readonly color: string }>;
  readonly strokes: StrokeRecord[];
}

/** Καθαρό ημερολόγιο — μία έκφραση, ώστε καμία σουίτα να μην ξεχάσει πεδίο. */
export function createPaintLog(): PaintLog {
  return { fills: [], texts: [], strokes: [] };
}

export function createCtx(log: PaintLog): CanvasRenderingContext2D {
  let fillStyle = '';
  let path: Array<{ x: number; y: number }> = [];
  const ctx = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: string) {
      fillStyle = v;
    },
    strokeStyle: '',
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    lineWidth: 1,
    save: (): void => undefined,
    restore: (): void => undefined,
    beginPath: (): void => {
      path = [];
    },
    closePath: (): void => undefined,
    moveTo: (x: number, y: number): void => {
      path.push({ x, y });
    },
    lineTo: (x: number, y: number): void => {
      path.push({ x, y });
    },
    stroke: (): void => {
      log.strokes.push({ color: ctx.strokeStyle, lineWidth: ctx.lineWidth, points: [...path] });
    },
    setLineDash: (): void => undefined,
    fill: (): void => {
      log.fills.push(fillStyle);
    },
    fillText: (text: string): void => {
      log.texts.push({ text, color: fillStyle });
    },
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

/** Πλαίσιο ζωγραφικής ταυτότητας (`toScreen` = ταυτοτική), με zoom αρκετό ώστε το LOD να μην κόβει. */
export function createRc(log: PaintLog, phaseColor?: string): StampTableContext {
  return {
    ctx: createCtx(log),
    toScreen: (u, v) => ({ x: u, y: v }),
    // Αρκετά μεγάλο ώστε το LOD να μην κόψει το κείμενο (δες MIN_CELL_TEXT_SCREEN_PX).
    pxPerMm: 10,
    phaseColor,
  };
}
