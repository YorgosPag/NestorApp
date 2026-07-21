/**
 * ADR-678 Φ1 + Βήμα 2 — resolveImportAppearance: όνομα υλικού (OBJ `usemtl`) + `.mtl` + resolver →
 * `FaceAppearance` ή `null`. Καλύπτει τον global name-based δρόμο (χωρίς `exportedName`) ΚΑΙ τον
 * per-entity/per-face baseline δρόμο (Βήμα 2: `exportedName` = τι εξήχθη γι' αυτή την όψη).
 */

import { resolveImportAppearance } from '../resolve-import-appearance';
import { buildKnownMaterialResolver } from '../known-import-materials';
import type { ImportedMaterial } from '../obj-mtl-parse';

const resolveKnownId = buildKnownMaterialResolver();

function mtl(entries: Record<string, string>): ReadonlyMap<string, ImportedMaterial> {
  return new Map(
    Object.entries(entries).map(([name, colorHex]) => [name, { name, colorHex, opacity: 1 }]),
  );
}

const NO_MTL: ReadonlyMap<string, ImportedMaterial> = new Map();

describe('resolveImportAppearance — global name-based path (no exportedName, back-compat)', () => {
  it('treats a Nestor DNA material as unchanged (no-op)', () => {
    expect(resolveImportAppearance('mat-concrete-c25', NO_MTL, resolveKnownId)).toBeNull();
  });

  it('resolves a known catalog id to { materialId }', () => {
    expect(resolveImportAppearance('paint-red', NO_MTL, resolveKnownId)).toEqual({ materialId: 'paint-red' });
  });

  it('resolves a foreign C4D material via its .mtl Kd colour', () => {
    expect(resolveImportAppearance('road_wood', mtl({ road_wood: '#8b5e3c' }), resolveKnownId)).toEqual({
      colorHex: '#8b5e3c',
    });
  });

  it('resolves a hex-in-name material (C4D R15 without .mtl)', () => {
    expect(resolveImportAppearance('8B4513', NO_MTL, resolveKnownId)).toEqual({ colorHex: '#8b4513' });
  });
});

describe('resolveImportAppearance — per-entity baseline (ADR-678 Βήμα 2)', () => {
  it('is a no-op when the incoming name equals the exported name for this face', () => {
    expect(
      resolveImportAppearance('mat-concrete-c25', NO_MTL, resolveKnownId, undefined, 'mat-concrete-c25'),
    ).toBeNull();
  });

  it('CATALOG SWAP: different catalog id than exported → { materialId } (global regex would miss it)', () => {
    // Ο global isUnchangedNestorMaterial βλέπει `mat-*` → «αμετάβλητο» και θα έκανε no-op. Το
    // per-entity baseline ξέρει ότι η όψη εξήχθη ως `mat-concrete-c25` → η αλλαγή σε
    // `mat-brick-masonry` είναι ΠΡΑΓΜΑΤΙΚΟ swap.
    expect(
      resolveImportAppearance('mat-brick-masonry', NO_MTL, resolveKnownId, undefined, 'mat-concrete-c25'),
    ).toEqual({ materialId: 'mat-brick-masonry' });
  });

  it('CHANGED to a foreign material falls to the .mtl Kd colour', () => {
    expect(
      resolveImportAppearance('road_wood', mtl({ road_wood: '#112233' }), resolveKnownId, undefined, 'mat-concrete-c25'),
    ).toEqual({ colorHex: '#112233' });
  });

  it('CHANGED to a hex-in-name material (no .mtl) → { colorHex }', () => {
    expect(
      resolveImportAppearance('A1B2C3', NO_MTL, resolveKnownId, undefined, 'mat-concrete-c25'),
    ).toEqual({ colorHex: '#a1b2c3' });
  });

  it('CHANGED but unresolvable → null', () => {
    expect(
      resolveImportAppearance('totally_unknown', NO_MTL, resolveKnownId, undefined, 'mat-concrete-c25'),
    ).toBeNull();
  });

  it('unchanged face still surfaces a repaint via the colour baseline (glTF, ADR-683 §7)', () => {
    // Ίδιο όνομα με το εξαχθέν, αλλά το χρωματικό baseline δείχνει ότι βάφτηκε αλλού.
    const actual = mtl({ 'mat-concrete-c25': '#cc2200' });
    const baseline = new Map([['mat-concrete-c25', '#808080']]);
    expect(
      resolveImportAppearance('mat-concrete-c25', actual, resolveKnownId, baseline, 'mat-concrete-c25'),
    ).toEqual({ colorHex: '#cc2200' });
  });
});
