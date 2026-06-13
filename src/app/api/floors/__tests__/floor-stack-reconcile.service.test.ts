/**
 * Unit tests — floor-stack-reconcile.service (ADR-451)
 *
 * The unified, server-authoritative floor-stack reconcile. `elevation` is the SSoT,
 * `height` the derived projection (`height[i] = elevation[i+1] − elevation[i]`).
 *
 *  - deriveAdjacentHeightsFromElevation (elevation edit = Revit «move a Level»):
 *      moving floor k re-derives exactly the storey BELOW (k−1) and storey k itself;
 *      nobody else's height changes; the topmost floor keeps its explicit height.
 *  - reconcileFloorStackAfterEdit dispatch: elevation edit → derive + per-storey
 *      entity re-stretch; height edit → ADR-450 push + changed-floor re-stretch.
 */

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'TS' },
}));

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn().mockResolvedValue('audit_1') },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

// Sub-services the dispatcher orchestrates — spied so dispatch routing is observable.
jest.mock('../floor-elevation-cascade.service', () => ({
  cascadeFloorElevations: jest.fn().mockResolvedValue({ floorsUpdated: 2, skipped: 0 }),
}));
jest.mock('../floor-height-cascade.service', () => ({
  cascadeFloorHeightToEntities: jest.fn().mockResolvedValue({
    wallsUpdated: 0, columnsUpdated: 0, slabsUpdated: 0, beamsUpdated: 0, skipped: 0,
  }),
}));

import {
  deriveAdjacentHeightsFromElevation,
  reconcileFloorStackAfterEdit,
} from '../floor-stack-reconcile.service';
import { cascadeFloorElevations } from '../floor-elevation-cascade.service';
import { cascadeFloorHeightToEntities } from '../floor-height-cascade.service';
import { EntityAuditService } from '@/services/entity-audit.service';

const recordChange = EntityAuditService.recordChange as jest.Mock;
const pushElevations = cascadeFloorElevations as jest.Mock;
const stretchEntities = cascadeFloorHeightToEntities as jest.Mock;

// ─── Minimal in-memory Firestore Admin double ────────────────────────────────

interface SeedDoc { id: string; data: Record<string, unknown>; }
type Update = { ref: { id: string }; patch: Record<string, unknown> };

const COMPANY = 'co_1';
const BUILDING = 'bldg_1';

function makeDb(floors: SeedDoc[], updates: Update[]) {
  const makeQuery = () => ({
    where: () => makeQuery(),
    get: async () => ({
      docs: floors.map((d) => ({ id: d.id, ref: { id: d.id }, data: () => d.data })),
    }),
  });
  return {
    collection: () => makeQuery(),
    batch: () => ({
      update: (ref: { id: string }, patch: Record<string, unknown>) => updates.push({ ref, patch }),
      commit: jest.fn().mockResolvedValue(undefined),
    }),
  };
}

async function runDerive(floors: SeedDoc[], changedFloorId: string) {
  const updates: Update[] = [];
  const db = makeDb(floors, updates);
  const result = await deriveAdjacentHeightsFromElevation(
    db as unknown as Parameters<typeof deriveAdjacentHeightsFromElevation>[0],
    BUILDING,
    changedFloorId,
    COMPANY,
    'user_1',
  );
  return { result, updates };
}

/** Floor with an already-persisted `elevation` (the edit landed before reconcile). */
const floor = (id: string, number: number, elevation: number | null, height: number): SeedDoc => ({
  id,
  data: { companyId: COMPANY, buildingId: BUILDING, name: id, number, elevation, height },
});

beforeEach(() => {
  recordChange.mockClear();
  pushElevations.mockClear();
  stretchEntities.mockClear();
});

describe('deriveAdjacentHeightsFromElevation — elevation-edit (Revit «move a Level»)', () => {
  it('re-derives the storey below AND the moved storey, nobody else', async () => {
    // el = [0, 3.5, 6] (floor f2 just moved 3 → 3.5); stored heights stale at 3.
    const { result, updates } = await runDerive(
      [floor('f1', 0, 0, 3), floor('f2', 1, 3.5, 3), floor('f3', 2, 6, 3)],
      'f2',
    );
    const byId = Object.fromEntries(updates.map((u) => [u.ref.id, u.patch.height]));
    expect(byId.f1).toBeCloseTo(3.5); // 3.5 − 0  (storey below)
    expect(byId.f2).toBeCloseTo(2.5); // 6 − 3.5  (moved storey)
    expect(byId.f3).toBeUndefined();  // top floor untouched
    expect(result.heightsUpdated.map((h) => h.floorId).sort()).toEqual(['f1', 'f2']);
  });

  it('moving the TOP floor re-derives only the storey below (top keeps explicit height)', async () => {
    const { result, updates } = await runDerive(
      [floor('f1', 0, 0, 3), floor('f2', 1, 3, 3), floor('f3', 2, 6.5, 3)],
      'f3',
    );
    expect(updates.map((u) => u.ref.id)).toEqual(['f2']);
    expect(updates[0].patch.height).toBeCloseTo(3.5); // 6.5 − 3
    expect(result.heightsUpdated).toHaveLength(1);
  });

  it('moving the BOTTOM floor re-derives only its own storey', async () => {
    const { updates } = await runDerive(
      [floor('f1', 0, 0.5, 3), floor('f2', 1, 3, 3), floor('f3', 2, 6, 3)],
      'f1',
    );
    expect(updates.map((u) => u.ref.id)).toEqual(['f1']);
    expect(updates[0].patch.height).toBeCloseTo(2.5); // 3 − 0.5
  });

  it('is idempotent — heights already consistent with elevations → no write, no audit', async () => {
    const { result, updates } = await runDerive(
      [floor('f1', 0, 0, 3), floor('f2', 1, 3, 3), floor('f3', 2, 6, 3)],
      'f2',
    );
    expect(result.heightsUpdated).toHaveLength(0);
    expect(updates).toHaveLength(0);
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('skips a storey whose elevation (or its neighbour above) is null', async () => {
    const { result } = await runDerive(
      [floor('f1', 0, 0, 3), floor('f2', 1, 3.5, 3), floor('f3', 2, null, 3)],
      'f2',
    );
    // below f1 derives (3.5−0); self f2 cannot derive (above f3 elevation null).
    expect(result.heightsUpdated.map((h) => h.floorId)).toEqual(['f1']);
    expect(result.skipped).toBe(1);
  });

  it('records one audit entry per re-derived storey (field height)', async () => {
    await runDerive(
      [floor('f1', 0, 0, 3), floor('f2', 1, 3.5, 3), floor('f3', 2, 6, 3)],
      'f2',
    );
    expect(recordChange).toHaveBeenCalledTimes(2);
    expect(recordChange.mock.calls[0][0].changes[0].field).toBe('height');
    expect(recordChange.mock.calls[0][0].action).toBe('updated');
  });

  it('returns empty when the changed floor is not in the building', async () => {
    const { result, updates } = await runDerive([floor('f1', 0, 0, 3)], 'missing');
    expect(result.heightsUpdated).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });
});

describe('reconcileFloorStackAfterEdit — dispatch', () => {
  const db = makeDb(
    [floor('f1', 0, 0, 3), floor('f2', 1, 3.5, 3), floor('f3', 2, 6, 3)],
    [],
  ) as unknown as Parameters<typeof reconcileFloorStackAfterEdit>[0];

  it('elevation edit → derives heights + re-stretches only those storeys (no FFL push)', async () => {
    const res = await reconcileFloorStackAfterEdit(db, BUILDING, 'f2', COMPANY, 'user_1', {
      elevationChanged: true,
      heightChanged: false,
      newHeightMetres: null,
    });
    expect(res.mode).toBe('elevation');
    expect(pushElevations).not.toHaveBeenCalled();
    // one entity re-stretch per derived storey (f1, f2)
    expect(stretchEntities).toHaveBeenCalledTimes(2);
    expect(res.heightsDerived.map((h) => h.floorId).sort()).toEqual(['f1', 'f2']);
  });

  it('height edit → re-stretches the changed floor + pushes upper FFLs (ADR-450)', async () => {
    const res = await reconcileFloorStackAfterEdit(db, BUILDING, 'f1', COMPANY, 'user_1', {
      elevationChanged: false,
      heightChanged: true,
      newHeightMetres: 3.2,
    });
    expect(res.mode).toBe('height');
    expect(stretchEntities).toHaveBeenCalledWith(db, 'f1', COMPANY, 3.2, 'user_1');
    expect(pushElevations).toHaveBeenCalledWith(db, BUILDING, 'f1', COMPANY, 'user_1');
    expect(res.elevationsPushed).toBe(2);
  });

  it('elevation wins when both fields changed', async () => {
    const res = await reconcileFloorStackAfterEdit(db, BUILDING, 'f2', COMPANY, 'user_1', {
      elevationChanged: true,
      heightChanged: true,
      newHeightMetres: 9,
    });
    expect(res.mode).toBe('elevation');
    expect(pushElevations).not.toHaveBeenCalled();
  });

  it('no-op mode when nothing structural changed', async () => {
    const res = await reconcileFloorStackAfterEdit(db, BUILDING, 'f1', COMPANY, 'user_1', {
      elevationChanged: false,
      heightChanged: false,
      newHeightMetres: null,
    });
    expect(res.mode).toBe('none');
    expect(stretchEntities).not.toHaveBeenCalled();
    expect(pushElevations).not.toHaveBeenCalled();
  });
});
