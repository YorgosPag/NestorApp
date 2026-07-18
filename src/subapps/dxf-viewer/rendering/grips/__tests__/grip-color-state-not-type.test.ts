/**
 * @fileoverview Regression anchor — grip COLOUR encodes STATE, never TYPE.
 *
 * ADR-048 v2.3. Two defects lived here together and this file pins both shut:
 *
 *  1. `GripColorManager.getColor()` had a `type === 'edge' && temperature === 'cold'
 *     → green` rule. Colour then carried two meanings at once (state AND type), and
 *     only in 1 of 3 temperature states — unlearnable. It also collided with AutoCAD,
 *     where green means HOVER, so a resting grip read as "you are on it".
 *
 *  2. `UnifiedGripRenderer.renderGripSetBatched()` groups grips by a key that does
 *     NOT contain `type`, then coloured the whole group from the *representative*
 *     grip's type. So the FIRST square grip in an entity's array coloured every
 *     other one. Columns start with `column-width` (`type: 'edge'`) → the entire
 *     column, including its four `vertex` corners, rendered green; lines/arcs start
 *     with a `vertex` → their genuine edge midpoints rendered blue. Same code, two
 *     opposite wrong answers, decided purely by array order.
 *
 * Type is expressed by SHAPE (square vs diamond vs glyph), which IS in the batch key.
 * Keep it that way: a type→colour rule reintroduces defect 2 silently.
 */

import { GripColorManager } from '../GripColorManager';
import { UnifiedGripRenderer } from '../UnifiedGripRenderer';
import { DEFAULT_GRIP_COLORS } from '../constants';
import type { GripRenderConfig, GripType } from '../types';
import type { Point2D } from '../../types/Types';

const ALL_TYPES: GripType[] = ['vertex', 'edge', 'midpoint', 'center', 'corner', 'quadrant', 'close'];

describe('GripColorManager — colour is a function of STATE only', () => {
  const mgr = new GripColorManager();

  it('returns the cold azure for a resting grip', () => {
    expect(mgr.getColor('cold')).toBe(DEFAULT_GRIP_COLORS.COLD);
  });

  it('never returns green at rest — the removed EDGE_GRIP_COLOR was #00ff80', () => {
    expect(mgr.getColor('cold').toLowerCase()).not.toBe('#00ff80');
  });

  it('honours customColor (ADR-047 close indicator / ADR-637 stair fuchsia)', () => {
    expect(mgr.getColor('cold', '#00ff00')).toBe('#00ff00');
  });

  it('maps each temperature to its own colour', () => {
    expect(mgr.getColor('warm')).toBe(DEFAULT_GRIP_COLORS.WARM);
    expect(mgr.getColor('hot')).toBe(DEFAULT_GRIP_COLORS.HOT);
    expect(mgr.getColor('armed')).toBe(DEFAULT_GRIP_COLORS.ARMED);
    expect(mgr.getColor('snappable')).toBe(DEFAULT_GRIP_COLORS.SNAPPABLE);
  });
});

describe('renderGripSetBatched — array order must not decide colour', () => {
  /** Records every fill colour the renderer commits to the canvas. */
  function makeRecordingCtx(): { ctx: CanvasRenderingContext2D; fills: string[] } {
    const fills: string[] = [];
    const ctx = {
      save: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      closePath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arc: jest.fn(),
      rect: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(() => fills.push(String(ctx.fillStyle))),
      fillRect: jest.fn(() => fills.push(String(ctx.fillStyle))),
      strokeRect: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      setLineDash: jest.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D & { fillStyle: string };
    return { ctx, fills };
  }

  const identity = (p: Point2D): Point2D => p;

  const grip = (type: GripType, x: number): GripRenderConfig => ({
    position: { x, y: 0 },
    type,
    temperature: 'cold',
    shape: 'square',
    entityId: 'e1',
    gripIndex: x,
  });

  /** The column order that produced the all-green bug: an 'edge' grip leads. */
  const EDGE_FIRST = [grip('edge', 0), grip('edge', 1), grip('vertex', 2), grip('vertex', 3)];
  /** The line/arc order that hid it: a 'vertex' grip leads. */
  const VERTEX_FIRST = [grip('vertex', 0), grip('vertex', 1), grip('edge', 2), grip('vertex', 3)];

  function fillsFor(grips: GripRenderConfig[]): string[] {
    const { ctx, fills } = makeRecordingCtx();
    new UnifiedGripRenderer(ctx, identity).renderGripSetBatched(grips);
    return fills;
  }

  it('paints an edge-first set (columns) the same as a vertex-first set (lines)', () => {
    const edgeFirst = new Set(fillsFor(EDGE_FIRST).map((c) => c.toLowerCase()));
    const vertexFirst = new Set(fillsFor(VERTEX_FIRST).map((c) => c.toLowerCase()));
    expect([...edgeFirst]).toEqual([...vertexFirst]);
  });

  it('paints every resting grip the cold azure — no green anywhere', () => {
    for (const set of [EDGE_FIRST, VERTEX_FIRST]) {
      const fills = fillsFor(set);
      expect(fills.length).toBeGreaterThan(0);
      for (const c of fills) {
        expect(c.toLowerCase()).not.toBe('#00ff80');
      }
      expect(fills.some((c) => c.toLowerCase() === DEFAULT_GRIP_COLORS.COLD.toLowerCase())).toBe(true);
    }
  });

  it('is order-independent for every grip type', () => {
    const baseline = new Set(fillsFor([grip('vertex', 0)]).map((c) => c.toLowerCase()));
    for (const type of ALL_TYPES) {
      const leading = new Set(fillsFor([grip(type, 0), grip('vertex', 1)]).map((c) => c.toLowerCase()));
      expect([...leading]).toEqual([...baseline]);
    }
  });
});
