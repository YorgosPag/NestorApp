/**
 * ADR-377 — BIM Subcategories Taxonomy tests.
 */
import { describe, it, expect } from '@jest/globals';
import {
  SUBCATEGORY_TAXONOMY,
  WIRED_SUBCATEGORIES,
  isWiredSubcategory,
  getAllSubcategoryKeysForCategory,
} from '../bim-subcategories';

describe('SUBCATEGORY_TAXONOMY total count', () => {
  it('contains exactly 47 subcategory keys across all categories', () => {
    const total = Object.values(SUBCATEGORY_TAXONOMY).reduce(
      (sum, keys) => sum + keys.length,
      0,
    );
    expect(total).toBe(47);
  });
});

describe('SUBCATEGORY_TAXONOMY per-category counts', () => {
  it('wall has 6 subcategories', () => {
    expect(SUBCATEGORY_TAXONOMY.wall.length).toBe(6);
  });

  it('slab has 5 subcategories', () => {
    expect(SUBCATEGORY_TAXONOMY.slab.length).toBe(5);
  });

  it('column has 4 subcategories (3 standard + section-profile ⭐)', () => {
    expect(SUBCATEGORY_TAXONOMY.column.length).toBe(4);
    expect(SUBCATEGORY_TAXONOMY.column).toContain('section-profile');
  });

  it('beam has 4 subcategories (3 standard + section-profile ⭐)', () => {
    expect(SUBCATEGORY_TAXONOMY.beam.length).toBe(4);
    expect(SUBCATEGORY_TAXONOMY.beam).toContain('section-profile');
  });

  it('opening has 15 subcategories (door + window + wall-cutout + sliding-track ⭐)', () => {
    expect(SUBCATEGORY_TAXONOMY.opening.length).toBe(15);
    expect(SUBCATEGORY_TAXONOMY.opening).toContain('sliding-track');
  });

  it('slab-opening has 2 subcategories', () => {
    expect(SUBCATEGORY_TAXONOMY['slab-opening'].length).toBe(2);
  });

  it('stair has 11 subcategories (9 standard + handrails ⭐ + tread-labels ⭐)', () => {
    expect(SUBCATEGORY_TAXONOMY.stair.length).toBe(11);
    expect(SUBCATEGORY_TAXONOMY.stair).toContain('handrails');
    expect(SUBCATEGORY_TAXONOMY.stair).toContain('tread-labels');
  });

  it('categories without subcategory model return empty arrays', () => {
    expect(SUBCATEGORY_TAXONOMY.roof.length).toBe(0);
    expect(SUBCATEGORY_TAXONOMY.ceiling.length).toBe(0);
    expect(SUBCATEGORY_TAXONOMY.dimension.length).toBe(0);
    expect(SUBCATEGORY_TAXONOMY.hatch.length).toBe(0);
    expect(SUBCATEGORY_TAXONOMY.grip.length).toBe(0);
  });
});

describe('SUBCATEGORY_TAXONOMY key correctness', () => {
  it('opening contains all door subcategory keys', () => {
    const opening = SUBCATEGORY_TAXONOMY.opening;
    expect(opening).toContain('door-frame');
    expect(opening).toContain('door-glass');
    expect(opening).toContain('door-opening');
    expect(opening).toContain('door-plan-swing');
  });

  it('opening contains window-glass and wall-cutout-jambs', () => {
    expect(SUBCATEGORY_TAXONOMY.opening).toContain('window-glass');
    expect(SUBCATEGORY_TAXONOMY.opening).toContain('wall-cutout-jambs');
  });

  it('stair contains walkline, down-arrows, up-arrows', () => {
    const stair = SUBCATEGORY_TAXONOMY.stair;
    expect(stair).toContain('walkline');
    expect(stair).toContain('down-arrows');
    expect(stair).toContain('up-arrows');
  });
});

describe('WIRED_SUBCATEGORIES', () => {
  it('contains exactly 23 wired keys', () => {
    expect(WIRED_SUBCATEGORIES.size).toBe(23);
  });

  it('wall wired keys: common-edges and cut-pattern', () => {
    expect(WIRED_SUBCATEGORIES.has('wall:common-edges')).toBe(true);
    expect(WIRED_SUBCATEGORIES.has('wall:cut-pattern')).toBe(true);
  });

  it('slab:common-edges is wired', () => {
    expect(WIRED_SUBCATEGORIES.has('slab:common-edges')).toBe(true);
  });

  it('column:section-profile (⭐) is wired', () => {
    expect(WIRED_SUBCATEGORIES.has('column:section-profile')).toBe(true);
  });

  it('beam:hidden-lines and beam:section-profile are wired', () => {
    expect(WIRED_SUBCATEGORIES.has('beam:hidden-lines')).toBe(true);
    expect(WIRED_SUBCATEGORIES.has('beam:section-profile')).toBe(true);
  });

  it('opening:sliding-track (⭐) is wired', () => {
    expect(WIRED_SUBCATEGORIES.has('opening:sliding-track')).toBe(true);
  });

  it('stair:handrails and stair:tread-labels (⭐) are wired', () => {
    expect(WIRED_SUBCATEGORIES.has('stair:handrails')).toBe(true);
    expect(WIRED_SUBCATEGORIES.has('stair:tread-labels')).toBe(true);
  });
});

describe('isWiredSubcategory', () => {
  it('returns true for known wired keys', () => {
    expect(isWiredSubcategory('wall', 'common-edges')).toBe(true);
    expect(isWiredSubcategory('beam', 'hidden-lines')).toBe(true);
    expect(isWiredSubcategory('stair', 'treads')).toBe(true);
    expect(isWiredSubcategory('opening', 'door-frame')).toBe(true);
    expect(isWiredSubcategory('slab-opening', 'edges')).toBe(true);
  });

  it('returns false for stub keys', () => {
    expect(isWiredSubcategory('wall', 'sweeps')).toBe(false);
    expect(isWiredSubcategory('wall', 'reveals')).toBe(false);
    expect(isWiredSubcategory('stair', 'cut-marks')).toBe(false);
    expect(isWiredSubcategory('opening', 'door-panel')).toBe(false);
    expect(isWiredSubcategory('opening', 'window-sash')).toBe(false);
  });

  it('returns false for categories with no subcategories', () => {
    expect(isWiredSubcategory('roof', 'anything')).toBe(false);
    expect(isWiredSubcategory('grip', 'any')).toBe(false);
  });
});

describe('getAllSubcategoryKeysForCategory', () => {
  it('returns wall keys in taxonomy order', () => {
    const keys = getAllSubcategoryKeysForCategory('wall');
    expect(keys[0]).toBe('common-edges');
    expect(keys[1]).toBe('cut-pattern');
    expect(keys.length).toBe(6);
  });

  it('returns stair keys including ⭐ extras at the end', () => {
    const keys = getAllSubcategoryKeysForCategory('stair');
    expect(keys[keys.length - 2]).toBe('handrails');
    expect(keys[keys.length - 1]).toBe('tread-labels');
  });

  it('returns empty array for roof (no subcategory model)', () => {
    expect(getAllSubcategoryKeysForCategory('roof')).toEqual([]);
  });

  it('returns same reference as SUBCATEGORY_TAXONOMY (zero allocation)', () => {
    expect(getAllSubcategoryKeysForCategory('wall')).toBe(SUBCATEGORY_TAXONOMY.wall);
  });
});
