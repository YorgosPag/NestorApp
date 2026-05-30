/**
 * ADR-363 Phase 1J — wall-from-entity geometry bridge tests.
 *
 * Covers: pick (line hit / rectangle perimeter hit / miss), single-wall build on
 * a line (edge-on-line + length parity), and 4-wall build around a closed
 * rectangle for both inside (interior) and outside (exterior) side points.
 */

import type { Entity } from '../../../types/entities';
import type { WallEntity } from '../../types/wall-types';
import {
  pickWallSourceFromEntity,
  buildWallForLine,
  buildWallsForClosed,
  type WallSource,
} from '../wall-from-entity';

const SU = 'mm' as const;
const LEVEL = '0';

function lineEntity(x1: number, y1: number, x2: number, y2: number): Entity {
  return {
    id: 'line-1',
    type: 'line',
    layer: '0',
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
  } as unknown as Entity;
}

function rectEntity(x: number, y: number, w: number, h: number): Entity {
  return {
    id: 'rect-1',
    type: 'rectangle',
    layer: '0',
    x,
    y,
    width: w,
    height: h,
  } as unknown as Entity;
}

/** A drawn rectangle: the builder populates ONLY corner1/corner2 (no x/y/width/height). */
function drawnRectEntity(x1: number, y1: number, x2: number, y2: number): Entity {
  return {
    id: 'rect-2',
    type: 'rectangle',
    layer: '0',
    corner1: { x: x1, y: y1 },
    corner2: { x: x2, y: y2 },
  } as unknown as Entity;
}

describe('wall-from-entity — pickWallSourceFromEntity', () => {
  it('returns a line source when the click hits a line', () => {
    const src = pickWallSourceFromEntity({ x: 2500, y: 0 }, [lineEntity(0, 0, 5000, 0)], 6);
    expect(src?.kind).toBe('line');
    if (src?.kind === 'line') {
      expect(src.start).toEqual({ x: 0, y: 0 });
      expect(src.end).toEqual({ x: 5000, y: 0 });
    }
  });

  it('returns a closed source when the click hits a rectangle perimeter', () => {
    const src = pickWallSourceFromEntity({ x: 2500, y: 0 }, [rectEntity(0, 0, 5000, 3000)], 6);
    expect(src?.kind).toBe('closed');
    if (src?.kind === 'closed') {
      expect(src.polygon).toHaveLength(4);
    }
  });

  it('picks a drawn rectangle that has only corner1/corner2 (no x/y/width/height)', () => {
    // Regression: the rectangle drawing builder leaves x/y/width/height undefined.
    const src = pickWallSourceFromEntity({ x: 2500, y: 0 }, [drawnRectEntity(0, 0, 5000, 3000)], 6);
    expect(src?.kind).toBe('closed');
    if (src?.kind === 'closed') expect(src.polygon).toHaveLength(4);
  });

  it('picks a drawn rectangle drawn right-to-left / bottom-to-top (normalised corners)', () => {
    const src = pickWallSourceFromEntity({ x: 2500, y: 3000 }, [drawnRectEntity(5000, 3000, 0, 0)], 6);
    expect(src?.kind).toBe('closed');
  });

  it('returns null when nothing is within tolerance', () => {
    const src = pickWallSourceFromEntity({ x: 2500, y: 500 }, [lineEntity(0, 0, 5000, 0)], 6);
    expect(src).toBeNull();
  });

  it('picks the nearest entity among several', () => {
    const src = pickWallSourceFromEntity(
      { x: 1000, y: 1 },
      [lineEntity(0, 0, 5000, 0), lineEntity(0, 1000, 5000, 1000)],
      6,
    );
    expect(src?.kind).toBe('line');
    if (src?.kind === 'line') expect(src.start.y).toBe(0);
  });
});

describe('wall-from-entity — buildWallForLine', () => {
  it('builds one straight wall the length of the line, edge on the line', () => {
    const entity = buildWallForLine({ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 2500, y: 1000 }, {}, SU, LEVEL);
    expect(entity).not.toBeNull();
    const e = entity as WallEntity;
    expect(e.type).toBe('wall');
    expect(e.kind).toBe('straight');
    // Side point at +Y → axis shifts +Y by half thickness → the edge on the
    // original A→B line (y=0) stays, the body extends toward +Y.
    const half = e.params.thickness / 2;
    expect(e.params.start.y).toBeCloseTo(half, 6);
    expect(e.params.end.y).toBeCloseTo(half, 6);
    expect(e.params.end.x - e.params.start.x).toBeCloseTo(5000, 6);
  });

  it('returns null for a zero-length line (validator reject)', () => {
    const entity = buildWallForLine({ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 200, y: 200 }, {}, SU, LEVEL);
    expect(entity).toBeNull();
  });
});

describe('wall-from-entity — buildWallsForClosed', () => {
  const rectPoly = [
    { x: 0, y: 0 },
    { x: 5000, y: 0 },
    { x: 5000, y: 3000 },
    { x: 0, y: 3000 },
  ];

  it('builds 4 walls when the side point is inside (interior)', () => {
    const walls = buildWallsForClosed(rectPoly, { x: 2500, y: 1500 }, {}, SU, LEVEL);
    expect(walls).toHaveLength(4);
    walls.forEach((w) => expect(w.kind).toBe('straight'));
  });

  it('builds 4 walls when the side point is outside (exterior)', () => {
    const walls = buildWallsForClosed(rectPoly, { x: -2000, y: 1500 }, {}, SU, LEVEL);
    expect(walls).toHaveLength(4);
  });

  it('interior and exterior shift the bottom edge to opposite sides of y=0', () => {
    const inside = buildWallsForClosed(rectPoly, { x: 2500, y: 1500 }, {}, SU, LEVEL);
    const outside = buildWallsForClosed(rectPoly, { x: 2500, y: -1000 }, {}, SU, LEVEL);
    // Bottom edge = edge 0 (v0→v1, along y=0). Interior axis shifts +Y, exterior −Y.
    const insideY = inside[0].params.start.y;
    const outsideY = outside[0].params.start.y;
    expect(Math.sign(insideY)).toBe(1);
    expect(Math.sign(outsideY)).toBe(-1);
  });

  it('consecutive walls share endpoints EXACTLY → clean miter corners (regression: bottom not closing)', () => {
    // Exact miter-offset means wall[i].end === wall[i+1].start at every corner,
    // including the closing corner (wall[3].end === wall[0].start). The old
    // per-edge alignment offset left these axes apart → gaps at thick corners.
    for (const side of [{ x: 2500, y: 1500 }, { x: 2500, y: -3000 }]) {
      const walls = buildWallsForClosed(rectPoly, side, { thickness: 600 }, SU, LEVEL);
      expect(walls).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        const end = walls[i].params.end;
        const start = walls[(i + 1) % 4].params.start;
        expect(start.x).toBeCloseTo(end.x, 6);
        expect(start.y).toBeCloseTo(end.y, 6);
      }
    }
  });

  it('dedupes a duplicated closing vertex (still 4 walls)', () => {
    const closed = [...rectPoly, { x: 0, y: 0 }];
    const walls = buildWallsForClosed(closed, { x: 2500, y: 1500 }, {}, SU, LEVEL);
    expect(walls).toHaveLength(4);
  });

  it('returns empty for a degenerate polygon (<3 vertices)', () => {
    const walls = buildWallsForClosed([{ x: 0, y: 0 }, { x: 100, y: 0 }], { x: 50, y: 50 }, {}, SU, LEVEL);
    expect(walls).toHaveLength(0);
  });
});

// Keep the imported type referenced (avoids unused-import noise in some configs).
const _typecheck: WallSource | null = null;
void _typecheck;
