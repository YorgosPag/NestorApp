/**
 * Regression anchors for the DXF primitive geometry painter SSoT.
 *
 * The arc test is the important one: before centralization `FloorplanViewerTab`
 * passed DXF **degrees** straight into `ctx.arc()` (which takes radians) with the
 * start and end angles swapped. Centralizing fixed that surface — this pins the
 * correct conversion so no copy can regress it again.
 */

import { paintSceneEntityGeometry } from '../canvas-scene-painter';
import type { FitTransform, SceneBounds } from '../scene-fit-transform';

const BOUNDS: SceneBounds = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
const FIT: FitTransform = { scale: 2, offsetX: 10, offsetY: 20 };

function makeCtx() {
  return {
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    arc: jest.fn(),
    stroke: jest.fn(),
  } as unknown as CanvasRenderingContext2D & Record<string, jest.Mock>;
}

describe('paintSceneEntityGeometry', () => {
  it('strokes a line with Y flipped against bounds.max.y', () => {
    const ctx = makeCtx();
    const handled = paintSceneEntityGeometry(
      ctx,
      { type: 'line', start: { x: 0, y: 100 }, end: { x: 50, y: 0 } },
      BOUNDS,
      FIT,
    );

    expect(handled).toBe(true);
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 20);
    expect(ctx.lineTo).toHaveBeenCalledWith(110, 220);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it('closes a polyline only when the entity is flagged closed', () => {
    const vertices = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

    const open = makeCtx();
    paintSceneEntityGeometry(open, { type: 'polyline', vertices }, BOUNDS, FIT);
    expect(open.closePath).not.toHaveBeenCalled();
    expect(open.lineTo).toHaveBeenCalledTimes(2);

    const closed = makeCtx();
    paintSceneEntityGeometry(closed, { type: 'polyline', vertices, closed: true }, BOUNDS, FIT);
    expect(closed.closePath).toHaveBeenCalledTimes(1);
  });

  it('skips a polyline with fewer than two vertices', () => {
    const ctx = makeCtx();
    paintSceneEntityGeometry(ctx, { type: 'polyline', vertices: [{ x: 1, y: 1 }] }, BOUNDS, FIT);

    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('scales a circle radius by the fit scale', () => {
    const ctx = makeCtx();
    paintSceneEntityGeometry(ctx, { type: 'circle', center: { x: 50, y: 50 }, radius: 4 }, BOUNDS, FIT);

    expect(ctx.arc).toHaveBeenCalledWith(110, 120, 8, 0, 2 * Math.PI);
  });

  it('converts DXF arc degrees to negated radians drawn anticlockwise', () => {
    const ctx = makeCtx();
    paintSceneEntityGeometry(
      ctx,
      { type: 'arc', center: { x: 0, y: 0 }, radius: 10, startAngle: 0, endAngle: 90 },
      BOUNDS,
      FIT,
    );

    expect(ctx.arc).toHaveBeenCalledWith(10, 220, 20, -0, -Math.PI / 2, true);
  });

  it('skips an arc missing either angle', () => {
    const ctx = makeCtx();
    paintSceneEntityGeometry(
      ctx,
      { type: 'arc', center: { x: 0, y: 0 }, radius: 10, startAngle: 0 },
      BOUNDS,
      FIT,
    );

    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('reports text and unknown types as unhandled so callers own their text pass', () => {
    const ctx = makeCtx();

    expect(paintSceneEntityGeometry(ctx, { type: 'text' }, BOUNDS, FIT)).toBe(false);
    expect(paintSceneEntityGeometry(ctx, { type: 'mtext' }, BOUNDS, FIT)).toBe(false);
    expect(paintSceneEntityGeometry(ctx, { type: 'hatch' }, BOUNDS, FIT)).toBe(false);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});
