/**
 * ADR-678 Φ1 — round-trip pure core tests: parse OBJ/MTL → match names → resolve appearance.
 * Στήνει OBJ/MTL όπως θα τα ξανα-έγραφε το C4D πάνω στα export ονόματά μας.
 */

import { parseObjObjects, parseMtl } from '../obj-mtl-parse';
import { resolveImportAppearance, isUnchangedNestorMaterial } from '../resolve-import-appearance';
import { buildKnownMaterialResolver } from '../known-import-materials';
import { matchObjectsToEntities, type EntityExportIdentity } from '../match-objects-to-entities';
import type { BimMaterial } from '../../../bim/types/bim-material-types';

/** Minimal library υλικό — ο resolver διαβάζει μόνο id/nameEl/nameEn. */
function fakeMaterial(id: string, nameEl: string, nameEn: string): BimMaterial {
  return { id, nameEl, nameEn } as unknown as BimMaterial;
}

const MTL = `# c4d export
newmtl paint-red
Kd 0.752941 0.223529 0.168627
d 1.000000
newmtl mat_myblue
Kd 0.100000 0.200000 0.300000
d 1.000000
`;

const OBJ = `mtllib model.mtl
o Wall_w-42
usemtl paint-red
f 1 2 3
f 1 3 4
o Column_col-7
usemtl mat_myblue
f 5 6 7
`;

describe('parseMtl', () => {
  it('reads Kd colours into hex', () => {
    const mtl = parseMtl(MTL);
    expect(mtl.get('paint-red')?.colorHex).toBe('#c0392b');
    expect(mtl.get('mat_myblue')?.colorHex).toBe('#1a334d');
    expect(mtl.get('paint-red')?.opacity).toBe(1);
  });
});

describe('parseObjObjects', () => {
  it('maps each object to its material (o blocks)', () => {
    expect(parseObjObjects(OBJ)).toEqual([
      { objectName: 'Wall_w-42', materialName: 'paint-red' },
      { objectName: 'Column_col-7', materialName: 'mat_myblue' },
    ]);
  });

  it('handles g groups', () => {
    expect(parseObjObjects('g Slab_s-1\nusemtl x\nf 1 2 3\n')).toEqual([
      { objectName: 'Slab_s-1', materialName: 'x' },
    ]);
  });

  it('picks the dominant material (most faces) when an object has several usemtl groups', () => {
    const obj = 'o Wall_w-9\nusemtl a\nf 1 2 3\nusemtl b\nf 4 5 6\nf 7 8 9\n';
    expect(parseObjObjects(obj)).toEqual([{ objectName: 'Wall_w-9', materialName: 'b' }]);
  });
});

describe('matchObjectsToEntities', () => {
  const entities: EntityExportIdentity[] = [
    { bimId: 'w-42', bimType: 'wall', floorName: '' },
    { bimId: 'col-7', bimType: 'column', floorName: '' },
  ];

  it('matches export names back to bimIds', () => {
    const objects = parseObjObjects(OBJ);
    const { matched, unmatched } = matchObjectsToEntities(objects, entities, 'latin');
    expect(unmatched).toEqual([]);
    expect(matched).toEqual([
      { objectName: 'Wall_w-42', bimId: 'w-42', materialName: 'paint-red' },
      { objectName: 'Column_col-7', bimId: 'col-7', materialName: 'mat_myblue' },
    ]);
  });

  it('strips HIDDEN_ prefix and _N disambiguation', () => {
    const objects = [
      { objectName: 'HIDDEN_Wall_w-42', materialName: 'paint-red' },
      { objectName: 'Wall_w-42_2', materialName: 'paint-red' },
    ];
    const { matched, unmatched } = matchObjectsToEntities(objects, entities, 'latin');
    expect(unmatched).toEqual([]);
    expect(matched.map((m) => m.bimId)).toEqual(['w-42', 'w-42']);
  });

  it('reports objects with no matching entity', () => {
    const objects = [{ objectName: 'Cube_new', materialName: 'x' }];
    const { matched, unmatched } = matchObjectsToEntities(objects, entities, 'latin');
    expect(matched).toEqual([]);
    expect(unmatched).toEqual(['Cube_new']);
  });

  it('matches multi-floor names (with floor prefix)', () => {
    const multi: EntityExportIdentity[] = [{ bimId: 'w-1', bimType: 'wall', floorName: 'Ισόγειο' }];
    const objects = [{ objectName: 'Isogeio_Wall_w-1', materialName: 'paint-red' }];
    const { matched } = matchObjectsToEntities(objects, multi, 'latin');
    expect(matched).toEqual([{ objectName: 'Isogeio_Wall_w-1', bimId: 'w-1', materialName: 'paint-red' }]);
  });
});

describe('resolveImportAppearance', () => {
  const mtl = parseMtl(MTL);
  const resolveKnownId = buildKnownMaterialResolver();

  it('maps a wall-covering material name to { materialId } (SSoT colour)', () => {
    expect(resolveImportAppearance('paint-red', mtl, resolveKnownId)).toEqual({ materialId: 'paint-red' });
  });

  it('maps a floor-finish catalog id to { materialId } (ADR-679 Φ2a — όχι μόνο wall-covering)', () => {
    expect(resolveImportAppearance('floor-wood-oak', mtl, resolveKnownId)).toEqual({ materialId: 'floor-wood-oak' });
  });

  it('maps a custom C4D material to its flat { colorHex }', () => {
    expect(resolveImportAppearance('mat_myblue', mtl, resolveKnownId)).toEqual({ colorHex: '#1a334d' });
  });

  it('returns null when the object had no material', () => {
    expect(resolveImportAppearance(null, mtl, resolveKnownId)).toBeNull();
  });

  it('returns null for an unknown material with no colour', () => {
    expect(resolveImportAppearance('ghost', mtl, resolveKnownId)).toBeNull();
  });

  it('reads a hex colour encoded in the material name (C4D R15 has no .mtl)', () => {
    expect(resolveImportAppearance('8B4513', mtl, resolveKnownId)).toEqual({ colorHex: '#8b4513' });
    expect(resolveImportAppearance('#c0d8b0', mtl, resolveKnownId)).toEqual({ colorHex: '#c0d8b0' });
  });

  it('prefers the .mtl Kd over a name that also parses as hex', () => {
    const m = parseMtl('newmtl abcdef\nKd 0 0 0\n');
    expect(resolveImportAppearance('abcdef', m, resolveKnownId)).toEqual({ colorHex: '#000000' });
  });

  it('recognises a user library material by id AND by human name (ADR-679 Φ2a)', () => {
    const resolve = buildKnownMaterialResolver([fakeMaterial('bmat_oak01', 'Δρύινο δάπεδο', 'Oak floor')]);
    expect(resolveImportAppearance('bmat_oak01', mtl, resolve)).toEqual({ materialId: 'bmat_oak01' });
    expect(resolveImportAppearance('Δρύινο δάπεδο', mtl, resolve)).toEqual({ materialId: 'bmat_oak01' });
    expect(resolveImportAppearance('oak floor', mtl, resolve)).toEqual({ materialId: 'bmat_oak01' }); // case-insensitive
  });
});

describe('isUnchangedNestorMaterial (ΡΙΖΑ 2 — skip unchanged)', () => {
  it('flags DNA matIds (mat-* / elem-*) as unchanged', () => {
    expect(isUnchangedNestorMaterial('mat-concrete-c25')).toBe(true);
    expect(isUnchangedNestorMaterial('elem-railing')).toBe(true);
  });

  it('flags the exact mat_<hex6> colour fallback as unchanged', () => {
    expect(isUnchangedNestorMaterial('mat_808080')).toBe(true);
    expect(isUnchangedNestorMaterial('mat_c0392b')).toBe(true);
  });

  it('does NOT flag custom C4D names that only look similar', () => {
    expect(isUnchangedNestorMaterial('mat_myblue')).toBe(false); // not 6 hex
    expect(isUnchangedNestorMaterial('road_wood')).toBe(false);
    expect(isUnchangedNestorMaterial('paint-red')).toBe(false);
  });
});

describe('resolveImportAppearance — skips unchanged Nestor DNA (ΡΙΖΑ 2)', () => {
  const mtl = parseMtl(MTL);
  const resolveKnownId = buildKnownMaterialResolver();

  it('returns null for an original DNA matId (no useless override)', () => {
    expect(resolveImportAppearance('mat-concrete-c25', mtl, resolveKnownId)).toBeNull();
    expect(resolveImportAppearance('elem-railing', mtl, resolveKnownId)).toBeNull();
    expect(resolveImportAppearance('mat_808080', mtl, resolveKnownId)).toBeNull();
  });

  it('returns null even when HIDDEN_ prefixed', () => {
    expect(resolveImportAppearance('HIDDEN_mat-concrete-c25', mtl, resolveKnownId)).toBeNull();
  });
});
