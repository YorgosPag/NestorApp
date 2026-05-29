/**
 * ADR-396 P7 Part B — Tests για envelope-boq-sync.
 *
 * computeEnvelopeZoneAreas (pure): per-zone m² aggregation.
 * syncEnvelopeBoq (Firestore-mock, mirror stair-boq-sync): per-zone+floor rows,
 * deterministic ids, OIK-10.05 mapping, orphan cleanup (zone off → delete),
 * detach guard, createdAt preservation, missing scope → no I/O.
 */

import {
  computeEnvelopeZoneAreas,
  syncEnvelopeBoq,
  envelopeZoneBoqId,
} from '../envelope-boq-sync';
import type { AnySceneEntity } from '../../../types/entities';
import type { Point3D } from '../../types/bim-base';
import type { WallParams } from '../../types/wall-types';
import type { ThermalEnvelopeSpec } from '../../types/thermal-envelope-types';
import type { StoreyRef } from '../../utils/bim-floor-utils';

// ─── Mock Firestore (mirror stair-boq-sync.test) ──────────────────────────────

const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockDoc = jest.fn((_, __, id) => ({ id, __ref: id }));

jest.mock('firebase/firestore', () => ({
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...(args as [unknown, unknown, unknown])),
}));

jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('@/config/firestore-collections', () => ({ COLLECTIONS: { BOQ_ITEMS: 'boq_items' } }));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn() }) }));
jest.mock('@/lib/date-local', () => ({ nowISO: () => '2026-05-29T00:00:00.000Z' }));
jest.mock('@/utils/firestore-sanitize', () => ({ stripUndefinedDeep: (v: unknown) => v }));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function spec(overrides: Partial<ThermalEnvelopeSpec> = {}): ThermalEnvelopeSpec {
  return {
    materialId: 'mat-eps-graphite', thickness_m: 0.1, revealThickness_m: 0.05,
    zones: { Z1: true, Z2: true, Z3: true, Z4: true }, ...overrides,
  };
}

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
function squareWalls(): AnySceneEntity[] {
  const p = (x: number, y: number): Point3D => ({ x, y, z: 0 });
  return [
    wallEntity('w1', p(0, 0), p(10000, 0)),
    wallEntity('w2', p(10000, 0), p(10000, 10000)),
    wallEntity('w3', p(10000, 10000), p(0, 10000)),
    wallEntity('w4', p(0, 10000), p(0, 0)),
  ];
}
function slabTop(id: string): AnySceneEntity {
  return {
    id, type: 'slab', kind: 'floor', floorId: 'f1',
    params: { levelElevation: 3000, thickness: 200, storeyId: 'f1' },
    geometry: { area: 100, netArea: 100 },
  } as unknown as AnySceneEntity;
}
function opening(id: string, wallId: string): AnySceneEntity {
  return {
    id, type: 'opening', kind: 'window',
    params: { wallId, offsetFromStart: 1000, width: 1200, height: 1400, sillHeight: 900 },
  } as unknown as AnySceneEntity;
}

const storeys: StoreyRef[] = [{ id: 'f0', elevation: 0 }, { id: 'f1', elevation: 3 }];
const ctx = { companyId: 'c1', projectId: 'p1', buildingId: 'b1', floorId: 'f1' };

function makeSnap(exists: boolean, data?: Record<string, unknown>) {
  return { exists: () => exists, data: () => data ?? {} };
}
function payloadById(id: string): Record<string, unknown> | undefined {
  const call = mockSetDoc.mock.calls.find((c) => (c[0] as { id: string }).id === id);
  return call?.[1] as Record<string, unknown> | undefined;
}

// ─── computeEnvelopeZoneAreas ─────────────────────────────────────────────────

describe('computeEnvelopeZoneAreas', () => {
  it('Z1 facade > 0, Z3 = slab netArea, Z4 = reveal strips area', () => {
    const entities = [...squareWalls(), slabTop('s1'), opening('o1', 'w1')];
    const areas = computeEnvelopeZoneAreas(entities, storeys, spec());
    expect(areas.Z1).toBeGreaterThan(100); // ~perimeter(40m+) × 3m
    expect(areas.Z2).toBe(0);
    expect(areas.Z3).toBe(100);
    expect(areas.Z4).toBeCloseTo(1.04, 6); // 2·(1.2+1.4)·0.2
  });

  it('zones off → 0', () => {
    const entities = [...squareWalls(), slabTop('s1'), opening('o1', 'w1')];
    const areas = computeEnvelopeZoneAreas(
      entities, storeys, spec({ zones: { Z1: false, Z2: false, Z3: false, Z4: false } }),
    );
    expect(areas).toEqual({ Z1: 0, Z2: 0, Z3: 0, Z4: 0 });
  });
});

// ─── syncEnvelopeBoq ──────────────────────────────────────────────────────────

describe('syncEnvelopeBoq', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDoc.mockResolvedValue(makeSnap(false));
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  it('writes one row per active zone με OIK-10.05 + envelope discriminator', async () => {
    const entities = [...squareWalls(), slabTop('s1'), opening('o1', 'w1')];
    await syncEnvelopeBoq(entities, storeys, spec(), ctx);

    // Z1 + Z3 + Z4 active (Z2 area 0, no existing → no write/delete)
    expect(mockSetDoc).toHaveBeenCalledTimes(3);
    const z1 = payloadById('boq_env_f1_Z1')!;
    expect(z1.categoryCode).toBe('OIK-10.05');
    expect(z1.unit).toBe('m2');
    expect(z1.sourceType).toBe('bim-auto');
    expect(z1.sourceEntityType).toBe('envelope');
    expect(z1.scope).toBe('floor');
    expect(z1.linkedFloorId).toBe('f1');
    expect(payloadById('boq_env_f1_Z3')!.estimatedQuantity).toBe(100);
    expect(payloadById('boq_env_f1_Z4')!.estimatedQuantity).toBeCloseTo(1.04, 6);
    expect(payloadById('boq_env_f1_Z2')).toBeUndefined();
  });

  it('orphan cleanup — ζώνη off + υπάρχουσα γραμμή → delete', async () => {
    mockGetDoc.mockImplementation((ref: { id?: string }) =>
      Promise.resolve(ref.id === 'boq_env_f1_Z4' ? makeSnap(true, { detached: false }) : makeSnap(false)),
    );
    const entities = [...squareWalls(), opening('o1', 'w1')];
    await syncEnvelopeBoq(entities, storeys, spec({ zones: { Z1: true, Z2: true, Z3: true, Z4: false } }), ctx);
    expect((mockDeleteDoc.mock.calls[0][0] as { id: string }).id).toBe('boq_env_f1_Z4');
  });

  it('detached row never overwritten', async () => {
    mockGetDoc.mockImplementation((ref: { id?: string }) =>
      Promise.resolve(ref.id === 'boq_env_f1_Z1' ? makeSnap(true, { detached: true }) : makeSnap(false)),
    );
    const entities = [...squareWalls(), slabTop('s1')];
    await syncEnvelopeBoq(entities, storeys, spec(), ctx);
    expect(payloadById('boq_env_f1_Z1')).toBeUndefined();
  });

  it('preserves createdAt from existing row', async () => {
    const created = '2026-03-01T00:00:00Z';
    mockGetDoc.mockImplementation((ref: { id?: string }) =>
      Promise.resolve(ref.id === 'boq_env_f1_Z3' ? makeSnap(true, { detached: false, createdAt: created }) : makeSnap(false)),
    );
    const entities = [...squareWalls(), slabTop('s1')];
    await syncEnvelopeBoq(entities, storeys, spec(), ctx);
    expect(payloadById('boq_env_f1_Z3')!.createdAt).toBe(created);
  });

  it('missing floorId → no Firestore I/O', async () => {
    const entities = [...squareWalls(), slabTop('s1')];
    await syncEnvelopeBoq(entities, storeys, spec(), { ...ctx, floorId: '' });
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

// ─── envelopeZoneBoqId ────────────────────────────────────────────────────────

describe('envelopeZoneBoqId', () => {
  it('builds boq_env_<floorId>_<zone>', () => {
    expect(envelopeZoneBoqId('f7', 'Z1')).toBe('boq_env_f7_Z1');
    expect(envelopeZoneBoqId('f7', 'Z4')).toBe('boq_env_f7_Z4');
  });
});
