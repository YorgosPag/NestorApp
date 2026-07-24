/**
 * material-library-index — ADR-687 Φ8 unit tests. Pure data in/out (no React/Firestore/three).
 * Καλύπτει: ένωση catalog+user+μπογιές, `apply` value, editable/deletable ανά source,
 * `entryFilterScope`, και parity της projection `entryToSwatchItem` (μηδέν δεύτερη ένωση, N.18).
 */
import type { TFunction } from 'i18next';
import type { BimMaterial } from '../../../bim/types/bim-material-types';
import {
  buildMaterialLibraryEntries,
  entryFilterScope,
  FACE_TEXTURE_MATERIAL_IDS,
} from '../material-library-index';
import { entryToSwatchItem } from '../polygon-material-swatches';
import { listWallCoveringMaterials } from '../../../bim/wall-coverings/wall-covering-material-catalog';

// Mock TFunction — επιστρέφει το κλειδί (μας ενδιαφέρει η δομή, όχι η μετάφραση).
const t = ((k: string) => k) as unknown as TFunction;

const userMaterial: BimMaterial = {
  id: 'bmat_001',
  scope: 'company',
  nameEl: 'Τούβλο Φάτσας',
  nameEn: 'Face Brick',
  category: 'masonry',
  density: 1800,
  defaultThickness: null,
  fireRating: 'none',
  atoeCategory: 'OIK-1.01',
  atoeArticle: null,
  defaultUnitCost: null,
  defaultUnit: 'm2',
  brand: null,
  brandModel: null,
  notes: null,
  thumbnailUrl: null,
  pbrTextures: { albedoUrl: 'https://x.test/a.jpg', normalUrl: null, roughnessUrl: null, aoUrl: null, tileSizeM: 1 },
  appearance: null,
  builtin: false,
  companyId: 'company-1',
  projectId: null,
  createdBy: 'u1',
  createdAt: null as unknown as BimMaterial['createdAt'],
  updatedBy: 'u1',
  updatedAt: null as unknown as BimMaterial['updatedAt'],
};

describe('buildMaterialLibraryEntries', () => {
  it('unions catalog + user + paints, in that order', () => {
    const entries = buildMaterialLibraryEntries([userMaterial], t);
    const paints = listWallCoveringMaterials();
    expect(entries).toHaveLength(FACE_TEXTURE_MATERIAL_IDS.length + 1 + paints.length);
    expect(entries.slice(0, FACE_TEXTURE_MATERIAL_IDS.length).every((e) => e.source === 'catalog')).toBe(true);
    expect(entries[FACE_TEXTURE_MATERIAL_IDS.length]?.source).toBe('user');
    expect(entries[entries.length - 1]?.source).toBe('paint');
  });

  it('catalog entries: apply by materialId, read-only', () => {
    const [brick] = buildMaterialLibraryEntries([], t);
    expect(brick).toMatchObject({
      id: 'mat-brick',
      source: 'catalog',
      apply: { materialId: 'mat-brick' },
      materialId: 'mat-brick',
      editable: false,
      deletable: false,
    });
  });

  it('user entry: scope/category/bimMaterial + editable when not builtin', () => {
    const entries = buildMaterialLibraryEntries([userMaterial], t);
    const user = entries.find((e) => e.source === 'user');
    expect(user).toMatchObject({
      id: 'bmat_001',
      label: 'Τούβλο Φάτσας',
      scope: 'company',
      category: 'masonry',
      apply: { materialId: 'bmat_001' },
      editable: true,
      deletable: true,
    });
    expect(user?.bimMaterial).toBe(userMaterial);
  });

  it('system (builtin) user material is read-only', () => {
    const entries = buildMaterialLibraryEntries([{ ...userMaterial, builtin: true, scope: 'system' }], t);
    const sys = entries.find((e) => e.source === 'user');
    expect(sys?.editable).toBe(false);
    expect(sys?.deletable).toBe(false);
  });

  it('paint entries: flat color + apply by id', () => {
    const entries = buildMaterialLibraryEntries([], t);
    const paint = entries.find((e) => e.source === 'paint');
    expect(paint?.color).toBeDefined();
    expect(paint?.apply.materialId).toBe(paint?.id);
  });
});

describe('entryFilterScope', () => {
  it('user → firestore scope; catalog/paint → the source', () => {
    const entries = buildMaterialLibraryEntries([userMaterial], t);
    expect(entryFilterScope(entries.find((e) => e.source === 'user')!)).toBe('company');
    expect(entryFilterScope(entries.find((e) => e.source === 'catalog')!)).toBe('catalog');
    expect(entryFilterScope(entries.find((e) => e.source === 'paint')!)).toBe('paint');
  });
});

describe('entryToSwatchItem parity', () => {
  it('paint → color branch; catalog/user → swatch branch', () => {
    const entries = buildMaterialLibraryEntries([userMaterial], t);
    const catalog = entryToSwatchItem(entries.find((e) => e.source === 'catalog')!);
    const user = entryToSwatchItem(entries.find((e) => e.source === 'user')!);
    const paint = entryToSwatchItem(entries.find((e) => e.source === 'paint')!);

    expect(catalog).toMatchObject({ draggable: true, swatch: { materialId: 'mat-brick' } });
    expect(catalog.color).toBeUndefined();
    expect(user).toMatchObject({ draggable: true, swatch: { materialId: 'bmat_001', category: 'masonry' } });
    expect(paint.color).toBeDefined();
    expect(paint.swatch).toBeUndefined();
  });
});
