/**
 * ADR-641 — `computeEntityArrayBounds` must cover EVERY geometry type, or a block/scene whose extent
 * is defined by an "uncovered" type (text/ellipse/rectangle/spline/point) yields empty bounds → the
 * Block Editor recenter centre falls back to (0,0) → members render at raw world coords, off-screen
 * («η οντότητα εξαφανίζεται», Giorgio 2026-07-13).
 */
import { computeEntityArrayBounds } from '../dxf-entity-array-bounds';
import type { AnySceneEntity } from '../../types/scene';

const e = (o: object): AnySceneEntity => o as unknown as AnySceneEntity;
const finite = (b: ReturnType<typeof computeEntityArrayBounds>): boolean =>
  [b.min.x, b.min.y, b.max.x, b.max.y].every(Number.isFinite);

describe('computeEntityArrayBounds — full type coverage (ADR-641 world-coords fix)', () => {
  it('text contributes its insertion point (was excluded → empty bounds)', () => {
    const b = computeEntityArrayBounds([e({ type: 'text', position: { x: 1700, y: 400 } })]);
    expect(finite(b)).toBe(true);
    expect(b.min).toEqual({ x: 1700, y: 400 });
  });

  it('mtext + point contribute their positions', () => {
    const b = computeEntityArrayBounds([
      e({ type: 'mtext', position: { x: 10, y: 20 } }),
      e({ type: 'point', position: { x: 30, y: 40 } }),
    ]);
    expect(b.min).toEqual({ x: 10, y: 20 });
    expect(b.max).toEqual({ x: 30, y: 40 });
  });

  it('ellipse contributes a rotation-agnostic major-axis envelope', () => {
    const b = computeEntityArrayBounds([e({ type: 'ellipse', center: { x: 100, y: 100 }, majorAxis: 10, minorAxis: 4 })]);
    expect(b.min).toEqual({ x: 90, y: 90 });
    expect(b.max).toEqual({ x: 110, y: 110 });
  });

  it('rectangle contributes its x/y/w/h box', () => {
    const b = computeEntityArrayBounds([e({ type: 'rectangle', x: 5, y: 5, width: 20, height: 10 })]);
    expect(b.min).toEqual({ x: 5, y: 5 });
    expect(b.max).toEqual({ x: 25, y: 15 });
  });

  it('spline contributes its control points', () => {
    const b = computeEntityArrayBounds([e({ type: 'spline', controlPoints: [{ x: 0, y: 0 }, { x: 50, y: 30 }] })]);
    expect(b.min).toEqual({ x: 0, y: 0 });
    expect(b.max).toEqual({ x: 50, y: 30 });
  });

  it('line/circle/hatch still work (no regression)', () => {
    expect(computeEntityArrayBounds([e({ type: 'line', start: { x: 0, y: 0 }, end: { x: 4, y: 8 } })]).max).toEqual({ x: 4, y: 8 });
    expect(computeEntityArrayBounds([e({ type: 'circle', center: { x: 5, y: 5 }, radius: 2 })]).min).toEqual({ x: 3, y: 3 });
    expect(computeEntityArrayBounds([e({ type: 'hatch', boundaryPaths: [[{ x: 1, y: 1 }, { x: 9, y: 7 }]] })]).max).toEqual({ x: 9, y: 7 });
  });
});
