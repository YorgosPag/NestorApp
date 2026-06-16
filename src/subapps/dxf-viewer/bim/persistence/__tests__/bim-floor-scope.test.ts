/**
 * ADR-420 — bim-floor-scope SSoT unit tests.
 *
 * Covers:
 *   - resolveBimScope: prefers stable `floorId`, falls back to `floorplanId`.
 *   - buildBimScopeConstraints: always emits projectId + the resolved scope
 *     key; never emits companyId (auto-injected upstream by firestoreQueryService).
 *   - bimScopeWriteFields: always writes floorplanId provenance; writes floorId
 *     only when bound.
 */

interface MockWhere {
  readonly __type: 'where';
  readonly field: string;
  readonly op: string;
  readonly value: unknown;
}

jest.mock('firebase/firestore', () => ({
  where: (field: string, op: string, value: unknown): MockWhere => ({
    __type: 'where',
    field,
    op,
    value,
  }),
}));

import {
  resolveBimScope,
  buildBimScopeConstraints,
  bimScopeWriteFields,
  resolveBimPersistenceScope,
} from '../bim-floor-scope';

const asWhere = (c: unknown): MockWhere => c as unknown as MockWhere;

describe('resolveBimScope', () => {
  it('prefers the stable floorId when present', () => {
    expect(
      resolveBimScope({ projectId: 'p1', floorplanId: 'file_x', floorId: 'flr_1' }),
    ).toEqual({ key: 'floorId', value: 'flr_1' });
  });

  it('falls back to floorplanId when no floor is bound', () => {
    expect(resolveBimScope({ projectId: 'p1', floorplanId: 'file_x' })).toEqual({
      key: 'floorplanId',
      value: 'file_x',
    });
  });

  it('treats empty-string floorId as unbound (fallback)', () => {
    expect(
      resolveBimScope({ projectId: 'p1', floorplanId: 'file_x', floorId: '' }),
    ).toEqual({ key: 'floorplanId', value: 'file_x' });
  });
});

describe('buildBimScopeConstraints', () => {
  it('emits projectId + floorId (no companyId) on a floor-bound canvas', () => {
    const cs = buildBimScopeConstraints({
      projectId: 'p1',
      floorplanId: 'file_x',
      floorId: 'flr_1',
    }).map(asWhere);
    expect(cs).toHaveLength(2);
    expect(cs[0]).toMatchObject({ field: 'projectId', op: '==', value: 'p1' });
    expect(cs[1]).toMatchObject({ field: 'floorId', op: '==', value: 'flr_1' });
    expect(cs.some((c) => c.field === 'companyId')).toBe(false);
  });

  it('falls back to floorplanId scope on a floor-less canvas', () => {
    const cs = buildBimScopeConstraints({ projectId: 'p1', floorplanId: 'file_x' }).map(
      asWhere,
    );
    expect(cs[1]).toMatchObject({ field: 'floorplanId', op: '==', value: 'file_x' });
  });
});

describe('bimScopeWriteFields', () => {
  it('always writes floorplanId provenance + floorId when bound', () => {
    expect(
      bimScopeWriteFields({ projectId: 'p1', floorplanId: 'file_x', floorId: 'flr_1' }),
    ).toEqual({ floorplanId: 'file_x', floorId: 'flr_1' });
  });

  it('writes only floorplanId when no floor is bound', () => {
    expect(bimScopeWriteFields({ projectId: 'p1', floorplanId: 'file_x' })).toEqual({
      floorplanId: 'file_x',
    });
  });
});

describe('resolveBimPersistenceScope (ADR-420 SSoT gate — incident 2026-06-16)', () => {
  const base = { companyId: 'c1', projectId: 'p1', userId: 'u1' };

  it('resolves with both floorId and floorplanId (normal floor with a DXF file)', () => {
    expect(
      resolveBimPersistenceScope({ ...base, floorId: 'flr_1', floorplanId: 'file_x' }),
    ).toEqual({ companyId: 'c1', projectId: 'p1', userId: 'u1', floorId: 'flr_1', floorplanId: 'file_x' });
  });

  it('resolves on a file-less floor (durable floorId only) — the core fix: mirrors floorId into the provenance slot so the service config stays valid', () => {
    expect(
      resolveBimPersistenceScope({ ...base, floorId: 'flr_1', floorplanId: null }),
    ).toEqual({ companyId: 'c1', projectId: 'p1', userId: 'u1', floorId: 'flr_1', floorplanId: 'flr_1' });
  });

  it('resolves on a floor-less canvas via the legacy floorplanId fallback (no floorId)', () => {
    expect(
      resolveBimPersistenceScope({ ...base, floorplanId: 'file_x' }),
    ).toEqual({ companyId: 'c1', projectId: 'p1', userId: 'u1', floorplanId: 'file_x' });
  });

  it('returns null when no scope key at all (neither floorId nor floorplanId)', () => {
    expect(resolveBimPersistenceScope({ ...base })).toBeNull();
    expect(resolveBimPersistenceScope({ ...base, floorId: '', floorplanId: '' })).toBeNull();
  });

  it('returns null when any identity field is missing', () => {
    expect(resolveBimPersistenceScope({ companyId: null, projectId: 'p1', userId: 'u1', floorId: 'flr_1' })).toBeNull();
    expect(resolveBimPersistenceScope({ companyId: 'c1', projectId: undefined, userId: 'u1', floorId: 'flr_1' })).toBeNull();
    expect(resolveBimPersistenceScope({ companyId: 'c1', projectId: 'p1', userId: null, floorId: 'flr_1' })).toBeNull();
  });
});
