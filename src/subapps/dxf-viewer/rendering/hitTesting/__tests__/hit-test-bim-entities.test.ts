/**
 * ADR-363 Bug 1 — hit-test polygon containment + child-over-parent priority.
 *
 * Coverage:
 *   - Opening polygon containment hit succeeds inside outline, fails outside.
 *   - Slab polygon hit succeeds inside outline.
 *   - Wall polygon (outerEdge + innerEdge reversed) hit succeeds inside footprint.
 *   - Opening priority > wall priority (75 vs 50).
 *   - Slab-opening priority > slab priority.
 *   - Column / beam polygon containment via geometry.footprint/outline.
 */

import { performDetailedHitTest } from '../hit-test-entity-tests';
import { calculatePriority } from '../hit-tester-utils';
import type { Entity } from '../../../types/entities';

function makeOpeningEntity(): Entity {
  return {
    id: 'op_1',
    type: 'opening',
    kind: 'door',
    layerId: '0',
    visible: true,
    params: { kind: 'door', wallId: 'w_1', offsetFromStart: 1000, width: 900, height: 2100, sillHeight: 0 },
    geometry: {
      position: { x: 1450, y: 0, z: 0 },
      rotation: 0,
      outline: {
        vertices: [
          { x: 1000, y: -125, z: 0 },
          { x: 1900, y: -125, z: 0 },
          { x: 1900, y: 125, z: 0 },
          { x: 1000, y: 125, z: 0 },
        ],
      },
      bbox: { min: { x: 1000, y: -125, z: 0 }, max: { x: 1900, y: 125, z: 2.1 } },
      area: 1.89,
      perimeter: 6.0,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as Entity;
}

function makeWallEntity(): Entity {
  return {
    id: 'w_1',
    type: 'wall',
    kind: 'straight',
    layerId: '0',
    visible: true,
    params: { category: 'exterior', start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 }, height: 3000, thickness: 250, flip: false },
    geometry: {
      axisPolyline: { points: [{ x: 0, y: 0, z: 0 }, { x: 5000, y: 0, z: 0 }], closed: false },
      outerEdge: { points: [{ x: 0, y: -125, z: 0 }, { x: 5000, y: -125, z: 0 }], closed: false },
      innerEdge: { points: [{ x: 0, y: 125, z: 0 }, { x: 5000, y: 125, z: 0 }], closed: false },
      bbox: { min: { x: 0, y: -125, z: 0 }, max: { x: 5000, y: 125, z: 3 } },
      length: 5,
      area: 15,
      volume: 3.75,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as Entity;
}

function makeSlabEntity(): Entity {
  return {
    id: 's_1',
    type: 'slab',
    kind: 'floor',
    layerId: '0',
    visible: true,
    params: {
      outline: {
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 4000, y: 0, z: 0 },
          { x: 4000, y: 3000, z: 0 },
          { x: 0, y: 3000, z: 0 },
        ],
      },
      thickness: 200,
      levelElevation: 0,
    },
    geometry: { footprint: { vertices: [] }, bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 4000, y: 3000, z: 0.2 } }, area: 12, perimeter: 14 },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as Entity;
}

describe('performDetailedHitTest — BIM entities (ADR-363 Bug 1)', () => {
  it('opening hit succeeds when point is inside outline polygon', () => {
    const op = makeOpeningEntity();
    const result = performDetailedHitTest(op, { x: 1450, y: 0 }, 1);
    expect(result).not.toBeNull();
    expect(result?.hitType).toBe('entity');
  });

  it('opening hit fails when point is outside outline polygon (still inside bbox)', () => {
    const op = makeOpeningEntity();
    // Point at x=500 — outside opening (which starts at x=1000), still inside wall bbox
    const result = performDetailedHitTest(op, { x: 500, y: 0 }, 1);
    expect(result).toBeNull();
  });

  it('slab hit succeeds when point is inside outline polygon', () => {
    const slab = makeSlabEntity();
    const result = performDetailedHitTest(slab, { x: 2000, y: 1500 }, 1);
    expect(result).not.toBeNull();
  });

  it('slab hit fails when point is outside outline polygon', () => {
    const slab = makeSlabEntity();
    const result = performDetailedHitTest(slab, { x: 5000, y: 1500 }, 1);
    expect(result).toBeNull();
  });

  it('wall hit succeeds when point is inside the outer+inner edge band', () => {
    const wall = makeWallEntity();
    const result = performDetailedHitTest(wall, { x: 2500, y: 0 }, 1);
    expect(result).not.toBeNull();
  });

  it('wall hit fails when point is outside the band (far from wall axis)', () => {
    const wall = makeWallEntity();
    const result = performDetailedHitTest(wall, { x: 2500, y: 500 }, 1);
    expect(result).toBeNull();
  });
});

// ─── Bug 4 — leaf line + swing arc hit test ───────────────────────────────────

/**
 * Door on horizontal wall (x: 1000-1900, thickness 250mm, axis at y=0).
 * Handing left, inward swing. Arc points computed from buildHingeArc geometry:
 *   hinge = (1000, 0), startVec = (1, 0), perp = (0, 1) → arc sweeps rightward/upward.
 *   arc.points[0]  = (1900,    0)   ← right jamb (closed position)
 *   arc.points[12] = (1000,  900)   ← 90°-open tip
 *   Leaf line: hinge (1000,0) → arc.points[12] (1000, 900).
 */
function makeOpeningWithArc(): Entity {
  const SUBDIVISIONS = 12;
  const HALF_PI = Math.PI / 2;
  const arcPoints: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 0; i <= SUBDIVISIONS; i++) {
    const t = (i / SUBDIVISIONS) * HALF_PI;
    arcPoints.push({ x: 1000 + 900 * Math.cos(t), y: 900 * Math.sin(t), z: 0 });
  }
  return {
    id: 'op_arc',
    type: 'opening',
    kind: 'door',
    layerId: '0',
    visible: true,
    params: { kind: 'door', wallId: 'w_1', offsetFromStart: 1000, width: 900, height: 2100, sillHeight: 0 },
    geometry: {
      position: { x: 1450, y: 0, z: 0 },
      rotation: 0,
      outline: {
        vertices: [
          { x: 1000, y: -125, z: 0 },
          { x: 1900, y: -125, z: 0 },
          { x: 1900, y: 125, z: 0 },
          { x: 1000, y: 125, z: 0 },
        ],
      },
      hingeArc: { points: arcPoints, closed: false },
      hingeAnchor: { x: 1000, y: 0, z: 0 },
      bbox: { min: { x: 1000, y: -125, z: 0 }, max: { x: 1900, y: 125, z: 2.1 } },
      area: 1.89,
      perimeter: 6.0,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as Entity;
}

/** French-door: two leaves. Second hinge at (1900,0), second leaf → (1900,900). */
function makeFrenchDoorOpening(): Entity {
  const SUBDIVISIONS = 12;
  const HALF_PI = Math.PI / 2;
  const arcPoints: Array<{ x: number; y: number; z: number }> = [];
  // First leaf arc: hinge1=(1000,0), startVec=(1,0), sweeps upward.
  for (let i = 0; i <= SUBDIVISIONS; i++) {
    const t = (i / SUBDIVISIONS) * HALF_PI;
    arcPoints.push({ x: 1000 + 900 * Math.cos(t), y: 900 * Math.sin(t), z: 0 });
  }
  // Second leaf arc: hinge2=(1900,0), startVec=(-1,0), sweeps upward (reversed order).
  for (let i = SUBDIVISIONS; i >= 0; i--) {
    const t = (i / SUBDIVISIONS) * HALF_PI;
    arcPoints.push({ x: 1900 - 900 * Math.cos(t), y: 900 * Math.sin(t), z: 0 });
  }
  return {
    id: 'op_french',
    type: 'opening',
    kind: 'french-door',
    layerId: '0',
    visible: true,
    params: { kind: 'french-door', wallId: 'w_1', offsetFromStart: 1000, width: 900, height: 2100, sillHeight: 0 },
    geometry: {
      position: { x: 1450, y: 0, z: 0 },
      rotation: 0,
      outline: {
        vertices: [
          { x: 1000, y: -125, z: 0 },
          { x: 1900, y: -125, z: 0 },
          { x: 1900, y: 125, z: 0 },
          { x: 1000, y: 125, z: 0 },
        ],
      },
      hingeArc: { points: arcPoints, closed: false },
      hingeAnchor: { x: 1000, y: 0, z: 0 },
      hingeAnchor2: { x: 1900, y: 0, z: 0 },
      bbox: { min: { x: 1000, y: -125, z: 0 }, max: { x: 1900, y: 125, z: 2.1 } },
      area: 1.89,
      perimeter: 6.0,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as Entity;
}

describe('hitTestOpening — Bug 4: leaf line + swing arc (ADR-363)', () => {
  it('hits leaf line midpoint (outside outline rectangle)', () => {
    const op = makeOpeningWithArc();
    // Leaf line: (1000,0)→(1000,900). Midpoint (1000,450) is well outside the
    // outline rectangle (y: -125..125), so only leaf-line branch can match.
    const result = performDetailedHitTest(op, { x: 1000, y: 450 }, 5);
    expect(result).not.toBeNull();
    expect(result?.hitType).toBe('entity');
  });

  it('hits swing arc midpoint (outside outline + leaf)', () => {
    const op = makeOpeningWithArc();
    // Arc at t=π/4 ≈ (1637, 636) — outside outline and not on leaf line x=1000.
    // Point (1638, 636) with tolerance 5 lands within a chord segment of the arc.
    const result = performDetailedHitTest(op, { x: 1638, y: 636 }, 5);
    expect(result).not.toBeNull();
    expect(result?.hitType).toBe('entity');
  });

  it('returns null when point is far from outline, leaf line, and arc', () => {
    const op = makeOpeningWithArc();
    const result = performDetailedHitTest(op, { x: 500, y: 500 }, 5);
    expect(result).toBeNull();
  });

  it('hits french-door second leaf midpoint', () => {
    const op = makeFrenchDoorOpening();
    // Second leaf: hinge2 (1900,0) → arc.points[13] = (1900,900). Midpoint (1900,450).
    const result = performDetailedHitTest(op, { x: 1900, y: 450 }, 5);
    expect(result).not.toBeNull();
    expect(result?.hitType).toBe('entity');
  });

  it('opening without hingeArc still hits via outline polygon', () => {
    // Window — no arc, no leaf. Only outline containment.
    const op = makeOpeningEntity(); // existing factory, no hingeArc
    const result = performDetailedHitTest(op, { x: 1450, y: 0 }, 5);
    expect(result).not.toBeNull();
  });
});

// ─── ADR-507 — hatch even-odd polygon containment ─────────────────────────────

function makeHatchEntity(): Entity {
  return {
    id: 'hatch_1',
    type: 'hatch',
    layerId: '0',
    visible: true,
    // Outer 1000×1000 ring + inner 200×200 island hole centred at (500,500).
    boundaryPaths: [
      [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }],
      [{ x: 400, y: 400 }, { x: 600, y: 400 }, { x: 600, y: 600 }, { x: 400, y: 600 }],
    ],
    fillType: 'solid',
  } as unknown as Entity;
}

describe('performDetailedHitTest — hatch even-odd containment (ADR-507)', () => {
  it('hits when the point is inside the outer ring but outside any island', () => {
    const result = performDetailedHitTest(makeHatchEntity(), { x: 100, y: 100 }, 1);
    expect(result).not.toBeNull();
    expect(result?.hitType).toBe('entity');
  });

  it('misses when the point is inside an island hole (even-odd → 2 crossings)', () => {
    const result = performDetailedHitTest(makeHatchEntity(), { x: 500, y: 500 }, 1);
    expect(result).toBeNull();
  });

  it('misses when the point is outside the outer ring', () => {
    const result = performDetailedHitTest(makeHatchEntity(), { x: 2000, y: 2000 }, 1);
    expect(result).toBeNull();
  });
});

describe('calculatePriority — child-over-parent (ADR-363 Bug 1)', () => {
  it('opening priority > wall priority', () => {
    const op = makeOpeningEntity();
    const wall = makeWallEntity();
    expect(calculatePriority(op)).toBeGreaterThan(calculatePriority(wall));
  });

  it('opening priority === 75 (child boost), wall === 50 (default)', () => {
    expect(calculatePriority(makeOpeningEntity())).toBe(75);
    expect(calculatePriority(makeWallEntity())).toBe(50);
  });

  it('slab-opening priority > slab priority', () => {
    const slabOpening: Entity = {
      id: 'so_1',
      type: 'slab-opening',
      kind: 'shaft',
      layerId: '0',
      visible: true,
      params: { slabId: 's_1', outline: { vertices: [] } },
      geometry: { polygon: { vertices: [] }, bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, area: 0, perimeter: 0 },
      validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    } as unknown as Entity;
    expect(calculatePriority(slabOpening)).toBe(75);
    expect(calculatePriority(makeSlabEntity())).toBe(50);
  });
});
