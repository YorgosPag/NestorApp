/**
 * ADR-412 — Tests for the built-in (factory) BIM family-type catalog +
 * clone-to-edit helper (`built-in-types.ts`).
 */

import {
  cloneTypeToInput,
  getAllBuiltInTypes,
  getBuiltInStairTypes,
  getBuiltInWallTypes,
} from '../built-in-types';
import { getDefaultDnaForCategory } from '../../types/wall-dna-types';
import type { WallCategory } from '../../types/wall-types';
import type { BimFamilyType } from '../../types/bim-family-type';

const COMPANY_ID = 'company-abc';

const ALL_WALL_CATEGORIES: readonly WallCategory[] = [
  'exterior',
  'interior',
  'partition',
  'parapet',
  'fence',
];

describe('getBuiltInWallTypes', () => {
  it('produces exactly one built-in per wall category (5)', () => {
    const walls = getBuiltInWallTypes(COMPANY_ID);
    expect(walls).toHaveLength(5);

    const categories = walls.map((w) => w.typeParams.category);
    expect(new Set(categories)).toEqual(new Set(ALL_WALL_CATEGORIES));
  });

  it('derives thickness + dna from the wall-DNA SSoT per category', () => {
    const walls = getBuiltInWallTypes(COMPANY_ID);
    for (const wall of walls) {
      const expectedDna = getDefaultDnaForCategory(wall.typeParams.category);
      expect(wall.typeParams.dna).toBeDefined();
      expect(wall.typeParams.thickness).toBe(expectedDna.totalThickness);
      expect(wall.typeParams.dna?.totalThickness).toBe(expectedDna.totalThickness);
    }
  });

  it('marks every wall built-in origin=built-in, scope=company, ownerId=system', () => {
    for (const wall of getBuiltInWallTypes(COMPANY_ID)) {
      expect(wall.origin).toBe('built-in');
      expect(wall.scope).toBe('company');
      expect(wall.ownerId).toBe('system');
      expect(wall.companyId).toBe(COMPANY_ID);
      expect(wall.category).toBe('wall');
    }
  });

  it('uses stable technical-key names, never UI labels', () => {
    const walls = getBuiltInWallTypes(COMPANY_ID);
    const names = walls.map((w) => w.name).sort();
    expect(names).toEqual(
      [
        'builtin.wall.exterior',
        'builtin.wall.fence',
        'builtin.wall.interior',
        'builtin.wall.parapet',
        'builtin.wall.partition',
      ].sort(),
    );
  });

  it('generates deterministic, stable ids across two calls', () => {
    const a = getBuiltInWallTypes(COMPANY_ID);
    const b = getBuiltInWallTypes(COMPANY_ID);
    expect(a.map((w) => w.id)).toEqual(b.map((w) => w.id));
    expect(a).toEqual(b);
    expect(a[0]?.id).toBe('bimftype-builtin-wall-exterior');
  });
});

describe('getBuiltInStairTypes', () => {
  it('produces sensible stair built-ins with origin=built-in', () => {
    const stairs = getBuiltInStairTypes(COMPANY_ID);
    expect(stairs.length).toBeGreaterThanOrEqual(1);
    for (const stair of stairs) {
      expect(stair.origin).toBe('built-in');
      expect(stair.scope).toBe('company');
      expect(stair.ownerId).toBe('system');
      expect(stair.category).toBe('stair');
      expect(stair.typeParams.rise).toBe(175);
      expect(stair.typeParams.tread).toBe(280);
      expect(stair.typeParams.codeProfile).toBe('nok');
    }
  });

  it('is deterministic across two calls', () => {
    expect(getBuiltInStairTypes(COMPANY_ID)).toEqual(
      getBuiltInStairTypes(COMPANY_ID),
    );
  });
});

describe('getAllBuiltInTypes', () => {
  it('concatenates wall + stair built-ins', () => {
    const all = getAllBuiltInTypes(COMPANY_ID);
    const walls = getBuiltInWallTypes(COMPANY_ID);
    const stairs = getBuiltInStairTypes(COMPANY_ID);

    expect(all).toHaveLength(walls.length + stairs.length);
    expect(all.some((t) => t.category === 'wall')).toBe(true);
    expect(all.some((t) => t.category === 'stair')).toBe(true);
  });

  it('is fully deterministic (same companyId → identical output)', () => {
    expect(getAllBuiltInTypes(COMPANY_ID)).toEqual(
      getAllBuiltInTypes(COMPANY_ID),
    );
  });
});

describe('cloneTypeToInput', () => {
  it('produces a user-origin SaveTypeInput with the given name + default scope', () => {
    const source = getBuiltInWallTypes(COMPANY_ID)[0] as BimFamilyType<'wall'>;
    const input = cloneTypeToInput(source, 'My Exterior Wall');

    expect(input.origin).toBe('user');
    expect(input.name).toBe('My Exterior Wall');
    expect(input.scope).toBe('company');
    expect(input.category).toBe('wall');
    expect(input.typeParams.thickness).toBe(source.typeParams.thickness);
  });

  it('honours an explicit scope override', () => {
    const source = getBuiltInStairTypes(COMPANY_ID)[0] as BimFamilyType<'stair'>;
    const input = cloneTypeToInput(source, 'Project Stair', 'project');
    expect(input.scope).toBe('project');
  });

  it('deep-copies typeParams so mutating the clone does not affect the source', () => {
    const source = getBuiltInWallTypes(COMPANY_ID)[0] as BimFamilyType<'wall'>;
    const originalThickness = source.typeParams.thickness;
    const originalLayerCount = source.typeParams.dna?.layers.length ?? 0;

    const input = cloneTypeToInput(source, 'Mutated');

    // The clone's typeParams must be a NEW object, not the same reference.
    expect(input.typeParams).not.toBe(source.typeParams);
    expect(input.typeParams.dna).not.toBe(source.typeParams.dna);

    // Mutate the clone (cast off readonly for the mutation test only).
    const mutable = input.typeParams as { thickness: number; dna?: { layers: unknown[] } };
    mutable.thickness = 9999;
    mutable.dna?.layers.push({ tampered: true });

    // Source stays pristine.
    expect(source.typeParams.thickness).toBe(originalThickness);
    expect(source.typeParams.dna?.layers.length).toBe(originalLayerCount);
  });
});
