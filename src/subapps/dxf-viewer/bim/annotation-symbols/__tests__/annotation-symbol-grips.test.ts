/**
 * ADR-583 Φ3 — Annotation-symbol grip SSoT tests («αύξηση λαβών», Giorgio 2026-07-09).
 *
 * Covers the pure grip layer both grip paths consume (`getAnnotationSymbolGrips` +
 * `applyAnnotationSymbolGripDrag`): a selected symbol emits move + rotation + 4 UNIFORM-scale
 * corner handles (all `type:'vertex'` so they survive multi-select), and a corner drag scales
 * `sizeMm` by the SCALE-FREE radial ratio about the insertion point, clamped to a minimum.
 */

import {
  getAnnotationSymbolGrips,
  applyAnnotationSymbolGripDrag,
  ANNOTATION_SYMBOL_CORNER_KINDS,
  MIN_ANNOTATION_SYMBOL_SIZE_MM,
} from '../annotation-symbol-grips';
import type { AnnotationSymbolEntity } from '../../../types/annotation-symbol';

/** A north arrow at the origin, sizeMm 20, unrotated. */
function northArrow(overrides: Partial<AnnotationSymbolEntity> = {}): AnnotationSymbolEntity {
  return {
    id: 'sym-1',
    type: 'annotation-symbol',
    layerId: 'L',
    position: { x: 0, y: 0 },
    kind: 'north-arrow',
    symbolId: 'northArrowSimple',
    sizeMm: 20,
    rotation: 0,
    ...overrides,
  } as AnnotationSymbolEntity;
}

describe('getAnnotationSymbolGrips — 6 grips (move + rotation + 4 corners)', () => {
  it('emits move(center) + rotation(vertex) + 4 corner(vertex) handles with distinct kinds', () => {
    const grips = getAnnotationSymbolGrips('sym-1', { x: 0, y: 0 }, 20, 0);

    expect(grips).toHaveLength(6);
    expect(grips.map((g) => g.gripKind?.kind)).toEqual([
      'annotation-symbol-move',
      'annotation-symbol-rotation',
      ...ANNOTATION_SYMBOL_CORNER_KINDS,
    ]);
    expect(grips.every((g) => g.gripKind?.on === 'annotation-symbol')).toBe(true);
    expect(grips.map((g) => g.gripIndex)).toEqual([0, 1, 2, 3, 4, 5]);

    // MOVE = the insertion point, `movesEntity`, `type:'center'`.
    expect(grips[0].type).toBe('center');
    expect(grips[0].movesEntity).toBe(true);
    expect(grips[0].position).toEqual({ x: 0, y: 0 });

    // Rotation + all 4 corners are STRUCTURAL 'vertex' → always shown on a selected symbol
    // (survive grip-type toggles + the multi-select transform-glyph hide) and never move the entity.
    expect(grips.slice(1).every((g) => g.type === 'vertex')).toBe(true);
    expect(grips.slice(1).every((g) => g.movesEntity === false)).toBe(true);
  });

  it('places the 4 corners on a symmetric square box centred on the insertion point', () => {
    const corners = getAnnotationSymbolGrips('sym-1', { x: 0, y: 0 }, 20, 0).slice(2);
    // Rotation 0 → NE/NW/SW/SE at (±half, ±half). Centroid = origin, all equidistant.
    const cx = corners.reduce((s, g) => s + g.position.x, 0) / 4;
    const cy = corners.reduce((s, g) => s + g.position.y, 0) / 4;
    expect(cx).toBeCloseTo(0, 9);
    expect(cy).toBeCloseTo(0, 9);
    const radii = corners.map((g) => Math.hypot(g.position.x, g.position.y));
    radii.forEach((r) => {
      expect(r).toBeGreaterThan(0);
      expect(r).toBeCloseTo(radii[0], 9);
    });
    // NE is diagonally opposite SW (index 0 vs 2 in the sliced corner array).
    expect(corners[0].position.x).toBeCloseTo(-corners[2].position.x, 9);
    expect(corners[0].position.y).toBeCloseTo(-corners[2].position.y, 9);
  });
});

describe('applyAnnotationSymbolGripDrag — UNIFORM corner resize', () => {
  it('move + rotation kinds return an empty patch (handled by their own SSoTs)', () => {
    const e = northArrow();
    expect(applyAnnotationSymbolGripDrag('annotation-symbol-move', e, { x: 5, y: 5 }, { x: 1, y: 1 })).toEqual({});
    expect(applyAnnotationSymbolGripDrag('annotation-symbol-rotation', e, { x: 5, y: 5 }, { x: 1, y: 1 })).toEqual({});
  });

  it('dragging a corner outward by its own radius doubles sizeMm (position never moves)', () => {
    const e = northArrow({ sizeMm: 20 });
    const ne = getAnnotationSymbolGrips(e.id, e.position, e.sizeMm, e.rotation)[2].position;
    // Move the corner outward along its own radial vector → newDist = 2·oldDist → ratio 2.
    const patch = applyAnnotationSymbolGripDrag('annotation-symbol-corner-ne', e, ne, { x: ne.x, y: ne.y });
    expect(patch.sizeMm).toBeCloseTo(40, 6);
    // Uniform scale about the insertion point — nothing else changes.
    expect(patch.position).toBeUndefined();
    expect(patch.rotation).toBeUndefined();
  });

  it('is SCALE-FREE: the ratio is radial (dimensionless), independent of the drawing scale', () => {
    const e = northArrow({ sizeMm: 20 });
    // Any corner anchor at distance d, dragged inward to half its distance → sizeMm halves.
    const anchor = { x: 100, y: 0 };
    const patch = applyAnnotationSymbolGripDrag('annotation-symbol-corner-se', e, anchor, { x: -50, y: 0 });
    expect(patch.sizeMm).toBeCloseTo(10, 6);
  });

  it('clamps to the minimum readable size (never ≤ 0) when dragged past the centre', () => {
    const e = northArrow({ sizeMm: 20 });
    const nw = getAnnotationSymbolGrips(e.id, e.position, e.sizeMm, e.rotation)[3].position;
    const patch = applyAnnotationSymbolGripDrag('annotation-symbol-corner-nw', e, nw, { x: 1e9, y: -1e9 });
    // Degenerate anchor guard aside, a real inward drag clamps to MIN, never zero/negative.
    const inward = applyAnnotationSymbolGripDrag('annotation-symbol-corner-nw', e, nw, {
      x: -nw.x * 0.999,
      y: -nw.y * 0.999,
    });
    expect(inward.sizeMm).toBeGreaterThanOrEqual(MIN_ANNOTATION_SYMBOL_SIZE_MM);
    expect(patch.sizeMm).toBeGreaterThan(0);
  });

  it('a zero-radius anchor (grip on the insertion point) is a no-op', () => {
    const e = northArrow();
    expect(applyAnnotationSymbolGripDrag('annotation-symbol-corner-ne', e, { x: 0, y: 0 }, { x: 5, y: 5 })).toEqual({});
  });
});
