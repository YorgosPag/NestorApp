/**
 * bim-material-texture-upload.service tests (ADR-413 §2D Phase 3).
 *
 * Covers client-side validation (format/size), the company/material guards, the
 * per-map storage path (materialId-keyed + map sub-key), and the error wrapping.
 */

import {
  validateMaterialTextureFile,
  uploadMaterialTextureMap,
  isMaterialTextureReachable,
  MaterialTextureUploadError,
  MATERIAL_TEXTURE_MAX_BYTES,
} from '../bim-material-texture-upload.service';

// ── Firebase storage mocks ────────────────────────────────────────────────────
const uploadBytesMock = jest.fn();
const getDownloadURLMock = jest.fn();
const getMetadataMock = jest.fn();
const refMock = jest.fn((_storage: unknown, path: string) => ({ path }));

jest.mock('@/lib/firebase', () => ({ storage: { __mock: true } }));
jest.mock('firebase/storage', () => ({
  ref: (storage: unknown, path: string) => refMock(storage, path),
  uploadBytes: (...args: unknown[]) => uploadBytesMock(...args),
  getDownloadURL: (...args: unknown[]) => getDownloadURLMock(...args),
  getMetadata: (...args: unknown[]) => getMetadataMock(...args),
}));

function fileOfSize(name: string, bytes: number, type = 'image/png'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

beforeEach(() => {
  jest.clearAllMocks();
  uploadBytesMock.mockResolvedValue(undefined);
  getDownloadURLMock.mockResolvedValue('https://storage.example/albedo.jpg');
  getMetadataMock.mockResolvedValue({ size: 10 }); // durable by default
});

describe('validateMaterialTextureFile', () => {
  it('accepts png/jpg/jpeg/webp and returns the ext', () => {
    expect(validateMaterialTextureFile(fileOfSize('a.png', 10))).toBe('png');
    expect(validateMaterialTextureFile(fileOfSize('a.jpg', 10))).toBe('jpg');
    expect(validateMaterialTextureFile(fileOfSize('a.jpeg', 10))).toBe('jpeg');
    expect(validateMaterialTextureFile(fileOfSize('a.webp', 10))).toBe('webp');
  });

  it('rejects an unsupported extension with code "format"', () => {
    expect(() => validateMaterialTextureFile(fileOfSize('a.tga', 10)))
      .toThrow(expect.objectContaining({ code: 'format' }));
  });

  it('rejects a file over the size cap with code "size"', () => {
    const tooBig = fileOfSize('big.png', MATERIAL_TEXTURE_MAX_BYTES + 1);
    expect(() => validateMaterialTextureFile(tooBig))
      .toThrow(expect.objectContaining({ code: 'size' }));
  });
});

describe('uploadMaterialTextureMap', () => {
  const baseInput = { companyId: 'cmp1', materialId: 'bmat_abc', map: 'albedo' as const };

  it('throws "missing-company" when companyId is empty (no upload)', async () => {
    await expect(
      uploadMaterialTextureMap({ ...baseInput, companyId: '', file: fileOfSize('a.png', 10) }),
    ).rejects.toMatchObject({ code: 'missing-company' });
    expect(uploadBytesMock).not.toHaveBeenCalled();
  });

  it('throws "missing-material" when materialId is empty (no upload)', async () => {
    await expect(
      uploadMaterialTextureMap({ ...baseInput, materialId: '', file: fileOfSize('a.png', 10) }),
    ).rejects.toMatchObject({ code: 'missing-material' });
    expect(uploadBytesMock).not.toHaveBeenCalled();
  });

  it('uploads to the materialId + map-keyed company-scoped path', async () => {
    const result = await uploadMaterialTextureMap({
      ...baseInput, map: 'normal', file: fileOfSize('n.jpg', 10, 'image/jpeg'),
    });

    expect(refMock).toHaveBeenCalledWith(
      expect.anything(),
      'companies/cmp1/bim-material-textures/bmat_abc/normal.jpg',
    );
    expect(uploadBytesMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'companies/cmp1/bim-material-textures/bmat_abc/normal.jpg' }),
      expect.any(File),
      { contentType: 'image/jpeg' },
    );
    expect(result).toEqual({
      storagePath: 'companies/cmp1/bim-material-textures/bmat_abc/normal.jpg',
      downloadUrl: 'https://storage.example/albedo.jpg',
      ext: 'jpg',
    });
  });

  it('wraps a storage failure as "upload-failed"', async () => {
    uploadBytesMock.mockRejectedValueOnce(new Error('network'));
    await expect(
      uploadMaterialTextureMap({ ...baseInput, file: fileOfSize('a.png', 10) }),
    ).rejects.toBeInstanceOf(MaterialTextureUploadError);
  });

  it('throws "upload-failed" when the object is not durable after write (verify-after-write)', async () => {
    // uploadBytes + getDownloadURL «succeed», but the object is gone → ghost-doc guard fires.
    getMetadataMock.mockRejectedValueOnce({ code: 'storage/object-not-found' });
    await expect(
      uploadMaterialTextureMap({ ...baseInput, file: fileOfSize('a.png', 10) }),
    ).rejects.toMatchObject({ code: 'upload-failed' });
    expect(uploadBytesMock).toHaveBeenCalled(); // the write was attempted
  });
});

describe('isMaterialTextureReachable', () => {
  it('returns true when the object exists', async () => {
    getMetadataMock.mockResolvedValueOnce({ size: 10 });
    await expect(isMaterialTextureReachable('companies/c/bim-material-textures/m/albedo.jpg')).resolves.toBe(true);
  });

  it('returns false ONLY on a definitive object-not-found (→ safe to repair)', async () => {
    getMetadataMock.mockRejectedValueOnce({ code: 'storage/object-not-found' });
    await expect(isMaterialTextureReachable('https://s/x.jpg')).resolves.toBe(false);
  });

  it('returns true on an ambiguous error (permission/network) to avoid a false repair loop', async () => {
    getMetadataMock.mockRejectedValueOnce({ code: 'storage/unauthorized' });
    await expect(isMaterialTextureReachable('https://s/x.jpg')).resolves.toBe(true);
  });
});
