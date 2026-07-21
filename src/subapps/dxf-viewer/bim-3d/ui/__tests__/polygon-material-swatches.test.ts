/**
 * polygon-material-swatches — unit tests for the pure BODY-layer swatch data/builder
 * (ADR-539 Φ4d / ADR-679 Φ2b). No React, no Firestore — plain data in/out.
 */
import {
  FACE_TEXTURE_MATERIAL_IDS,
  buildLibraryMaterialSwatches,
} from '../polygon-material-swatches';
import type { BimMaterial } from '../../../bim/types/bim-material-types';

describe('FACE_TEXTURE_MATERIAL_IDS', () => {
  it('contains exactly the 8 curated textured cladding materials', () => {
    expect(FACE_TEXTURE_MATERIAL_IDS).toEqual([
      'mat-brick',
      'mat-stone',
      'mat-wood',
      'mat-tile',
      'mat-concrete',
      'mat-metal',
      'mat-plaster',
      'mat-roof-tile',
    ]);
  });

  it('excludes build-up-layer-only DNA materials', () => {
    const excluded = ['mat-screed', 'mat-insulation', 'mat-membrane', 'mat-gravel', 'mat-finish'];
    for (const id of excluded) {
      expect(FACE_TEXTURE_MATERIAL_IDS as readonly string[]).not.toContain(id);
    }
  });
});

describe('buildLibraryMaterialSwatches', () => {
  const baseMaterial: BimMaterial = {
    id: 'bmat_001',
    scope: 'company',
    nameEl: 'Τούβλο Φάτσας',
    nameEn: 'Face Brick',
    category: 'masonry',
    density: null,
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
    pbrTextures: {
      albedoUrl: 'https://example.test/albedo.jpg',
      normalUrl: null,
      roughnessUrl: null,
      aoUrl: null,
      tileSizeM: 1,
    },
    builtin: false,
    companyId: 'company-1',
    projectId: null,
    createdBy: 'user-1',
    createdAt: null as unknown as BimMaterial['createdAt'],
    updatedBy: 'user-1',
    updatedAt: null as unknown as BimMaterial['updatedAt'],
  };

  it('returns [] for an empty library', () => {
    expect(buildLibraryMaterialSwatches([])).toEqual([]);
  });

  it('maps id/label(nameEl fallback)/category/albedoUrl for a sample material', () => {
    const [descriptor] = buildLibraryMaterialSwatches([baseMaterial]);
    expect(descriptor).toEqual({
      id: 'bmat_001',
      label: 'Τούβλο Φάτσας',
      category: 'masonry',
      thumbnailUrl: null,
      albedoUrl: 'https://example.test/albedo.jpg',
    });
  });

  it('falls back to nameEn when nameEl is empty, then to id when both are empty', () => {
    const noGreek = buildLibraryMaterialSwatches([{ ...baseMaterial, nameEl: '' }]);
    expect(noGreek[0]?.label).toBe('Face Brick');

    const noNames = buildLibraryMaterialSwatches([{ ...baseMaterial, nameEl: '', nameEn: '' }]);
    expect(noNames[0]?.label).toBe('bmat_001');
  });

  it('resolves albedoUrl to null when pbrTextures is null', () => {
    const [descriptor] = buildLibraryMaterialSwatches([{ ...baseMaterial, pbrTextures: null }]);
    expect(descriptor?.albedoUrl).toBeNull();
  });
});
