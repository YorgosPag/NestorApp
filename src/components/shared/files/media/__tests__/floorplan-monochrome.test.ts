/**
 * ADR-340 — «Μαύρο σχέδιο» ink recolor (`applyMonochromeInk`).
 *
 * The recolor MUST run as a single `source-in` fill over the whole backing store so
 * the ink lands on the (transparent-background) entity render with alpha preserved,
 * isolated by save/restore so the following `destination-over` background is unaffected.
 */

import { applyMonochromeInk } from '@/components/shared/files/media/floorplan-monochrome';
import { MONOCHROME_INK } from '@/components/shared/files/media/floorplan-dxf-renderer';

interface FillRectCall {
  args: [number, number, number, number];
  /** Snapshot of the compositing state AT the moment fillRect ran (order matters). */
  op: string;
  style: string;
}

/** Minimal 2D-context spy that records the state present when `fillRect` fires. */
function makeCtx() {
  const calls: string[] = [];
  const fillRectCalls: FillRectCall[] = [];
  const ctx = {
    globalCompositeOperation: 'source-over',
    fillStyle: '#000000',
    save() { calls.push('save'); },
    restore() {
      calls.push('restore');
      // A correct implementation restores the default composite for later paints.
      this.globalCompositeOperation = 'source-over';
    },
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push('fillRect');
      fillRectCalls.push({
        args: [x, y, w, h],
        op: this.globalCompositeOperation,
        style: String(this.fillStyle),
      });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, fillRectCalls, raw: ctx };
}

describe('applyMonochromeInk', () => {
  it('fills the full backing store with a source-in composite', () => {
    const { ctx, fillRectCalls } = makeCtx();
    applyMonochromeInk(ctx, 800, 600);

    expect(fillRectCalls).toHaveLength(1);
    expect(fillRectCalls[0].args).toEqual([0, 0, 800, 600]);
    // source-in was active AT paint time → keeps dest alpha, replaces colour.
    expect(fillRectCalls[0].op).toBe('source-in');
  });

  it('defaults to the SSoT MONOCHROME_INK', () => {
    const { ctx, fillRectCalls } = makeCtx();
    applyMonochromeInk(ctx, 10, 10);
    expect(fillRectCalls[0].style).toBe(MONOCHROME_INK);
  });

  it('honours a caller-supplied ink', () => {
    const { ctx, fillRectCalls } = makeCtx();
    applyMonochromeInk(ctx, 10, 10, '#ff0000');
    expect(fillRectCalls[0].style).toBe('#ff0000');
  });

  it('isolates the recolor with save/restore around the fill', () => {
    const { ctx, calls, raw } = makeCtx();
    applyMonochromeInk(ctx, 10, 10);
    expect(calls).toEqual(['save', 'fillRect', 'restore']);
    // Composite is back to the default so the subsequent background paint is unaffected.
    expect(raw.globalCompositeOperation).toBe('source-over');
  });
});
