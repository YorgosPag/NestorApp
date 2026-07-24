import {
  resolveEntityCurrentMaterialId,
  resolveFaceCurrentMaterialId,
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
