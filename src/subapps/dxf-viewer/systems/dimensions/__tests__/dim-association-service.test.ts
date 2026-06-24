/**
 * ADR-362 Phase O2 — dim-association-service unit tests.
 *
 * Covers:
 *   `recomputeAssociatedDefPoint` — all association types + entity mismatch
 *   `applyAssociationUpdates`     — no-op identity, orphan, update, multi-update
 */

import type { DimensionAssociation, DimensionEntity } from '../../../types/dimension';
import type { SceneEntity } from '../../../core/commands/interfaces';
import {
  recomputeAssociatedDefPoint,
  applyAssociationUpdates,
} from '../dim-association-service';
import { ISO_129_TEMPLATE } from '../dim-style-templates';

// ──────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ──────────────────────────────────────────────────────────────────────────────

type Pt = { x: number; y: number };

function makeLine(start: Pt, end: Pt): SceneEntity {
  return { id: 'geo', type: 'line', layerId: '0', start, end } as unknown as SceneEntity;
}

function makeCircle(center: Pt, radius = 50): SceneEntity {
  return { id: 'geo', type: 'circle', layerId: '0', center, radius } as unknown as SceneEntity;
}

function makeArc(center: Pt, radius = 50): SceneEntity {
  return {
    id: 'geo',
    type: 'arc',
    layerId: '0',
    center,
    radius,
    startAngle: 0,
    endAngle: Math.PI,
  } as unknown as SceneEntity;
}

function makePolyline(vertices: Pt[]): SceneEntity {
  return {
    id: 'geo',
    type: 'polyline',
    layerId: '0',
    vertices,
  } as unknown as SceneEntity;
}

function assoc(
  type: DimensionAssociation['associationType'],
  defPointIndex = 0,
  subIndex?: number,
): DimensionAssociation {
  return { geometryId: 'geo', defPointIndex, associationType: type, subIndex };
}

function makeDim(defPoints: Pt[], assocs: DimensionAssociation[] = []): DimensionEntity {
  return {
    id: 'd1',
    type: 'dimension',
    dimensionType: 'aligned',
    styleId: ISO_129_TEMPLATE.id,
    layerId: '0',
    defPoints,
    associations: assocs,
  } as DimensionEntity;
}

// ──────────────────────────────────────────────────────────────────────────────
// recomputeAssociatedDefPoint
// ──────────────────────────────────────────────────────────────────────────────

describe('recomputeAssociatedDefPoint — endpoint', () => {
  it('line subIndex=0 → start', () => {
    expect(
      recomputeAssociatedDefPoint(assoc('endpoint', 0, 0), makeLine({ x: 10, y: 20 }, { x: 30, y: 40 })),
    ).toEqual({ x: 10, y: 20 });
  });

  it('line subIndex=1 → end', () => {
    expect(
      recomputeAssociatedDefPoint(assoc('endpoint', 0, 1), makeLine({ x: 10, y: 20 }, { x: 30, y: 40 })),
    ).toEqual({ x: 30, y: 40 });
  });

  it('line subIndex undefined → null (preserves current defPoint, ADR-362 2026-05-19 hotfix)', () => {
    // Pre-fix: `assoc.subIndex === 0 ? e.start : e.end` returned `e.end` when
    // subIndex was undefined, snapping linear/aligned dims to the line's far
    // endpoint on every command event. Now returns null → caller preserves
    // the existing defPoint.
    expect(
      recomputeAssociatedDefPoint(assoc('endpoint', 0, undefined), makeLine({ x: 5, y: 6 }, { x: 7, y: 8 })),
    ).toBeNull();
  });

  it('polyline → vertex at subIndex', () => {
    const poly = makePolyline([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }]);
    expect(
      recomputeAssociatedDefPoint(assoc('endpoint', 0, 1), poly),
    ).toEqual({ x: 50, y: 0 });
  });

  it('polyline subIndex out-of-range → clamps to last vertex', () => {
    const poly = makePolyline([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    expect(
      recomputeAssociatedDefPoint(assoc('endpoint', 0, 99), poly),
    ).toEqual({ x: 100, y: 0 });
  });

  it('circle (non-line/polyline) → null', () => {
    expect(
      recomputeAssociatedDefPoint(assoc('endpoint', 0, 0), makeCircle({ x: 0, y: 0 })),
    ).toBeNull();
  });
});

describe('recomputeAssociatedDefPoint — midpoint', () => {
  it('line → midpoint of start/end', () => {
    expect(
      recomputeAssociatedDefPoint(assoc('midpoint'), makeLine({ x: 0, y: 0 }, { x: 100, y: 0 })),
    ).toEqual({ x: 50, y: 0 });
  });

  it('polyline edge → midpoint of vertex[subIndex] → vertex[subIndex+1]', () => {
    const poly = makePolyline([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]);
    expect(
      recomputeAssociatedDefPoint(assoc('midpoint', 0, 1), poly),
    ).toEqual({ x: 150, y: 0 });
  });

  it('arc (non-line/polyline) → null', () => {
    expect(
      recomputeAssociatedDefPoint(assoc('midpoint'), makeArc({ x: 0, y: 0 })),
    ).toBeNull();
  });
});

describe('recomputeAssociatedDefPoint — center', () => {
  it('circle → center', () => {
    expect(
      recomputeAssociatedDefPoint(assoc('center'), makeCircle({ x: 25, y: 35 })),
    ).toEqual({ x: 25, y: 35 });
  });

  it('arc → center', () => {
    expect(
      recomputeAssociatedDefPoint(assoc('center'), makeArc({ x: 10, y: 20 })),
    ).toEqual({ x: 10, y: 20 });
  });

  it('line → null (no center concept)', () => {
    expect(
      recomputeAssociatedDefPoint(assoc('center'), makeLine({ x: 0, y: 0 }, { x: 100, y: 0 })),
    ).toBeNull();
  });
});

describe('recomputeAssociatedDefPoint — intersection / nearest (legacy back-compat)', () => {
  it('intersection without geometryId2 → null (legacy capture preserved)', () => {
    expect(
      recomputeAssociatedDefPoint(assoc('intersection'), makeLine({ x: 0, y: 0 }, { x: 100, y: 0 })),
    ).toBeNull();
  });

  it('nearest without param → null (legacy capture preserved, 2026-05-19 hotfix)', () => {
    expect(
      recomputeAssociatedDefPoint(assoc('nearest'), makeLine({ x: 0, y: 0 }, { x: 100, y: 0 })),
    ).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ADR-362 Phase J3 (gap #2) — parametric nearest + intersection associativity
// ──────────────────────────────────────────────────────────────────────────────

function nearestAssoc(param: number, subIndex?: number, defPointIndex = 0): DimensionAssociation {
  return { geometryId: 'geo', defPointIndex, associationType: 'nearest', param, subIndex };
}

describe('recomputeAssociatedDefPoint — nearest with param (J3)', () => {
  it('line → lerp at t (follows the moved line)', () => {
    // t = 0.25 along (0,0)→(100,0) = (25,0); move line → re-project at same t.
    expect(
      recomputeAssociatedDefPoint(nearestAssoc(0.25), makeLine({ x: 0, y: 0 }, { x: 100, y: 0 })),
    ).toEqual({ x: 25, y: 0 });
    expect(
      recomputeAssociatedDefPoint(nearestAssoc(0.25), makeLine({ x: 0, y: 100 }, { x: 100, y: 100 })),
    ).toEqual({ x: 25, y: 100 });
  });

  it('line → t outside [0,1] extrapolates (clamp-free param)', () => {
    expect(
      recomputeAssociatedDefPoint(nearestAssoc(1.5), makeLine({ x: 0, y: 0 }, { x: 100, y: 0 })),
    ).toEqual({ x: 150, y: 0 });
  });

  it('circle → pointOnCircle at angle param (orbits on move)', () => {
    const pt = recomputeAssociatedDefPoint(nearestAssoc(0), makeCircle({ x: 0, y: 0 }, 50));
    expect(pt?.x).toBeCloseTo(50);
    expect(pt?.y).toBeCloseTo(0);
    const pt2 = recomputeAssociatedDefPoint(nearestAssoc(Math.PI), makeCircle({ x: 10, y: 0 }, 50));
    expect(pt2?.x).toBeCloseTo(-40);
    expect(pt2?.y).toBeCloseTo(0);
  });

  it('arc → pointOnCircle at angle param', () => {
    const pt = recomputeAssociatedDefPoint(nearestAssoc(Math.PI / 2), makeArc({ x: 0, y: 0 }, 50));
    expect(pt?.x).toBeCloseTo(0);
    expect(pt?.y).toBeCloseTo(50);
  });

  it('polyline → lerp on segment[subIndex] at t', () => {
    const poly = makePolyline([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    // segment 1 = (100,0)→(100,100), t=0.5 → (100,50).
    expect(
      recomputeAssociatedDefPoint(nearestAssoc(0.5, 1), poly),
    ).toEqual({ x: 100, y: 50 });
  });
});

describe('recomputeAssociatedDefPoint — intersection with geometryId2 (J3)', () => {
  const line1 = (y: number) =>
    ({ id: 'geo', type: 'line', layerId: '0', start: { x: -100, y }, end: { x: 100, y } }) as unknown as SceneEntity;
  const line2 = (x: number) =>
    ({ id: 'geo2', type: 'line', layerId: '0', start: { x, y: -100 }, end: { x, y: 100 } }) as unknown as SceneEntity;

  const interAssoc: DimensionAssociation = {
    geometryId: 'geo',
    geometryId2: 'geo2',
    defPointIndex: 0,
    associationType: 'intersection',
  };

  it('line × line → re-solved crossing, follows both hosts', () => {
    const pt = recomputeAssociatedDefPoint(interAssoc, line1(0), {
      resolveEntity: (id) => (id === 'geo2' ? line2(50) : undefined),
      currentDefPoint: { x: 50, y: 0 },
    });
    expect(pt?.x).toBeCloseTo(50);
    expect(pt?.y).toBeCloseTo(0);

    // Move the 2nd host to x=80 → intersection follows to (80, 0).
    const pt2 = recomputeAssociatedDefPoint(interAssoc, line1(0), {
      resolveEntity: (id) => (id === 'geo2' ? line2(80) : undefined),
      currentDefPoint: { x: 50, y: 0 },
    });
    expect(pt2?.x).toBeCloseTo(80);
    expect(pt2?.y).toBeCloseTo(0);
  });

  it('no longer crossing (parallel) → null (preserve)', () => {
    expect(
      recomputeAssociatedDefPoint(interAssoc, line1(0), {
        resolveEntity: (id) => (id === 'geo2' ? line1(0) : undefined), // colinear/parallel
        currentDefPoint: { x: 50, y: 0 },
      }),
    ).toBeNull();
  });

  it('missing 2nd host → null (preserve)', () => {
    expect(
      recomputeAssociatedDefPoint(interAssoc, line1(0), {
        resolveEntity: () => undefined,
        currentDefPoint: { x: 50, y: 0 },
      }),
    ).toBeNull();
  });

  it('line × circle → currentDefPoint hint picks the right branch', () => {
    const horiz = ({ id: 'geo', type: 'line', layerId: '0', start: { x: -100, y: 0 }, end: { x: 100, y: 0 } }) as unknown as SceneEntity;
    const circle = ({ id: 'geo2', type: 'circle', layerId: '0', center: { x: 0, y: 0 }, radius: 50 }) as unknown as SceneEntity;
    // Two crossings: (-50,0) and (50,0). Hint near (50,0) → pick the +x branch.
    const pt = recomputeAssociatedDefPoint(
      { geometryId: 'geo', geometryId2: 'geo2', defPointIndex: 0, associationType: 'intersection' },
      horiz,
      { resolveEntity: () => circle, currentDefPoint: { x: 49, y: 0 } },
    );
    expect(pt?.x).toBeCloseTo(50);
    expect(pt?.y).toBeCloseTo(0);
  });
});

describe('recomputeAssociatedDefPoint — endpoint on arc (J3, arcLength)', () => {
  it('arc subIndex 0 → arcStart, subIndex 1 → arcEnd', () => {
    const arc = makeArc({ x: 0, y: 0 }, 50); // startAngle 0, endAngle π
    expect(recomputeAssociatedDefPoint(assoc('endpoint', 0, 0), arc)).toEqual({ x: 50, y: 0 });
    const end = recomputeAssociatedDefPoint(assoc('endpoint', 0, 1), arc);
    expect(end?.x).toBeCloseTo(-50);
    expect(end?.y).toBeCloseTo(0);
  });
});

describe('applyAssociationUpdates — J3 nearest + intersection end-to-end', () => {
  it('nearest param → defPoint follows the moved line', () => {
    const dim = makeDim([{ x: 25, y: 0 }], [nearestAssoc(0.25)]);
    const moved = makeLine({ x: 0, y: 100 }, { x: 100, y: 100 });
    const { updated, orphanCount } = applyAssociationUpdates(dim, () => moved);
    expect(updated.defPoints[0]).toEqual({ x: 25, y: 100 });
    expect(orphanCount).toBe(0);
  });

  it('intersection → defPoint re-solves via the 2nd host lookup', () => {
    const dim = makeDim(
      [{ x: 50, y: 0 }],
      [{ geometryId: 'geo', geometryId2: 'geo2', defPointIndex: 0, associationType: 'intersection' }],
    );
    const horiz = makeLine({ x: -100, y: 0 }, { x: 100, y: 0 });
    const vert = ({ id: 'geo2', type: 'line', layerId: '0', start: { x: 80, y: -100 }, end: { x: 80, y: 100 } }) as unknown as SceneEntity;
    const { updated } = applyAssociationUpdates(dim, (id) => (id === 'geo2' ? vert : horiz));
    expect(updated.defPoints[0].x).toBeCloseTo(80);
    expect(updated.defPoints[0].y).toBeCloseTo(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// applyAssociationUpdates
// ──────────────────────────────────────────────────────────────────────────────

describe('applyAssociationUpdates', () => {
  it('no associations → same reference, orphanCount=0', () => {
    const dim = makeDim([{ x: 0, y: 0 }], []);
    const { updated, orphanCount } = applyAssociationUpdates(dim, () => undefined);
    expect(updated).toBe(dim);
    expect(orphanCount).toBe(0);
  });

  it('undefined associations → same reference, orphanCount=0', () => {
    const dim = { ...makeDim([{ x: 0, y: 0 }]), associations: undefined };
    const { updated, orphanCount } = applyAssociationUpdates(dim, () => undefined);
    expect(updated).toBe(dim);
    expect(orphanCount).toBe(0);
  });

  it('missing geometry → preserves defPoint, orphanCount=1, same reference', () => {
    const dim = makeDim(
      [{ x: 10, y: 20 }],
      [{ geometryId: 'missing', defPointIndex: 0, associationType: 'endpoint' }],
    );
    const { updated, orphanCount } = applyAssociationUpdates(dim, () => undefined);
    expect(updated).toBe(dim);
    expect(orphanCount).toBe(1);
  });

  it('updated geometry → new entity with patched defPoint, orphanCount=0', () => {
    const dim = makeDim(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      [{ geometryId: 'geo', defPointIndex: 0, associationType: 'endpoint', subIndex: 0 }],
    );
    const line = makeLine({ x: 50, y: 50 }, { x: 200, y: 200 });
    const { updated, orphanCount } = applyAssociationUpdates(dim, () => line);
    expect(updated).not.toBe(dim);
    expect(updated.defPoints[0]).toEqual({ x: 50, y: 50 });
    expect(updated.defPoints[1]).toEqual({ x: 100, y: 0 }); // unchanged
    expect(orphanCount).toBe(0);
  });

  it('same position → same reference (identity equality guard)', () => {
    const dim = makeDim(
      [{ x: 10, y: 20 }],
      [{ geometryId: 'geo', defPointIndex: 0, associationType: 'endpoint', subIndex: 0 }],
    );
    const line = makeLine({ x: 10, y: 20 }, { x: 100, y: 0 }); // start === current defPoint
    const { updated } = applyAssociationUpdates(dim, () => line);
    expect(updated).toBe(dim);
  });

  it('multiple associations — both defPoints updated in one pass', () => {
    const dim = makeDim(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      [
        { geometryId: 'geo', defPointIndex: 0, associationType: 'endpoint', subIndex: 0 },
        { geometryId: 'geo', defPointIndex: 1, associationType: 'endpoint', subIndex: 1 },
      ],
    );
    const line = makeLine({ x: 5, y: 5 }, { x: 200, y: 200 });
    const { updated, orphanCount } = applyAssociationUpdates(dim, () => line);
    expect(updated.defPoints[0]).toEqual({ x: 5, y: 5 });
    expect(updated.defPoints[1]).toEqual({ x: 200, y: 200 });
    expect(orphanCount).toBe(0);
  });

  it('mix of orphan + updated → correct counts and partial patch', () => {
    const dim = makeDim(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      [
        { geometryId: 'present', defPointIndex: 0, associationType: 'endpoint', subIndex: 0 },
        { geometryId: 'missing', defPointIndex: 1, associationType: 'endpoint', subIndex: 0 },
      ],
    );
    const line = makeLine({ x: 77, y: 88 }, { x: 999, y: 999 });
    const { updated, orphanCount } = applyAssociationUpdates(dim, (id) =>
      id === 'present' ? line : undefined,
    );
    expect(updated.defPoints[0]).toEqual({ x: 77, y: 88 }); // updated
    expect(updated.defPoints[1]).toEqual({ x: 100, y: 0 }); // orphan → preserved
    expect(orphanCount).toBe(1);
  });
});
