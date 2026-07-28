/**
 * ADR-554 / ADR-726 Φ2 — shared overlay frame renderer (`paintOverlayDispatchFrame`).
 *
 * The ONE pull-model frame renderer behind every 2D overlay canvas — both the multi-painter
 * dispatch canvases (analytical ADR-552, proposal ADR-554) and the single-painter overlays
 * (envelope / floor-underlay / mep-wires / grid / topo-grid / gizmo / …, ADR-726 Φ2):
 * size → **πύλη** → clear ONCE → paint active painters in z-order, skipping `null`.
 * Mock canvas/ctx — zero DOM/React.
 *
 * ⚠️ Το clear-state ledger είναι **per canvas element** (WeakSet). Κάθε `makeCanvas()` φτιάχνει
 * ΝΕΟ αντικείμενο ⇒ άγνωστο ⇒ «μπορεί να έχει μελάνι» ⇒ το πρώτο καρέ καθαρίζει πάντα. Τα tests
 * που ελέγχουν την πύλη ΠΡΕΠΕΙ να ζωγραφίζουν δύο διαδοχικά καρέ στον ΙΔΙΟ καμβά.
 */

import { paintOverlayDispatchFrame } from '../overlay-dispatch-frame';
import type { OverlayDispatchPainter } from '../overlay-dispatch-frame';
import type { ViewTransform, Viewport } from '../../../../rendering/types/Types';

const TRANSFORM: ViewTransform = { scale: 2, offsetX: 10, offsetY: 20 };
const VIEWPORT: Viewport = { width: 800, height: 600 };

interface MockCtx {
  setTransform: jest.Mock;
  clearRect: jest.Mock;
}

function makeCanvas(initialW = 0, initialH = 0): { canvas: HTMLCanvasElement; ctx: MockCtx } {
  const ctx: MockCtx = { setTransform: jest.fn(), clearRect: jest.fn() };
  const canvas = {
    width: initialW,
    height: initialH,
    getContext: jest.fn(() => ctx as unknown as CanvasRenderingContext2D),
  } as unknown as HTMLCanvasElement;
  return { canvas, ctx };
}

describe('paintOverlayDispatchFrame (ADR-554)', () => {
  it('clears the canvas exactly once before painting', () => {
    const { canvas, ctx } = makeCanvas();
    const painter: OverlayDispatchPainter = jest.fn();
    paintOverlayDispatchFrame(canvas, [painter], TRANSFORM, VIEWPORT);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(ctx.setTransform).toHaveBeenCalledTimes(1);
  });

  it('calls active painters in array (z-) order with ctx, transform, viewport', () => {
    const { canvas, ctx } = makeCanvas();
    const order: string[] = [];
    const a: OverlayDispatchPainter = jest.fn(() => void order.push('a'));
    const b: OverlayDispatchPainter = jest.fn(() => void order.push('b'));
    const c: OverlayDispatchPainter = jest.fn(() => void order.push('c'));
    paintOverlayDispatchFrame(canvas, [a, b, c], TRANSFORM, VIEWPORT);
    expect(order).toEqual(['a', 'b', 'c']);
    expect(a).toHaveBeenCalledWith(ctx, TRANSFORM, VIEWPORT);
    expect(c).toHaveBeenCalledWith(ctx, TRANSFORM, VIEWPORT);
  });

  it('skips null painters (inactive layers) but keeps the order of the rest', () => {
    const { canvas } = makeCanvas();
    const order: string[] = [];
    const first: OverlayDispatchPainter = jest.fn(() => void order.push('first'));
    const last: OverlayDispatchPainter = jest.fn(() => void order.push('last'));
    paintOverlayDispatchFrame(canvas, [null, first, null, null, last, null, null], TRANSFORM, VIEWPORT);
    expect(order).toEqual(['first', 'last']);
    expect(first).toHaveBeenCalledTimes(1);
    expect(last).toHaveBeenCalledTimes(1);
  });

  // ── ADR-726 Φ2 — η πύλη πριν το clear ────────────────────────────────────────────────────
  //
  // Το συμβόλαιο ΑΛΛΑΞΕ: παλιά «μηδέν painters ⇒ ένα clear, πάντα». Τώρα «μηδέν painters ⇒ ένα
  // clear ΜΟΝΟ αν ο καμβάς μπορεί να έχει μελάνι· αλλιώς ΚΑΜΙΑ επαφή». Ένα clearRect σε ήδη-άδειο
  // καμβά ακυρώνει ολόκληρο compositor layer (Blink `HTMLCanvasElement::DidDraw` — δεν συγκρίνει
  // pixels), και μετρήθηκαν 9 καμβάδες × 131–148 τέτοια clears ανά συνεδρία (ADR-726 §4.Γ).

  const ALL_NULL = [null, null, null, null, null, null, null];

  it('clears ONCE on the first empty frame of an unseen canvas (safe seed — μπορεί να έχει μελάνι)', () => {
    const { canvas, ctx } = makeCanvas();
    paintOverlayDispatchFrame(canvas, ALL_NULL, TRANSFORM, VIEWPORT);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
  });

  it('does NOT touch the canvas on a SECOND empty frame — μηδέν clearRect, μηδέν ακύρωση layer', () => {
    const { canvas, ctx } = makeCanvas();
    paintOverlayDispatchFrame(canvas, ALL_NULL, TRANSFORM, VIEWPORT);
    ctx.clearRect.mockClear();

    paintOverlayDispatchFrame(canvas, ALL_NULL, TRANSFORM, VIEWPORT);
    paintOverlayDispatchFrame(canvas, ALL_NULL, TRANSFORM, VIEWPORT);
    paintOverlayDispatchFrame(canvas, ALL_NULL, TRANSFORM, VIEWPORT);

    expect(ctx.clearRect).not.toHaveBeenCalled();
  });

  it('clears again as soon as content appeared and then went away (μηδέν φάντασμα)', () => {
    const { canvas, ctx } = makeCanvas();
    paintOverlayDispatchFrame(canvas, ALL_NULL, TRANSFORM, VIEWPORT); // seed → clear + «καθαρός»
    paintOverlayDispatchFrame(canvas, [jest.fn()], TRANSFORM, VIEWPORT); // ζωγράφισε → «με μελάνι»
    ctx.clearRect.mockClear();

    paintOverlayDispatchFrame(canvas, ALL_NULL, TRANSFORM, VIEWPORT);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1); // σβήνει το προηγούμενο περιεχόμενο
    ctx.clearRect.mockClear();

    paintOverlayDispatchFrame(canvas, ALL_NULL, TRANSFORM, VIEWPORT);
    expect(ctx.clearRect).not.toHaveBeenCalled(); // …και μετά ησυχάζει ξανά
  });

  it('τα ξανα-καθαρίζει αν ένας painter πέταξε — ο καμβάς μπορεί να έμεινε μισο-ζωγραφισμένος', () => {
    const { canvas, ctx } = makeCanvas();
    const exploding: OverlayDispatchPainter = () => {
      throw new Error('painter blew up');
    };
    expect(() => paintOverlayDispatchFrame(canvas, [exploding], TRANSFORM, VIEWPORT)).toThrow();
    ctx.clearRect.mockClear();

    paintOverlayDispatchFrame(canvas, ALL_NULL, TRANSFORM, VIEWPORT);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
  });

  it('sizes the backing store even when the gate skips the paint (κρυφός καμβάς μένει έτοιμος)', () => {
    const { canvas, ctx } = makeCanvas();
    paintOverlayDispatchFrame(canvas, ALL_NULL, TRANSFORM, VIEWPORT); // seed
    ctx.setTransform.mockClear();

    paintOverlayDispatchFrame(canvas, ALL_NULL, TRANSFORM, VIEWPORT);
    expect(ctx.setTransform).toHaveBeenCalledTimes(1); // sizing έτρεξε· clear ΟΧΙ
    expect(ctx.clearRect).toHaveBeenCalledTimes(1); // μόνο το seed
  });

  it('resizes the DPR-aware backing store only when the size changes', () => {
    const { canvas } = makeCanvas(VIEWPORT.width, VIEWPORT.height);
    const setW = jest.fn();
    Object.defineProperty(canvas, 'width', { get: () => VIEWPORT.width, set: setW, configurable: true });
    paintOverlayDispatchFrame(canvas, [], TRANSFORM, VIEWPORT);
    expect(setW).not.toHaveBeenCalled();
  });

  it('is a no-op when getContext returns null', () => {
    const canvas = { getContext: jest.fn(() => null) } as unknown as HTMLCanvasElement;
    expect(() => paintOverlayDispatchFrame(canvas, [jest.fn()], TRANSFORM, VIEWPORT)).not.toThrow();
  });
});
