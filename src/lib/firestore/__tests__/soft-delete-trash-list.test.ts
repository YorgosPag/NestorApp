/**
 * Trash-list SSoT (ADR-697) — contract, query and exhaustiveness.
 *
 * The `describe('wire contract')` block hard-codes the five response keys on
 * purpose. They are what `EntityTrashSpec.selectItems` unwraps on the client;
 * a "tidier" rename here is a silently broken trash view, and this block is the
 * thing that says so out loud.
 */

import fs from 'fs';
import path from 'path';

// The engine's mutation half reaches firebase-admin (→ the ESM-only `jose`),
// which jest cannot load. `listTrashed` touches none of it: the collaborators
// below are stubbed so the read path can be tested where it actually lives,
// rather than being split out of ADR-281's "one mechanism" to suit the runner.
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: jest.fn(), delete: jest.fn() },
}));
jest.mock('../deletion-guard', () => ({ executeDeletion: jest.fn() }));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn().mockResolvedValue(undefined) },
  resolveUserDisplayName: jest.fn(),
}));

import {
  SOFT_DELETE_CONFIG,
  TRASHED_STATUS,
  getTrashListConfig,
  listTrashListableEntities,
} from '../soft-delete-config';
import { listTrashed } from '../soft-delete-engine';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

// ============================================================================
// Fake Firestore — records the query it was asked to build
// ============================================================================

interface RecordedFilter {
  field: string;
  op: string;
  value: unknown;
}

function fakeDb(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const recorded = { collection: '', filters: [] as RecordedFilter[] };

  const query = {
    where(field: string, op: string, value: unknown) {
      recorded.filters.push({ field, op, value });
      return query;
    },
    get: async () => ({
      docs: docs.map(d => ({ id: d.id, data: () => d.data })),
    }),
  };

  const db = {
    collection(name: string) {
      recorded.collection = name;
      return query;
    },
  } as unknown as FirebaseFirestore.Firestore;

  return { db, recorded };
}

// ============================================================================

describe('trash-list config — wire contract (frozen)', () => {
  const EXPECTED_RESPONSE_KEYS: Record<string, string> = {
    building: 'buildings',
    project: 'projects',
    property: 'properties',
    parking: 'parkingSpots',
    storage: 'storages',
  };

  it.each(Object.entries(EXPECTED_RESPONSE_KEYS))(
    "%s answers under the key '%s'",
    (entityType, expectedKey) => {
      expect(getTrashListConfig(entityType as SoftDeletableEntityType)?.responseKey).toBe(
        expectedKey,
      );
    },
  );

  it('guards the bin with a view permission, never a delete permission', () => {
    for (const entityType of listTrashListableEntities()) {
      const trashList = getTrashListConfig(entityType);

      expect(trashList?.viewPermission).toMatch(/:view$/);
      expect(trashList?.viewPermission).not.toBe(SOFT_DELETE_CONFIG[entityType].permission);
    }
  });

  it('sorts parking by number and every other bin by name', () => {
    expect(getTrashListConfig('parking')?.sortField).toBe('number');

    for (const entityType of listTrashListableEntities()) {
      if (entityType === 'parking') continue;
      expect(getTrashListConfig(entityType)?.sortField).toBe('name');
    }
  });

  it('gives contact no trash list — its bin is filtered client-side', () => {
    expect(getTrashListConfig('contact')).toBeUndefined();
    expect(listTrashListableEntities()).not.toContain('contact');
  });

  it('names a distinct logger per entity so server logs stay greppable', () => {
    const names = listTrashListableEntities().map(e => getTrashListConfig(e)?.loggerName);

    expect(new Set(names).size).toBe(names.length);
  });
});

describe('listTrashed — query', () => {
  it('scopes to the company and to trashed rows only', async () => {
    const { db, recorded } = fakeDb([]);

    await listTrashed(db, 'building', 'comp_1');

    expect(recorded.collection).toBe(SOFT_DELETE_CONFIG.building.collection);
    expect(recorded.filters).toEqual([
      { field: 'companyId', op: '==', value: 'comp_1' },
      { field: 'status', op: '==', value: TRASHED_STATUS },
    ]);
  });

  it('never widens the query when asked for a different company', async () => {
    const { db, recorded } = fakeDb([]);

    await listTrashed(db, 'storage', 'comp_other');

    expect(recorded.filters[0]).toEqual({ field: 'companyId', op: '==', value: 'comp_other' });
  });

  it('folds the document id into each row', async () => {
    const { db } = fakeDb([{ id: 'bld_1', data: { name: 'Alpha', floors: 3 } }]);

    const rows = await listTrashed(db, 'building', 'comp_1');

    expect(rows).toEqual([{ id: 'bld_1', name: 'Alpha', floors: 3 }]);
  });

  it('refuses an entity that publishes no trash list', async () => {
    const { db } = fakeDb([]);

    await expect(listTrashed(db, 'contact', 'comp_1')).rejects.toThrow(
      /does not publish a trash list/,
    );
  });
});

describe('listTrashed — ordering', () => {
  it('sorts by the configured field', async () => {
    const { db } = fakeDb([
      { id: '1', data: { name: 'Gamma' } },
      { id: '2', data: { name: 'Alpha' } },
      { id: '3', data: { name: 'Beta' } },
    ]);

    const rows = await listTrashed(db, 'building', 'comp_1');

    expect(rows.map(r => r.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('sorts parking by number, not by name', async () => {
    const { db } = fakeDb([
      { id: '1', data: { number: 'P-20', name: 'Zeta' } },
      { id: '2', data: { number: 'P-10', name: 'Alpha' } },
    ]);

    const rows = await listTrashed(db, 'parking', 'comp_1');

    expect(rows.map(r => r.number)).toEqual(['P-10', 'P-20']);
  });

  it('puts rows missing the sort field first, as the routes always did', async () => {
    const { db } = fakeDb([
      { id: '1', data: { name: 'Alpha' } },
      { id: '2', data: {} },
      { id: '3', data: { name: 42 } },
    ]);

    const rows = await listTrashed(db, 'building', 'comp_1');

    expect(rows.map(r => r.id).slice(0, 2).sort()).toEqual(['2', '3']);
    expect(rows[2].id).toBe('1');
  });
});

// ============================================================================
// Exhaustiveness anchor — config and routes may not drift apart
// ============================================================================

describe('trash routes ↔ config (anchor)', () => {
  const API_DIR = path.join(process.cwd(), 'src', 'app', 'api');

  /** Every `src/app/api/<segment>/trash/route.ts`, mapped to its factory argument. */
  function readRouteEntities(): Array<{ segment: string; entityType: string | null }> {
    return fs
      .readdirSync(API_DIR, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => ({
        segment: entry.name,
        file: path.join(API_DIR, entry.name, 'trash', 'route.ts'),
      }))
      .filter(candidate => fs.existsSync(candidate.file))
      .map(candidate => {
        const source = fs.readFileSync(candidate.file, 'utf8');
        const match = source.match(/createTrashListRoute\(\s*'([a-z]+)'\s*\)/);
        return { segment: candidate.segment, entityType: match ? match[1] : null };
      });
  }

  it('routes every configured entity — and configures every route', () => {
    const routed = readRouteEntities();

    expect(routed.map(r => r.entityType).filter(Boolean).sort()).toEqual(
      [...listTrashListableEntities()].sort(),
    );
  });

  it('leaves no trash route hand-rolled outside the factory', () => {
    const handRolled = readRouteEntities().filter(r => r.entityType === null);

    expect(handRolled.map(r => r.segment)).toEqual([]);
  });
});
