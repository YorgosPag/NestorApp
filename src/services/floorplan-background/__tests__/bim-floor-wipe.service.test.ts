/**
 * Unit tests — bim-floor-wipe.service (ADR-340 replace / ADR-420 floor-scope)
 *
 * Verifies the "full replace" BIM cleanup:
 *  - wipes BIM entities across the floor-scoped collections, by floorId
 *  - leaves other floors' entities untouched (companyId + floorId scoping)
 *  - deletes only `source: 'bim-auto'` BOQ — keeps manual BOQ
 *  - idempotent on zero-state
 *  - countBimForFloor reports correct totals
 *  - best-effort per-entity audit on supported types
 */

interface SeedDoc { id: string; data: Record<string, unknown>; }

jest.mock('@/lib/firebaseAdmin', () => {
  const store: Record<string, SeedDoc[]> = {};

  const matches = (data: Record<string, unknown>, filters: Record<string, unknown>) =>
    Object.entries(filters).every(([field, value]) => data[field] === value);

  const makeQuery = (collectionName: string, filters: Record<string, unknown> = {}) => {
    const query = {
      where: (field: string, _op: string, value: unknown) =>
        makeQuery(collectionName, { ...filters, [field]: value }),
      get: async () => {
        const docs = (store[collectionName] ?? [])
          .filter((d) => matches(d.data, filters))
          .map((d) => ({
            id: d.id,
            ref: { id: d.id, __col: collectionName },
            data: () => d.data,
          }));
        return { empty: docs.length === 0, docs };
      },
      count: () => ({
        get: async () => ({
          data: () => ({
            count: (store[collectionName] ?? []).filter((d) => matches(d.data, filters)).length,
          }),
        }),
      }),
    };
    return query;
  };

  const db = {
    collection: (name: string) => makeQuery(name),
    batch: () => {
      const ops: Array<{ id: string; __col: string }> = [];
      return {
        delete: (ref: { id: string; __col: string }) => { ops.push(ref); },
        commit: async () => {
          for (const ref of ops) {
            const arr = store[ref.__col];
            if (!arr) continue;
            const idx = arr.findIndex((d) => d.id === ref.id);
            if (idx >= 0) arr.splice(idx, 1);
          }
        },
      };
    },
  };

  return {
    getAdminFirestore: () => db,
    FieldValue: { serverTimestamp: () => 'TS' },
    __store: store,
    __seed: (collectionName: string, docs: SeedDoc[]) => { store[collectionName] = docs; },
    __reset: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn().mockResolvedValue('audit_1') },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { wipeBimForFloor, countBimForFloor } from '../bim-floor-wipe.service';
import { EntityAuditService } from '@/services/entity-audit.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const adminMock = require('@/lib/firebaseAdmin') as {
  __store: Record<string, SeedDoc[]>;
  __seed: (c: string, d: SeedDoc[]) => void;
  __reset: () => void;
};

const COMPANY = 'comp_1';
const FLOOR = 'flr_target';
const OTHER_FLOOR = 'flr_other';

function bimDoc(id: string, floorId: string): SeedDoc {
  return { id, data: { companyId: COMPANY, floorId } };
}

beforeEach(() => {
  adminMock.__reset();
  (EntityAuditService.recordChange as jest.Mock).mockClear();
});

describe('wipeBimForFloor', () => {
  it('deletes BIM entities of the target floor across collections, keeps other floors', async () => {
    adminMock.__seed('floorplan_walls', [
      bimDoc('wall_1', FLOOR), bimDoc('wall_2', FLOOR), bimDoc('wall_other', OTHER_FLOOR),
    ]);
    adminMock.__seed('floorplan_columns', [bimDoc('col_1', FLOOR)]);

    const result = await wipeBimForFloor(COMPANY, FLOOR);

    expect(result.bimEntitiesDeleted).toBe(3);
    expect(adminMock.__store.floorplan_walls.map((d) => d.id)).toEqual(['wall_other']);
    expect(adminMock.__store.floorplan_columns).toHaveLength(0);
  });

  it('deletes only bim-auto BOQ, preserving manual BOQ items', async () => {
    adminMock.__seed('boq_items', [
      { id: 'boq_bim_1', data: { companyId: COMPANY, linkedFloorId: FLOOR, source: 'bim-auto' } },
      { id: 'boq_manual', data: { companyId: COMPANY, linkedFloorId: FLOOR, source: 'manual' } },
      { id: 'boq_other', data: { companyId: COMPANY, linkedFloorId: OTHER_FLOOR, source: 'bim-auto' } },
    ]);

    const result = await wipeBimForFloor(COMPANY, FLOOR);

    expect(result.boqItemsDeleted).toBe(1);
    expect(adminMock.__store.boq_items.map((d) => d.id).sort()).toEqual(['boq_manual', 'boq_other']);
  });

  it('is idempotent on zero-state', async () => {
    const result = await wipeBimForFloor(COMPANY, FLOOR);
    expect(result.bimEntitiesDeleted).toBe(0);
    expect(result.boqItemsDeleted).toBe(0);
  });

  it('records a best-effort delete audit for supported entity types', async () => {
    adminMock.__seed('floorplan_walls', [bimDoc('wall_1', FLOOR)]);

    await wipeBimForFloor(COMPANY, FLOOR, { performedBy: 'uid_1', performedByName: 'Tester' });

    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'wall', entityId: 'wall_1', action: 'deleted' }),
    );
  });

  it('does not audit when no audit context is provided', async () => {
    adminMock.__seed('floorplan_walls', [bimDoc('wall_1', FLOOR)]);
    await wipeBimForFloor(COMPANY, FLOOR);
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });
});

describe('countBimForFloor', () => {
  it('counts BIM entities and bim-auto BOQ for the floor', async () => {
    adminMock.__seed('floorplan_walls', [bimDoc('wall_1', FLOOR), bimDoc('wall_other', OTHER_FLOOR)]);
    adminMock.__seed('floorplan_slabs', [bimDoc('slab_1', FLOOR)]);
    adminMock.__seed('boq_items', [
      { id: 'boq_bim_1', data: { companyId: COMPANY, linkedFloorId: FLOOR, source: 'bim-auto' } },
      { id: 'boq_manual', data: { companyId: COMPANY, linkedFloorId: FLOOR, source: 'manual' } },
    ]);

    const counts = await countBimForFloor(COMPANY, FLOOR);

    expect(counts.bimEntityCount).toBe(2);
    expect(counts.boqItemCount).toBe(1);
  });
});
