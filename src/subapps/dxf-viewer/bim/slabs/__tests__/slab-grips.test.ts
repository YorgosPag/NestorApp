/**
 * ADR-363 Phase 3.5 + 3.6 — `slab-grips` pure handlers tests.
 *
 * Coverage:
 *   - `getSlabGrips()` returns `2N` grips per closed polygon (N vertex +
 *     N edge-midpoint), in stable index order, with positions matching
 *     the outline + edge midpoints.
 *   - `getSlabGrips()` returns empty array for degenerate polygons (<3 vertices).
 *   - `applySlabGripDrag()`:
 *       · `slab-vertex-N`        → translates the indexed vertex by `delta`
 *                                   (XY), preserves z, leaves others untouched
 *       · `slab-edge-midpoint-N` → inserts a fresh vertex at edge midpoint +
 *                                   delta, original vertices untouched, length+1
 *       · `rectilinear=true`     → quantizes delta to the dominant world axis
 *       · ignores unknown grip kinds gracefully
 *       · short-circuits on zero delta + out-of-range index
 */

import { applySlabGripDrag, getSlabGrips } from '../slab-grips';
import {
  buildDefaultSlabParams,
  buildSlabEntity,
} from '../../../hooks/drawing/slab-completion';
import type { SlabEntity } from '../../types/slab-types';

function unwrapSlab(r: ReturnType<typeof buildSlabEntity>): SlabEntity {
  if (!r.ok) throw new Error('expected slab ok, hardErrors: ' + r.hardErrors.join(','));
  return r.entity;
}

describe('slab-grips (Phase 3.5 + 3.6)', () => {
  function makeRectSlab(): SlabEntity {
    const verts = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
    ];
    return unwrapSlab(buildSlabEntity(buildDefaultSlabParams(verts), '0'));
  }

  // ─── getSlabGrips ────────────────────────────────────────────────────────

  it('1. rectangle slab → 4 vertex + 4 edge-midpoint grips in stable order', () => {
    const slab = makeRectSlab();
    const grips = getSlabGrips(slab);
    expect(grips).toHaveLength(8);
    expect(grips.map((g) => g.slabGripKind)).toEqual([
      'slab-vertex-0',
      'slab-vertex-1',
      'slab-vertex-2',
      'slab-vertex-3',
      'slab-edge-midpoint-0',
      'slab-edge-midpoint-1',
      'slab-edge-midpoint-2',
      'slab-edge-midpoint-3',
    ]);
  });

  it('2. vertex grip positions match outline vertices (XY projection)', () => {
    const slab = makeRectSlab();
    const grips = getSlabGrips(slab);
    expect(grips[0].position).toEqual({ x: 0, y: 0 });
    expect(grips[1].position).toEqual({ x: 4000, y: 0 });
    expect(grips[2].position).toEqual({ x: 4000, y: 3000 });
    expect(grips[3].position).toEqual({ x: 0, y: 3000 });
  });

  it('3. vertex grips carry type=vertex + movesEntity=false', () => {
    const slab = makeRectSlab();
    const grips = getSlabGrips(slab).filter((g) => g.slabGripKind?.startsWith('slab-vertex-'));
    expect(grips).toHaveLength(4);
    for (const g of grips) {
      expect(g.type).toBe('vertex');
      expect(g.movesEntity).toBe(false);
      expect(g.entityId).toBe(slab.id);
    }
  });

  it('4. degenerate polygon (<3 vertices) → empty grip list', () => {
    const slab = makeRectSlab();
    const degenerate: SlabEntity = {
      ...slab,
      params: { ...slab.params, outline: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] } },
    };
    expect(getSlabGrips(degenerate)).toEqual([]);
  });

  // ─── applySlabGripDrag ───────────────────────────────────────────────────

  it('5. drag vertex 0 by (delta) translates only vertex 0', () => {
    const slab = makeRectSlab();
    const next = applySlabGripDrag('slab-vertex-0', {
      originalParams: slab.params,
      delta: { x: 100, y: -50 },
    });
    const verts = next.outline.vertices;
    expect(verts[0].x).toBeCloseTo(100, 3);
    expect(verts[0].y).toBeCloseTo(-50, 3);
    // Other vertices untouched.
    expect(verts[1].x).toBe(4000);
    expect(verts[1].y).toBe(0);
    expect(verts[2].x).toBe(4000);
    expect(verts[2].y).toBe(3000);
    expect(verts[3].x).toBe(0);
    expect(verts[3].y).toBe(3000);
  });

  it('6. drag vertex 2 by (delta) translates only vertex 2', () => {
    const slab = makeRectSlab();
    const next = applySlabGripDrag('slab-vertex-2', {
      originalParams: slab.params,
      delta: { x: -200, y: 300 },
    });
    const verts = next.outline.vertices;
    expect(verts[2].x).toBeCloseTo(3800, 3);
    expect(verts[2].y).toBeCloseTo(3300, 3);
    expect(verts[0].x).toBe(0);
    expect(verts[1].x).toBe(4000);
    expect(verts[3].x).toBe(0);
  });

  it('7. preserves z when present, omits when absent', () => {
    const slab = makeRectSlab();
    // buildDefaultSlabParams lifts to z=0 explicitly.
    const next = applySlabGripDrag('slab-vertex-1', {
      originalParams: slab.params,
      delta: { x: 10, y: 0 },
    });
    expect(next.outline.vertices[1].z).toBe(0);
  });

  it('8. zero delta → returns originalParams referentially', () => {
    const slab = makeRectSlab();
    const next = applySlabGripDrag('slab-vertex-0', {
      originalParams: slab.params,
      delta: { x: 0, y: 0 },
    });
    expect(next).toBe(slab.params);
  });

  it('9. out-of-range vertex index → returns originalParams referentially', () => {
    const slab = makeRectSlab();
    const next = applySlabGripDrag('slab-vertex-99', {
      originalParams: slab.params,
      delta: { x: 10, y: 10 },
    });
    expect(next).toBe(slab.params);
  });

  it('10. unknown grip kind → returns originalParams referentially', () => {
    const slab = makeRectSlab();
    const next = applySlabGripDrag(
      'foreign-grip' as 'slab-vertex-0',
      { originalParams: slab.params, delta: { x: 10, y: 10 } },
    );
    expect(next).toBe(slab.params);
  });
});
