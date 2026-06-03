/**
 * ADR-412 Φ4 — `family-type-ui-helpers` unit tests.
 *
 * Pure helpers behind the Family Type ribbon widgets: catalog slicing, built-in
 * vs user provenance, display-name resolution, override-key detection, override
 * normalisation, and the effective-param assignment builder («type always wins»).
 */

import {
  asWallFamilyType,
  getOverriddenParamKeys,
  isBuiltInType,
  listWallTypes,
  normaliseOverrides,
  resolveTypeDisplayName,
  resolveWallTypeAssignment,
  WALL_OVERRIDABLE_KEYS,
} from '../family-type-ui-helpers';
import { getAllBuiltInTypes, getBuiltInWallTypes } from '../built-in-types';
import { buildDefaultWallParams } from '../../../hooks/drawing/wall-completion';
import type { BimFamilyType, WallTypeParams } from '../../types/bim-family-type';

const CO = 'company_test';
const echo = (key: string): string => key; // i18n stub: returns the key verbatim

function userWallType(id: string, name: string): BimFamilyType<'wall'> {
  return {
    id,
    category: 'wall',
    name,
    scope: 'company',
    origin: 'user',
    typeParams: { category: 'interior', thickness: 100 },
    companyId: CO,
    ownerId: 'u1',
  };
}

function makeWall(over?: Partial<WallTypeParams>, typeId?: string) {
  return {
    params: buildDefaultWallParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, { category: 'partition', thickness: 120 }),
    typeId,
    typeOverrides: over,
  };
}

describe('family-type-ui-helpers (ADR-412 Φ4)', () => {
  it('1. listWallTypes keeps only wall types', () => {
    const all = getAllBuiltInTypes(CO); // 5 wall + 2 stair
    const walls = listWallTypes(all);
    expect(walls.length).toBe(5);
    expect(walls.every((t) => t.category === 'wall')).toBe(true);
  });

  it('2. asWallFamilyType narrows wall, rejects non-wall', () => {
    const [wall] = getBuiltInWallTypes(CO);
    const stair = getAllBuiltInTypes(CO).find((t) => t.category === 'stair')!;
    expect(asWallFamilyType(wall)).toBe(wall);
    expect(asWallFamilyType(stair)).toBeNull();
    expect(asWallFamilyType(null)).toBeNull();
  });

  it('3. isBuiltInType distinguishes provenance', () => {
    expect(isBuiltInType(getBuiltInWallTypes(CO)[0])).toBe(true);
    expect(isBuiltInType(userWallType('t1', 'My Wall'))).toBe(false);
  });

  it('4. resolveTypeDisplayName: built-in → i18n key, user → literal', () => {
    const builtin = getBuiltInWallTypes(CO).find((t) => t.typeParams.category === 'exterior')!;
    expect(resolveTypeDisplayName(builtin, echo)).toBe('ribbon.commands.bimFamilyType.builtin.wall.exterior');
    expect(resolveTypeDisplayName(userWallType('t1', 'Façade 30'), echo)).toBe('Façade 30');
  });

  it('5. getOverriddenParamKeys ignores undefined values', () => {
    expect(getOverriddenParamKeys(undefined)).toEqual([]);
    expect(getOverriddenParamKeys({ category: 'interior' })).toEqual(['category']);
    expect(getOverriddenParamKeys({ category: undefined, material: 'rc' })).toEqual(['material']);
  });

  it('6. WALL_OVERRIDABLE_KEYS are the per-instance overridable params', () => {
    expect(WALL_OVERRIDABLE_KEYS).toContain('category');
    expect(WALL_OVERRIDABLE_KEYS).not.toContain('thickness'); // structural, type-only
  });

  it('7. normaliseOverrides collapses empty to undefined', () => {
    expect(normaliseOverrides({})).toBeUndefined();
    expect(normaliseOverrides({ category: 'interior' })).toEqual({ category: 'interior' });
  });

  it('8. resolveWallTypeAssignment: assigning a type makes type params win', () => {
    const wall = makeWall(); // category partition, thickness 120, untyped
    const ext = getBuiltInWallTypes(CO).find((t) => t.typeParams.category === 'exterior')!;
    const getType = (id: string) => (id === ext.id ? ext : null);

    const { next, previous } = resolveWallTypeAssignment(wall, ext.id, undefined, getType);

    expect(next.typeId).toBe(ext.id);
    expect(next.params.category).toBe('exterior'); // type wins
    expect(next.params.thickness).toBe(ext.typeParams.thickness);
    expect(next.params.start).toEqual(wall.params.start); // instance field preserved
    expect(previous.typeId).toBeUndefined();
    expect(previous.params).toBe(wall.params);
  });

  it('9. resolveWallTypeAssignment: clearing keeps params unchanged (detach)', () => {
    const wall = makeWall(undefined, 'some-type');
    const { next } = resolveWallTypeAssignment(wall, undefined, undefined, () => null);
    expect(next.typeId).toBeUndefined();
    expect(next.params).toBe(wall.params); // non-destructive (Q6)
  });

  it('10. resolveWallTypeAssignment: per-param override wins over type', () => {
    const ext = getBuiltInWallTypes(CO).find((t) => t.typeParams.category === 'exterior')!;
    const wall = makeWall(undefined, ext.id);
    const getType = (id: string) => (id === ext.id ? ext : null);

    const { next } = resolveWallTypeAssignment(wall, ext.id, { category: 'interior' }, getType);

    expect(next.params.category).toBe('interior'); // override beats type
    expect(next.typeOverrides).toEqual({ category: 'interior' });
  });
});
