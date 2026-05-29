/**
 * ADR-396 P7 Part B — Tests για envelope-element-applicator (PURE).
 *
 * Καλύπτει: Z1 proximity (εξωτ./εσωτ. κολώνα+δοκάρι + tolerance), Z2/Z3 slab
 * classification, Z4 opening σε εξωτ. host wall, zone gates → clear, idempotent
 * dequal-skip, και το `applyAssignmentsToEntities` patch/changed contract.
 */

import {
  computeEnvelopeAssignments,
  applyAssignmentsToEntities,
} from '../envelope-element-applicator';
import type { AnySceneEntity } from '../../../types/entities';
import type { Point3D } from '../../types/bim-base';
import type { WallParams } from '../../types/wall-types';
import type { ThermalEnvelopeSpec } from '../../types/thermal-envelope-types';
import type { StoreyRef } from '../../utils/bim-floor-utils';

// ─── Spec + storeys ──────────────────────────────────────────────────────────

function spec(overrides: Partial<ThermalEnvelopeSpec> = {}): ThermalEnvelopeSpec {
  return {
    materialId: 'mat-eps-graphite',
    thickness_m: 0.1,
    revealThickness_m: 0.05,
    zones: { Z1: true, Z2: true, Z3: true, Z4: true },
    ...overrides,
  };
}

// ─── Entity builders (cast — guards only check `.type`) ───────────────────────

function wallParams(start: Point3D, end: Point3D): WallParams {
  return {
    category: 'exterior', start, end, height: 3000, thickness: 200, flip: false,
    sceneUnits: 'mm', baseBinding: 'storey-floor', topBinding: 'storey-ceiling',
    baseOffset: 0, topOffset: 0,
  };
}

function wallEntity(id: string, start: Point3D, end: Point3D): AnySceneEntity {
  return { id, type: 'wall', kind: 'straight', params: wallParams(start, end) } as unknown as AnySceneEntity;
}

/** Κλειστό τετράγωνο 10000×10000 (mm), 4 τοίχοι w1..w4. */
function squareWalls(): AnySceneEntity[] {
  const p = (x: number, y: number): Point3D => ({ x, y, z: 0 });
  return [
    wallEntity('w1', p(0, 0), p(10000, 0)),
    wallEntity('w2', p(10000, 0), p(10000, 10000)),
    wallEntity('w3', p(10000, 10000), p(0, 10000)),
    wallEntity('w4', p(0, 10000), p(0, 0)),
  ];
}

function columnAt(id: string, cx: number, cy: number, envelopeLayer?: unknown): AnySceneEntity {
  const v: Point3D[] = [
    { x: cx - 200, y: cy - 200 }, { x: cx + 200, y: cy - 200 },
    { x: cx + 200, y: cy + 200 }, { x: cx - 200, y: cy + 200 },
  ];
  return {
    id, type: 'column', kind: 'rectangular',
    params: { sceneUnits: 'mm', ...(envelopeLayer ? { envelopeLayer } : {}) },
    geometry: { footprint: { vertices: v }, area: 0.16, volume: 0.48, height: 3000 },
  } as unknown as AnySceneEntity;
}

function beamAt(id: string, a: Point3D, b: Point3D): AnySceneEntity {
  return {
    id, type: 'beam', kind: 'straight',
    params: { sceneUnits: 'mm' },
    geometry: { axisPolyline: { points: [a, b] } },
  } as unknown as AnySceneEntity;
}

function slabAt(id: string, levelElevation: number, storeyId?: string): AnySceneEntity {
  return {
    id, type: 'slab', kind: 'floor', floorId: storeyId,
    params: { levelElevation, thickness: 200, storeyId },
    geometry: { area: 100, netArea: 100 },
  } as unknown as AnySceneEntity;
}

function openingAt(id: string, wallId: string): AnySceneEntity {
  return {
    id, type: 'opening', kind: 'window',
    params: { wallId, offsetFromStart: 1000, width: 1200, height: 1400, sillHeight: 900 },
  } as unknown as AnySceneEntity;
}

// ─── Z1 columns / beams ───────────────────────────────────────────────────────

describe('computeEnvelopeAssignments — Z1 columns/beams', () => {
  it('εξωτερική κολώνα (πάνω στη γραμμή τοίχου) παίρνει Z1 layer, εσωτερική όχι', () => {
    const entities = [...squareWalls(), columnAt('cExt', 0, 5000), columnAt('cInt', 5000, 5000)];
    const a = computeEnvelopeAssignments(spec(), entities, []);
    const ext = a.find((x) => x.entityId === 'cExt');
    const int = a.find((x) => x.entityId === 'cInt');
    expect(ext?.layer).toEqual({ materialId: 'mat-eps-graphite', thickness_m: 0.1, zone: 'Z1' });
    expect(int?.layer).toBeUndefined();
  });

  it('εξωτερικό δοκάρι (άξονας κατά μήκος τοίχου) παίρνει Z1', () => {
    const entities = [...squareWalls(), beamAt('bExt', { x: 0, y: 0, z: 0 }, { x: 0, y: 10000, z: 0 })];
    const a = computeEnvelopeAssignments(spec(), entities, []);
    expect(a.find((x) => x.entityId === 'bExt')?.layer?.zone).toBe('Z1');
  });

  it('Z1 zone off → καμία κολώνα δεν παίρνει layer (clear)', () => {
    const entities = [...squareWalls(), columnAt('cExt', 0, 5000)];
    const a = computeEnvelopeAssignments(spec({ zones: { Z1: false, Z2: true, Z3: true, Z4: true } }), entities, []);
    expect(a.find((x) => x.entityId === 'cExt')?.layer).toBeUndefined();
  });
});

// ─── Z2 / Z3 slabs ────────────────────────────────────────────────────────────

describe('computeEnvelopeAssignments — Z2/Z3 slabs', () => {
  const storeys: StoreyRef[] = [
    { id: 'f0', elevation: 0 },
    { id: 'f1', elevation: 3 },
  ];

  it('πλάκα δώματος (κανένας όροφος πάνω) → Z3', () => {
    const entities = [slabAt('sTop', 6000, 'f1')];
    const a = computeEnvelopeAssignments(spec(), entities, storeys);
    expect(a.find((x) => x.entityId === 'sTop')?.layer?.zone).toBe('Z3');
  });

  it('Z3 off → η πλάκα δώματος καθαρίζεται', () => {
    const entities = [slabAt('sTop', 6000, 'f1')];
    const a = computeEnvelopeAssignments(spec({ zones: { Z1: true, Z2: true, Z3: false, Z4: true } }), entities, storeys);
    expect(a.find((x) => x.entityId === 'sTop')?.layer).toBeUndefined();
  });
});

// ─── Z4 openings ──────────────────────────────────────────────────────────────

describe('computeEnvelopeAssignments — Z4 openings', () => {
  it('άνοιγμα σε εξωτερικό τοίχο → reveal Z4· σε άγνωστο τοίχο → όχι', () => {
    const entities = [...squareWalls(), openingAt('oExt', 'w1'), openingAt('oOrphan', 'wX')];
    const a = computeEnvelopeAssignments(spec(), entities, []);
    expect(a.find((x) => x.entityId === 'oExt')?.reveal).toEqual({
      materialId: 'mat-eps-graphite', thickness_m: 0.05, zone: 'Z4',
    });
    expect(a.find((x) => x.entityId === 'oOrphan')?.reveal).toBeUndefined();
  });

  it('Z4 off → κανένα reveal', () => {
    const entities = [...squareWalls(), openingAt('oExt', 'w1')];
    const a = computeEnvelopeAssignments(spec({ zones: { Z1: true, Z2: true, Z3: true, Z4: false } }), entities, []);
    expect(a.find((x) => x.entityId === 'oExt')?.reveal).toBeUndefined();
  });
});

// ─── applyAssignmentsToEntities ───────────────────────────────────────────────

describe('applyAssignmentsToEntities', () => {
  it('γράφει το layer + επιστρέφει μόνο τα changed', () => {
    const entities = [...squareWalls(), columnAt('cExt', 0, 5000)];
    const a = computeEnvelopeAssignments(spec(), entities, []);
    const { entities: next, changed } = applyAssignmentsToEntities(entities, a);
    expect(changed).toHaveLength(1);
    expect(changed[0].id).toBe('cExt');
    const col = next.find((e) => e.id === 'cExt') as unknown as { params: { envelopeLayer?: unknown } };
    expect(col.params.envelopeLayer).toEqual({ materialId: 'mat-eps-graphite', thickness_m: 0.1, zone: 'Z1' });
  });

  it('idempotent — re-apply ίδιου spec → καμία αλλαγή', () => {
    const layer = { materialId: 'mat-eps-graphite', thickness_m: 0.1, zone: 'Z1' };
    const entities = [...squareWalls(), columnAt('cExt', 0, 5000, layer)];
    const a = computeEnvelopeAssignments(spec(), entities, []);
    const { changed } = applyAssignmentsToEntities(entities, a);
    expect(changed).toHaveLength(0);
  });

  it('clear — κολώνα με layer + Z1 off → αφαιρείται το πεδίο (changed)', () => {
    const layer = { materialId: 'mat-eps-graphite', thickness_m: 0.1, zone: 'Z1' };
    const entities = [...squareWalls(), columnAt('cExt', 0, 5000, layer)];
    const a = computeEnvelopeAssignments(spec({ zones: { Z1: false, Z2: true, Z3: true, Z4: true } }), entities, []);
    const { entities: next, changed } = applyAssignmentsToEntities(entities, a);
    expect(changed).toHaveLength(1);
    const col = next.find((e) => e.id === 'cExt') as unknown as { params: Record<string, unknown> };
    expect('envelopeLayer' in col.params).toBe(false);
  });
});
