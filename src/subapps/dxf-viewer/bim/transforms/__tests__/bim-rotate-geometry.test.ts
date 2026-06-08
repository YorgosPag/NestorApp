/**
 * ADR-363 Phase 7.2 — BIM rotate geometry unit tests.
 *
 * Verifies that `calculateBimRotatedGeometry` produces a `{params, geometry}`
 * atomic patch per BIM kind, pivot-aware:
 *   - World-coord fields of `params` rotated around pivot (z preserved).
 *   - Column rotation field accumulates; stair direction field accumulates.
 *   - Opening returns empty patch (hosted-derived).
 *   - Non-BIM entity types return null.
 */
import { calculateBimRotatedGeometry } from '../bim-rotate-geometry';
import type { Entity } from '../../../types/entities';
import type { WallEntity } from '../../types/wall-types';
import type { OpeningEntity } from '../../types/opening-types';
import type { SlabEntity } from '../../types/slab-types';
import type { SlabOpeningEntity } from '../../types/slab-opening-types';
import type { ColumnEntity } from '../../types/column-types';
import type { BeamEntity } from '../../types/beam-types';
import type { StairEntity } from '../../types/stair-types';
import type { Point2D } from '../../../rendering/types/Types';

const ORIGIN: Point2D = { x: 0, y: 0 };

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeWall(): WallEntity {
  return {
    id: 'wall_1',
    type: 'wall',
    kind: 'straight',
    layerId: 'L',
    params: {
      category: 'exterior',
      start: { x: 1000, y: 0, z: 0 },
      end: { x: 5000, y: 0, z: 0 },
      height: 3000,
      thickness: 250,
      flip: false,
    },
    geometry: { bbox: { min: { x: 1000, y: -125 }, max: { x: 5000, y: 125 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as WallEntity;
}

function makeOpening(): OpeningEntity {
  return {
    id: 'opn_1',
    type: 'opening',
    kind: 'door',
    layerId: 'L',
    params: {
      kind: 'door',
      wallId: 'wall_1',
      offsetFromStart: 1000,
      width: 900,
      height: 2100,
      sillHeight: 0,
      handing: 'left',
    },
    geometry: {
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      outline: { vertices: [] },
      bbox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
      area: 0,
      perimeter: 0,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as OpeningEntity;
}

function makeSlab(): SlabEntity {
  return {
    id: 'slab_1',
    type: 'slab',
    kind: 'floor',
    layerId: 'L',
    params: {
      kind: 'floor',
      outline: {
        vertices: [
          { x: 1000, y: 0 },
          { x: 2000, y: 0 },
          { x: 2000, y: 1000 },
          { x: 1000, y: 1000 },
        ],
      },
      elevation: 0,
      thickness: 200,
    },
    geometry: { bbox: { min: { x: 1000, y: 0 }, max: { x: 2000, y: 1000 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as SlabEntity;
}

function makeSlabOpening(): SlabOpeningEntity {
  return {
    id: 'slbopn_1',
    type: 'slab-opening',
    kind: 'shaft',
    layerId: 'L',
    params: {
      kind: 'shaft',
      slabId: 'slab_1',
      outline: {
        vertices: [
          { x: 100, y: 0 },
          { x: 300, y: 0 },
          { x: 300, y: 200 },
          { x: 100, y: 200 },
        ],
      },
    },
    geometry: { bbox: { min: { x: 100, y: 0 }, max: { x: 300, y: 200 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as SlabOpeningEntity;
}

function makeColumn(): ColumnEntity {
  return {
    id: 'col_1',
    type: 'column',
    kind: 'rectangular',
    layerId: 'L',
    params: {
      kind: 'rectangular',
      position: { x: 1000, y: 0, z: 0 },
      anchor: 'center',
      width: 400,
      depth: 400,
      height: 3000,
      rotation: 30,
    },
    geometry: { bbox: { min: { x: 800, y: -200 }, max: { x: 1200, y: 200 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as ColumnEntity;
}

function makeBeam(): BeamEntity {
  return {
    id: 'beam_1',
    type: 'beam',
    kind: 'curved',
    layerId: 'L',
    params: {
      kind: 'curved',
      startPoint: { x: 1000, y: 0, z: 3000 },
      endPoint: { x: 3000, y: 0, z: 3000 },
      curveControl: { x: 2000, y: 500, z: 3000 },
      width: 250,
      depth: 400,
      elevation: 3000,
    },
    geometry: { bbox: { min: { x: 1000, y: 0 }, max: { x: 3000, y: 500 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as BeamEntity;
}

function makeStair(): StairEntity {
  return {
    id: 'stair_1',
    type: 'stair',
    kind: 'straight',
    layerId: 'L',
    params: {
      basePoint: { x: 1000, y: 0, z: 0 },
      direction: 0,
      rise: 175,
      tread: 280,
      nosing: 25,
      nosingSide: 'front',
      width: 1000,
      stepCount: 14,
      totalRise: 2450,
      totalRun: 3920,
      pitch: 32,
      structureType: 'monolithic',
      riserType: 'closed',
      antiskidNosing: false,
      adaContrastStrip: false,
      variant: { kind: 'straight' },
      walklineOffset: 300,
      handrails: { inner: false, outer: false, height: 900 },
      upDirection: 'forward',
      treadNumberStart: 1,
      treadLabelDisplay: 'none',
      treadLabelRestartPerFlight: false,
      codeProfile: 'none',
    },
    geometry: {
      treads: [],
      treadsBelowCut: [],
      treadsAboveCut: [],
      risers: [],
      stringers: { inner: [], outer: [] },
      walkline: [],
      handrails: {},
      landings: [],
      arrowSymbol: { start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 0 }, label: 'UP' },
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    },
    validation: {
      hasCodeViolations: false,
      violationKeys: [],
      lastValidatedAt: { seconds: 0, nanoseconds: 0 },
    },
  } as unknown as StairEntity;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('ADR-363 Phase 7.2 — calculateBimRotatedGeometry', () => {
  it('wall: rotates start + end around pivot by 90° (CCW), preserves z', () => {
    const patch = calculateBimRotatedGeometry(makeWall() as unknown as Entity, ORIGIN, 90) as {
      params: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } };
    };
    expect(patch.params.start.x).toBeCloseTo(0, 4);
    expect(patch.params.start.y).toBeCloseTo(1000, 4);
    expect(patch.params.start.z).toBe(0);
    expect(patch.params.end.x).toBeCloseTo(0, 4);
    expect(patch.params.end.y).toBeCloseTo(5000, 4);
  });

  it('wall: 180° rotation around origin negates both coords', () => {
    const patch = calculateBimRotatedGeometry(makeWall() as unknown as Entity, ORIGIN, 180) as {
      params: { start: { x: number; y: number }; end: { x: number; y: number } };
    };
    expect(patch.params.start.x).toBeCloseTo(-1000, 4);
    expect(patch.params.end.x).toBeCloseTo(-5000, 4);
    expect(patch.params.start.y).toBeCloseTo(0, 4);
    expect(patch.params.end.y).toBeCloseTo(0, 4);
  });

  it('opening: returns empty patch (hosted-derived)', () => {
    const patch = calculateBimRotatedGeometry(makeOpening() as unknown as Entity, ORIGIN, 90);
    expect(patch).toEqual({});
  });

  it('slab: rotates every outline vertex around pivot', () => {
    const patch = calculateBimRotatedGeometry(makeSlab() as unknown as Entity, ORIGIN, 90) as {
      params: { outline: { vertices: readonly { x: number; y: number }[] } };
    };
    const v = patch.params.outline.vertices;
    expect(v[0].x).toBeCloseTo(0, 4);
    expect(v[0].y).toBeCloseTo(1000, 4);
    expect(v[1].x).toBeCloseTo(0, 4);
    expect(v[1].y).toBeCloseTo(2000, 4);
    expect(v[2].x).toBeCloseTo(-1000, 4);
    expect(v[2].y).toBeCloseTo(2000, 4);
  });

  it('slab-opening: rotates outline independently of host slab', () => {
    const patch = calculateBimRotatedGeometry(makeSlabOpening() as unknown as Entity, ORIGIN, 90) as {
      params: { outline: { vertices: readonly { x: number; y: number }[] } };
    };
    expect(patch.params.outline.vertices[0].x).toBeCloseTo(0, 4);
    expect(patch.params.outline.vertices[0].y).toBeCloseTo(100, 4);
  });

  it('column: rotates position around pivot AND accumulates rotation field', () => {
    const patch = calculateBimRotatedGeometry(makeColumn() as unknown as Entity, ORIGIN, 60) as {
      params: { position: { x: number; y: number }; rotation: number; anchor: string };
    };
    // position (1000, 0) rotated by 60° CCW: (1000*cos60, 1000*sin60) ≈ (500, 866).
    expect(patch.params.position.x).toBeCloseTo(500, 0);
    expect(patch.params.position.y).toBeCloseTo(866, 0);
    // rotation field 30° + 60° = 90°.
    expect(patch.params.rotation).toBeCloseTo(90, 4);
    expect(patch.params.anchor).toBe('center');
  });

  it('column: rotation normalizes past 360° (350 + 30 = 20)', () => {
    const col = makeColumn();
    (col.params as { rotation: number }).rotation = 350;
    const patch = calculateBimRotatedGeometry(col as unknown as Entity, ORIGIN, 30) as {
      params: { rotation: number };
    };
    expect(patch.params.rotation).toBeCloseTo(20, 4);
  });

  it('column (ADR-404 raking): rotates the absolute tilt.direction by the same angle', () => {
    const col = makeColumn();
    (col.params as { tilt?: { direction: number; angle: number } }).tilt = { direction: 10, angle: 5 };
    const patch = calculateBimRotatedGeometry(col as unknown as Entity, ORIGIN, 60) as {
      params: { tilt?: { direction: number; angle: number } };
    };
    // The lean must follow the rotation: 10° + 60° = 70° (angle magnitude unchanged).
    expect(patch.params.tilt?.direction).toBeCloseTo(70, 4);
    expect(patch.params.tilt?.angle).toBeCloseTo(5, 4);
  });

  it('column: a non-tilted column carries no tilt field after rotation', () => {
    const patch = calculateBimRotatedGeometry(makeColumn() as unknown as Entity, ORIGIN, 60) as {
      params: { tilt?: unknown };
    };
    expect(patch.params.tilt).toBeUndefined();
  });

  it('slab (ADR-404 tilted): rotates the absolute slope.direction by the same angle', () => {
    const slab = makeSlab();
    (slab.params as { geometryType?: string; slope?: { direction: number; angle: number; pivotEdge: string } }).geometryType = 'tilted';
    (slab.params as { slope?: { direction: number; angle: number; pivotEdge: string } }).slope = {
      direction: 10, angle: 2, pivotEdge: 'center',
    };
    const patch = calculateBimRotatedGeometry(slab as unknown as Entity, ORIGIN, 90) as {
      params: { slope?: { direction: number; angle: number } };
    };
    expect(patch.params.slope?.direction).toBeCloseTo(100, 4);
    expect(patch.params.slope?.angle).toBeCloseTo(2, 4);
  });

  it('beam: rotates startPoint + endPoint + curveControl', () => {
    const patch = calculateBimRotatedGeometry(makeBeam() as unknown as Entity, ORIGIN, 90) as {
      params: {
        startPoint: { x: number; y: number; z: number };
        endPoint: { x: number; y: number; z: number };
        curveControl?: { x: number; y: number; z: number };
      };
    };
    expect(patch.params.startPoint.x).toBeCloseTo(0, 4);
    expect(patch.params.startPoint.y).toBeCloseTo(1000, 4);
    expect(patch.params.endPoint.x).toBeCloseTo(0, 4);
    expect(patch.params.endPoint.y).toBeCloseTo(3000, 4);
    expect(patch.params.curveControl?.x).toBeCloseTo(-500, 4);
    expect(patch.params.curveControl?.y).toBeCloseTo(2000, 4);
    // z preserved.
    expect(patch.params.startPoint.z).toBe(3000);
  });

  it('stair: rotates basePoint around pivot AND accumulates direction field', () => {
    const patch = calculateBimRotatedGeometry(makeStair() as unknown as Entity, ORIGIN, 45) as {
      params: { basePoint: { x: number; y: number; z: number }; direction: number };
    };
    expect(patch.params.basePoint.x).toBeCloseTo(707.107, 2);
    expect(patch.params.basePoint.y).toBeCloseTo(707.107, 2);
    expect(patch.params.direction).toBeCloseTo(45, 4);
  });

  it('stair: 360° rotation is a no-op (direction normalized to 0)', () => {
    const patch = calculateBimRotatedGeometry(makeStair() as unknown as Entity, ORIGIN, 360) as {
      params: { direction: number };
    };
    expect(patch.params.direction).toBeCloseTo(0, 4);
  });

  it('non-pivot rotation: column at (500,500) around pivot (500,500) does not move position', () => {
    const col = makeColumn();
    (col.params as { position: { x: number; y: number; z: number } }).position = { x: 500, y: 500, z: 0 };
    const patch = calculateBimRotatedGeometry(col as unknown as Entity, { x: 500, y: 500 }, 45) as {
      params: { position: { x: number; y: number }; rotation: number };
    };
    expect(patch.params.position.x).toBeCloseTo(500, 4);
    expect(patch.params.position.y).toBeCloseTo(500, 4);
    expect(patch.params.rotation).toBeCloseTo(75, 4); // 30 + 45
  });

  // ── ADR-408 Φ-C (3D gizmo) — MEP rotate persistence (was a no-op → revert) ──
  it('mep-segment: rotates startPoint + endPoint around pivot by 90° (CCW), z preserved', () => {
    const seg = {
      id: 'seg_1',
      type: 'mep-segment',
      kind: 'pipe',
      params: {
        domain: 'pipe',
        sectionKind: 'round',
        startPoint: { x: 1000, y: 0, z: 400 },
        endPoint: { x: 3000, y: 0, z: 400 },
        diameter: 50,
        centerlineElevationMm: 400,
      },
    } as unknown as Entity;
    const patch = calculateBimRotatedGeometry(seg, ORIGIN, 90) as {
      params: { startPoint: { x: number; y: number; z?: number }; endPoint: { x: number; y: number } };
    };
    expect(patch.params.startPoint.x).toBeCloseTo(0, 4);
    expect(patch.params.startPoint.y).toBeCloseTo(1000, 4);
    expect(patch.params.startPoint.z).toBe(400); // planar rotation preserves z
    expect(patch.params.endPoint.x).toBeCloseTo(0, 4);
    expect(patch.params.endPoint.y).toBeCloseTo(3000, 4);
  });

  it('mep-manifold (point host): rotates position around pivot AND accumulates rotation', () => {
    const manifold = {
      id: 'mfld_1',
      type: 'mep-manifold',
      kind: 'floor-manifold',
      params: {
        position: { x: 1000, y: 0, z: 0 },
        rotation: 0,
        shape: 'rectangular',
        width: 400,
        length: 80,
        bodyHeightMm: 60,
        mountingElevationMm: 400,
        outletCount: 1,
        inletDiameterMm: 25,
        outletDiameterMm: 16,
        sceneUnits: 'mm',
        connectors: [
          { connectorId: 'm-out-0', domain: 'pipe', flow: 'out', localPosition: { x: 40, y: 0, z: 0 } },
        ],
      },
    } as unknown as Entity;
    const patch = calculateBimRotatedGeometry(manifold, ORIGIN, 90) as {
      params: { position: { x: number; y: number }; rotation: number };
    };
    expect(patch.params.position.x).toBeCloseTo(0, 4);
    expect(patch.params.position.y).toBeCloseTo(1000, 4);
    expect(patch.params.rotation).toBeCloseTo(90, 4);
  });

  it('returns null for non-BIM types', () => {
    const line = { type: 'line' } as unknown as Entity;
    expect(calculateBimRotatedGeometry(line, ORIGIN, 90)).toBeNull();
  });
});
