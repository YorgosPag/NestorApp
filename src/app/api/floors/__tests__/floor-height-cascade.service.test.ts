/**
 * Unit tests — floor-height-cascade.service (ADR-369 §9 Q5 + ADR-448 Phase 4)
 *
 * Verifies the "whole storey re-stretches" cascade triggered by a floor.height
 * change:
 *  - walls + columns with topBinding='storey-ceiling' → params.height
 *  - ceiling/roof slabs → params.levelElevation (ADR-448 Phase 4)
 *  - non-storey-bound structure + floor/ground/foundation slabs are skipped
 *  - idempotent no-op (already at derived value → no write, no audit)
 *  - zero-change → no batch.commit, no audit
 *  - EntityAudit recorded per updated entity (incl. entityType:'slab')
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

import { cascadeFloorHeightToEntities } from '../floor-height-cascade.service';
import { EntityAuditService } from '@/services/entity-audit.service';

const recordChange = EntityAuditService.recordChange as jest.Mock;

// ─── Minimal in-memory Firestore Admin double ────────────────────────────────

interface SeedDoc { id: string; data: Record<string, unknown>; }
type Update = { ref: { id: string; __col: string }; patch: Record<string, unknown> };

const COMPANY = 'co_1';
const FLOOR = 'floor_1';

function makeDb(store: Record<string, SeedDoc[]>, updates: Update[]) {
  const matches = (data: Record<string, unknown>, filters: Record<string, unknown>) =>
    Object.entries(filters).every(([f, v]) => data[f] === v);

  const makeQuery = (col: string, filters: Record<string, unknown> = {}) => ({
    where: (field: string, _op: string, value: unknown) =>
      makeQuery(col, { ...filters, [field]: value }),
    get: async () => ({
      docs: (store[col] ?? [])
        .filter((d) => matches(d.data, filters))
        .map((d) => ({ id: d.id, ref: { id: d.id, __col: col }, data: () => d.data })),
    }),
  });

  return {
    collection: (name: string) => makeQuery(name),
    batch: () => ({
      update: (ref: { id: string; __col: string }, patch: Record<string, unknown>) => {
        updates.push({ ref, patch });
      },
      commit: jest.fn().mockResolvedValue(undefined),
    }),
  };
}

interface RunResult {
  result: Awaited<ReturnType<typeof cascadeFloorHeightToEntities>>;
  updates: Update[];
}

async function runCascade(
  store: Record<string, SeedDoc[]>,
  newHeightMetres: number,
): Promise<RunResult> {
  const updates: Update[] = [];
  const db = makeDb(store, updates);
  // db is the in-memory double; cast through unknown — the service only touches
  // the collection/where/get + batch.update/commit surface modelled above.
  const result = await cascadeFloorHeightToEntities(
    db as unknown as Parameters<typeof cascadeFloorHeightToEntities>[0],
    FLOOR,
    COMPANY,
    newHeightMetres,
    'user_1',
  );
  return { result, updates };
}

const scoped = (params: Record<string, unknown>) => ({
  companyId: COMPANY,
  floorId: FLOOR,
  params,
});

beforeEach(() => recordChange.mockClear());

describe('cascadeFloorHeightToEntities — ADR-448 Phase 4 slab cascade', () => {
  it('re-stretches ceiling/roof slabs to floor.height*1000 (levelElevation)', async () => {
    const store: Record<string, SeedDoc[]> = {
      [COLLECTIONS.FLOORPLAN_SLABS]: [
        { id: 'slab_ceiling', data: scoped({ kind: 'ceiling', levelElevation: 3000 }) },
        { id: 'slab_roof', data: scoped({ kind: 'roof', levelElevation: 3000 }) },
      ],
    };

    const { result, updates } = await runCascade(store, 3.5);

    expect(result.slabsUpdated).toBe(2);
    expect(updates).toHaveLength(2);
    expect(updates.every((u) => u.patch['params.levelElevation'] === 3500)).toBe(true);
  });

  it('skips floor/ground/foundation slabs (not storey-height-driven)', async () => {
    const store: Record<string, SeedDoc[]> = {
      [COLLECTIONS.FLOORPLAN_SLABS]: [
        { id: 'slab_floor', data: scoped({ kind: 'floor', levelElevation: 0 }) },
        { id: 'slab_ground', data: scoped({ kind: 'ground', levelElevation: 0 }) },
        { id: 'slab_foundation', data: scoped({ kind: 'foundation', levelElevation: -200 }) },
      ],
    };

    const { result, updates } = await runCascade(store, 3.5);

    expect(result.slabsUpdated).toBe(0);
    expect(result.skipped).toBe(3);
    expect(updates).toHaveLength(0);
  });

  it('is idempotent — ceiling slab already at derived value → no write, no audit', async () => {
    const store: Record<string, SeedDoc[]> = {
      [COLLECTIONS.FLOORPLAN_SLABS]: [
        { id: 'slab_ceiling', data: scoped({ kind: 'ceiling', levelElevation: 3500 }) },
      ],
    };

    const { result, updates } = await runCascade(store, 3.5);

    expect(result.slabsUpdated).toBe(0);
    expect(updates).toHaveLength(0);
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('records an EntityAudit entry with entityType "slab" for each updated slab', async () => {
    const store: Record<string, SeedDoc[]> = {
      [COLLECTIONS.FLOORPLAN_SLABS]: [
        { id: 'slab_ceiling', data: scoped({ kind: 'ceiling', levelElevation: 3000 }) },
      ],
    };

    await runCascade(store, 4);

    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'slab',
        entityId: 'slab_ceiling',
        action: 'updated',
        changes: [expect.objectContaining({
          field: 'params.levelElevation', oldValue: 3000, newValue: 4000,
        })],
      }),
    );
  });
});

describe('cascadeFloorHeightToEntities — wall/column regression', () => {
  it('re-stretches storey-ceiling walls/columns and offsets, skips absolute', async () => {
    const store: Record<string, SeedDoc[]> = {
      [COLLECTIONS.FLOORPLAN_WALLS]: [
        { id: 'wall_ceiling', data: scoped({ topBinding: 'storey-ceiling', height: 3000 }) },
        { id: 'wall_offset', data: scoped({ topBinding: 'storey-ceiling', height: 3100, topOffset: 100 }) },
        { id: 'wall_absolute', data: scoped({ topBinding: 'absolute', height: 2400 }) },
      ],
      [COLLECTIONS.FLOORPLAN_COLUMNS]: [
        { id: 'col_ceiling', data: scoped({ topBinding: 'storey-ceiling', height: 3000 }) },
      ],
    };

    const { result, updates } = await runCascade(store, 3.5);

    expect(result.wallsUpdated).toBe(2);
    expect(result.columnsUpdated).toBe(1);
    expect(result.skipped).toBe(1); // wall_absolute
    const byId = Object.fromEntries(updates.map((u) => [u.ref.id, u.patch['params.height']]));
    expect(byId.wall_ceiling).toBe(3500);
    expect(byId.wall_offset).toBe(3600); // 3500 + 100
    expect(byId.col_ceiling).toBe(3500);
  });

  it('no-op when nothing matches — no commit-worthy entries, no audit', async () => {
    const store: Record<string, SeedDoc[]> = {
      [COLLECTIONS.FLOORPLAN_WALLS]: [
        { id: 'wall_absolute', data: scoped({ topBinding: 'absolute', height: 2400 }) },
      ],
    };

    const { result, updates } = await runCascade(store, 3.5);

    expect(
      result.wallsUpdated + result.columnsUpdated + result.slabsUpdated + result.beamsUpdated,
    ).toBe(0);
    expect(updates).toHaveLength(0);
    expect(recordChange).not.toHaveBeenCalled();
  });
});

describe('cascadeFloorHeightToEntities — ADR-448 Phase 4b frame cascade', () => {
  it('re-stretches flat beams to floor.height*1000 + offsetFromStorey (topElevation)', async () => {
    const store: Record<string, SeedDoc[]> = {
      [COLLECTIONS.FLOORPLAN_BEAMS]: [
        { id: 'beam_flat', data: scoped({ topElevation: 3000 }) },
        { id: 'beam_offset', data: scoped({ topElevation: 3200, offsetFromStorey: 200 }) },
      ],
    };

    const { result, updates } = await runCascade(store, 3.5);

    expect(result.beamsUpdated).toBe(2);
    const byId = Object.fromEntries(updates.map((u) => [u.ref.id, u.patch['params.topElevation']]));
    expect(byId.beam_flat).toBe(3500);
    expect(byId.beam_offset).toBe(3700); // 3500 + 200
    // flat beam carries no topElevationEnd → not written
    const flat = updates.find((u) => u.ref.id === 'beam_flat');
    expect(flat?.patch['params.topElevationEnd']).toBeUndefined();
  });

  it('preserves the slope span of sloped beams (topElevationEnd shifts by the same Δ)', async () => {
    const store: Record<string, SeedDoc[]> = {
      [COLLECTIONS.FLOORPLAN_BEAMS]: [
        { id: 'beam_sloped', data: scoped({ topElevation: 3000, topElevationEnd: 3200 }) },
      ],
    };

    const { result, updates } = await runCascade(store, 3.5);

    expect(result.beamsUpdated).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0].patch['params.topElevation']).toBe(3500);
    // span preserved: 3500 + (3200 − 3000) = 3700
    expect(updates[0].patch['params.topElevationEnd']).toBe(3700);
  });

  it('cascades attached columns/walls (grid-first), skips absolute/unconnected', async () => {
    const store: Record<string, SeedDoc[]> = {
      [COLLECTIONS.FLOORPLAN_WALLS]: [
        { id: 'wall_attached', data: scoped({ topBinding: 'attached', height: 3000 }) },
        { id: 'wall_unconnected', data: scoped({ topBinding: 'unconnected', height: 2800 }) },
      ],
      [COLLECTIONS.FLOORPLAN_COLUMNS]: [
        { id: 'col_attached', data: scoped({ topBinding: 'attached', height: 4000 }) },
        { id: 'col_absolute', data: scoped({ topBinding: 'absolute', height: 5000 }) },
      ],
    };

    const { result, updates } = await runCascade(store, 3.5);

    expect(result.wallsUpdated).toBe(1);
    expect(result.columnsUpdated).toBe(1);
    expect(result.skipped).toBe(2); // wall_unconnected + col_absolute
    const byId = Object.fromEntries(updates.map((u) => [u.ref.id, u.patch['params.height']]));
    expect(byId.wall_attached).toBe(3500);
    expect(byId.col_attached).toBe(3500);
    expect(byId.col_absolute).toBeUndefined();
    expect(byId.wall_unconnected).toBeUndefined();
  });

  it('is idempotent — beam already at derived value → no write, no audit', async () => {
    const store: Record<string, SeedDoc[]> = {
      [COLLECTIONS.FLOORPLAN_BEAMS]: [
        { id: 'beam_done', data: scoped({ topElevation: 3500, topElevationEnd: 3700 }) },
      ],
    };

    const { result, updates } = await runCascade(store, 3.5);

    expect(result.beamsUpdated).toBe(0);
    expect(updates).toHaveLength(0);
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('records an EntityAudit entry with entityType "beam" for each updated beam', async () => {
    const store: Record<string, SeedDoc[]> = {
      [COLLECTIONS.FLOORPLAN_BEAMS]: [
        { id: 'beam_flat', data: scoped({ topElevation: 3000 }) },
      ],
    };

    await runCascade(store, 4);

    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'beam',
        entityId: 'beam_flat',
        action: 'updated',
        changes: [expect.objectContaining({
          field: 'params.topElevation', oldValue: 3000, newValue: 4000,
        })],
      }),
    );
  });
});
