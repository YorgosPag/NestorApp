/**
 * ADR-421 SLICE C — opening «type wins» resolution + link-diff helpers tests.
 *
 * Covers the pure / store-backed helpers used by the opening persistence layer:
 *   - resolveOpeningEffective: untyped fast-path, type wins, operationType re-derive
 *   - openingTypeLinkChanged: detach / override / no-change detection
 *   - openingUpdateLinkPatch: value vs null (deleteField) mapping
 *   - openingEntityDiffersFromDoc: effective-aware diff (no spurious re-hydrate)
 */

import {
  resolveOpeningEffective,
  openingTypeLinkChanged,
  openingUpdateLinkPatch,
  openingEntityDiffersFromDoc,
} from '../opening-type-resolution';
import { useBimFamilyTypeStore } from '../bim-family-type-store';
import type { BimFamilyType } from '../../types/bim-family-type';
import type { OpeningEntity, OpeningParams } from '../../types/opening-types';

const TYPE: BimFamilyType<'opening'> = {
  id: 'bimft_open_door',
  category: 'opening',
  name: 'Door 900',
  scope: 'company',
  origin: 'user',
  companyId: 'c1',
  ownerId: 'u1',
  typeParams: { kind: 'door', width: 900, height: 2100, frameWidth: 60, material: 'oak' },
};

function cachedParams(overrides: Partial<OpeningParams> = {}): OpeningParams {
  return {
    kind: 'window',
    wallId: 'wall_1',
    offsetFromStart: 500,
    width: 1200,
    height: 1400,
    sillHeight: 900,
    operationType: 'NOTDEFINED',
    ...overrides,
  };
}

beforeEach(() => {
  useBimFamilyTypeStore.getState().setTypes([TYPE]);
});

describe('resolveOpeningEffective', () => {
  it('returns cached params unchanged (same ref) for an untyped opening', () => {
    const params = cachedParams();
    expect(resolveOpeningEffective(params, {})).toBe(params);
  });

  it('returns cached params unchanged when the type is not in the catalog', () => {
    const params = cachedParams();
    expect(resolveOpeningEffective(params, { typeId: 'missing' })).toBe(params);
  });

  it('lets the type win and re-derives operationType for the new kind', () => {
    const params = cachedParams();
    const result = resolveOpeningEffective(params, { typeId: TYPE.id });
    expect(result.kind).toBe('door');
    expect(result.width).toBe(900);
    expect(result.height).toBe(2100);
    expect(result.frameWidth).toBe(60);
    // operationType re-derived from the type-governed kind (door, no handing).
    expect(result.operationType).not.toBe('NOTDEFINED');
    // instance fields preserved
    expect(result.wallId).toBe('wall_1');
    expect(result.sillHeight).toBe(900);
  });
});

describe('openingTypeLinkChanged', () => {
  it('detects an assign (undefined → typeId)', () => {
    expect(openingTypeLinkChanged(undefined, { typeId: 't1' })).toBe(true);
  });
  it('detects a detach (typeId → undefined)', () => {
    expect(openingTypeLinkChanged({ typeId: 't1' }, {})).toBe(true);
  });
  it('detects an override change', () => {
    expect(openingTypeLinkChanged({ typeId: 't1' }, { typeId: 't1', typeOverrides: { width: 1000 } })).toBe(true);
  });
  it('returns false when the link is unchanged', () => {
    expect(openingTypeLinkChanged({ typeId: 't1', typeOverrides: { width: 1000 } }, { typeId: 't1', typeOverrides: { width: 1000 } })).toBe(false);
  });
});

describe('openingUpdateLinkPatch', () => {
  it('maps an absent link to null (deleteField)', () => {
    expect(openingUpdateLinkPatch({})).toEqual({ typeId: null, typeOverrides: null });
  });
  it('maps a present link to its values', () => {
    expect(openingUpdateLinkPatch({ typeId: 't1', typeOverrides: { width: 1000 } })).toEqual({
      typeId: 't1',
      typeOverrides: { width: 1000 },
    });
  });
});

describe('openingEntityDiffersFromDoc', () => {
  it('is false when the entity already equals the effective doc (no churn)', () => {
    // entity holds the resolved (effective) params + link; doc holds the cache.
    const effective = resolveOpeningEffective(cachedParams(), { typeId: TYPE.id });
    const entity = { id: 'o1', params: effective, typeId: TYPE.id } as unknown as OpeningEntity;
    expect(openingEntityDiffersFromDoc(entity, { params: cachedParams(), typeId: TYPE.id })).toBe(false);
  });

  it('is true when the type link changed', () => {
    const entity = { id: 'o1', params: cachedParams() } as unknown as OpeningEntity;
    expect(openingEntityDiffersFromDoc(entity, { params: cachedParams(), typeId: TYPE.id })).toBe(true);
  });
});
