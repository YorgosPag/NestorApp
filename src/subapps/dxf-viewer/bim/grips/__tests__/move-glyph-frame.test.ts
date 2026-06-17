/**
 * ADR-397 — Move-glyph local frame SSoT tests (Giorgio 2026-06-17).
 *
 * `resolveMoveGlyphFrame` → entity local axes (world unit vectors); box entities
 * from `params.rotation`, linear entities from their axis. `withMoveGlyphRotation`
 * attaches the SCREEN-space angle to `shape: 'move'` grips only.
 */

import { resolveMoveGlyphFrame, withMoveGlyphRotation } from '../move-glyph-frame';
import type { Entity } from '../../../types/entities';
import type { GripInfo, Point2D } from '../../../rendering/types/Types';

/** Minimal entity stub — only `type` + `params` are read by the resolver. */
function ent(type: string, params: Record<string, unknown>): Entity {
  return { id: 'e1', type, params } as unknown as Entity;
}

describe('resolveMoveGlyphFrame (ADR-397)', () => {
  it('box entity at rotation 0 → world-aligned axes', () => {
    const f = resolveMoveGlyphFrame(ent('column', { rotation: 0 }))!;
    expect(f.axisX.x).toBeCloseTo(1, 6);
    expect(f.axisX.y).toBeCloseTo(0, 6);
    expect(f.axisY.x).toBeCloseTo(0, 6);
    expect(f.axisY.y).toBeCloseTo(1, 6);
  });

  it('box entity at rotation 90° → axisX points +Y (world CCW)', () => {
    const f = resolveMoveGlyphFrame(ent('column', { rotation: 90 }))!;
    expect(f.axisX.x).toBeCloseTo(0, 6);
    expect(f.axisX.y).toBeCloseTo(1, 6);
    expect(f.axisY.x).toBeCloseTo(-1, 6);
    expect(f.axisY.y).toBeCloseTo(0, 6);
  });

  it('box entity at 45° → unit diagonal axes', () => {
    const f = resolveMoveGlyphFrame(ent('furniture', { rotation: 45 }))!;
    const h = Math.SQRT1_2;
    expect(f.axisX.x).toBeCloseTo(h, 6);
    expect(f.axisX.y).toBeCloseTo(h, 6);
    expect(Math.hypot(f.axisX.x, f.axisX.y)).toBeCloseTo(1, 6);
  });

  it('linear wall → axisX along start→end (horizontal)', () => {
    const f = resolveMoveGlyphFrame(ent('wall', { start: { x: 0, y: 0 }, end: { x: 500, y: 0 } }))!;
    expect(f.axisX.x).toBeCloseTo(1, 6);
    expect(f.axisX.y).toBeCloseTo(0, 6);
  });

  it('linear wall (vertical) → axisX points +Y', () => {
    const f = resolveMoveGlyphFrame(ent('wall', { start: { x: 0, y: 0 }, end: { x: 0, y: 300 } }))!;
    expect(f.axisX.x).toBeCloseTo(0, 6);
    expect(f.axisX.y).toBeCloseTo(1, 6);
  });

  it('linear beam → axisX along startPoint→endPoint', () => {
    const f = resolveMoveGlyphFrame(ent('beam', { startPoint: { x: 0, y: 0 }, endPoint: { x: 0, y: -200 } }))!;
    expect(f.axisX.x).toBeCloseTo(0, 6);
    expect(f.axisX.y).toBeCloseTo(-1, 6);
  });

  it('axis wins over rotation when both present (linear element)', () => {
    const f = resolveMoveGlyphFrame(ent('wall', { rotation: 90, start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }))!;
    expect(f.axisX.x).toBeCloseTo(1, 6); // horizontal axis, not the 90° rotation
  });

  it('no orientation (plain line, degenerate axis, missing params) → null', () => {
    expect(resolveMoveGlyphFrame(ent('line', {}))).toBeNull();
    expect(resolveMoveGlyphFrame(ent('wall', { start: { x: 5, y: 5 }, end: { x: 5, y: 5 } }))).toBeNull();
    expect(resolveMoveGlyphFrame({ id: 'x', type: 'line' } as unknown as Entity)).toBeNull();
  });
});

describe('withMoveGlyphRotation (ADR-397)', () => {
  const identity = (p: Point2D): Point2D => p;
  const yFlip = (p: Point2D): Point2D => ({ x: p.x, y: -p.y });

  const moveGrip: GripInfo = {
    id: 'g0', position: { x: 100, y: 50 }, type: 'center', entityId: 'e1', isVisible: true,
    gripIndex: 0, shape: 'move',
  };
  const squareGrip: GripInfo = {
    id: 'g2', position: { x: 0, y: 0 }, type: 'vertex', entityId: 'e1', isVisible: true,
    gripIndex: 2, shape: 'square',
  };

  it('attaches the screen angle only to move grips', () => {
    const out = withMoveGlyphRotation([moveGrip, squareGrip], ent('column', { rotation: 0 }), identity);
    expect(out[0].glyphRotationRad).toBeCloseTo(0, 6);
    expect(out[1].glyphRotationRad).toBeUndefined();
  });

  it('Y-flip canvas: a 90° world rotation reads as −90° on screen', () => {
    // axisX world = (0,1) → screen (0,−1) → atan2(−1,0) = −π/2.
    const out = withMoveGlyphRotation([moveGrip], ent('column', { rotation: 90 }), yFlip);
    expect(out[0].glyphRotationRad).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('returns the array untouched when the entity has no orientation', () => {
    const grips = [moveGrip, squareGrip];
    expect(withMoveGlyphRotation(grips, ent('line', {}), identity)).toBe(grips);
  });
});
