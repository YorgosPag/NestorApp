/**
 * ADR-358 Q19 Φ3a — 2D tread highlight draw tests.
 *
 * @see ../stair-sub-element-highlight-2d.ts
 */

import { drawStairSubElementHighlight } from '../stair-sub-element-highlight-2d';
import type { Point2D } from '../../../rendering/types/Types';
import type { Polygon3D } from '../../types/stair-types';
import type { StairSubElementRef } from '../../stairs/stair-sub-element-selection-store';

function mockCtx() {
  return {
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    setLineDash: jest.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  };
}

const identity = (p: Point2D): Point2D => ({ x: p.x, y: p.y });

const TREADS: Polygon3D[] = [
  [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 10, y: 10, z: 0 },
    { x: 0, y: 10, z: 0 },
  ],
  [
    { x: 20, y: 0, z: 5 },
    { x: 30, y: 0, z: 5 },
    { x: 30, y: 10, z: 5 },
    { x: 20, y: 10, z: 5 },
  ],
];

function tread(index: number): StairSubElementRef {
  return { stairId: 'stair_1', part: 'tread', index };
}

describe('drawStairSubElementHighlight', () => {
  it('fills + strokes the selected tread polygon', () => {
    const ctx = mockCtx();
    drawStairSubElementHighlight(ctx as unknown as CanvasRenderingContext2D, identity, TREADS, 'stair_1', tread(1));
    expect(ctx.fill).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(ctx.moveTo).toHaveBeenCalledWith(20, 0); // tread 1 first vertex
    expect(ctx.lineTo).toHaveBeenCalledTimes(3); // 4-vertex quad → 3 lineTo + closePath
  });

  it('is a no-op when nothing is selected', () => {
    const ctx = mockCtx();
    drawStairSubElementHighlight(ctx as unknown as CanvasRenderingContext2D, identity, TREADS, 'stair_1', null);
    expect(ctx.beginPath).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('is a no-op for a different stair', () => {
    const ctx = mockCtx();
    drawStairSubElementHighlight(ctx as unknown as CanvasRenderingContext2D, identity, TREADS, 'stair_1', {
      stairId: 'other',
      part: 'tread',
      index: 0,
    });
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('is a no-op for a non-tread part', () => {
    const ctx = mockCtx();
    drawStairSubElementHighlight(ctx as unknown as CanvasRenderingContext2D, identity, TREADS, 'stair_1', {
      stairId: 'stair_1',
      part: 'riser',
      index: 0,
    });
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('is a no-op for an out-of-range index', () => {
    const ctx = mockCtx();
    drawStairSubElementHighlight(ctx as unknown as CanvasRenderingContext2D, identity, TREADS, 'stair_1', tread(9));
    expect(ctx.fill).not.toHaveBeenCalled();
  });
});
