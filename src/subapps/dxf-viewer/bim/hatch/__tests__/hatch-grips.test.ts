/**
 * ADR-507 S2-fix-3 — hatch grip-drag transform tests.
 */

import {
  applyHatchGripDrag, decodeHatchVertexGripKind, getHatchBoundaryGrips,
  applyHatchOriginGripDrag, isHatchOriginGripKind, hatchBounds, hatchBoundsCenter,
  HATCH_GRADIENT_ORIGIN_KIND,
  isHatchAngleGripKind, hatchGradientAngleGripPos, applyHatchAngleGripDrag,
  HATCH_GRADIENT_ANGLE_KIND,
  getHatchEdgeMidpointGrips, decodeHatchEdgeMidpointGripKind,
  insertHatchVertexOnEdge, removeVertexFromHatch, removeVerticesFromHatch,
} from '../hatch-grips';
import type { Point2D } from '../../../rendering/types/Types';
import type { HatchGripKind } from '../../../hooks/grip-types';

const OUTER: Point2D[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];
const ISLAND: Point2D[] = [
  { x: 400, y: 400 },
  { x: 600, y: 400 },
  { x: 600, y: 600 },
];

describe('getHatchBoundaryGrips — the render↔interaction grip SSoT (ADR-507 §grip-SSoT)', () => {
  it('emits one grip per vertex of every ring, path-major order, with correct indices', () => {
    const grips = getHatchBoundaryGrips([OUTER, ISLAND]);
    expect(grips).toHaveLength(OUTER.length + ISLAND.length); // 4 + 3
    // path-major, vertex-minor → array index is the running gripIndex both consumers assign.
    expect(grips[0]).toEqual({ pathIdx: 0, vertexIdx: 0, point: { x: 0, y: 0 } });
    expect(grips[3]).toEqual({ pathIdx: 0, vertexIdx: 3, point: { x: 0, y: 1000 } });
    expect(grips[4]).toEqual({ pathIdx: 1, vertexIdx: 0, point: { x: 400, y: 400 } });
    // The decoded kind of each grip round-trips to its (pathIdx, vertexIdx).
    for (const g of grips) {
      expect(decodeHatchVertexGripKind(`hatch-vertex-${g.pathIdx}-${g.vertexIdx}` as HatchGripKind)).toEqual([g.pathIdx, g.vertexIdx]);
    }
  });

  it('is UNCAPPED — a dense boundary (>50 vertices) yields a grip for EVERY vertex (big-player visible≡editable)', () => {
    const dense: Point2D[] = Array.from({ length: 200 }, (_, i) => ({ x: i, y: 0 }));
    expect(getHatchBoundaryGrips([dense])).toHaveLength(200);
  });

  it('empty boundary → no grips', () => {
    expect(getHatchBoundaryGrips([])).toHaveLength(0);
  });
});

describe('decodeHatchVertexGripKind', () => {
  it('decodes path + vertex indices', () => {
    expect(decodeHatchVertexGripKind('hatch-vertex-0-2')).toEqual([0, 2]);
    expect(decodeHatchVertexGripKind('hatch-vertex-1-0')).toEqual([1, 0]);
  });

  it('returns null on a malformed kind', () => {
    expect(decodeHatchVertexGripKind('hatch-vertex-0' as HatchGripKind)).toBeNull();
  });
});

describe('applyHatchGripDrag', () => {
  it('translates the targeted outer-ring vertex only', () => {
    const result = applyHatchGripDrag('hatch-vertex-0-1', {
      originalBoundaryPaths: [OUTER],
      delta: { x: 50, y: -30 },
    });
    expect(result[0][1]).toEqual({ x: 1050, y: -30 });
    // Other vertices untouched.
    expect(result[0][0]).toEqual({ x: 0, y: 0 });
    expect(result[0][2]).toEqual({ x: 1000, y: 1000 });
  });

  it('translates a vertex on an island ring (multi-ring decode)', () => {
    const result = applyHatchGripDrag('hatch-vertex-1-0', {
      originalBoundaryPaths: [OUTER, ISLAND],
      delta: { x: 10, y: 10 },
    });
    expect(result[1][0]).toEqual({ x: 410, y: 410 });
    // Outer ring shared untouched.
    expect(result[0]).toEqual(OUTER);
  });

  it('returns the original reference (no-op) on out-of-range index', () => {
    const original = [OUTER];
    expect(applyHatchGripDrag('hatch-vertex-0-9', { originalBoundaryPaths: original, delta: { x: 5, y: 5 } })).toBe(original);
    expect(applyHatchGripDrag('hatch-vertex-3-0', { originalBoundaryPaths: original, delta: { x: 5, y: 5 } })).toBe(original);
  });

  it('returns the original reference on zero delta', () => {
    const original = [OUTER];
    expect(applyHatchGripDrag('hatch-vertex-0-0', { originalBoundaryPaths: original, delta: { x: 0, y: 0 } })).toBe(original);
  });

  it('quantizes to the dominant axis when rectilinear', () => {
    const result = applyHatchGripDrag('hatch-vertex-0-0', {
      originalBoundaryPaths: [OUTER],
      delta: { x: 80, y: 20 },
      rectilinear: true,
    });
    // |dx| > |dy| → y component dropped.
    expect(result[0][0]).toEqual({ x: 80, y: 0 });
  });

  it('does not mutate the input boundaryPaths', () => {
    const original = [OUTER.map((p) => ({ ...p }))];
    const snapshot = JSON.stringify(original);
    applyHatchGripDrag('hatch-vertex-0-1', { originalBoundaryPaths: original, delta: { x: 50, y: 50 } });
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

// ── ADR-507 (Giorgio 2026-07-07) — edge-midpoint grips: add/remove boundary vertex ──

describe('getHatchEdgeMidpointGrips — the render↔interaction edge-grip SSoT', () => {
  it('emits one midpoint grip per edge of every ring (incl. the closing edge), path-major', () => {
    const grips = getHatchEdgeMidpointGrips([OUTER, ISLAND]);
    expect(grips).toHaveLength(OUTER.length + ISLAND.length); // one per edge (closed rings)
    // outer edge 0 = midpoint of (0,0)→(1000,0).
    expect(grips[0]).toEqual({ pathIdx: 0, edgeIdx: 0, point: { x: 500, y: 0 } });
    // outer closing edge 3 = midpoint of (0,1000)→(0,0).
    expect(grips[3]).toEqual({ pathIdx: 0, edgeIdx: 3, point: { x: 0, y: 500 } });
    // island first edge.
    expect(grips[4]).toEqual({ pathIdx: 1, edgeIdx: 0, point: { x: 500, y: 400 } });
  });

  it('skips degenerate rings (<3 vertices)', () => {
    expect(getHatchEdgeMidpointGrips([[{ x: 0, y: 0 }, { x: 10, y: 0 }]])).toHaveLength(0);
    expect(getHatchEdgeMidpointGrips([])).toHaveLength(0);
  });
});

describe('decodeHatchEdgeMidpointGripKind', () => {
  it('decodes path + edge indices', () => {
    expect(decodeHatchEdgeMidpointGripKind('hatch-edge-midpoint-0-2')).toEqual([0, 2]);
    expect(decodeHatchEdgeMidpointGripKind('hatch-edge-midpoint-1-0')).toEqual([1, 0]);
  });
  it('returns null on a vertex/gradient kind', () => {
    expect(decodeHatchEdgeMidpointGripKind('hatch-vertex-0-1')).toBeNull();
    expect(decodeHatchEdgeMidpointGripKind(HATCH_GRADIENT_ORIGIN_KIND)).toBeNull();
  });
});

describe('insertHatchVertexOnEdge', () => {
  it('inserts a new vertex at the edge midpoint (delta 0) right after the edge start', () => {
    const result = insertHatchVertexOnEdge([OUTER], 0, 0, { x: 0, y: 0 });
    expect(result[0]).toHaveLength(OUTER.length + 1);
    expect(result[0][1]).toEqual({ x: 500, y: 0 }); // inserted between v0 and v1
    expect(result[0][2]).toEqual({ x: 1000, y: 0 }); // former v1 shifted
  });

  it('offsets the inserted vertex by delta (drag-to-place)', () => {
    const result = insertHatchVertexOnEdge([OUTER], 0, 0, { x: 0, y: -40 });
    expect(result[0][1]).toEqual({ x: 500, y: -40 });
  });

  it('inserts on the closing edge (wraps to vertex 0)', () => {
    const result = insertHatchVertexOnEdge([OUTER], 0, 3, { x: 0, y: 0 });
    // edge 3 = v3(0,1000)→v0(0,0) → midpoint (0,500), appended at end.
    expect(result[0]).toHaveLength(OUTER.length + 1);
    expect(result[0][4]).toEqual({ x: 0, y: 500 });
  });

  it('targets the correct island ring, leaves the outer untouched', () => {
    const result = insertHatchVertexOnEdge([OUTER, ISLAND], 1, 0, { x: 0, y: 0 });
    expect(result[0]).toEqual(OUTER);
    expect(result[1]).toHaveLength(ISLAND.length + 1);
  });

  it('returns the original reference on out-of-range', () => {
    const original = [OUTER];
    expect(insertHatchVertexOnEdge(original, 5, 0, { x: 0, y: 0 })).toBe(original);
    expect(insertHatchVertexOnEdge(original, 0, 9, { x: 0, y: 0 })).toBe(original);
  });
});

describe('removeVertexFromHatch', () => {
  const PENTAGON: Point2D[] = [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 50, y: 150 }, { x: 0, y: 100 },
  ];

  it('drops the targeted vertex', () => {
    const result = removeVertexFromHatch([PENTAGON], 0, 2);
    expect(result[0]).toHaveLength(PENTAGON.length - 1);
    expect(result[0]).not.toContainEqual({ x: 100, y: 100 });
  });

  it('no-op (original reference) at the minimum triangle', () => {
    const tri = [ISLAND];
    expect(removeVertexFromHatch(tri, 0, 0)).toBe(tri);
  });

  it('no-op on out-of-range index / ring', () => {
    const original = [PENTAGON];
    expect(removeVertexFromHatch(original, 0, 9)).toBe(original);
    expect(removeVertexFromHatch(original, 3, 0)).toBe(original);
  });

  it('removes from the correct island ring, leaves outer untouched', () => {
    const island5: Point2D[] = [...PENTAGON];
    const result = removeVertexFromHatch([OUTER, island5], 1, 1);
    expect(result[0]).toEqual(OUTER);
    expect(result[1]).toHaveLength(island5.length - 1);
  });
});

describe('removeVerticesFromHatch — bulk delete of armed vertices', () => {
  const HEX: Point2D[] = [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 80 },
    { x: 100, y: 160 }, { x: 0, y: 160 }, { x: -50, y: 80 },
  ];

  it('removes several vertices of one ring at once', () => {
    const result = removeVerticesFromHatch([HEX], [
      { pathIdx: 0, vertexIdx: 1 }, { pathIdx: 0, vertexIdx: 3 },
    ]);
    expect(result[0]).toHaveLength(HEX.length - 2);
    expect(result[0]).not.toContainEqual({ x: 100, y: 0 });
    expect(result[0]).not.toContainEqual({ x: 100, y: 160 });
  });

  it('removes across multiple rings independently', () => {
    const island: Point2D[] = [...HEX];
    const result = removeVerticesFromHatch([HEX, island], [
      { pathIdx: 0, vertexIdx: 0 }, { pathIdx: 1, vertexIdx: 2 },
    ]);
    expect(result[0]).toHaveLength(HEX.length - 1);
    expect(result[1]).toHaveLength(island.length - 1);
  });

  it('never drops a ring below the minimum triangle (removes as many as it can)', () => {
    // Request all 6 vertices → only 3 can go, exactly a triangle survives.
    const result = removeVerticesFromHatch([HEX], HEX.map((_, i) => ({ pathIdx: 0, vertexIdx: i })));
    expect(result[0]).toHaveLength(3);
  });

  it('no-op (original reference) when the ring is already a triangle', () => {
    const tri = [ISLAND];
    expect(removeVerticesFromHatch(tri, [{ pathIdx: 0, vertexIdx: 0 }])).toBe(tri);
  });

  it('no-op on empty targets / out-of-range ring', () => {
    const original = [HEX];
    expect(removeVerticesFromHatch(original, [])).toBe(original);
    expect(removeVerticesFromHatch(original, [{ pathIdx: 5, vertexIdx: 0 }])).toBe(original);
  });

  it('deduplicates repeated targets (same vertex twice removes once)', () => {
    const result = removeVerticesFromHatch([HEX], [
      { pathIdx: 0, vertexIdx: 2 }, { pathIdx: 0, vertexIdx: 2 },
    ]);
    expect(result[0]).toHaveLength(HEX.length - 1);
  });
});

describe('applyHatchGripDrag — edge-midpoint branch (insert-on-drag)', () => {
  it('inserts a vertex at the edge midpoint + delta', () => {
    const result = applyHatchGripDrag('hatch-edge-midpoint-0-0', {
      originalBoundaryPaths: [OUTER],
      delta: { x: 0, y: -25 },
    });
    expect(result[0]).toHaveLength(OUTER.length + 1);
    expect(result[0][1]).toEqual({ x: 500, y: -25 });
  });

  it('quantizes the insert delta to the dominant axis when rectilinear', () => {
    const result = applyHatchGripDrag('hatch-edge-midpoint-0-0', {
      originalBoundaryPaths: [OUTER],
      delta: { x: 20, y: 80 },
      rectilinear: true,
    });
    // |dy| > |dx| → x component dropped; midpoint (500,0) + (0,80).
    expect(result[0][1]).toEqual({ x: 500, y: 80 });
  });
});

// ── ADR-507 Φ5 A3 — gradient origin/seed grip ────────────────────────────────

describe('hatchBounds / hatchBoundsCenter', () => {
  it('computes the axis-aligned bbox + center over all rings', () => {
    expect(hatchBounds([OUTER, ISLAND])).toEqual({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 });
    expect(hatchBoundsCenter([OUTER])).toEqual({ x: 500, y: 500 });
  });

  it('returns null on empty boundary', () => {
    expect(hatchBounds([])).toBeNull();
    expect(hatchBoundsCenter([])).toBeNull();
  });
});

describe('isHatchOriginGripKind', () => {
  it('matches only the gradient-origin kind', () => {
    expect(isHatchOriginGripKind(HATCH_GRADIENT_ORIGIN_KIND)).toBe(true);
    expect(isHatchOriginGripKind('hatch-vertex-0-0')).toBe(false);
  });
});

describe('applyHatchOriginGripDrag', () => {
  it('translates the origin by the delta', () => {
    expect(applyHatchOriginGripDrag({ x: 500, y: 500 }, { delta: { x: 30, y: -20 } }))
      .toEqual({ x: 530, y: 480 });
  });

  it('quantizes to the dominant axis when rectilinear', () => {
    // |dx| > |dy| → y component dropped.
    expect(applyHatchOriginGripDrag({ x: 0, y: 0 }, { delta: { x: 80, y: 20 }, rectilinear: true }))
      .toEqual({ x: 80, y: 0 });
  });

  it('does not mutate the input origin', () => {
    const origin = { x: 10, y: 10 };
    applyHatchOriginGripDrag(origin, { delta: { x: 5, y: 5 } });
    expect(origin).toEqual({ x: 10, y: 10 });
  });
});

// ── ADR-507 Φ5 A4 — gradient-angle βραχίονας ──────────────────────────────────

describe('isHatchAngleGripKind', () => {
  it('matches only the gradient-angle kind', () => {
    expect(isHatchAngleGripKind(HATCH_GRADIENT_ANGLE_KIND)).toBe(true);
    expect(isHatchAngleGripKind(HATCH_GRADIENT_ORIGIN_KIND)).toBe(false);
    expect(isHatchAngleGripKind('hatch-vertex-0-0')).toBe(false);
  });
});

describe('hatchGradientAngleGripPos', () => {
  // OUTER = 1000×1000 → R = 0.5·hypot(1000,1000) ≈ 707.107.
  const R = 0.5 * Math.hypot(1000, 1000);

  it('places the handle along +X at angle 0', () => {
    const pos = hatchGradientAngleGripPos({ x: 500, y: 500 }, 0, [OUTER]);
    expect(pos?.x).toBeCloseTo(500 + R, 3);
    expect(pos?.y).toBeCloseTo(500, 3);
  });

  it('places the handle along +Y at angle 90', () => {
    const pos = hatchGradientAngleGripPos({ x: 500, y: 500 }, 90, [OUTER]);
    expect(pos?.x).toBeCloseTo(500, 3);
    expect(pos?.y).toBeCloseTo(500 + R, 3);
  });

  it('returns null on empty boundary (degenerate bbox)', () => {
    expect(hatchGradientAngleGripPos({ x: 0, y: 0 }, 0, [])).toBeNull();
  });
});

describe('applyHatchAngleGripDrag', () => {
  const origin: Point2D = { x: 500, y: 500 };

  it('maps cardinal cursor directions to [0,360) degrees', () => {
    expect(applyHatchAngleGripDrag(origin, { x: 600, y: 500 })).toBeCloseTo(0, 6);
    expect(applyHatchAngleGripDrag(origin, { x: 500, y: 600 })).toBeCloseTo(90, 6);
    expect(applyHatchAngleGripDrag(origin, { x: 400, y: 500 })).toBeCloseTo(180, 6);
    // -90° → normalized 270°.
    expect(applyHatchAngleGripDrag(origin, { x: 500, y: 400 })).toBeCloseTo(270, 6);
  });

  it('does not mutate the input origin', () => {
    const o = { x: 1, y: 2 };
    applyHatchAngleGripDrag(o, { x: 5, y: 6 });
    expect(o).toEqual({ x: 1, y: 2 });
  });

  it('snaps to 15° increments when snap=true (Shift)', () => {
    // dx=100, dy=30 → 16.7° → 15°.
    expect(applyHatchAngleGripDrag(origin, { x: 600, y: 530 }, true)).toBeCloseTo(15, 6);
    // dx=100, dy=80 → 38.66° → 45°.
    expect(applyHatchAngleGripDrag(origin, { x: 600, y: 580 }, true)).toBeCloseTo(45, 6);
    // exact axis stays at 0°.
    expect(applyHatchAngleGripDrag(origin, { x: 600, y: 500 }, true)).toBeCloseTo(0, 6);
    // snap=false leaves the raw angle.
    expect(applyHatchAngleGripDrag(origin, { x: 600, y: 530 }, false)).toBeCloseTo(16.699, 2);
  });
});
