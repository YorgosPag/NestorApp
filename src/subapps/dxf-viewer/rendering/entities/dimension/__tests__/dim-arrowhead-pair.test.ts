/**
 * ADR-362 §7 — `renderDimArrowheadPair` + `resolveArrowBlockNames` SSoT.
 *
 * These cover the shared arrowhead-pair wrapper that both the main canvas
 * (`DimensionRenderer.drawArrowheads`) and the preview canvas
 * (`preview-dimension-renderer.drawArrowheads`) delegate to, so the block-pair
 * fallback, the per-side visibility gate (ADR-362 Round 36), and the side-2 flip
 * can never drift between the two renderers again.
 *
 * The fake ctx captures `translate` (one call per stamped arrow → tells us which
 * side drew and at what anchor) and `rotate` (a `flipOnSecondArrow` block emits a
 * second `rotate(PI)` on side 2). `renderArrowhead` early-returns BEFORE `save`
 * for empty geometry / zero-length direction, so `save` count = arrows stamped.
 */

import {
  renderDimArrowheadPair,
  type DimArrowheadPairParams,
} from '../dim-arrowhead-renderer';
import { resolveArrowBlockNames } from '../../../../systems/dimensions/dim-arrowhead-blocks';
import type { DimStyle } from '../../../../types/dimension';

function makeCtxSpy() {
  const translates: Array<{ x: number; y: number }> = [];
  const rotates: number[] = [];
  const ctx: Partial<CanvasRenderingContext2D> = {
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn((x: number, y: number) => { translates.push({ x, y }); }),
    rotate: jest.fn((a: number) => { rotates.push(a); }),
    scale: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    set lineWidth(_v: number) {},
    set strokeStyle(_v: string | CanvasGradient | CanvasPattern) {},
    set fillStyle(_v: string | CanvasGradient | CanvasPattern) {},
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, translates, rotates };
}

const BASE: Omit<DimArrowheadPairParams, 'block1Name' | 'block2Name' | 'suppress1' | 'suppress2'> = {
  anchor1Screen: { x: 10, y: 20 },
  anchor2Screen: { x: 90, y: 20 },
  dir1: { x: -1, y: 0 },
  dir2: { x: 1, y: 0 },
  unitPx: 8,
  color: '#fff',
};

describe('resolveArrowBlockNames (ADR-362 §7)', () => {
  const style = (o: Partial<Pick<DimStyle, 'dimblk' | 'dimblk1' | 'dimblk2'>>) =>
    ({ dimblk: '', dimblk1: '', dimblk2: '', ...o }) as Pick<DimStyle, 'dimblk' | 'dimblk1' | 'dimblk2'>;

  it('falls back to dimblk on both sides when dimblk1/2 are empty', () => {
    expect(resolveArrowBlockNames(style({ dimblk: 'closedFilled' }))).toEqual({
      block1: 'closedFilled',
      block2: 'closedFilled',
    });
  });

  it('lets dimblk1/dimblk2 override per side', () => {
    expect(
      resolveArrowBlockNames(style({ dimblk: 'closedFilled', dimblk1: 'dot', dimblk2: 'oblique' })),
    ).toEqual({ block1: 'dot', block2: 'oblique' });
  });

  it('mixes: side 1 override, side 2 fallback', () => {
    expect(resolveArrowBlockNames(style({ dimblk: 'closed', dimblk1: 'architecturalTick' }))).toEqual({
      block1: 'architecturalTick',
      block2: 'closed',
    });
  });
});

describe('renderDimArrowheadPair (ADR-362 §7)', () => {
  it('stamps both sides at their anchors when neither is suppressed', () => {
    const { ctx, translates } = makeCtxSpy();
    renderDimArrowheadPair(ctx, {
      ...BASE, block1Name: 'closedFilled', block2Name: 'closedFilled',
      suppress1: false, suppress2: false,
    });
    expect(translates).toEqual([{ x: 10, y: 20 }, { x: 90, y: 20 }]);
    expect(ctx.save).toHaveBeenCalledTimes(2);
  });

  it('skips side 1 when suppress1 is set (gate = single owner)', () => {
    const { ctx, translates } = makeCtxSpy();
    renderDimArrowheadPair(ctx, {
      ...BASE, block1Name: 'closedFilled', block2Name: 'closedFilled',
      suppress1: true, suppress2: false,
    });
    expect(translates).toEqual([{ x: 90, y: 20 }]);
    expect(ctx.save).toHaveBeenCalledTimes(1);
  });

  it('skips side 2 when suppress2 is set', () => {
    const { ctx, translates } = makeCtxSpy();
    renderDimArrowheadPair(ctx, {
      ...BASE, block1Name: 'closedFilled', block2Name: 'closedFilled',
      suppress1: false, suppress2: true,
    });
    expect(translates).toEqual([{ x: 10, y: 20 }]);
  });

  it('draws nothing when both sides are suppressed', () => {
    const { ctx, translates } = makeCtxSpy();
    renderDimArrowheadPair(ctx, {
      ...BASE, block1Name: 'closedFilled', block2Name: 'closedFilled',
      suppress1: true, suppress2: true,
    });
    expect(translates).toEqual([]);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('does not stamp a "none" block even when unsuppressed', () => {
    const { ctx, translates } = makeCtxSpy();
    renderDimArrowheadPair(ctx, {
      ...BASE, block1Name: 'none', block2Name: 'closedFilled',
      suppress1: false, suppress2: false,
    });
    // side 1 is 'none' (empty geometry → no-op); only side 2 stamps.
    expect(translates).toEqual([{ x: 90, y: 20 }]);
  });

  it('applies the extra 180° flip on side 2 for flipOnSecondArrow blocks', () => {
    // architecturalTick has flipOnSecondArrow: true.
    const side1 = makeCtxSpy();
    renderDimArrowheadPair(side1.ctx, {
      ...BASE, block1Name: 'architecturalTick', block2Name: 'architecturalTick',
      suppress1: false, suppress2: true, // only side 1
    });
    const side2 = makeCtxSpy();
    renderDimArrowheadPair(side2.ctx, {
      ...BASE, block1Name: 'architecturalTick', block2Name: 'architecturalTick',
      suppress1: true, suppress2: false, // only side 2
    });
    // Side 1: one rotate (align). Side 2: align + extra PI flip.
    expect(side1.rotates).toHaveLength(1);
    expect(side2.rotates).toHaveLength(2);
    expect(side2.rotates[1]).toBeCloseTo(Math.PI);
  });
});
