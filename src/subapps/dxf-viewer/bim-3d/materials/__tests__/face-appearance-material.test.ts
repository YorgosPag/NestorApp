/**
 * ADR-539 Φ4d / ADR-679 Φ2b — resolveFaceMaterial delegation contract.
 *
 * `resolveFaceMaterial` is a THIN DELEGATE: construction moved into `MaterialCatalog3D`
 * (`getFaceMaterial3D` / `getFaceColorMaterial3D`, the sole PBR factory + texture cache,
 * N.18) and colour resolution into `faceAppearanceColorHex` (shared with the 2D plan fill).
 * This suite mocks BOTH and asserts the cascade + precedence WIRING only:
 *
 *   resolve(face) = appearance[face] ?? appearance['*'] ?? base
 *   1. face.materialId AND getFaceMaterial3D(materialId) returns non-null (real texture,
 *      realistic ON, bmat_* + albedo) → textured material WINS.
 *   2. else faceAppearanceColorHex(face) (itself: colorHex wins, else materialId→catalog
 *      colour) → getFaceColorMaterial3D(hex).
 *   3. else → baseMaterial.
 */

import * as THREE from 'three';
import { resolveFaceMaterial } from '../face-appearance-material';
import { getFaceMaterial3D, getFaceColorMaterial3D } from '../MaterialCatalog3D';
import { faceAppearanceColorHex } from '../../../bim/utils/face-appearance-color';

jest.mock('../MaterialCatalog3D', () => {
  const ThreeModule = require('three') as typeof import('three');
  return {
    getFaceMaterial3D: jest.fn((_materialId: string) => null as InstanceType<typeof ThreeModule.MeshStandardMaterial> | null),
    getFaceColorMaterial3D: jest.fn((colorHex: string) => {
      const mat = new ThreeModule.MeshStandardMaterial();
      mat.name = `face-color:${colorHex}`;
      return mat;
    }),
  };
});

jest.mock('../../../bim/utils/face-appearance-color', () => ({
  faceAppearanceColorHex: jest.fn((_face: unknown) => null as string | null),
}));

const mockGetFaceMaterial3D = jest.mocked(getFaceMaterial3D);
const mockGetFaceColorMaterial3D = jest.mocked(getFaceColorMaterial3D);
const mockFaceAppearanceColorHex = jest.mocked(faceAppearanceColorHex);

beforeEach(() => {
  mockGetFaceMaterial3D.mockClear();
  mockGetFaceColorMaterial3D.mockClear();
  mockFaceAppearanceColorHex.mockClear();
  mockGetFaceMaterial3D.mockReturnValue(null);
  mockFaceAppearanceColorHex.mockReturnValue(null);
});

describe('resolveFaceMaterial — base+override cascade (delegates to MaterialCatalog3D + faceAppearanceColorHex)', () => {
  it('returns the SAME base material when neither the face nor "*" is painted', () => {
    const base = new THREE.MeshStandardMaterial();
    expect(resolveFaceMaterial('top', {}, base)).toBe(base);
    expect(resolveFaceMaterial('top', { 'side:0': { colorHex: '#ffffff' } }, base)).toBe(base);
    expect(mockGetFaceMaterial3D).not.toHaveBeenCalled();
    expect(mockGetFaceColorMaterial3D).not.toHaveBeenCalled();
  });

  it('materialId + getFaceMaterial3D returns a real textured material → textured WINS, colour path skipped', () => {
    const base = new THREE.MeshStandardMaterial();
    const textured = new THREE.MeshStandardMaterial();
    textured.name = 'textured-sentinel';
    mockGetFaceMaterial3D.mockReturnValue(textured);

    const result = resolveFaceMaterial('top', { top: { materialId: 'bmat_oak' } }, base);

    expect(mockGetFaceMaterial3D).toHaveBeenCalledTimes(1);
    expect(mockGetFaceMaterial3D).toHaveBeenCalledWith('bmat_oak');
    expect(result).toBe(textured);
    expect(mockFaceAppearanceColorHex).not.toHaveBeenCalled();
    expect(mockGetFaceColorMaterial3D).not.toHaveBeenCalled();
  });

  it('materialId + getFaceMaterial3D returns null (no texture) → falls through to faceAppearanceColorHex', () => {
    const base = new THREE.MeshStandardMaterial();
    mockGetFaceMaterial3D.mockReturnValue(null);
    mockFaceAppearanceColorHex.mockReturnValue('#c0392b');

    const result = resolveFaceMaterial('top', { top: { materialId: 'mat-concrete-c25' } }, base);

    expect(mockGetFaceMaterial3D).toHaveBeenCalledWith('mat-concrete-c25');
    expect(mockFaceAppearanceColorHex).toHaveBeenCalledTimes(1);
    expect(mockFaceAppearanceColorHex).toHaveBeenCalledWith({ materialId: 'mat-concrete-c25' });
    expect(mockGetFaceColorMaterial3D).toHaveBeenCalledWith('#c0392b');
    expect(result).toBe(mockGetFaceColorMaterial3D.mock.results[0]?.value);
  });

  it('colorHex-only override (no materialId) → getFaceMaterial3D never called, colour path used', () => {
    const base = new THREE.MeshStandardMaterial();
    mockFaceAppearanceColorHex.mockReturnValue('#27ae60');

    const result = resolveFaceMaterial('top', { top: { colorHex: '#27ae60' } }, base);

    expect(mockGetFaceMaterial3D).not.toHaveBeenCalled(); // no materialId → step 1 skipped entirely
    expect(mockFaceAppearanceColorHex).toHaveBeenCalledWith({ colorHex: '#27ae60' });
    expect(mockGetFaceColorMaterial3D).toHaveBeenCalledWith('#27ae60');
    expect(result).toBe(mockGetFaceColorMaterial3D.mock.results[0]?.value);
  });

  it('faceAppearanceColorHex returns null (no colour source at all) → falls back to baseMaterial', () => {
    const base = new THREE.MeshStandardMaterial();
    mockGetFaceMaterial3D.mockReturnValue(null);
    mockFaceAppearanceColorHex.mockReturnValue(null);

    const result = resolveFaceMaterial('top', { top: { materialId: 'mat-unknown' } }, base);

    expect(result).toBe(base);
    expect(mockGetFaceColorMaterial3D).not.toHaveBeenCalled();
  });

  it('falls back to the base "*" appearance for an unpainted face («βάψε όλο»)', () => {
    const base = new THREE.MeshStandardMaterial();
    mockFaceAppearanceColorHex.mockReturnValue('#27ae60');

    resolveFaceMaterial('side:3', { '*': { colorHex: '#27ae60' } }, base);

    expect(mockFaceAppearanceColorHex).toHaveBeenCalledWith({ colorHex: '#27ae60' });
    expect(mockGetFaceColorMaterial3D).toHaveBeenCalledWith('#27ae60');
  });

  it('a per-face override wins over the base "*"', () => {
    const base = new THREE.MeshStandardMaterial();
    mockFaceAppearanceColorHex.mockReturnValue('#c0392b');

    resolveFaceMaterial('top', { '*': { colorHex: '#000000' }, top: { colorHex: '#C0392B' } }, base);

    expect(mockFaceAppearanceColorHex).toHaveBeenCalledWith({ colorHex: '#C0392B' });
    expect(mockGetFaceColorMaterial3D).toHaveBeenCalledWith('#c0392b');
  });

  it('"*" materialId override applies to every unpainted face', () => {
    const base = new THREE.MeshStandardMaterial();
    const textured = new THREE.MeshStandardMaterial();
    mockGetFaceMaterial3D.mockReturnValue(textured);

    const result = resolveFaceMaterial('bottom', { '*': { materialId: 'bmat_brick' } }, base);

    expect(mockGetFaceMaterial3D).toHaveBeenCalledWith('bmat_brick');
    expect(result).toBe(textured);
  });
});
