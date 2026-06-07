/**
 * ADR-412 §3.4 — Effective param resolution SSoT tests.
 *
 * Covers the «type always wins, overrides win last, legacy fast-path = zero
 * regression» contract of `resolveEffectiveParams` / `resolveEffectiveWallParams`:
 *   - legacy fast-path: no `typeId` OR null `type` → instance params UNCHANGED
 *     (same reference).
 *   - type-only: `type.typeParams` overwrite the type-governed fields
 *     (category/thickness/dna/material); instance-level fields preserved.
 *   - per-param override: `typeOverrides` win over type AND instance for that one
 *     field, while the other type fields are still applied.
 *   - generic core direct tests (plain objects, merge order).
 *
 * @see ../resolve-effective-params
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.4
 */

import {
  resolveEffectiveOpeningParams,
  resolveEffectiveParams,
  resolveEffectiveRoofParams,
  resolveEffectiveSlabParams,
  resolveEffectiveWallParams,
} from '../resolve-effective-params';
import type {
  BimFamilyType,
  OpeningTypeParams,
  RoofTypeParams,
  SlabTypeParams,
  WallTypeParams,
} from '../../types/bim-family-type';
import type { WallParams } from '../../types/wall-types';
import type { WallDna } from '../../types/wall-dna-types';
import type { SlabParams } from '../../types/slab-types';
import type { SlabDna } from '../../types/slab-dna-types';
import type { RoofParams } from '../../types/roof-types';
import type { OpeningParams } from '../../types/opening-types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TYPE_DNA = { totalThickness: 250 } as unknown as WallDna;

/** Instance-level WallParams whose type-governed cache deliberately drifts. */
function makeInstanceParams(overrides: Partial<WallParams> = {}): WallParams {
  return {
    category: 'partition', // drifted cache (type says 'exterior')
    start: { x: 0, y: 0 },
    end: { x: 1000, y: 0 },
    height: 2700, // instance-level — must survive
    thickness: 100, // drifted cache (type says 250)
    flip: false, // instance-level — must survive
    material: 'gypsum', // drifted cache (type says 'rc')
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    ...overrides,
  };
}

/** Wall family type whose typeParams own category/thickness/dna/material. */
function makeWallType(
  typeParams: Partial<WallTypeParams> = {},
): BimFamilyType<'wall'> {
  return {
    id: 'bimfamtype_test_1',
    category: 'wall',
    name: 'Exterior 250',
    scope: 'company',
    origin: 'user',
    companyId: 'company_1',
    ownerId: 'user_1',
    typeParams: {
      category: 'exterior',
      thickness: 250,
      dna: TYPE_DNA,
      material: 'rc',
      ...typeParams,
    },
  };
}

// ---------------------------------------------------------------------------
// resolveEffectiveWallParams — legacy fast-path (zero regression)
// ---------------------------------------------------------------------------

describe('resolveEffectiveWallParams — legacy fast-path', () => {
  it('returns instance params UNCHANGED (same reference) when no typeId', () => {
    const params = makeInstanceParams();
    const type = makeWallType();
    const result = resolveEffectiveWallParams({ params }, type);

    expect(result).toBe(params); // same reference — no merge happened
  });

  it('returns instance params UNCHANGED (same reference) when type is null', () => {
    const params = makeInstanceParams();
    const result = resolveEffectiveWallParams(
      { params, typeId: 'bimfamtype_test_1' },
      null,
    );

    expect(result).toBe(params);
  });

  it('returns instance params UNCHANGED when type is undefined', () => {
    const params = makeInstanceParams();
    const result = resolveEffectiveWallParams(
      { params, typeId: 'bimfamtype_test_1' },
      undefined,
    );

    expect(result).toBe(params);
  });
});

// ---------------------------------------------------------------------------
// resolveEffectiveWallParams — type-only («type always wins»)
// ---------------------------------------------------------------------------

describe('resolveEffectiveWallParams — type wins', () => {
  it('overwrites type-governed fields from the type', () => {
    const params = makeInstanceParams();
    const type = makeWallType();
    const result = resolveEffectiveWallParams(
      { params, typeId: type.id },
      type,
    );

    // Type-governed fields come from the type (cache drift discarded).
    expect(result.category).toBe('exterior');
    expect(result.thickness).toBe(250);
    expect(result.dna).toBe(TYPE_DNA);
    expect(result.material).toBe('rc');
  });

  it('preserves instance-level fields the type does not own', () => {
    const params = makeInstanceParams();
    const type = makeWallType();
    const result = resolveEffectiveWallParams(
      { params, typeId: type.id },
      type,
    );

    expect(result.height).toBe(2700);
    expect(result.flip).toBe(false);
    expect(result.start).toEqual({ x: 0, y: 0 });
    expect(result.end).toEqual({ x: 1000, y: 0 });
    expect(result.baseBinding).toBe('storey-floor');
    expect(result.topBinding).toBe('storey-ceiling');
  });

  it('returns a NEW object (does not mutate instance params)', () => {
    const params = makeInstanceParams();
    const type = makeWallType();
    const result = resolveEffectiveWallParams(
      { params, typeId: type.id },
      type,
    );

    expect(result).not.toBe(params);
    expect(params.thickness).toBe(100); // original untouched
    expect(params.category).toBe('partition');
  });
});

// ---------------------------------------------------------------------------
// resolveEffectiveWallParams — per-param override (override wins last)
// ---------------------------------------------------------------------------

describe('resolveEffectiveWallParams — per-param override', () => {
  it('lets a single override win over BOTH type and instance', () => {
    const params = makeInstanceParams(); // thickness 100
    const type = makeWallType(); // thickness 250
    const result = resolveEffectiveWallParams(
      { params, typeId: type.id, typeOverrides: { thickness: 300 } },
      type,
    );

    expect(result.thickness).toBe(300); // override wins
  });

  it('still applies the other type fields when one is overridden', () => {
    const params = makeInstanceParams();
    const type = makeWallType();
    const result = resolveEffectiveWallParams(
      { params, typeId: type.id, typeOverrides: { material: 'masonry' } },
      type,
    );

    expect(result.material).toBe('masonry'); // overridden
    expect(result.category).toBe('exterior'); // from type
    expect(result.thickness).toBe(250); // from type
    expect(result.dna).toBe(TYPE_DNA); // from type
    expect(result.height).toBe(2700); // from instance
  });

  it('ignores empty overrides (type still wins)', () => {
    const params = makeInstanceParams();
    const type = makeWallType();
    const result = resolveEffectiveWallParams(
      { params, typeId: type.id, typeOverrides: {} },
      type,
    );

    expect(result.thickness).toBe(250);
    expect(result.category).toBe('exterior');
  });
});

// ---------------------------------------------------------------------------
// resolveEffectiveSlabParams — slab analogue (type wins / fast-path / override)
// ---------------------------------------------------------------------------

const SLAB_TYPE_DNA = { totalThickness: 285 } as unknown as SlabDna;

/** Instance-level SlabParams whose type-governed cache deliberately drifts. */
function makeSlabInstanceParams(overrides: Partial<SlabParams> = {}): SlabParams {
  return {
    kind: 'roof', // drifted cache (type says 'floor')
    outline: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }, { x: 0, y: 1000, z: 0 }] },
    levelElevation: 3000, // instance-level — must survive
    thickness: 200, // drifted cache (type says 285)
    geometryType: 'box', // instance-level — must survive
    material: 'mat-concrete', // drifted cache (type says 'mat-finish')
    ...overrides,
  };
}

/** Slab family type whose typeParams own kind/thickness/dna/material. */
function makeSlabType(typeParams: Partial<SlabTypeParams> = {}): BimFamilyType<'slab'> {
  return {
    id: 'bimfamtype_slab_1',
    category: 'slab',
    name: 'Floor 285',
    scope: 'company',
    origin: 'user',
    companyId: 'company_1',
    ownerId: 'user_1',
    typeParams: {
      kind: 'floor',
      thickness: 285,
      dna: SLAB_TYPE_DNA,
      material: 'mat-finish',
      ...typeParams,
    },
  };
}

describe('resolveEffectiveSlabParams', () => {
  it('returns instance params UNCHANGED (same reference) when no typeId', () => {
    const params = makeSlabInstanceParams();
    expect(resolveEffectiveSlabParams({ params }, makeSlabType())).toBe(params);
  });

  it('returns instance params UNCHANGED when type is null', () => {
    const params = makeSlabInstanceParams();
    expect(
      resolveEffectiveSlabParams({ params, typeId: 'bimfamtype_slab_1' }, null),
    ).toBe(params);
  });

  it('overwrites type-governed fields from the type («type always wins»)', () => {
    const params = makeSlabInstanceParams();
    const type = makeSlabType();
    const result = resolveEffectiveSlabParams({ params, typeId: type.id }, type);

    expect(result.kind).toBe('floor');
    expect(result.thickness).toBe(285);
    expect(result.dna).toBe(SLAB_TYPE_DNA);
    expect(result.material).toBe('mat-finish');
    // instance-level fields preserved
    expect(result.levelElevation).toBe(3000);
    expect(result.geometryType).toBe('box');
    // new object, original untouched
    expect(result).not.toBe(params);
    expect(params.thickness).toBe(200);
  });

  it('lets a per-param override win over BOTH type and instance', () => {
    const params = makeSlabInstanceParams();
    const type = makeSlabType();
    const result = resolveEffectiveSlabParams(
      { params, typeId: type.id, typeOverrides: { material: 'mat-tile' } },
      type,
    );

    expect(result.material).toBe('mat-tile'); // overridden
    expect(result.thickness).toBe(285); // from type
    expect(result.kind).toBe('floor'); // from type
  });
});

// ---------------------------------------------------------------------------
// resolveEffectiveRoofParams — roof analogue (type wins / fast-path / override)
// ---------------------------------------------------------------------------

const ROOF_TYPE_DNA = { totalThickness: 295 } as unknown as SlabDna;

/** Instance-level RoofParams whose type-governed cache deliberately drifts. */
function makeRoofInstanceParams(overrides: Partial<RoofParams> = {}): RoofParams {
  return {
    outline: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }, { x: 0, y: 1000, z: 0 }] },
    edges: [
      { definesSlope: true, slope: 30, overhangMm: 0 },
      { definesSlope: true, slope: 30, overhangMm: 0 },
      { definesSlope: false, slope: 0, overhangMm: 0 },
    ],
    slopeUnit: 'deg', // instance-level — must survive
    basePivotZ: 3000, // instance-level — must survive
    thickness: 200, // drifted cache (type says 295)
    material: 'mat-concrete', // drifted cache (type says 'mat-tile')
    ...overrides,
  };
}

/** Roof family type whose typeParams own thickness/dna/material (no kind). */
function makeRoofType(typeParams: Partial<RoofTypeParams> = {}): BimFamilyType<'roof'> {
  return {
    id: 'bimfamtype_roof_1',
    category: 'roof',
    name: 'Tiled 295',
    scope: 'company',
    origin: 'user',
    companyId: 'company_1',
    ownerId: 'user_1',
    typeParams: {
      thickness: 295,
      dna: ROOF_TYPE_DNA,
      material: 'mat-tile',
      ...typeParams,
    },
  };
}

describe('resolveEffectiveRoofParams', () => {
  it('returns instance params UNCHANGED (same reference) when no typeId', () => {
    const params = makeRoofInstanceParams();
    expect(resolveEffectiveRoofParams({ params }, makeRoofType())).toBe(params);
  });

  it('returns instance params UNCHANGED when type is null', () => {
    const params = makeRoofInstanceParams();
    expect(
      resolveEffectiveRoofParams({ params, typeId: 'bimfamtype_roof_1' }, null),
    ).toBe(params);
  });

  it('overwrites type-governed fields from the type («type always wins»)', () => {
    const params = makeRoofInstanceParams();
    const type = makeRoofType();
    const result = resolveEffectiveRoofParams({ params, typeId: type.id }, type);

    expect(result.thickness).toBe(295);
    expect(result.dna).toBe(ROOF_TYPE_DNA);
    expect(result.material).toBe('mat-tile');
    // instance-level fields preserved (footprint/slopes/datum)
    expect(result.basePivotZ).toBe(3000);
    expect(result.slopeUnit).toBe('deg');
    expect(result.edges).toBe(params.edges);
    // new object, original untouched
    expect(result).not.toBe(params);
    expect(params.thickness).toBe(200);
  });

  it('lets a per-param override win over BOTH type and instance', () => {
    const params = makeRoofInstanceParams();
    const type = makeRoofType();
    const result = resolveEffectiveRoofParams(
      { params, typeId: type.id, typeOverrides: { material: 'mat-slate' } },
      type,
    );

    expect(result.material).toBe('mat-slate'); // overridden
    expect(result.thickness).toBe(295); // from type
    expect(result.dna).toBe(ROOF_TYPE_DNA); // from type
  });
});

// ---------------------------------------------------------------------------
// resolveEffectiveOpeningParams — opening analogue (ADR-421 SLICE C)
// ---------------------------------------------------------------------------

/** Instance-level OpeningParams whose type-governed cache deliberately drifts. */
function makeOpeningInstanceParams(overrides: Partial<OpeningParams> = {}): OpeningParams {
  return {
    kind: 'window', // drifted cache (type says 'door')
    wallId: 'wall_1', // instance-level — must survive
    offsetFromStart: 500, // instance-level — must survive
    width: 1200, // drifted cache (type says 900)
    height: 1400, // drifted cache (type says 2100)
    sillHeight: 900, // instance-level — must survive
    frameWidth: 50, // drifted cache (type says 60)
    ...overrides,
  };
}

/** Opening family type whose typeParams own kind/width/height/frame/material. */
function makeOpeningType(typeParams: Partial<OpeningTypeParams> = {}): BimFamilyType<'opening'> {
  return {
    id: 'bimfamtype_opening_1',
    category: 'opening',
    name: 'Door 900',
    scope: 'company',
    origin: 'user',
    companyId: 'company_1',
    ownerId: 'user_1',
    typeParams: {
      kind: 'door',
      width: 900,
      height: 2100,
      frameWidth: 60,
      material: 'oak',
      ...typeParams,
    },
  };
}

describe('resolveEffectiveOpeningParams', () => {
  it('returns instance params UNCHANGED (same reference) when no typeId', () => {
    const params = makeOpeningInstanceParams();
    expect(resolveEffectiveOpeningParams({ params }, makeOpeningType())).toBe(params);
  });

  it('returns instance params UNCHANGED when type is null', () => {
    const params = makeOpeningInstanceParams();
    expect(
      resolveEffectiveOpeningParams({ params, typeId: 'bimfamtype_opening_1' }, null),
    ).toBe(params);
  });

  it('overwrites type-governed fields from the type («type always wins»)', () => {
    const params = makeOpeningInstanceParams();
    const type = makeOpeningType();
    const result = resolveEffectiveOpeningParams({ params, typeId: type.id }, type);

    // type-governed (family swap: window cache → door type)
    expect(result.kind).toBe('door');
    expect(result.width).toBe(900);
    expect(result.height).toBe(2100);
    expect(result.frameWidth).toBe(60);
    expect(result.material).toBe('oak');
    // instance-level fields preserved
    expect(result.wallId).toBe('wall_1');
    expect(result.offsetFromStart).toBe(500);
    expect(result.sillHeight).toBe(900);
    // new object, original untouched
    expect(result).not.toBe(params);
    expect(params.width).toBe(1200);
    expect(params.kind).toBe('window');
  });

  it('lets a per-param override win over BOTH type and instance', () => {
    const params = makeOpeningInstanceParams();
    const type = makeOpeningType();
    const result = resolveEffectiveOpeningParams(
      { params, typeId: type.id, typeOverrides: { width: 1000 } },
      type,
    );

    expect(result.width).toBe(1000); // overridden
    expect(result.height).toBe(2100); // from type
    expect(result.kind).toBe('door'); // from type
    expect(result.offsetFromStart).toBe(500); // from instance
  });
});

// ---------------------------------------------------------------------------
// resolveEffectiveParams — generic core (plain objects)
// ---------------------------------------------------------------------------

describe('resolveEffectiveParams — generic core', () => {
  it('returns params reference unchanged when typeParams is null', () => {
    const params = { a: 1, b: 2 };
    const result = resolveEffectiveParams(params, null, { a: 9 });

    expect(result).toBe(params);
  });

  it('returns params reference unchanged when typeParams is undefined', () => {
    const params = { a: 1, b: 2 };
    const result = resolveEffectiveParams(params, undefined, null);

    expect(result).toBe(params);
  });

  it('applies merge order instance → type → overrides', () => {
    const params = { a: 1, b: 2, c: 3 };
    const typeParams = { a: 10, b: 20 };
    const overrides = { a: 100 };
    const result = resolveEffectiveParams(params, typeParams, overrides);

    expect(result).toEqual({ a: 100, b: 20, c: 3 });
  });

  it('type overwrites instance when no overrides given', () => {
    const params = { a: 1, b: 2, c: 3 };
    const typeParams = { a: 10, b: 20 };
    const result = resolveEffectiveParams(params, typeParams, null);

    expect(result).toEqual({ a: 10, b: 20, c: 3 });
  });

  it('does not mutate the input params object', () => {
    const params = { a: 1, b: 2 };
    resolveEffectiveParams(params, { a: 9 }, null);

    expect(params).toEqual({ a: 1, b: 2 });
  });

  it('preserves instance-only keys absent from type and overrides', () => {
    const params = { a: 1, keep: 'yes' };
    const result = resolveEffectiveParams(params, { a: 2 }, { a: 3 });

    expect(result).toEqual({ a: 3, keep: 'yes' });
  });
});
