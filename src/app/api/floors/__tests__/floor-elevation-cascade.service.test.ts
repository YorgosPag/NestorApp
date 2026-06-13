/**
 * Unit tests — floor-elevation-cascade.service (ADR-450 §1)
 *
 * Verifies the Revit level-driven floor-elevation cascade triggered by a
 * floor.height change:
 *  - upper floors re-stack: elevation[i+1] = elevation[i] + height[i] (chain up)
 *  - lower floors (number ≤ changed) are never touched (datum stays put)
 *  - self-healing: a stale upper elevation is corrected in one pass
 *  - idempotent no-op (already at derived elevation → no write, no audit)
 *  - top floor changed → nothing above → no write
 *  - EntityAudit recorded per shifted floor (field 'elevation')
 */

import { COLLECTIONS } from '@/config/firestore-collections';

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'TS' },
}));

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn().mockResolvedValue('audit_1') },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { cascadeFloorElevations } from '../floor-elevation-cascade.service';
import { EntityAuditService } from '@/services/entity-audit.service';

const recordChange = EntityAuditService.recordChange as jest.Mock;

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

async function run(floors: SeedDoc[], changedFloorId: string) {
  const updates: Update[] = [];
  const db = makeDb(floors, updates);
  const result = await cascadeFloorElevations(
    db as unknown as Parameters<typeof cascadeFloorElevations>[0],
    BUILDING,
    changedFloorId,
    COMPANY,
    'user_1',
  );
  return { result, updates };
}

const floor = (id: string, number: number, elevation: number | null, height: number): SeedDoc => ({
  id,
  data: { companyId: COMPANY, buildingId: BUILDING, name: id, number, elevation, height },
});

beforeEach(() => recordChange.mockClear());

describe('cascadeFloorElevations — ADR-450 §1', () => {
  it('re-stacks upper floors after a height change (the verify root cause)', async () => {
    // floor1: el=3 h=5 (just changed to 5) · floor2: el=6 (stale, should be 8)
    const { result, updates } = await run(
      [floor('f1', 1, 3, 5), floor('f2', 2, 6, 3)],
      'f1',
    );
    expect(result.floorsUpdated).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0].ref.id).toBe('f2');
    expect(updates[0].patch.elevation).toBe(8); // 3 + 5
  });

  it('chains across multiple upper floors', async () => {
    const { updates } = await run(
      [floor('f1', 1, 0, 4), floor('f2', 2, 99, 3), floor('f3', 3, 99, 3)],
      'f1',
    );
    const byId = Object.fromEntries(updates.map((u) => [u.ref.id, u.patch.elevation]));
    expect(byId.f2).toBe(4);   // 0 + 4
    expect(byId.f3).toBe(7);   // 4 + 3
  });

  it('never touches floors below the changed one', async () => {
    const { updates } = await run(
      [floor('b1', -1, -3, 3), floor('g', 0, 0, 3), floor('u', 1, 99, 3)],
      'g',
    );
    expect(updates.map((u) => u.ref.id)).toEqual(['u']);
    expect(updates[0].patch.elevation).toBe(3); // 0 + 3
  });

  it('is idempotent — consistent stack → no write, no audit', async () => {
    const { result, updates } = await run(
      [floor('f1', 1, 3, 5), floor('f2', 2, 8, 3)],
      'f1',
    );
    expect(result.floorsUpdated).toBe(0);
    expect(updates).toHaveLength(0);
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('no-op when the top floor changes (nothing above)', async () => {
    const { result, updates } = await run(
      [floor('f1', 1, 3, 5), floor('f2', 2, 8, 3)],
      'f2',
    );
    expect(result.floorsUpdated).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it('records one audit entry per shifted floor (field elevation)', async () => {
    await run([floor('f1', 1, 0, 4), floor('f2', 2, 99, 3), floor('f3', 3, 99, 3)], 'f1');
    expect(recordChange).toHaveBeenCalledTimes(2);
    const call = recordChange.mock.calls[0][0];
    expect(call.changes[0].field).toBe('elevation');
    expect(call.action).toBe('updated');
  });
});
