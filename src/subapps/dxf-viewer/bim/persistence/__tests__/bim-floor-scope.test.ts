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
