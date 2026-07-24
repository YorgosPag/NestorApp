import {
  resolveEntityCurrentMaterialId,
  resolveFaceCurrentMaterialId,
  resolveEntityMaterialIdSet,
  resolveEntityAppearanceRefs,
} from '../resolve-entity-current-material';
import { BASE_FACE_KEY } from '../../../bim/types/face-appearance-types';

describe('resolveEntityCurrentMaterialId', () => {
  it('returns the base materialId when present', () => {
    const entity = { faceAppearance: { [BASE_FACE_KEY]: { materialId: 'bmat_oak' } } };
    expect(resolveEntityCurrentMaterialId(entity)).toBe('bmat_oak');
  });

  it('returns null when the base slot is absent', () => {
    const entity = { faceAppearance: { 'side:0': { materialId: 'bmat_oak' } } };
    expect(resolveEntityCurrentMaterialId(entity)).toBeNull();
  });

  it('returns null when faceAppearance is absent entirely', () => {
    expect(resolveEntityCurrentMaterialId({})).toBeNull();
  });
});

describe('resolveFaceCurrentMaterialId', () => {
  it('returns the per-face override when present', () => {
    const entity = {
      faceAppearance: {
        [BASE_FACE_KEY]: { materialId: 'bmat_oak' },
        'side:0': { materialId: 'bmat_glass' },
      },
    };
    expect(resolveFaceCurrentMaterialId(entity, 'side:0')).toBe('bmat_glass');
  });

  it('falls back to the base materialId when the face has no override', () => {
    const entity = {
      faceAppearance: { [BASE_FACE_KEY]: { materialId: 'bmat_oak' } },
    };
    expect(resolveFaceCurrentMaterialId(entity, 'side:0')).toBe('bmat_oak');
  });

  it('returns null when neither the face nor the base has a materialId', () => {
    const entity = { faceAppearance: { [BASE_FACE_KEY]: { colorHex: '#FFFFFF' } } };
    expect(resolveFaceCurrentMaterialId(entity, 'side:0')).toBeNull();
  });

  it('returns null when faceAppearance is absent entirely', () => {
    expect(resolveFaceCurrentMaterialId({}, 'top')).toBeNull();
  });
});

describe('resolveEntityMaterialIdSet', () => {
  it('returns an empty array when faceAppearance is absent entirely', () => {
    expect(resolveEntityMaterialIdSet({})).toEqual([]);
  });

  it('returns an empty array when faceAppearance has no materialId values', () => {
    const entity = { faceAppearance: { [BASE_FACE_KEY]: { colorHex: '#FFFFFF' } } };
    expect(resolveEntityMaterialIdSet(entity)).toEqual([]);
  });

  it('returns the single base materialId when only the base slot is set', () => {
    const entity = { faceAppearance: { [BASE_FACE_KEY]: { materialId: 'bmat_oak' } } };
    expect(resolveEntityMaterialIdSet(entity)).toEqual(['bmat_oak']);
  });

  it('dedupes to one id when base and a slot override share the same materialId', () => {
    const entity = {
      faceAppearance: {
        [BASE_FACE_KEY]: { materialId: 'bmat_oak' },
        'slot:seat': { materialId: 'bmat_oak' },
      },
    };
    expect(resolveEntityMaterialIdSet(entity)).toEqual(['bmat_oak']);
  });

  it('returns both ids when base and a slot override differ (the divergence case)', () => {
    const entity = {
      faceAppearance: {
        [BASE_FACE_KEY]: { materialId: 'bmat_oak' },
        'slot:seat': { materialId: 'bmat_glass' },
      },
    };
    expect(resolveEntityMaterialIdSet(entity)).toEqual(['bmat_oak', 'bmat_glass']);
  });

  it('returns only the slot materialIds when there is no base override', () => {
    const entity = {
      faceAppearance: {
        'slot:seat': { materialId: 'bmat_glass' },
        'slot:legs': { materialId: 'bmat_steel' },
      },
    };
    expect(resolveEntityMaterialIdSet(entity)).toEqual(['bmat_glass', 'bmat_steel']);
  });
});

describe('resolveEntityAppearanceRefs', () => {
  it('returns two empty arrays when faceAppearance is absent entirely', () => {
    expect(resolveEntityAppearanceRefs({})).toEqual({ materialIds: [], colorHexes: [] });
  });

  it('collects a base materialId into materialIds', () => {
    const entity = { faceAppearance: { [BASE_FACE_KEY]: { materialId: 'bmat_oak' } } };
    expect(resolveEntityAppearanceRefs(entity)).toEqual({
      materialIds: ['bmat_oak'],
      colorHexes: [],
    });
  });

  it('collects a raw base colorHex into colorHexes (ad-hoc paint)', () => {
    const entity = { faceAppearance: { [BASE_FACE_KEY]: { colorHex: '#3B82F6' } } };
    expect(resolveEntityAppearanceRefs(entity)).toEqual({
      materialIds: [],
      colorHexes: ['#3B82F6'],
    });
  });

  it('collects both materialIds and colorHexes across mixed slots, order-stable + deduped', () => {
    const entity = {
      faceAppearance: {
        [BASE_FACE_KEY]: { materialId: 'bmat_oak' },
        'slot:seat': { colorHex: '#FF0000' },
        'slot:legs': { materialId: 'bmat_oak' }, // dup materialId
        'slot:arm': { colorHex: '#FF0000' }, // dup colorHex
        'slot:back': { colorHex: '#00FF00' },
      },
    };
    expect(resolveEntityAppearanceRefs(entity)).toEqual({
      materialIds: ['bmat_oak'],
      colorHexes: ['#FF0000', '#00FF00'],
    });
  });

  it('keeps resolveEntityMaterialIdSet as the materialIds projection (SSoT delegation)', () => {
    const entity = {
      faceAppearance: {
        [BASE_FACE_KEY]: { materialId: 'bmat_oak' },
        'slot:seat': { colorHex: '#FF0000' },
      },
    };
    expect(resolveEntityMaterialIdSet(entity)).toEqual(
      resolveEntityAppearanceRefs(entity).materialIds,
    );
  });
});
