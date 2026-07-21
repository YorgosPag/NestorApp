/**
 * ADR-679 Φ2a — known-import-materials: «όνομα C4D → Νέστωρ material id» για όλους τους
 * καταλόγους + library υλικά (by id / by ανθρώπινο όνομα), με id-first priority.
 */

import { buildKnownMaterialResolver } from '../known-import-materials';
import type { BimMaterial } from '../../../bim/types/bim-material-types';

function fakeMaterial(id: string, nameEl: string, nameEn: string): BimMaterial {
  return { id, nameEl, nameEn } as unknown as BimMaterial;
}

describe('buildKnownMaterialResolver — static catalogs (by id)', () => {
  const resolve = buildKnownMaterialResolver();

  it('recognises wall-covering ids (ADR-511)', () => {
    expect(resolve('paint-red')).toBe('paint-red');
    expect(resolve('tile-ceramic')).toBe('tile-ceramic');
  });

  it('recognises floor-finish ids (ADR-419)', () => {
    expect(resolve('floor-wood-oak')).toBe('floor-wood-oak');
  });

  it('is case/whitespace-insensitive', () => {
    expect(resolve('  PAINT-RED ')).toBe('paint-red');
  });

  it('returns null for unknown names', () => {
    expect(resolve('road_wood')).toBeNull();
    expect(resolve('')).toBeNull();
  });
});

describe('buildKnownMaterialResolver — wall DNA preset ids (ADR-678 Βήμα 2, by id)', () => {
  const resolve = buildKnownMaterialResolver();

  it('recognises catalog mat-* preset ids so a catalog swap is not lost', () => {
    expect(resolve('mat-concrete-c25')).toBe('mat-concrete-c25');
    expect(resolve('mat-brick-masonry')).toBe('mat-brick-masonry');
    expect(resolve('mat-eps-graphite')).toBe('mat-eps-graphite');
  });

  it('is case/whitespace-insensitive for preset ids', () => {
    expect(resolve('  MAT-BRICK-MASONRY ')).toBe('mat-brick-masonry');
  });

  it('still returns null for an unknown mat-* variant not in the catalog', () => {
    expect(resolve('mat-unicorn-9000')).toBeNull();
  });
});

describe('buildKnownMaterialResolver — library υλικά (by id AND human name)', () => {
  const resolve = buildKnownMaterialResolver([
    fakeMaterial('bmat_oak01', 'Δρύινο δάπεδο', 'Oak floor'),
  ]);

  it('recognises a library material by its id', () => {
    expect(resolve('bmat_oak01')).toBe('bmat_oak01');
  });

  it('recognises a library material by its Greek OR English human name', () => {
    expect(resolve('Δρύινο δάπεδο')).toBe('bmat_oak01');
    expect(resolve('oak floor')).toBe('bmat_oak01');
  });
});

describe('buildKnownMaterialResolver — id wins over human name (Giorgio 2026-07-19)', () => {
  it('a library material named after another material id never shadows that id', () => {
    // User material X is (perversely) named "paint-red" — the wall-covering id.
    const resolve = buildKnownMaterialResolver([
      fakeMaterial('bmat_x', 'paint-red', 'paint-red'),
    ]);
    // "paint-red" must resolve to the wall-covering id, NOT to bmat_x (id-first).
    expect(resolve('paint-red')).toBe('paint-red');
    // The library material is still reachable by its own id.
    expect(resolve('bmat_x')).toBe('bmat_x');
  });
});
