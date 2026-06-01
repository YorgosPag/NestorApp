/**
 * ADR-363 Phase 7.2 — BIM mirror geometry unit tests.
 *
 * Verifies that `calculateBimMirroredGeometry` produces a `{params, geometry}`
 * atomic patch per BIM kind, axis-aware:
 *   - World-coord fields of `params` reflected across the axis (z preserved).
 *   - Geometry cache recomputed (bbox reflects, length preserved).
 *   - Opening hinged kinds: handing flipped; others no-op.
 *   - Column anchor + rotation reflected (anchor snaps to discrete enum).
 *   - Non-BIM entity types return null.
 */
import {
  __testing,
  calculateBimMirroredGeometry,
} from '../bim-mirror-geometry';
import type { Entity } from '../../../types/entities';
import type { WallEntity } from '../../types/wall-types';
import type { OpeningEntity } from '../../types/opening-types';
import type { SlabEntity } from '../../types/slab-types';
import type { SlabOpeningEntity } from '../../types/slab-opening-types';
import type { ColumnEntity } from '../../types/column-types';
import type { BeamEntity } from '../../types/beam-types';
import type { StairEntity } from '../../types/stair-types';
import type { MirrorAxis } from '../../../utils/mirror-math';

// Axis = Y-axis (vertical, x=0): reflects X-coord, preserves Y.
const Y_AXIS: MirrorAxis = { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 } };
// Axis = X-axis (horizontal, y=0): reflects Y-coord, preserves X.
const X_AXIS: MirrorAxis = { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } };

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeWall(): WallEntity {
  return {
    id: 'wall_1',
    type: 'wall',
    kind: 'straight',
    layerId: 'L',
    params: {
      category: 'exterior',
      start: { x: 100, y: 0, z: 0 },
      end: { x: 500, y: 0, z: 0 },
      height: 3000,
      thickness: 250,
      flip: false,
    },
    geometry: {
      bbox: { min: { x: 100, y: -125 }, max: { x: 500, y: 125 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as WallEntity;
}

function makeDoor(handing: 'left' | 'right' = 'left'): OpeningEntity {
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
      handing,
    },
    geometry: {
      position: { x: 1000, y: 0, z: 0 },
      rotation: 0,
      outline: { vertices: [] },
      bbox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
      area: 0,
      perimeter: 0,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as OpeningEntity;
}

function makeWindow(): OpeningEntity {
  return {
    id: 'opn_2',
    type: 'opening',
    kind: 'window',
    layerId: 'L',
    params: {
      kind: 'window',
      wallId: 'wall_1',
      offsetFromStart: 2000,
      width: 1200,
      height: 1400,
      sillHeight: 900,
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
          { x: 100, y: 100 },
          { x: 500, y: 100 },
          { x: 500, y: 400 },
          { x: 100, y: 400 },
        ],
      },
      elevation: 0,
      thickness: 200,
    },
    geometry: {
      bbox: { min: { x: 100, y: 100 }, max: { x: 500, y: 400 } },
    },
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
          { x: 100, y: 100 },
          { x: 300, y: 100 },
          { x: 300, y: 300 },
          { x: 100, y: 300 },
        ],
      },
    },
    geometry: {
      bbox: { min: { x: 100, y: 100 }, max: { x: 300, y: 300 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as SlabOpeningEntity;
}

function makeColumn(anchor: 'center' | 'nw' = 'center', rotation = 0): ColumnEntity {
  return {
    id: 'col_1',
    type: 'column',
    kind: 'rectangular',
    layerId: 'L',
    params: {
      kind: 'rectangular',
      position: { x: 1000, y: 500, z: 0 },
      anchor,
      width: 400,
      depth: 400,
      height: 3000,
      rotation,
    },
    geometry: {
      bbox: { min: { x: 800, y: 300 }, max: { x: 1200, y: 700 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as ColumnEntity;
}

function makeLshapeColumn(flipY = false): ColumnEntity {
  return {
    id: 'col_L',
    type: 'column',
    kind: 'L-shape',
    layerId: 'L',
    params: {
      kind: 'L-shape',
      position: { x: 1000, y: 500, z: 0 },
      anchor: 'center',
      width: 600,
      depth: 600,
      height: 3000,
      rotation: 0,
      lshape: { armWidth: 200, armLength: 200, flipY },
    },
    geometry: { bbox: { min: { x: 700, y: 200 }, max: { x: 1300, y: 800 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as ColumnEntity;
}

function makeLshapeColumnNoOverride(): ColumnEntity {
  return {
    id: 'col_Lx',
    type: 'column',
    kind: 'L-shape',
    layerId: 'L',
    params: {
      kind: 'L-shape',
      position: { x: 1000, y: 500, z: 0 },
      anchor: 'center',
      width: 600,
      depth: 600,
      height: 3000,
      rotation: 0,
    },
    geometry: { bbox: { min: { x: 700, y: 200 }, max: { x: 1300, y: 800 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as ColumnEntity;
}

function makeTshapeColumn(flipY = false): ColumnEntity {
  return {
    id: 'col_T',
    type: 'column',
    kind: 'T-shape',
    layerId: 'L',
    params: {
      kind: 'T-shape',
      position: { x: 1000, y: 500, z: 0 },
      anchor: 'center',
      width: 600,
      depth: 600,
      height: 3000,
      rotation: 0,
      tshape: { flangeLength: 600, webThickness: 200, flipY },
    },
    geometry: { bbox: { min: { x: 700, y: 200 }, max: { x: 1300, y: 800 } } },
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
      startPoint: { x: 100, y: 200, z: 3000 },
      endPoint: { x: 500, y: 200, z: 3000 },
      curveControl: { x: 300, y: 400, z: 3000 },
      width: 250,
      depth: 400,
      elevation: 3000,
    },
    geometry: {
      bbox: { min: { x: 100, y: 200 }, max: { x: 500, y: 400 } },
    },
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
      basePoint: { x: 500, y: 500, z: 0 },
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
      arrowSymbol: {
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 0, z: 0 },
        label: 'UP',
      },
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

describe('ADR-363 Phase 7.2 — calculateBimMirroredGeometry', () => {
  // ── Wall ─────────────────────────────────────────────────────────────
  it('wall: reflects start + end across Y-axis (X negated, Y preserved, z preserved)', () => {
    const patch = calculateBimMirroredGeometry(makeWall() as unknown as Entity, Y_AXIS);
    expect(patch).not.toBeNull();
    const p = (patch as { params: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } } }).params;
    expect(p.start).toEqual({ x: -100, y: 0, z: 0 });
    expect(p.end).toEqual({ x: -500, y: 0, z: 0 });
  });

  it('wall: reflects start + end across X-axis (Y negated)', () => {
    const wall = makeWall();
    (wall.params as { start: { y: number }; end: { y: number } }).start.y = 200;
    (wall.params as { start: { y: number }; end: { y: number } }).end.y = 300;
    const patch = calculateBimMirroredGeometry(wall as unknown as Entity, X_AXIS) as {
      params: { start: { y: number }; end: { y: number } };
    };
    expect(patch.params.start.y).toBeCloseTo(-200, 4);
    expect(patch.params.end.y).toBeCloseTo(-300, 4);
  });

  it('wall: recomputes geometry after mirror (bbox reflects)', () => {
    const patch = calculateBimMirroredGeometry(makeWall() as unknown as Entity, Y_AXIS) as {
      geometry: { bbox: { min: { x: number }; max: { x: number } } };
    };
    expect(patch.geometry.bbox.min.x).toBeLessThanOrEqual(-100);
    expect(patch.geometry.bbox.max.x).toBeGreaterThanOrEqual(-500);
  });

  // ── Opening ─────────────────────────────────────────────────────────
  it('opening (door): flips handing left → right', () => {
    const patch = calculateBimMirroredGeometry(makeDoor('left') as unknown as Entity, Y_AXIS) as {
      params: { handing: 'left' | 'right' };
    };
    expect(patch.params.handing).toBe('right');
  });

  it('opening (door): flips handing right → left', () => {
    const patch = calculateBimMirroredGeometry(makeDoor('right') as unknown as Entity, X_AXIS) as {
      params: { handing: 'left' | 'right' };
    };
    expect(patch.params.handing).toBe('left');
  });

  it('opening (window): returns empty patch (no handedness)', () => {
    const patch = calculateBimMirroredGeometry(makeWindow() as unknown as Entity, Y_AXIS);
    expect(patch).toEqual({});
  });

  it('opening (door without handing): returns empty patch', () => {
    const door = makeDoor();
    delete (door.params as Partial<{ handing: 'left' | 'right' }>).handing;
    const patch = calculateBimMirroredGeometry(door as unknown as Entity, Y_AXIS);
    expect(patch).toEqual({});
  });

  // ── Slab ────────────────────────────────────────────────────────────
  it('slab: reflects every outline vertex across Y-axis', () => {
    const patch = calculateBimMirroredGeometry(makeSlab() as unknown as Entity, Y_AXIS) as {
      params: { outline: { vertices: readonly { x: number; y: number }[] } };
    };
    expect(patch.params.outline.vertices).toEqual([
      { x: -100, y: 100 },
      { x: -500, y: 100 },
      { x: -500, y: 400 },
      { x: -100, y: 400 },
    ]);
  });

  // ── Slab opening ────────────────────────────────────────────────────
  it('slab-opening: reflects outline independently of host slab', () => {
    const patch = calculateBimMirroredGeometry(makeSlabOpening() as unknown as Entity, X_AXIS) as {
      params: { outline: { vertices: readonly { x: number; y: number }[] } };
    };
    expect(patch.params.outline.vertices).toEqual([
      { x: 100, y: -100 },
      { x: 300, y: -100 },
      { x: 300, y: -300 },
      { x: 100, y: -300 },
    ]);
  });

  // ── Column ──────────────────────────────────────────────────────────
  it('column (center anchor): reflects position, anchor stays center', () => {
    const patch = calculateBimMirroredGeometry(makeColumn('center') as unknown as Entity, Y_AXIS) as {
      params: { position: { x: number; y: number }; anchor: string; rotation: number };
    };
    expect(patch.params.position.x).toBe(-1000);
    expect(patch.params.position.y).toBe(500);
    expect(patch.params.anchor).toBe('center');
  });

  it('column (nw anchor): anchor flips to ne across Y-axis (X-flip)', () => {
    const patch = calculateBimMirroredGeometry(makeColumn('nw') as unknown as Entity, Y_AXIS) as {
      params: { anchor: string };
    };
    expect(patch.params.anchor).toBe('ne');
  });

  it('column (nw anchor): anchor flips to sw across X-axis (Y-flip)', () => {
    const patch = calculateBimMirroredGeometry(makeColumn('nw') as unknown as Entity, X_AXIS) as {
      params: { anchor: string };
    };
    expect(patch.params.anchor).toBe('sw');
  });

  it('column: rotation reflected (45° across Y-axis → 135°)', () => {
    const patch = calculateBimMirroredGeometry(makeColumn('center', 45) as unknown as Entity, Y_AXIS) as {
      params: { rotation: number };
    };
    expect(patch.params.rotation).toBeCloseTo(135, 4);
  });

  // ── L-shape / T-shape handedness (Phase 7.2) ────────────────────────
  it('L-shape column: mirror across Y-axis toggles flipY false→true', () => {
    const patch = calculateBimMirroredGeometry(makeLshapeColumn(false) as unknown as Entity, Y_AXIS) as {
      params: { lshape: { flipY: boolean } };
    };
    expect(patch.params.lshape.flipY).toBe(true);
  });

  it('L-shape column: double-mirror restores flipY (true→false)', () => {
    const patch = calculateBimMirroredGeometry(makeLshapeColumn(true) as unknown as Entity, Y_AXIS) as {
      params: { lshape: { flipY: boolean } };
    };
    expect(patch.params.lshape.flipY).toBe(false);
  });

  it('L-shape column: mirror across X-axis also toggles flipY (axis-independent)', () => {
    const patch = calculateBimMirroredGeometry(makeLshapeColumn(false) as unknown as Entity, X_AXIS) as {
      params: { lshape: { flipY: boolean } };
    };
    expect(patch.params.lshape.flipY).toBe(true);
  });

  it('L-shape column with no lshape override: mirror creates flipY=true', () => {
    const patch = calculateBimMirroredGeometry(makeLshapeColumnNoOverride() as unknown as Entity, Y_AXIS) as {
      params: { lshape: { flipY: boolean } };
    };
    expect(patch.params.lshape.flipY).toBe(true);
  });

  it('T-shape column: mirror across Y-axis toggles flipY false→true', () => {
    const patch = calculateBimMirroredGeometry(makeTshapeColumn(false) as unknown as Entity, Y_AXIS) as {
      params: { tshape: { flipY: boolean } };
    };
    expect(patch.params.tshape.flipY).toBe(true);
  });

  it('T-shape column: double-mirror restores flipY (true→false)', () => {
    const patch = calculateBimMirroredGeometry(makeTshapeColumn(true) as unknown as Entity, Y_AXIS) as {
      params: { tshape: { flipY: boolean } };
    };
    expect(patch.params.tshape.flipY).toBe(false);
  });

  it('rectangular column: mirror adds no lshape or tshape', () => {
    const patch = calculateBimMirroredGeometry(makeColumn('center') as unknown as Entity, Y_AXIS) as {
      params: { lshape?: unknown; tshape?: unknown };
    };
    expect(patch.params.lshape).toBeUndefined();
    expect(patch.params.tshape).toBeUndefined();
  });

  // ── ADR-363 Phase 2b — polygon-backed U-shape / composite mirror ──────
  it('composite column: mirror reflects each polygon vertex (negate y) + reverses winding', () => {
    const tri = [
      { x: -100, y: -100 },
      { x: 100, y: -100 },
      { x: 0, y: 100 },
    ];
    const col = {
      id: 'col_C', type: 'column', kind: 'composite', layerId: 'L',
      params: {
        kind: 'composite', position: { x: 1000, y: 500, z: 0 }, anchor: 'center',
        width: 200, depth: 200, height: 3000, rotation: 0, sceneUnits: 'mm',
        composite: { polygon: tri },
      },
      geometry: { bbox: { min: { x: 900, y: 400 }, max: { x: 1100, y: 600 } } },
      validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    } as unknown as Entity;
    const patch = calculateBimMirroredGeometry(col, Y_AXIS) as {
      params: { composite: { polygon: Array<{ x: number; y: number }> } };
    };
    expect(patch.params.composite.polygon).toEqual([
      { x: 0, y: -100 },
      { x: 100, y: 100 },
      { x: -100, y: 100 },
    ]);
  });

  it('U-shape parametric (no polygon): mirror toggles ushape.flipY', () => {
    const col = {
      id: 'col_U', type: 'column', kind: 'U-shape', layerId: 'L',
      params: {
        kind: 'U-shape', position: { x: 1000, y: 500, z: 0 }, anchor: 'center',
        width: 400, depth: 400, height: 3000, rotation: 0, sceneUnits: 'mm',
      },
      geometry: { bbox: { min: { x: 800, y: 300 }, max: { x: 1200, y: 700 } } },
      validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    } as unknown as Entity;
    const patch = calculateBimMirroredGeometry(col, Y_AXIS) as {
      params: { ushape: { flipY: boolean } };
    };
    expect(patch.params.ushape.flipY).toBe(true);
  });

  // ── Beam ────────────────────────────────────────────────────────────
  it('beam: reflects startPoint + endPoint + curveControl across Y-axis', () => {
    const patch = calculateBimMirroredGeometry(makeBeam() as unknown as Entity, Y_AXIS) as {
      params: {
        startPoint: { x: number; y: number; z: number };
        endPoint: { x: number; y: number; z: number };
        curveControl?: { x: number; y: number; z: number };
      };
    };
    expect(patch.params.startPoint).toEqual({ x: -100, y: 200, z: 3000 });
    expect(patch.params.endPoint).toEqual({ x: -500, y: 200, z: 3000 });
    expect(patch.params.curveControl).toEqual({ x: -300, y: 400, z: 3000 });
  });

  // ── Stair ───────────────────────────────────────────────────────────
  it('stair: reflects basePoint and reflects direction', () => {
    const patch = calculateBimMirroredGeometry(makeStair() as unknown as Entity, Y_AXIS) as {
      params: { basePoint: { x: number; y: number }; direction: number };
    };
    expect(patch.params.basePoint.x).toBe(-500);
    expect(patch.params.basePoint.y).toBe(500);
    // Y_AXIS is vertical (90°). mirrorAngle(0, 90) = 2*90 - 0 = 180°.
    expect(patch.params.direction).toBeCloseTo(180, 4);
  });

  // ── Dispatcher ──────────────────────────────────────────────────────
  it('returns null for non-BIM types', () => {
    const line = { type: 'line' } as unknown as Entity;
    const circle = { type: 'circle' } as unknown as Entity;
    expect(calculateBimMirroredGeometry(line, Y_AXIS)).toBeNull();
    expect(calculateBimMirroredGeometry(circle, Y_AXIS)).toBeNull();
  });
});

describe('ADR-363 Phase 7.2 — column anchor reflection helpers', () => {
  it('mirrorColumnAnchor: center invariant under any axis', () => {
    expect(__testing.mirrorColumnAnchor('center', 0)).toBe('center');
    expect(__testing.mirrorColumnAnchor('center', 45)).toBe('center');
    expect(__testing.mirrorColumnAnchor('center', 90)).toBe('center');
  });

  it('mirrorColumnAnchor: vertical axis (90°) swaps east ↔ west', () => {
    expect(__testing.mirrorColumnAnchor('e', 90)).toBe('w');
    expect(__testing.mirrorColumnAnchor('w', 90)).toBe('e');
    expect(__testing.mirrorColumnAnchor('ne', 90)).toBe('nw');
    expect(__testing.mirrorColumnAnchor('se', 90)).toBe('sw');
    expect(__testing.mirrorColumnAnchor('nw', 90)).toBe('ne');
    expect(__testing.mirrorColumnAnchor('sw', 90)).toBe('se');
    expect(__testing.mirrorColumnAnchor('n', 90)).toBe('n');
    expect(__testing.mirrorColumnAnchor('s', 90)).toBe('s');
  });

  it('mirrorColumnAnchor: horizontal axis (0°) swaps north ↔ south', () => {
    expect(__testing.mirrorColumnAnchor('n', 0)).toBe('s');
    expect(__testing.mirrorColumnAnchor('s', 0)).toBe('n');
    expect(__testing.mirrorColumnAnchor('nw', 0)).toBe('sw');
    expect(__testing.mirrorColumnAnchor('ne', 0)).toBe('se');
    expect(__testing.mirrorColumnAnchor('sw', 0)).toBe('nw');
    expect(__testing.mirrorColumnAnchor('se', 0)).toBe('ne');
    expect(__testing.mirrorColumnAnchor('e', 0)).toBe('e');
    expect(__testing.mirrorColumnAnchor('w', 0)).toBe('w');
  });

  it('mirrorColumnAnchor: 45° diagonal swaps n↔e, s↔w, nw↔se; ne/sw invariant', () => {
    // Reflection across line y=x: (dx, dy) → (dy, dx).
    expect(__testing.mirrorColumnAnchor('n', 45)).toBe('e');
    expect(__testing.mirrorColumnAnchor('e', 45)).toBe('n');
    expect(__testing.mirrorColumnAnchor('s', 45)).toBe('w');
    expect(__testing.mirrorColumnAnchor('w', 45)).toBe('s');
    // nw (-0.5,+0.5) ↔ se (+0.5,-0.5) under y=x reflection.
    expect(__testing.mirrorColumnAnchor('nw', 45)).toBe('se');
    expect(__testing.mirrorColumnAnchor('se', 45)).toBe('nw');
    // ne (+0.5,+0.5) and sw (-0.5,-0.5) lie ON the y=x line — invariant.
    expect(__testing.mirrorColumnAnchor('ne', 45)).toBe('ne');
    expect(__testing.mirrorColumnAnchor('sw', 45)).toBe('sw');
  });

  it('snapAnchorOffset: discretizes a continuous (dx, dy) to nearest enum', () => {
    expect(__testing.snapAnchorOffset(0, 0)).toBe('center');
    expect(__testing.snapAnchorOffset(0.5, 0)).toBe('e');
    expect(__testing.snapAnchorOffset(-0.5, 0)).toBe('w');
    expect(__testing.snapAnchorOffset(0, 0.5)).toBe('n');
    expect(__testing.snapAnchorOffset(0, -0.5)).toBe('s');
    expect(__testing.snapAnchorOffset(0.5, 0.5)).toBe('ne');
    expect(__testing.snapAnchorOffset(-0.5, 0.5)).toBe('nw');
    expect(__testing.snapAnchorOffset(0.5, -0.5)).toBe('se');
    expect(__testing.snapAnchorOffset(-0.5, -0.5)).toBe('sw');
  });
});
