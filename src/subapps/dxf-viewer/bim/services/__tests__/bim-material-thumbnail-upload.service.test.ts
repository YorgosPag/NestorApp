/**
 * bim-material-thumbnail-upload.service tests (ADR-413 §2D Phase 2).
 *
 * Covers client-side validation (format/size), the company/material guards, and
 * the happy path — asserting the upload targets the `materialId`-keyed,
 * company-scoped storage path (the ONE central appearance asset per material).
 */

import {
  validateMaterialThumbnailFile,
  uploadMaterialThumbnail,
  MaterialThumbnailUploadError,
  MATERIAL_THUMBNAIL_MAX_BYTES,
} from '../bim-material-thumbnail-upload.service';

// ── Firebase storage mocks ────────────────────────────────────────────────────
const uploadBytesMock = jest.fn();
const getDownloadURLMock = jest.fn();
const refMock = jest.fn((_storage: unknown, path: string) => ({ path }));

jest.mock('@/lib/firebase', () => ({ storage: { __mock: true } }));
jest.mock('firebase/storage', () => ({
  ref: (storage: unknown, path: string) => refMock(storage, path),
  uploadBytes: (...args: unknown[]) => uploadBytesMock(...args),
  getDownloadURL: (...args: unknown[]) => getDownloadURLMock(...args),
}));

function fileOfSize(name: string, bytes: number, type = 'image/png'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

beforeEach(() => {
  jest.clearAllMocks();
  uploadBytesMock.mockResolvedValue(undefined);
  getDownloadURLMock.mockResolvedValue('https://storage.example/thumb.png');
});

describe('validateMaterialThumbnailFile', () => {
  it('accepts png/jpg/jpeg/webp and returns the ext', () => {
    expect(validateMaterialThumbnailFile(fileOfSize('a.png', 10))).toBe('png');
    expect(validateMaterialThumbnailFile(fileOfSize('a.jpg', 10))).toBe('jpg');
    expect(validateMaterialThumbnailFile(fileOfSize('a.jpeg', 10))).toBe('jpeg');
    expect(validateMaterialThumbnailFile(fileOfSize('a.webp', 10))).toBe('webp');
  });

  it('rejects an unsupported extension with code "format"', () => {
    expect(() => validateMaterialThumbnailFile(fileOfSize('a.gif', 10)))
      .toThrow(expect.objectContaining({ code: 'format' }));
  });

  it('rejects a file over the size cap with code "size"', () => {
    const tooBig = fileOfSize('big.png', MATERIAL_THUMBNAIL_MAX_BYTES + 1);
    expect(() => validateMaterialThumbnailFile(tooBig))
      .toThrow(expect.objectContaining({ code: 'size' }));
  });
});

describe('uploadMaterialThumbnail', () => {
  const baseInput = { companyId: 'cmp1', materialId: 'bmat_abc' };

  it('throws "missing-company" when companyId is empty (no upload)', async () => {
    await expect(
      uploadMaterialThumbnail({ ...baseInput, companyId: '', file: fileOfSize('a.png', 10) }),
    ).rejects.toMatchObject({ code: 'missing-company' });
    expect(uploadBytesMock).not.toHaveBeenCalled();
  });

  it('throws "missing-material" when materialId is empty (no upload)', async () => {
    await expect(
      uploadMaterialThumbnail({ ...baseInput, materialId: '', file: fileOfSize('a.png', 10) }),
    ).rejects.toMatchObject({ code: 'missing-material' });
    expect(uploadBytesMock).not.toHaveBeenCalled();
  });

  it('uploads to the materialId-keyed, company-scoped path and returns the URL', async () => {
    const result = await uploadMaterialThumbnail({ ...baseInput, file: fileOfSize('a.webp', 10, 'image/webp') });

    expect(refMock).toHaveBeenCalledWith(
      expect.anything(),
      'companies/cmp1/bim-material-thumbnails/bmat_abc.webp',
    );
    expect(uploadBytesMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'companies/cmp1/bim-material-thumbnails/bmat_abc.webp' }),
      expect.any(File),
      { contentType: 'image/webp' },
    );
    expect(result).toEqual({
      storagePath: 'companies/cmp1/bim-material-thumbnails/bmat_abc.webp',
      downloadUrl: 'https://storage.example/thumb.png',
      ext: 'webp',
    });
  });

  it('wraps a storage failure as "upload-failed"', async () => {
    uploadBytesMock.mockRejectedValueOnce(new Error('network'));
    await expect(
      uploadMaterialThumbnail({ ...baseInput, file: fileOfSize('a.png', 10) }),
    ).rejects.toBeInstanceOf(MaterialThumbnailUploadError);
  });
});
