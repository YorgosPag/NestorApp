/**
 * ADR-628 — createBimBoqAuditLifecycle unit tests.
 *
 * Coverage (the invariant audit + BOQ triplet shared by the 5 MEP persistence hooks):
 *   - onPersisted: created/updated audit + BOQ upsert, guarded on company+project+building
 *   - onDeleted: deleted audit (entity snapshot vs fallback kind) + BOQ delete, guarded on company
 *   - onRestored: restored audit
 *   - boqPayload: default { id, kind } vs per-entity override (underfloor lengthM)
 */

import { createBimBoqAuditLifecycle } from '../create-bim-boq-audit-lifecycle';
import type { BimPersistenceScope } from '../bim-entity-persistence-hook-types';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUpsert = jest.fn<Promise<void>, [string, unknown, unknown, string]>().mockResolvedValue(undefined);
const mockDelete = jest.fn<Promise<void>, [string, string]>().mockResolvedValue(undefined);
jest.mock('../../../bim/services/BimToBoqBridge', () => ({
  bimToBoqBridge: {
    upsertBoqItemForBim: (...a: unknown[]) => mockUpsert(...(a as [string, unknown, unknown, string])),
    deleteBoqItemForBim: (...a: unknown[]) => mockDelete(...(a as [string, string])),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

interface FakeEntity {
  readonly id: string;
  readonly kind: string;
  readonly layerId: string;
  readonly params: { readonly power: number };
  readonly geometry: { readonly totalLengthM: number };
}

function fakeEntity(id: string): FakeEntity {
  return { id, kind: 'wall-boiler', layerId: '0', params: { power: 24 }, geometry: { totalLengthM: 42 } };
}

function scope(overrides?: Partial<BimPersistenceScope>): BimPersistenceScope {
  return {
    companyId: 'co-1',
    projectId: 'proj-1',
    floorplanId: 'fp-1',
    buildingId: 'bld-1',
    floorId: 'floor-1',
    levelManager: {} as unknown as BimPersistenceScope['levelManager'],
    ...overrides,
  };
}

const recordChange = jest.fn();

function makeLifecycle(override?: { boqPayload?: (e: FakeEntity) => { id: string; kind: string; geometry?: { lengthM?: number } } }) {
  return createBimBoqAuditLifecycle<FakeEntity>({
    boqType: 'mep-boiler',
    recordChange,
    deletedFallbackKind: 'wall-boiler',
    ...override,
  });
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createBimBoqAuditLifecycle — onPersisted', () => {
  it('records created + upserts BOQ (default { id, kind }) on first save', () => {
    const lc = makeLifecycle();
    const e = fakeEntity('b1');
    lc.onPersisted(e, { isNew: true, prevComparable: null, scope: scope(), extra: undefined });

    expect(recordChange).toHaveBeenCalledWith('created', e, { prevParams: undefined });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      'mep-boiler',
      { id: 'b1', kind: 'wall-boiler' },
      { companyId: 'co-1', projectId: 'proj-1', buildingId: 'bld-1', floorId: 'floor-1' },
      'created',
    );
  });

  it('records updated + upserts BOQ with prevParams on re-save', () => {
    const lc = makeLifecycle();
    const e = fakeEntity('b1');
    lc.onPersisted(e, { isNew: false, prevComparable: { power: 18 }, scope: scope(), extra: undefined });

    expect(recordChange).toHaveBeenCalledWith('updated', e, { prevParams: { power: 18 } });
    expect(mockUpsert).toHaveBeenCalledWith('mep-boiler', expect.anything(), expect.anything(), 'updated');
  });

  it('skips BOQ upsert when buildingId is missing (still audits)', () => {
    const lc = makeLifecycle();
    lc.onPersisted(fakeEntity('b1'), { isNew: true, prevComparable: null, scope: scope({ buildingId: null }), extra: undefined });

    expect(recordChange).toHaveBeenCalledWith('created', expect.anything(), expect.anything());
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('uses a per-entity boqPayload override (underfloor developed length)', () => {
    const lc = makeLifecycle({
      boqPayload: (e) => ({ id: e.id, kind: e.kind, geometry: { lengthM: e.geometry.totalLengthM } }),
    });
    lc.onPersisted(fakeEntity('u1'), { isNew: true, prevComparable: null, scope: scope(), extra: undefined });

    expect(mockUpsert).toHaveBeenCalledWith(
      'mep-boiler',
      { id: 'u1', kind: 'wall-boiler', geometry: { lengthM: 42 } },
      expect.anything(),
      'created',
    );
  });
});

describe('createBimBoqAuditLifecycle — onDeleted', () => {
  it('records deleted from the entity snapshot + removes the BOQ row', () => {
    const lc = makeLifecycle();
    const e = fakeEntity('b1');
    lc.onDeleted('b1', e, { scope: scope(), extra: undefined, lastSavedComparable: null });

    expect(recordChange).toHaveBeenCalledWith('deleted', { id: 'b1', kind: 'wall-boiler', layerId: '0', params: { power: 24 } });
    expect(mockDelete).toHaveBeenCalledWith('b1', 'co-1');
  });

  it('falls back to the configured kind when the entity is already gone', () => {
    const lc = makeLifecycle();
    lc.onDeleted('b1', null, { scope: scope(), extra: undefined, lastSavedComparable: null });

    expect(recordChange).toHaveBeenCalledWith('deleted', { id: 'b1', kind: 'wall-boiler' });
  });

  it('skips the BOQ delete when companyId is missing (still audits)', () => {
    const lc = makeLifecycle();
    lc.onDeleted('b1', null, { scope: scope({ companyId: null }), extra: undefined, lastSavedComparable: null });

    expect(recordChange).toHaveBeenCalledWith('deleted', expect.anything());
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe('createBimBoqAuditLifecycle — onRestored', () => {
  it('records restored', () => {
    const lc = makeLifecycle();
    const e = fakeEntity('b1');
    lc.onRestored(e, { scope: scope(), extra: undefined });

    expect(recordChange).toHaveBeenCalledWith('restored', e);
  });
});

// ADR-684 Φ4-C — optional recordChange: BOQ-only entities (generic-solid) omit the audit client.
describe('createBimBoqAuditLifecycle — BOQ-only (no recordChange)', () => {
  function boqOnly() {
    return createBimBoqAuditLifecycle<FakeEntity>({
      boqType: 'generic-solid',
      deletedFallbackKind: 'wall-boiler',
      boqPayload: (e) => ({ id: e.id, kind: e.kind }),
    });
  }

  it('upserts the BOQ row without an audit call and without throwing', () => {
    const lc = boqOnly();
    expect(() =>
      lc.onPersisted(fakeEntity('g1'), { isNew: true, prevComparable: null, scope: scope(), extra: undefined }),
    ).not.toThrow();
    expect(recordChange).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith('generic-solid', { id: 'g1', kind: 'wall-boiler' }, expect.anything(), 'created');
  });

  it('deletes the BOQ row without an audit call', () => {
    const lc = boqOnly();
    expect(() => lc.onDeleted('g1', fakeEntity('g1'), { scope: scope(), extra: undefined, lastSavedComparable: null })).not.toThrow();
    expect(recordChange).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith('g1', 'co-1');
  });

  it('onRestored is a no-op (no audit, no throw)', () => {
    const lc = boqOnly();
    expect(() => lc.onRestored(fakeEntity('g1'), { scope: scope(), extra: undefined })).not.toThrow();
    expect(recordChange).not.toHaveBeenCalled();
  });
});
