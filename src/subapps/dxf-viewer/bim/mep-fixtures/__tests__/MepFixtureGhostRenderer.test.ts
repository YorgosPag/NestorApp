/**
 * ADR-406 — MepFixtureGhostRenderer (2D placement ghost) tests.
 *
 * Verifies the renderer traces the footprint (fill + outline) and draws the
 * cursor anchor marker, and that a degenerate footprint (<3 vertices) draws only
 * the anchor — guarding the WYSIWYG 2D preview that was missing vs the column.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MepFixtureGhostRenderer } from '../MepFixtureGhostRenderer';
import type { ViewTransform } from '../../../rendering/types/Types';

function makeCtx() {
  return {
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    fillRect: jest.fn(),
    setLineDash: jest.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D & {
    fill: jest.Mock; stroke: jest.Mock; fillRect: jest.Mock; lineTo: jest.Mock;
  };
}

const TRANSFORM: ViewTransform = { x: 0, y: 0, scale: 1 } as ViewTransform;
const VIEWPORT = { width: 800, height: 600 };
const SQUARE = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
];

describe('MepFixtureGhostRenderer', () => {
  let ctx: ReturnType<typeof makeCtx>;
  beforeEach(() => { ctx = makeCtx(); });

  it('fills + strokes the footprint and draws the anchor marker', () => {
    new MepFixtureGhostRenderer(ctx).render({
      footprint: SQUARE, cursor: { x: 5, y: 5 }, transform: TRANSFORM, viewport: VIEWPORT,
    });
    expect(ctx.fill).toHaveBeenCalledTimes(1);   // translucent footprint fill
    expect(ctx.stroke).toHaveBeenCalledTimes(1); // outline
    expect(ctx.fillRect).toHaveBeenCalledTimes(1); // anchor marker
    // 4-vertex polygon → 3 lineTo per path × 2 paths (fill + outline) = 6.
    expect(ctx.lineTo).toHaveBeenCalledTimes(6);
  });

  it('draws ONLY the anchor marker for a degenerate footprint (<3 vertices)', () => {
    new MepFixtureGhostRenderer(ctx).render({
      footprint: [{ x: 0, y: 0 }], cursor: { x: 1, y: 1 }, transform: TRANSFORM, viewport: VIEWPORT,
    });
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
  });
});
