/**
 * ADR-508 §dim — overlay-text-style SSoT unit tests (shared overlay label rendering).
 */

import { drawOverlayLabel, OVERLAY_TEXT_FONT } from '../overlay-text-style';

interface Call { fn: string; args: readonly unknown[]; }
function mockCtx(): { calls: Call[]; ctx: CanvasRenderingContext2D } {
  const calls: Call[] = [];
  const rec = (fn: string) => (...args: unknown[]): unknown => { calls.push({ fn, args }); return undefined; };
  const ctx = {
    save: rec('save'), restore: rec('restore'), fillRect: rec('fillRect'),
    fillText: rec('fillText'), setLineDash: rec('setLineDash'),
    measureText: () => ({ width: 40 }),
    set font(v: string) { calls.push({ fn: 'set:font', args: [v] }); },
    set fillStyle(v: string) { calls.push({ fn: 'set:fillStyle', args: [v] }); },
    set textAlign(v: string) { calls.push({ fn: 'set:textAlign', args: [v] }); },
    set textBaseline(v: string) { calls.push({ fn: 'set:textBaseline', args: [v] }); },
    set globalAlpha(v: number) { calls.push({ fn: 'set:globalAlpha', args: [v] }); },
  };
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

describe('drawOverlayLabel', () => {
  it('draws a background chip + text with the canonical font', () => {
    const m = mockCtx();
    drawOverlayLabel(m.ctx, '2.30 m', 100, 50, { textColor: '#0f0', bgColor: '#000', align: 'center' });
    expect(m.calls.some((c) => c.fn === 'set:font' && c.args[0] === OVERLAY_TEXT_FONT)).toBe(true);
    expect(m.calls.some((c) => c.fn === 'set:textAlign' && c.args[0] === 'center')).toBe(true);
    expect(m.calls.filter((c) => c.fn === 'fillRect')).toHaveLength(1);
    expect(m.calls.some((c) => c.fn === 'fillText' && c.args[0] === '2.30 m')).toBe(true);
  });

  it('left-aligns by default', () => {
    const m = mockCtx();
    drawOverlayLabel(m.ctx, 'x', 10, 10, { textColor: '#fff', bgColor: '#000' });
    expect(m.calls.some((c) => c.fn === 'set:textAlign' && c.args[0] === 'left')).toBe(true);
  });

  it('is a no-op for an empty label', () => {
    const m = mockCtx();
    drawOverlayLabel(m.ctx, '', 0, 0, { textColor: '#fff', bgColor: '#000' });
    expect(m.calls).toHaveLength(0);
  });
});
