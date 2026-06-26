/**
 * ADR-363 Phase 3.7a — `slab-opening-grips` pure handlers tests.
 *
 * Coverage (mirror του `slab-grips.test.ts` Phase 3.5 + 3.6):
 *   - `getSlabOpeningGrips()` returns `2N` grips per closed polygon (N vertex +
 *     N edge-midpoint), σε stable index order, με positions να ταιριάζουν
 *     με outline + edge midpoints.
 *   - `getSlabOpeningGrips()` returns empty array για degenerate polygons
 *     (<3 vertices).
 *   - `applySlabOpeningGripDrag()`:
 *       · `slab-opening-vertex-N`        → translates indexed vertex by `delta`
 *                                          (XY), preserves z, leaves others
 *                                          untouched
 *       · `slab-opening-edge-midpoint-N` → inserts fresh vertex στο edge midpoint
 *                                          + delta, original vertices untouched,
 *                                          length+1
 *       · `rectilinear=true`             → quantizes delta στον dominant world axis
 *       · ignores unknown grip kinds gracefully
 *       · short-circuits σε zero delta + out-of-range index
 */

import {
  applySlabOpeningGripDrag,
  getSlabOpeningGrips,
  removeVertexFromSlabOpening,
} from '../slab-opening-grips';
import { computeSlabOpeningGeometry } from '../../geometry/slab-opening-geometry';
import type {
  SlabOpeningEntity,
  SlabOpeningParams,
} from '../../types/slab-opening-types';

function makeRectShaft(): SlabOpeningEntity {
  const params: SlabOpeningParams = {
    kind: 'shaft',
    slabId: 'slab_test',
    outline: {
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1500, y: 0, z: 0 },
        { x: 1500, y: 1200, z: 0 },
        { x: 0, y: 1200, z: 0 },
      ],
    },
  };
  return {
    id: 'slbopn_test',
    type: 'slab-opening',
    kind: 'shaft',
    layerId: '0',
    params,
    geometry: computeSlabOpeningGeometry(params),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as SlabOpeningEntity;
}

describe('slab-opening-grips (Phase 3.7a)', () => {
  // ─── getSlabOpeningGrips ───────────────────────────────────────────────────

  it('1. rectangle slab-opening → 4 vertex + 4 edge-midpoint grips in stable order', () => {
    const opening = makeRectShaft();
    const grips = getSlabOpeningGrips(opening);
    expect(grips).toHaveLength(8);
    expect(grips.map((g) => g.slabOpeningGripKind)).toEqual([
      'slab-opening-vertex-0',
      'slab-opening-vertex-1',
      'slab-opening-vertex-2',
      'slab-opening-vertex-3',
      'slab-opening-edge-midpoint-0',
      'slab-opening-edge-midpoint-1',
      'slab-opening-edge-midpoint-2',
      'slab-opening-edge-midpoint-3',
    ]);
  });

  it('2. vertex grip positions match outline vertices (XY projection)', () => {
    const opening = makeRectShaft();
    const grips = getSlabOpeningGrips(opening);
    expect(grips[0].position).toEqual({ x: 0, y: 0 });
    expect(grips[1].position).toEqual({ x: 1500, y: 0 });
    expect(grips[2].position).toEqual({ x: 1500, y: 1200 });
    expect(grips[3].position).toEqual({ x: 0, y: 1200 });
  });

  it('3. vertex grips carry type=vertex + movesEntity=false + entityId', () => {
    const opening = makeRectShaft();
    const grips = getSlabOpeningGrips(opening).filter(
      (g) => g.slabOpeningGripKind?.startsWith('slab-opening-vertex-'),
    );
    expect(grips).toHaveLength(4);
    for (const g of grips) {
      expect(g.type).toBe('vertex');
      expect(g.movesEntity).toBe(false);
      expect(g.entityId).toBe(opening.id);
    }
  });

  it('4. degenerate polygon (<3 vertices) → empty grip list', () => {
    const opening = makeRectShaft();
    const degenerate: SlabOpeningEntity = {
      ...opening,
      params: {
        ...opening.params,
        outline: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] },
      },
    };
    expect(getSlabOpeningGrips(degenerate)).toEqual([]);
  });

  // ─── applySlabOpeningGripDrag — vertex translate ─────────────────────────

  it('5. drag vertex 0 translates only vertex 0', () => {
    const opening = makeRectShaft();
    const next = applySlabOpeningGripDrag('slab-opening-vertex-0', {
      originalParams: opening.params,
      delta: { x: 100, y: -50 },
    });
    const verts = next.outline.vertices;
    expect(verts[0].x).toBeCloseTo(100, 3);
    expect(verts[0].y).toBeCloseTo(-50, 3);
    expect(verts[1].x).toBe(1500);
    expect(verts[1].y).toBe(0);
    expect(verts[2].x).toBe(1500);
    expect(verts[2].y).toBe(1200);
    expect(verts[3].x).toBe(0);
    expect(verts[3].y).toBe(1200);
  });

  it('6. drag vertex 2 translates only vertex 2', () => {
    const opening = makeRectShaft();
    const next = applySlabOpeningGripDrag('slab-opening-vertex-2', {
      originalParams: opening.params,
      delta: { x: -200, y: 300 },
    });
    const verts = next.outline.vertices;
    expect(verts[2].x).toBeCloseTo(1300, 3);
    expect(verts[2].y).toBeCloseTo(1500, 3);
    expect(verts[0].x).toBe(0);
    expect(verts[1].x).toBe(1500);
    expect(verts[3].x).toBe(0);
  });

  it('7. preserves z when present', () => {
    const opening = makeRectShaft();
    const next = applySlabOpeningGripDrag('slab-opening-vertex-1', {
      originalParams: opening.params,
      delta: { x: 10, y: 0 },
    });
    expect(next.outline.vertices[1].z).toBe(0);
  });

  it('8. zero delta → returns originalParams referentially', () => {
    const opening = makeRectShaft();
    const next = applySlabOpeningGripDrag('slab-opening-vertex-0', {
      originalParams: opening.params,
      delta: { x: 0, y: 0 },
    });
    expect(next).toBe(opening.params);
  });

  it('9. out-of-range vertex index → returns originalParams referentially', () => {
    const opening = makeRectShaft();
    const next = applySlabOpeningGripDrag('slab-opening-vertex-99', {
      originalParams: opening.params,
      delta: { x: 10, y: 10 },
    });
    expect(next).toBe(opening.params);
  });

  it('10. unknown grip kind → returns originalParams referentially', () => {
    const opening = makeRectShaft();
    const next = applySlabOpeningGripDrag(
      'foreign-grip' as 'slab-opening-vertex-0',
      { originalParams: opening.params, delta: { x: 10, y: 10 } },
    );
    expect(next).toBe(opening.params);
  });

  // ─── Edge-midpoint vertex insertion ──────────────────────────────────────

  it('11. edge-midpoint grip positions = midpoint of each edge (incl. closing edge)', () => {
    const opening = makeRectShaft();
    const grips = getSlabOpeningGrips(opening);
    const mids = grips.filter(
      (g) => g.slabOpeningGripKind?.startsWith('slab-opening-edge-midpoint-'),
    );
    expect(mids).toHaveLength(4);
    expect(mids[0].position).toEqual({ x: 750, y: 0 });     // edge 0→1
    expect(mids[1].position).toEqual({ x: 1500, y: 600 });  // edge 1→2
    expect(mids[2].position).toEqual({ x: 750, y: 1200 });  // edge 2→3
    expect(mids[3].position).toEqual({ x: 0, y: 600 });     // edge 3→0 closing
  });

  it('12. edge-midpoint grip type=midpoint + edgeVertexIndices populated', () => {
    const opening = makeRectShaft();
    const mids = getSlabOpeningGrips(opening).filter(
      (g) => g.slabOpeningGripKind?.startsWith('slab-opening-edge-midpoint-'),
    );
    expect(mids[0].type).toBe('midpoint');
    expect(mids[0].edgeVertexIndices).toEqual([0, 1]);
    expect(mids[3].edgeVertexIndices).toEqual([3, 0]); // wraps closing edge
  });

  it('13. drag edge-midpoint inserts fresh vertex at midpoint + delta', () => {
    const opening = makeRectShaft();
    const next = applySlabOpeningGripDrag('slab-opening-edge-midpoint-0', {
      originalParams: opening.params,
      delta: { x: 0, y: -500 },
    });
    const verts = next.outline.vertices;
    expect(verts).toHaveLength(5);
    expect(verts[0]).toEqual(opening.params.outline.vertices[0]);
    expect(verts[1].x).toBeCloseTo(750, 3);
    expect(verts[1].y).toBeCloseTo(-500, 3);
    expect(verts[1].z).toBe(0);
    expect(verts[2]).toEqual(opening.params.outline.vertices[1]);
    expect(verts[3]).toEqual(opening.params.outline.vertices[2]);
    expect(verts[4]).toEqual(opening.params.outline.vertices[3]);
  });

  it('14. drag closing edge midpoint (-3) wraps around correctly', () => {
    const opening = makeRectShaft();
    const next = applySlabOpeningGripDrag('slab-opening-edge-midpoint-3', {
      originalParams: opening.params,
      delta: { x: -500, y: 0 },
    });
    const verts = next.outline.vertices;
    expect(verts).toHaveLength(5);
    expect(verts[4].x).toBeCloseTo(-500, 3);
    expect(verts[4].y).toBeCloseTo(600, 3);
  });

  it('15. out-of-range edge-midpoint index → returns originalParams referentially', () => {
    const opening = makeRectShaft();
    const next = applySlabOpeningGripDrag('slab-opening-edge-midpoint-99', {
      originalParams: opening.params,
      delta: { x: 10, y: 10 },
    });
    expect(next).toBe(opening.params);
  });

  // ─── Rectilinear (Shift) constraint ──────────────────────────────────────

  it('16. rectilinear=true + |dx| > |dy| → keeps dx, drops dy', () => {
    const opening = makeRectShaft();
    const next = applySlabOpeningGripDrag('slab-opening-vertex-0', {
      originalParams: opening.params,
      delta: { x: 300, y: -120 },
      rectilinear: true,
    });
    expect(next.outline.vertices[0].x).toBeCloseTo(300, 3);
    expect(next.outline.vertices[0].y).toBeCloseTo(0, 3);
  });

  it('17. rectilinear=true + |dy| > |dx| → keeps dy, drops dx', () => {
    const opening = makeRectShaft();
    const next = applySlabOpeningGripDrag('slab-opening-vertex-2', {
      originalParams: opening.params,
      delta: { x: 80, y: -500 },
      rectilinear: true,
    });
    expect(next.outline.vertices[2].x).toBeCloseTo(1500, 3);
    expect(next.outline.vertices[2].y).toBeCloseTo(700, 3);
  });

  it('18. rectilinear=true tie (|dx| == |dy|) → prefers horizontal axis', () => {
    const opening = makeRectShaft();
    const next = applySlabOpeningGripDrag('slab-opening-vertex-0', {
      originalParams: opening.params,
      delta: { x: 100, y: -100 },
      rectilinear: true,
    });
    expect(next.outline.vertices[0].x).toBeCloseTo(100, 3);
    expect(next.outline.vertices[0].y).toBeCloseTo(0, 3);
  });

  it('19. rectilinear=true applies to edge-midpoint insertion delta', () => {
    const opening = makeRectShaft();
    const next = applySlabOpeningGripDrag('slab-opening-edge-midpoint-0', {
      originalParams: opening.params,
      delta: { x: 40, y: -350 },
      rectilinear: true,
    });
    expect(next.outline.vertices).toHaveLength(5);
    // Midpoint edge 0→1 = (750, 0). Με rectilinear, μόνο dy κρατιέται.
    expect(next.outline.vertices[1].x).toBeCloseTo(750, 3);
    expect(next.outline.vertices[1].y).toBeCloseTo(-350, 3);
  });

  it('20. rectilinear=false (default) keeps full delta vector', () => {
    const opening = makeRectShaft();
    const next = applySlabOpeningGripDrag('slab-opening-vertex-0', {
      originalParams: opening.params,
      delta: { x: 100, y: -200 },
    });
    expect(next.outline.vertices[0].x).toBeCloseTo(100, 3);
    expect(next.outline.vertices[0].y).toBeCloseTo(-200, 3);
  });

  // ─── Foreign params preserved (kind / slabId / fireRating) ───────────────

  it('21. drag preserves kind / slabId / fireRating / elevationOverride', () => {
    const opening = makeRectShaft();
    const richParams: SlabOpeningParams = {
      ...opening.params,
      fireRating: 90,
      elevationOverride: 3000,
      multiStoreyStackGroupId: 'stack_42',
    };
    const next = applySlabOpeningGripDrag('slab-opening-vertex-0', {
      originalParams: richParams,
      delta: { x: 50, y: 50 },
    });
    expect(next.kind).toBe('shaft');
    expect(next.slabId).toBe('slab_test');
    expect(next.fireRating).toBe(90);
    expect(next.elevationOverride).toBe(3000);
    expect(next.multiStoreyStackGroupId).toBe('stack_42');
  });

  // ─── ADR-535 Φ4 — removeVertexFromSlabOpening (mirror removeVertexFromSlab) ─────

  it('22. removeVertexFromSlabOpening drops the indexed vertex (4 → 3) and preserves the rest', () => {
    const opening = makeRectShaft();
    const next = removeVertexFromSlabOpening(opening.params, 1);
    expect(next.outline.vertices).toHaveLength(3);
    expect(next.outline.vertices.map((v) => v.x)).toEqual([0, 1500, 0]);
    expect(next.slabId).toBe('slab_test');
  });

  it('23. removeVertexFromSlabOpening is a no-op at the minimum triangle (≤3 → identity)', () => {
    const tri: SlabOpeningParams = {
      ...makeRectShaft().params,
      outline: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 1500, y: 0, z: 0 }, { x: 750, y: 1200, z: 0 }] },
    };
    expect(removeVertexFromSlabOpening(tri, 1)).toBe(tri);
  });

  it('24. removeVertexFromSlabOpening is a no-op for an out-of-range index (identity)', () => {
    const opening = makeRectShaft();
    expect(removeVertexFromSlabOpening(opening.params, 99)).toBe(opening.params);
  });
});
