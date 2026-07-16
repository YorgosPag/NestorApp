/**
 * ADR-608 (hybrid image compositing) — scene-image-emitter placement math.
 *
 * Verifies `emitResolvedImage` maps world rect corners → the jsPDF
 * `addImage(x, y, w, h, alias, compression, rotation)` call with the correct
 * top-left / size / rotation (pivot = bottom-left, mirror of `ImageRenderer`),
 * without a real jsPDF. `toPaper` is identity so the placement world coords ARE
 * the assertable paper mm.
 */

import type { Point2D } from '../../../rendering/types/Types';
import { emitResolvedImage } from '../scene-image-emitter';
import type { ResolvedImagePlacement, ResolvedSceneImage } from '../scene-image-resolver';

interface Call { fn: string; args: readonly unknown[]; }

function mockPdf(): { pdf: Record<string, unknown>; calls: Call[] } {
  const calls: Call[] = [];
  const rec = (fn: string) => (...args: unknown[]) => { calls.push({ fn, args }); };
  const pdf = {
    addImage: rec('addImage'),
    saveGraphicsState: rec('saveGraphicsState'),
    restoreGraphicsState: rec('restoreGraphicsState'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    close: rec('close'),
    clipEvenOdd: rec('clipEvenOdd'),
    discardPath: rec('discardPath'),
  };
  return { pdf, calls };
}

const identity = (p: Point2D): Point2D => ({ x: p.x, y: p.y });

function resolved(placements: ResolvedImagePlacement[]): ResolvedSceneImage {
  return { dataUrl: 'data:x', alias: 'a1', placements };
}

function emitOne(pl: ResolvedImagePlacement, toPaper = identity): Call[] {
  const { pdf, calls } = mockPdf();
  emitResolvedImage(pdf as never, resolved([pl]), toPaper);
  return calls;
}

describe('scene-image-emitter — placement math', () => {
  it('axis-aligned (rotation 0): top-left = BL.y − h, size = edge lengths', () => {
    // BL(0,0) BR(10,0) TL(0,4): right edge = +x (10), up edge = +y (4).
    const calls = emitOne({ bl: { x: 0, y: 0 }, br: { x: 10, y: 0 }, tl: { x: 0, y: 4 }, wWorld: 10, hWorld: 4 });
    expect(calls).toHaveLength(1);
    const [data, fmt, x, y, w, h, alias, comp, rot] = calls[0].args;
    expect([data, fmt, alias, comp]).toEqual(['data:x', 'PNG', 'a1', 'FAST']);
    // pivot BL=(0,0), hMm=4 → y = 0 − 4 = −4; w=10, h=4, rotation 0.
    expect([x, y, w, h, rot]).toEqual([0, -4, 10, 4, 0]);
  });

  it('90° rotation: rotation param 90, size from edge lengths', () => {
    // right edge BR−BL = (0,−2) → r = atan2(2,0) = 90°. up edge TL−BL = (3,0) → hMm 3.
    const calls = emitOne({ bl: { x: 0, y: 0 }, br: { x: 0, y: -2 }, tl: { x: 3, y: 0 }, wWorld: 2, hWorld: 3 });
    const [, , x, y, w, h, , , rot] = calls[0].args;
    expect([w, h, rot]).toEqual([2, 3, 90]);
    // pivot BL=(0,0), hMm=3 → y = −3.
    expect([x, y]).toEqual([0, -3]);
  });

  it('negative rotation wraps into [0, 360)', () => {
    // right edge = (0,2) → atan2(-2,0) = −90° → normalized 270.
    const calls = emitOne({ bl: { x: 0, y: 0 }, br: { x: 0, y: 2 }, tl: { x: -3, y: 0 }, wWorld: 2, hWorld: 3 });
    expect(calls[0].args[8]).toBe(270);
  });

  it('honours the injected toPaper mapping (Y-flip)', () => {
    const flip = (p: Point2D): Point2D => ({ x: p.x, y: 100 - p.y });
    const calls = emitOne({ bl: { x: 0, y: 0 }, br: { x: 10, y: 0 }, tl: { x: 0, y: 4 }, wWorld: 10, hWorld: 4 }, flip);
    // BL→(0,100), BR→(10,100), TL→(0,96). rightVec=(10,0)→rot 0. hMm=|100−96|=4 → y=100−4=96.
    const [, , x, y, w, h, , , rot] = calls[0].args;
    expect([x, y, w, h, rot]).toEqual([0, 96, 10, 4, 0]);
  });

  it('degenerate (zero-size) placement → skipped', () => {
    const calls = emitOne({ bl: { x: 0, y: 0 }, br: { x: 0, y: 0 }, tl: { x: 0, y: 0 }, wWorld: 0, hWorld: 0 });
    expect(calls).toHaveLength(0);
  });

  it('non-finite corner → skipped (no addImage)', () => {
    const calls = emitOne({ bl: { x: NaN, y: 0 }, br: { x: 10, y: 0 }, tl: { x: 0, y: 4 }, wWorld: 10, hWorld: 4 });
    expect(calls).toHaveLength(0);
  });

  it('emits one addImage per placement (tiles)', () => {
    const { pdf, calls } = mockPdf();
    emitResolvedImage(pdf as never, resolved([
      { bl: { x: 0, y: 0 }, br: { x: 2, y: 0 }, tl: { x: 0, y: 2 }, wWorld: 2, hWorld: 2 },
      { bl: { x: 2, y: 0 }, br: { x: 4, y: 0 }, tl: { x: 2, y: 2 }, wWorld: 2, hWorld: 2 },
      { bl: { x: 4, y: 0 }, br: { x: 6, y: 0 }, tl: { x: 4, y: 2 }, wWorld: 2, hWorld: 2 },
    ]), identity);
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.args[6] === 'a1')).toBe(true);
  });
});
