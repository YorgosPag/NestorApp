/**
 * ADR-363 Phase 7A — BIM move geometry unit tests.
 *
 * Verifies that `calculateBimMovedGeometry` produces a `{params, geometry}`
 * atomic patch for each of the 7 BIM types, with:
 *  - delta applied to every world-coord field of `params`
 *  - geometry cache recomputed (bbox shifts by the same delta, length preserved)
 *  - z component on Point3D preserved (2D plan-view move)
 *  - opening returns `{}` (hosted-derived, no direct move)
 *  - non-BIM entity types return null (caller falls through)
 */

import { calculateBimMovedGeometry } from '../bim-move-geometry';
import type { Entity } from '../../../types/entities';
import type { WallEntity } from '../../types/wall-types';
import type { SlabEntity } from '../../types/slab-types';
import type { SlabOpeningEntity } from '../../types/slab-opening-types';
import type { ColumnEntity } from '../../types/column-types';
import type { BeamEntity } from '../../types/beam-types';
import type { MepRadiatorEntity } from '../../types/mep-radiator-types';
import type { MepBoilerEntity } from '../../types/mep-boiler-types';
import type { MepWaterHeaterEntity } from '../../types/mep-water-heater-types';
import type { RoofEntity } from '../../types/roof-types';
import type { MepUnderfloorEntity } from '../../types/mep-underfloor-types';

const DELTA = { x: 1000, y: 500 };

function makeWall(): WallEntity {
  return {
    id: 'wall_1',
    name: 'W1',
    type: 'wall',
    kind: 'straight',
    layerId: 'L',
    params: {
      category: 'exterior',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 5000, y: 0, z: 0 },
      height: 3000,
      thickness: 250,
      flip: false,
    },
    geometry: {
      bbox: { min: { x: 0, y: -125 }, max: { x: 5000, y: 125 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as WallEntity;
}

function makeSlab(): SlabEntity {
  return {
    id: 'slab_1',
    name: 'S1',
    type: 'slab',
    kind: 'floor',
    layerId: 'L',
    params: {
      kind: 'floor',
      outline: {
        vertices: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 1000, y: 1000 },
          { x: 0, y: 1000 },
        ],
      },
      elevation: 0,
      thickness: 200,
    },
    geometry: {
      bbox: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as SlabEntity;
}

function makeSlabOpening(): SlabOpeningEntity {
  return {
    id: 'slbopn_1',
    name: 'SO1',
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

function makeColumn(): ColumnEntity {
  return {
    id: 'col_1',
    name: 'C1',
    type: 'column',
    kind: 'rectangular',
    layerId: 'L',
    params: {
      kind: 'rectangular',
      position: { x: 2000, y: 2000, z: 0 },
      anchor: 'center',
      width: 400,
      depth: 400,
      height: 3000,
      rotation: 0,
    },
    geometry: {
      bbox: { min: { x: 1800, y: 1800 }, max: { x: 2200, y: 2200 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as ColumnEntity;
}

function makeBeam(): BeamEntity {
  return {
    id: 'beam_1',
    name: 'B1',
    type: 'beam',
    kind: 'straight',
    layerId: 'L',
    params: {
      kind: 'straight',
      startPoint: { x: 0, y: 0, z: 3000 },
      endPoint: { x: 5000, y: 0, z: 3000 },
      width: 250,
      depth: 400,
      elevation: 3000,
    },
    geometry: {
      bbox: { min: { x: 0, y: -125 }, max: { x: 5000, y: 125 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as BeamEntity;
}

// ─── ADR-363 Phase 1G.5 — point/polygon BIM entities added after Phase 7A ─────

/** Centred-box equipment fixture (radiator/boiler/water-heater share the shape). */
function makeCentredBoxEquipment<T>(type: string, id: string): T {
  return {
    id,
    name: id,
    type,
    layerId: 'L',
    params: {
      position: { x: 2000, y: 2000, z: 800 },
      rotation: 0,
      width: 600,
      length: 400,
      bodyHeightMm: 600,
      connectors: [],
    },
    geometry: { footprint: { vertices: [] }, bbox: { min: { x: 1700, y: 1800 }, max: { x: 2300, y: 2200 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as T;
}

function makeRoof(): RoofEntity {
  return {
    id: 'roof_1',
    name: 'R1',
    type: 'roof',
    kind: 'pitched',
    layerId: 'L',
    params: {
      outline: {
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 4000, y: 0, z: 0 },
          { x: 4000, y: 3000, z: 0 },
          { x: 0, y: 3000, z: 0 },
        ],
      },
      edges: [
        { definesSlope: false, slope: 0, overhangMm: 0 },
        { definesSlope: false, slope: 0, overhangMm: 0 },
        { definesSlope: false, slope: 0, overhangMm: 0 },
        { definesSlope: false, slope: 0, overhangMm: 0 },
      ],
      slopeUnit: 'deg',
      basePivotZ: 3000,
      thickness: 200,
    },
    geometry: { bbox: { min: { x: 0, y: 0, z: 2.8 }, max: { x: 4000, y: 3000, z: 3 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as RoofEntity;
}

function makeUnderfloor(): MepUnderfloorEntity {
  return {
    id: 'mufl_1',
    name: 'UF1',
    type: 'mep-underfloor',
    kind: 'wet',
    layerId: 'L',
    params: {
      kind: 'wet',
      footprint: {
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 2000, y: 0, z: 0 },
          { x: 2000, y: 2000, z: 0 },
          { x: 0, y: 2000, z: 0 },
        ],
      },
      pipeSpacingMm: 150,
      edgeClearanceMm: 100,
      patternType: 'boustrophedon',
      entrySide: 0,
      screedOffsetMm: 50,
      connectorDiameterMm: 16,
      connectors: [],
    },
    geometry: { bbox: { min: { x: 0, y: 0 }, max: { x: 2000, y: 2000 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as MepUnderfloorEntity;
}

describe('ADR-363 Phase 7A — calculateBimMovedGeometry', () => {
  it('wall: shifts params.start + params.end by delta, preserves z', () => {
    const patch = calculateBimMovedGeometry(makeWall() as unknown as Entity, DELTA);
    expect(patch).not.toBeNull();
    const p = (patch as { params: { start: { x: number; y: number; z?: number }; end: { x: number; y: number; z?: number } } }).params;
    expect(p.start).toEqual({ x: 1000, y: 500, z: 0 });
    expect(p.end).toEqual({ x: 6000, y: 500, z: 0 });
  });

  it('wall: recomputes geometry.bbox shifted by delta', () => {
    const patch = calculateBimMovedGeometry(makeWall() as unknown as Entity, DELTA) as {
      geometry: { bbox: { min: { x: number; y: number }; max: { x: number; y: number } } };
    };
    expect(patch.geometry.bbox.min.x).toBeCloseTo(1000, 0);
    expect(patch.geometry.bbox.min.y).toBeCloseTo(375, 0); // y0=-125 + 500
    expect(patch.geometry.bbox.max.x).toBeCloseTo(6000, 0);
    expect(patch.geometry.bbox.max.y).toBeCloseTo(625, 0); // y0=125 + 500
  });

  it('opening: returns empty patch (hosted-derived, no direct move)', () => {
    const opening = { type: 'opening' } as unknown as Entity;
    expect(calculateBimMovedGeometry(opening, DELTA)).toEqual({});
  });

  it('slab: shifts every vertex of params.outline by delta', () => {
    const patch = calculateBimMovedGeometry(makeSlab() as unknown as Entity, DELTA) as {
      params: { outline: { vertices: readonly { x: number; y: number }[] } };
    };
    expect(patch.params.outline.vertices).toEqual([
      { x: 1000, y: 500 },
      { x: 2000, y: 500 },
      { x: 2000, y: 1500 },
      { x: 1000, y: 1500 },
    ]);
  });

  it('slab-opening: shifts every vertex of params.outline by delta (independent world coords)', () => {
    const patch = calculateBimMovedGeometry(makeSlabOpening() as unknown as Entity, DELTA) as {
      params: { outline: { vertices: readonly { x: number; y: number }[] } };
    };
    expect(patch.params.outline.vertices).toEqual([
      { x: 1100, y: 600 },
      { x: 1300, y: 600 },
      { x: 1300, y: 800 },
      { x: 1100, y: 800 },
    ]);
  });

  it('column: shifts params.position by delta, preserves z', () => {
    const patch = calculateBimMovedGeometry(makeColumn() as unknown as Entity, DELTA) as {
      params: { position: { x: number; y: number; z?: number } };
    };
    expect(patch.params.position).toEqual({ x: 3000, y: 2500, z: 0 });
  });

  it('beam: shifts params.startPoint + params.endPoint by delta', () => {
    const patch = calculateBimMovedGeometry(makeBeam() as unknown as Entity, DELTA) as {
      params: {
        startPoint: { x: number; y: number; z?: number };
        endPoint: { x: number; y: number; z?: number };
      };
    };
    expect(patch.params.startPoint).toEqual({ x: 1000, y: 500, z: 3000 });
    expect(patch.params.endPoint).toEqual({ x: 6000, y: 500, z: 3000 });
  });

  it('beam (straight): moved params have NO `curveControl` key (Firestore updateDoc rejects undefined)', () => {
    // Regression: moveBeam used to set `curveControl: undefined` for straight beams,
    // which made the per-entity Firestore write throw ("Unsupported field value:
    // undefined") → every straight-beam move silently failed to persist.
    const patch = calculateBimMovedGeometry(makeBeam() as unknown as Entity, DELTA) as {
      params: Record<string, unknown>;
    };
    expect('curveControl' in patch.params).toBe(false);
  });

  it('beam (straight): scrubs a stale `curveControl: undefined` key already in params', () => {
    const beam = makeBeam();
    const dirty = {
      ...beam,
      params: { ...beam.params, curveControl: undefined },
    } as unknown as Entity;
    const patch = calculateBimMovedGeometry(dirty, DELTA) as { params: Record<string, unknown> };
    expect('curveControl' in patch.params).toBe(false);
  });

  it('beam (curved): shifts params.curveControl by delta, preserves z', () => {
    const beam = makeBeam();
    const curved = {
      ...beam,
      kind: 'curved',
      params: { ...beam.params, kind: 'curved', curveControl: { x: 2500, y: 200, z: 3000 } },
    } as unknown as Entity;
    const patch = calculateBimMovedGeometry(curved, DELTA) as {
      params: { curveControl?: { x: number; y: number; z?: number } };
    };
    expect(patch.params.curveControl).toEqual({ x: 3500, y: 700, z: 3000 });
  });

  it('returns null for non-BIM entity types', () => {
    const line = { type: 'line' } as unknown as Entity;
    expect(calculateBimMovedGeometry(line, DELTA)).toBeNull();

    const circle = { type: 'circle' } as unknown as Entity;
    expect(calculateBimMovedGeometry(circle, DELTA)).toBeNull();
  });

  it('preserves z coordinates on Point3D fields (2D plan-view move)', () => {
    const patch = calculateBimMovedGeometry(makeWall() as unknown as Entity, DELTA) as {
      params: { start: { z?: number }; end: { z?: number } };
    };
    expect(patch.params.start.z).toBe(0);
    expect(patch.params.end.z).toBe(0);
  });

  it('wall: translates startMiter + endMiter by delta (no stray lines after commit)', () => {
    const wall = makeWall();
    const wallWithMiter = {
      ...wall,
      params: {
        ...wall.params,
        startMiter: { outer: { x: -5, y: 125 }, inner: { x: -5, y: -125 } },
        endMiter: { outer: { x: 5005, y: 125 }, inner: { x: 5005, y: -125 } },
      },
    } as unknown as WallEntity;
    const patch = calculateBimMovedGeometry(wallWithMiter as unknown as Entity, DELTA) as {
      params: {
        startMiter?: { outer: { x: number; y: number }; inner: { x: number; y: number } };
        endMiter?: { outer: { x: number; y: number }; inner: { x: number; y: number } };
      };
    };
    expect(patch.params.startMiter?.outer).toEqual({ x: -5 + 1000, y: 125 + 500 });
    expect(patch.params.startMiter?.inner).toEqual({ x: -5 + 1000, y: -125 + 500 });
    expect(patch.params.endMiter?.outer).toEqual({ x: 5005 + 1000, y: 125 + 500 });
    expect(patch.params.endMiter?.inner).toEqual({ x: 5005 + 1000, y: -125 + 500 });
  });

  it('wall: startMiter/endMiter remain undefined when not set', () => {
    const patch = calculateBimMovedGeometry(makeWall() as unknown as Entity, DELTA) as {
      params: { startMiter?: unknown; endMiter?: unknown };
    };
    expect(patch.params.startMiter).toBeUndefined();
    expect(patch.params.endMiter).toBeUndefined();
  });
});

describe('ADR-363 Phase 1G.5 — point/polygon BIM move SSoT gap fix', () => {
  it.each([
    ['mep-radiator', () => makeCentredBoxEquipment<MepRadiatorEntity>('mep-radiator', 'rad_1')],
    ['mep-boiler', () => makeCentredBoxEquipment<MepBoilerEntity>('mep-boiler', 'blr_1')],
    ['mep-water-heater', () => makeCentredBoxEquipment<MepWaterHeaterEntity>('mep-water-heater', 'wht_1')],
  ])('%s: shifts params.position by delta + recomputes geometry (no longer a no-op)', (_type, make) => {
    const patch = calculateBimMovedGeometry(make() as unknown as Entity, DELTA) as {
      params: { position: { x: number; y: number; z?: number } };
      geometry: unknown;
    } | null;
    expect(patch).not.toBeNull();
    expect(patch).not.toEqual({});
    expect(patch!.params.position).toEqual({ x: 3000, y: 2500, z: 800 });
    expect(patch!.geometry).toBeDefined();
  });

  it('roof: shifts every params.outline vertex by delta + recomputes geometry, preserves z', () => {
    const patch = calculateBimMovedGeometry(makeRoof() as unknown as Entity, DELTA) as {
      params: { outline: { vertices: readonly { x: number; y: number; z?: number }[] } };
      geometry: unknown;
    };
    expect(patch.params.outline.vertices).toEqual([
      { x: 1000, y: 500, z: 0 },
      { x: 5000, y: 500, z: 0 },
      { x: 5000, y: 3500, z: 0 },
      { x: 1000, y: 3500, z: 0 },
    ]);
    expect(patch.geometry).toBeDefined();
  });

  it('mep-underfloor: shifts every params.footprint vertex by delta + recomputes geometry', () => {
    const patch = calculateBimMovedGeometry(makeUnderfloor() as unknown as Entity, DELTA) as {
      params: { footprint: { vertices: readonly { x: number; y: number; z?: number }[] } };
      geometry: unknown;
    };
    expect(patch.params.footprint.vertices).toEqual([
      { x: 1000, y: 500, z: 0 },
      { x: 3000, y: 500, z: 0 },
      { x: 3000, y: 2500, z: 0 },
      { x: 1000, y: 2500, z: 0 },
    ]);
    expect(patch.geometry).toBeDefined();
  });
});

// ─── ADR-507 §8 — flat hatch primitive move (boundaryPaths + pattern anchors) ──────
describe('ADR-507 §8 — calculateBimMovedGeometry hatch', () => {
  function makeHatch(extra: Record<string, unknown> = {}): Entity {
    return {
      id: 'hatch_1',
      name: 'H1',
      type: 'hatch',
      layerId: 'L',
      boundaryPaths: [
        // outer ring
        [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }],
        // island ring
        [{ x: 300, y: 300 }, { x: 700, y: 300 }, { x: 700, y: 700 }, { x: 300, y: 700 }],
      ],
      fillType: 'user-defined',
      ...extra,
    } as unknown as Entity;
  }

  it('shifts every vertex of every boundary ring by delta (outer + island)', () => {
    const patch = calculateBimMovedGeometry(makeHatch(), DELTA) as {
      boundaryPaths: readonly (readonly { x: number; y: number }[])[];
    };
    expect(patch.boundaryPaths[0]).toEqual([
      { x: 1000, y: 500 }, { x: 2000, y: 500 }, { x: 2000, y: 1500 }, { x: 1000, y: 1500 },
    ]);
    expect(patch.boundaryPaths[1]).toEqual([
      { x: 1300, y: 800 }, { x: 1700, y: 800 }, { x: 1700, y: 1200 }, { x: 1300, y: 1200 },
    ]);
  });

  it('returns a non-null, non-empty patch (no longer a no-op)', () => {
    const patch = calculateBimMovedGeometry(makeHatch(), DELTA);
    expect(patch).not.toBeNull();
    expect(patch).not.toEqual({});
  });

  it('shifts patternOrigin when present (pattern phase follows the hatch)', () => {
    const patch = calculateBimMovedGeometry(
      makeHatch({ patternOrigin: { x: 500, y: 500 } }), DELTA,
    ) as { patternOrigin?: { x: number; y: number } };
    expect(patch.patternOrigin).toEqual({ x: 1500, y: 1000 });
  });

  it('shifts every seedPoint when present', () => {
    const patch = calculateBimMovedGeometry(
      makeHatch({ seedPoints: [{ x: 500, y: 500 }, { x: 100, y: 100 }] }), DELTA,
    ) as { seedPoints?: readonly { x: number; y: number }[] };
    expect(patch.seedPoints).toEqual([{ x: 1500, y: 1000 }, { x: 1100, y: 600 }]);
  });

  it('omits patternOrigin/seedPoints from the patch when the hatch has none', () => {
    const patch = calculateBimMovedGeometry(makeHatch(), DELTA) as Record<string, unknown>;
    expect('patternOrigin' in patch).toBe(false);
    expect('seedPoints' in patch).toBe(false);
  });
});

// ─── ADR-049 Phase 2 — vertical (delta.z) branch: the unified MoveElement(dx,dy,dz) ──
// `delta.z` is the elevation delta in mm; each vertical-capable type bumps its own
// per-type elevation field AFTER the plan move, reusing the `bim-vertical-move` SSoT.
describe('ADR-049 Phase 2 — calculateBimMovedGeometry vertical (delta.z) branch', () => {
  const Z = 750; // mm up

  function wallWithBaseOffset(baseOffset: number): Entity {
    const w = makeWall();
    return { ...w, params: { ...w.params, baseOffset } } as unknown as Entity;
  }

  it('wall: delta.z bumps baseOffset (pure vertical leaves plan x/y untouched)', () => {
    const patch = calculateBimMovedGeometry(wallWithBaseOffset(100), { x: 0, y: 0, z: Z }) as {
      params: { baseOffset: number; start: { x: number; y: number } };
    };
    expect(patch.params.baseOffset).toBe(100 + Z);
    expect(patch.params.start).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('wall: combined plan + vertical applies BOTH the x/y shift and the baseOffset bump', () => {
    const patch = calculateBimMovedGeometry(wallWithBaseOffset(0), { x: 1000, y: 500, z: Z }) as {
      params: { baseOffset: number; start: { x: number; y: number }; end: { x: number; y: number } };
    };
    expect(patch.params.start).toEqual({ x: 1000, y: 500, z: 0 });
    expect(patch.params.end).toEqual({ x: 6000, y: 500, z: 0 });
    expect(patch.params.baseOffset).toBe(Z);
  });

  it('column: delta.z bumps baseOffset (mirror wall)', () => {
    const c = makeColumn();
    const col = { ...c, params: { ...c.params, baseOffset: 0 } } as unknown as Entity;
    const patch = calculateBimMovedGeometry(col, { x: 0, y: 0, z: Z }) as {
      params: { baseOffset: number; position: { x: number; y: number } };
    };
    expect(patch.params.baseOffset).toBe(Z);
    expect(patch.params.position).toEqual({ x: 2000, y: 2000, z: 0 });
  });

  it('beam: delta.z bumps topElevation (depth fixed)', () => {
    const b = makeBeam();
    const beam = { ...b, params: { ...b.params, topElevation: 3000 } } as unknown as Entity;
    const patch = calculateBimMovedGeometry(beam, { x: 0, y: 0, z: Z }) as {
      params: { topElevation: number };
    };
    expect(patch.params.topElevation).toBe(3000 + Z);
  });

  it('slab: delta.z bumps levelElevation (top face)', () => {
    const s = makeSlab();
    const slab = { ...s, params: { ...s.params, levelElevation: 0 } } as unknown as Entity;
    const patch = calculateBimMovedGeometry(slab, { x: 0, y: 0, z: Z }) as {
      params: { levelElevation: number };
    };
    expect(patch.params.levelElevation).toBe(Z);
  });

  it('mep-host (radiator): delta.z bumps mountingElevationMm + shifts position in plan', () => {
    const rad = makeCentredBoxEquipment<MepRadiatorEntity>('mep-radiator', 'rad_z');
    const withElev = { ...rad, params: { ...rad.params, mountingElevationMm: 200 } } as unknown as Entity;
    const patch = calculateBimMovedGeometry(withElev, { x: 1000, y: 500, z: Z }) as {
      params: { mountingElevationMm: number; position: { x: number; y: number } };
    };
    expect(patch.params.mountingElevationMm).toBe(200 + Z);
    expect(patch.params.position).toEqual({ x: 3000, y: 2500, z: 800 });
  });

  it('delta.z absent OR 0 leaves the elevation field unchanged (plan-only move)', () => {
    const noZ = calculateBimMovedGeometry(wallWithBaseOffset(250), { x: 1000, y: 0 }) as {
      params: { baseOffset: number };
    };
    expect(noZ.params.baseOffset).toBe(250);
    const zeroZ = calculateBimMovedGeometry(wallWithBaseOffset(250), { x: 1000, y: 0, z: 0 }) as {
      params: { baseOffset: number };
    };
    expect(zeroZ.params.baseOffset).toBe(250);
  });

  it('non-vertical type (furniture/roof) ignores delta.z — same coverage as the old gizmo path', () => {
    // Roof has no per-type vertical field in the unified move (out of scope, ADR-049 Φ2).
    const patch = calculateBimMovedGeometry(makeRoof() as unknown as Entity, { x: 1000, y: 500, z: Z }) as {
      params: { outline: { vertices: readonly { x: number; y: number; z?: number }[] } };
    };
    // Plan move still applies; z is silently ignored (outline vertices keep their own z=0).
    expect(patch.params.outline.vertices[0]).toEqual({ x: 1000, y: 500, z: 0 });
  });
});
