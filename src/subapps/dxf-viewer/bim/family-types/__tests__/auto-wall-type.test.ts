/**
 * Tests for the auto-type-on-create policy SSoT (Revit «Generic Wall», ADR-412).
 * @see ../auto-wall-type.ts
 */

import { getBuiltInWallTypeId } from '../built-in-types';
import { getDefaultDnaForCategory } from '../../types/wall-dna-types';
import { isAutoType, resolveTypeDisplayName } from '../family-type-ui-helpers';
import type { BimFamilyType, WallTypeParams } from '../../types/bim-family-type';
import {
  AUTO_WALL_TYPE_NAME_KEY,
  buildAutoWallType,
  findAutoWallType,
  resolveAutoWallTypeIdForSignature,
  resolveAutoWallTypeSignature,
  roundThicknessMm,
} from '../auto-wall-type';

const COMPANY = 'co-1';
const OWNER = 'user-1';

describe('roundThicknessMm', () => {
  it('rounds geometric floats to the nearest nominal mm', () => {
    expect(roundThicknessMm(187.34)).toBe(187);
    expect(roundThicknessMm(187.6)).toBe(188);
    expect(roundThicknessMm(250)).toBe(250);
  });
});

describe('resolveAutoWallTypeSignature', () => {
  it('keys by category + nominal thickness (same intent ⇒ same key)', () => {
    expect(resolveAutoWallTypeSignature('exterior', 187.2)).toBe('wall:exterior:187');
    expect(resolveAutoWallTypeSignature('exterior', 187.4)).toBe('wall:exterior:187');
    expect(resolveAutoWallTypeSignature('partition', 187)).toBe('wall:partition:187');
  });
});

describe('resolveAutoWallTypeIdForSignature', () => {
  it('returns the built-in id when the thickness equals the category default', () => {
    const def = getDefaultDnaForCategory('exterior');
    expect(resolveAutoWallTypeIdForSignature('exterior', def.totalThickness)).toBe(
      getBuiltInWallTypeId('exterior'),
    );
    // Rounding: a region float at the default thickness still matches the built-in.
    expect(resolveAutoWallTypeIdForSignature('exterior', def.totalThickness + 0.3)).toBe(
      getBuiltInWallTypeId('exterior'),
    );
  });

  it('returns undefined for an arbitrary thickness (→ a generic type is needed)', () => {
    expect(resolveAutoWallTypeIdForSignature('exterior', 187)).toBeUndefined();
  });
});

describe('buildAutoWallType', () => {
  it('builds an auto-origin wall type with a generic single-layer DNA', () => {
    const type = buildAutoWallType('bimftype-x', 'exterior', 187.4, COMPANY, OWNER);
    expect(type.origin).toBe('auto');
    expect(type.category).toBe('wall');
    expect(type.name).toBe(AUTO_WALL_TYPE_NAME_KEY);
    expect(type.scope).toBe('company');
    expect(type.companyId).toBe(COMPANY);
    expect(type.ownerId).toBe(OWNER);
    // Nominal thickness stored (rounded), DNA totals agree (SSoT, no double-entry).
    expect(type.typeParams.thickness).toBe(187);
    expect(type.typeParams.dna?.totalThickness).toBe(187);
    expect(type.typeParams.dna?.layers).toHaveLength(1);
    expect(type.typeParams.dna?.layers[0]?.side).toBe('core');
  });
});

describe('findAutoWallType', () => {
  const auto = buildAutoWallType('auto-1', 'exterior', 187, COMPANY, OWNER);
  const builtIn: BimFamilyType<'wall'> = {
    id: getBuiltInWallTypeId('exterior'),
    category: 'wall',
    name: 'builtin.wall.exterior',
    scope: 'company',
    origin: 'built-in',
    typeParams: { category: 'exterior', thickness: 187 } as WallTypeParams,
    companyId: COMPANY,
    ownerId: 'system',
  };
  const types = [builtIn, auto];

  it('finds the matching auto type by signature (rounding-tolerant)', () => {
    expect(findAutoWallType(types, 'exterior', 187)?.id).toBe('auto-1');
    expect(findAutoWallType(types, 'exterior', 186.7)?.id).toBe('auto-1');
  });

  it('ignores built-in / different category / different thickness', () => {
    expect(findAutoWallType([builtIn], 'exterior', 187)).toBeNull();
    expect(findAutoWallType(types, 'partition', 187)).toBeNull();
    expect(findAutoWallType(types, 'exterior', 300)).toBeNull();
  });
});

describe('isAutoType + resolveTypeDisplayName (auto)', () => {
  const auto = buildAutoWallType('auto-1', 'exterior', 187, COMPANY, OWNER);

  it('flags auto provenance', () => {
    expect(isAutoType(auto)).toBe(true);
  });

  it('translates the auto name with the interpolated thickness', () => {
    const t = (key: string, opts?: Record<string, unknown>): string =>
      opts ? `${key}#${JSON.stringify(opts)}` : key;
    expect(resolveTypeDisplayName(auto, t)).toBe(
      `ribbon.commands.bimFamilyType.${AUTO_WALL_TYPE_NAME_KEY}#{"thickness":187}`,
    );
  });
});
