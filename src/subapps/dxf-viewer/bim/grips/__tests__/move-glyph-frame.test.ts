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

  it('no orientation (params-less line w/o geometry, degenerate axis, missing params) → null', () => {
    expect(resolveMoveGlyphFrame(ent('line', {}))).toBeNull();
    expect(resolveMoveGlyphFrame(ent('wall', { start: { x: 5, y: 5 }, end: { x: 5, y: 5 } }))).toBeNull();
    expect(resolveMoveGlyphFrame({ id: 'x', type: 'line' } as unknown as Entity)).toBeNull();
  });

  // ADR-363 Slice G.5 — plain DXF line: the axis lives in TOP-LEVEL start/end (no
  // `params`), so the resolver must read it there → the move cross orients + drives
  // the directional move exactly like a wall axis.
  it('plain DXF line (top-level start/end, no params) → axisX along start→end', () => {
    const line = { id: 'L1', type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } } as unknown as Entity;
    const f = resolveMoveGlyphFrame(line)!;
    expect(f.axisX.x).toBeCloseTo(1, 6);
    expect(f.axisX.y).toBeCloseTo(0, 6);
    expect(f.axisY.x).toBeCloseTo(0, 6);
    expect(f.axisY.y).toBeCloseTo(1, 6);
  });

  it('plain DXF line (vertical, top-level) → axisX points +Y', () => {
    const line = { id: 'L1', type: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 50 } } as unknown as Entity;
    const f = resolveMoveGlyphFrame(line)!;
    expect(f.axisX.x).toBeCloseTo(0, 6);
    expect(f.axisX.y).toBeCloseTo(1, 6);
  });

  it('ADR-561: circle/arc/polyline get the WORLD-aligned identity frame (enables directional move)', () => {
    for (const type of ['circle', 'arc', 'polyline'] as const) {
      const prim = { id: 'P1', type } as unknown as Entity;
      const f = resolveMoveGlyphFrame(prim)!;
      expect(f).not.toBeNull();
      expect(f.axisX.x).toBeCloseTo(1, 6);
      expect(f.axisX.y).toBeCloseTo(0, 6);
      expect(f.axisY.x).toBeCloseTo(0, 6);
      expect(f.axisY.y).toBeCloseTo(1, 6);
    }
  });

  it('a params-less primitive with no recognised type is still NOT given a frame', () => {
    const unknown = { id: 'U1', type: 'point', position: { x: 0, y: 0 } } as unknown as Entity;
    expect(resolveMoveGlyphFrame(unknown)).toBeNull();
  });

  // ADR-557 — Text / MText carry orientation in the TOP-LEVEL `rotation` field (no
  // `params`), like a box entity → the 4-arrow MOVE cross rotates with the text and
  // the per-arm directional move-by-value runs along its local axes (column parity).
  it('text / mtext at rotation 0 → world-aligned identity frame', () => {
    for (const type of ['text', 'mtext'] as const) {
      const t = { id: 'T1', type, rotation: 0, position: { x: 0, y: 0 } } as unknown as Entity;
      const f = resolveMoveGlyphFrame(t)!;
      expect(f).not.toBeNull();
      expect(f.axisX.x).toBeCloseTo(1, 6);
      expect(f.axisX.y).toBeCloseTo(0, 6);
      expect(f.axisY.x).toBeCloseTo(0, 6);
      expect(f.axisY.y).toBeCloseTo(1, 6);
    }
  });

  it('text at rotation 90° → axisX points +Y (world CCW), like a box entity', () => {
    const t = { id: 'T2', type: 'text', rotation: 90, position: { x: 0, y: 0 } } as unknown as Entity;
    const f = resolveMoveGlyphFrame(t)!;
    expect(f.axisX.x).toBeCloseTo(0, 6);
    expect(f.axisX.y).toBeCloseTo(1, 6);
    expect(f.axisY.x).toBeCloseTo(-1, 6);
    expect(f.axisY.y).toBeCloseTo(0, 6);
  });

  it('text with missing/NaN rotation → treated as 0 (identity), never null', () => {
    const t = { id: 'T3', type: 'text', position: { x: 0, y: 0 } } as unknown as Entity;
    const f = resolveMoveGlyphFrame(t)!;
    expect(f).not.toBeNull();
    expect(f.axisX.x).toBeCloseTo(1, 6);
    expect(f.axisX.y).toBeCloseTo(0, 6);
  });

  // ADR-583 — an annotation symbol (point-glyph, no `params`) orients from its TOP-LEVEL
  // `rotation`, exactly like text: the MOVE cross rotates with it AND its rotation ghost
  // reference axis stays coaxial with the symbol's faces (Giorgio 2026-07-09).
  it('annotation symbol at rotation 45° → axisX along the 45° diagonal (never null)', () => {
    const s = { id: 'S1', type: 'annotation-symbol', rotation: 45, position: { x: 0, y: 0 } } as unknown as Entity;
    const f = resolveMoveGlyphFrame(s)!;
    const h = Math.SQRT1_2;
    expect(f).not.toBeNull();
    expect(f.axisX.x).toBeCloseTo(h, 6);
    expect(f.axisX.y).toBeCloseTo(h, 6);
  });

  it('annotation symbol with missing rotation → identity frame (0°), never null', () => {
    const s = { id: 'S2', type: 'annotation-symbol', position: { x: 0, y: 0 } } as unknown as Entity;
    const f = resolveMoveGlyphFrame(s)!;
    expect(f).not.toBeNull();
    expect(f.axisX.x).toBeCloseTo(1, 6);
    expect(f.axisX.y).toBeCloseTo(0, 6);
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
