/**
 * ADR-412 — Tests for the slab persistence helpers (slab analogue of the wall
 * persistence-helper resolution logic). Verifies «type always wins» on load
 * (`docToEntity`), store-version re-resolution (`reresolveSceneSlabs`), the
 * type-link change predicate, and the effective-param diff — all against the
 * live `bim-family-type-store` seeded with the built-in slab catalog.
 */

import { useBimFamilyTypeStore } from '../../../bim/family-types/bim-family-type-store';
import {
  getBuiltInSlabTypeId,
  getBuiltInSlabTypes,
} from '../../../bim/family-types/built-in-types';
import { getDefaultSlabBuildupForKind } from '../../../bim/types/slab-dna-types';
import { buildDefaultSlabParams } from '../../drawing/slab-completion';
import {
  docToEntity,
  reresolveSceneSlabs,
  slabEntityDiffersFromDoc,
  slabTypeLinkChanged,
} from '../slab-persistence-helpers';
import type { SlabDoc } from '../../../bim/slabs/slab-firestore-service';
import type { SlabEntity, SlabParams } from '../../../bim/types/slab-types';
import type { SceneModel } from '../../../types/entities';
import { validateSlabParams } from '../../../bim/validators/slab-validator';

const COMPANY_ID = 'company-abc';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 4000 },
  { x: 0, y: 4000 },
];

/** A typed-floor params set (matches the kind default → auto-typable). */
function floorParams(): SlabParams {
  return buildDefaultSlabParams(SQUARE, {
    kind: 'floor',
    dna: getDefaultSlabBuildupForKind('floor'),
  });
}

/** A bare single-material params set (no dna → untyped legacy). */
function bareParams(): SlabParams {
  return buildDefaultSlabParams(SQUARE, { kind: 'floor' });
}

function makeDoc(params: SlabParams, typeId?: string): SlabDoc {
  return {
    id: 'slab-1',
    companyId: COMPANY_ID,
    projectId: 'proj-1',
    floorplanId: 'fp-1',
    kind: params.kind,
    params,
    validation: validateSlabParams(params).bimValidation,
    layerId: '0',
    ...(typeId !== undefined && { typeId }),
  } as SlabDoc;
}

beforeEach(() => {
  // Seed the resolution store with the built-in slab catalog.
  useBimFamilyTypeStore.getState().setTypes(getBuiltInSlabTypes(COMPANY_ID));
});

describe('docToEntity — slab family-type resolution', () => {
  it('leaves a bare legacy slab untyped (no dna, no typeId) — zero regression', () => {
    const entity = docToEntity(makeDoc(bareParams()));
    expect(entity.typeId).toBeUndefined();
    expect(entity.params.dna).toBeUndefined();
    expect(entity.params.thickness).toBe(200);
  });

  it('auto-links a kind-default slab to its built-in type and resolves the dna', () => {
    const entity = docToEntity(makeDoc(floorParams()));
    expect(entity.typeId).toBe(getBuiltInSlabTypeId('floor'));
    expect(entity.params.dna).toBeDefined();
    expect(entity.params.thickness).toBe(getDefaultSlabBuildupForKind('floor').totalThickness);
  });

  it('resolves an explicitly-typed doc against the live type («type always wins»)', () => {
    // Doc cache says thickness 200 / no dna, but it is linked to the floor type.
    const doc = makeDoc(bareParams(), getBuiltInSlabTypeId('floor'));
    const entity = docToEntity(doc);
    expect(entity.typeId).toBe(getBuiltInSlabTypeId('floor'));
    expect(entity.params.thickness).toBe(getDefaultSlabBuildupForKind('floor').totalThickness);
    expect(entity.params.dna).toBeDefined();
  });
});

describe('slabTypeLinkChanged', () => {
  it('detects a detach (typeId cleared, params kept)', () => {
    expect(
      slabTypeLinkChanged({ typeId: 'bimftype-builtin-slab-floor' }, { typeId: undefined }),
    ).toBe(true);
  });

  it('is false when the link is unchanged', () => {
    expect(
      slabTypeLinkChanged({ typeId: 'x' }, { typeId: 'x' }),
    ).toBe(false);
  });
});

describe('slabEntityDiffersFromDoc', () => {
  it('is false when the scene entity already holds the doc effective params', () => {
    const doc = makeDoc(floorParams());
    const existing = docToEntity(doc);
    expect(slabEntityDiffersFromDoc(existing, doc)).toBe(false);
  });
});

describe('reresolveSceneSlabs', () => {
  it('re-flows a typed slab whose cached params drift from the live type', () => {
    // A typed slab carrying stale (200 mm, no dna) cached params.
    const stale: SlabEntity = {
      ...docToEntity(makeDoc(bareParams())),
      typeId: getBuiltInSlabTypeId('floor'),
    } as SlabEntity;
    const scene: SceneModel = { entities: [stale] } as unknown as SceneModel;

    const next = reresolveSceneSlabs(scene, new Set());
    expect(next).not.toBe(scene);
    const resolved = next.entities[0] as SlabEntity;
    expect(resolved.params.thickness).toBe(getDefaultSlabBuildupForKind('floor').totalThickness);
    expect(resolved.params.dna).toBeDefined();
  });

  it('returns the SAME scene reference when no typed slab changed', () => {
    const scene: SceneModel = {
      entities: [docToEntity(makeDoc(bareParams()))],
    } as unknown as SceneModel;
    expect(reresolveSceneSlabs(scene, new Set())).toBe(scene);
  });
});
