/**
 * ADR-643 Φ4 — hatch image upload orchestrator tests.
 * Verifies the reuse chain (validate → saveMaterial → uploadMaterialThumbnail →
 * updateMaterial → register), the file-name → library-name derivation, and the
 * orphan-doc cleanup on upload failure.
 */

const saveMaterial = jest.fn();
const updateMaterial = jest.fn();
const deleteMaterial = jest.fn();
const uploadMaterialThumbnail = jest.fn();
const validateMaterialThumbnailFile = jest.fn();

jest.mock('../MaterialLibraryService', () => ({
  createMaterialLibraryService: () => ({ saveMaterial, updateMaterial, deleteMaterial }),
}));

jest.mock('../bim-material-thumbnail-upload.service', () => ({
  uploadMaterialThumbnail: (input: unknown) => uploadMaterialThumbnail(input),
  validateMaterialThumbnailFile: (file: unknown) => validateMaterialThumbnailFile(file),
}));

import { uploadHatchImageMaterial } from '../hatch-image-upload.service';
import {
  getUserMaterialImageUrl,
  __resetUserMaterialImageStoreForTests,
} from '../../../rendering/entities/shared/user-material-image-store';

const fileNamed = (name: string): File => ({ name }) as unknown as File;

beforeEach(() => {
  jest.clearAllMocks();
  __resetUserMaterialImageStoreForTests();
});

describe('uploadHatchImageMaterial() (ADR-643 Φ4)', () => {
  it('runs the full reuse chain and registers the asset for immediate render', async () => {
    saveMaterial.mockResolvedValue({ id: 'bmat_x' });
    uploadMaterialThumbnail.mockResolvedValue({ downloadUrl: 'https://s/img.jpg' });
    updateMaterial.mockResolvedValue(undefined);

    const result = await uploadHatchImageMaterial({
      file: fileNamed('my tile.png'),
      companyId: 'c1',
      userId: 'u1',
      fallbackName: 'Fallback',
    });

    expect(result).toEqual({ assetId: 'bmat_x', url: 'https://s/img.jpg' });
    expect(saveMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'company', category: 'other', nameEl: 'my tile', nameEn: 'my tile' }),
    );
    expect(uploadMaterialThumbnail).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'c1', materialId: 'bmat_x' }),
    );
    expect(updateMaterial).toHaveBeenCalledWith('bmat_x', { thumbnailUrl: 'https://s/img.jpg' });
    expect(getUserMaterialImageUrl('bmat_x')).toBe('https://s/img.jpg');
  });

  it('uses the fallback name when the file name has no usable base', async () => {
    saveMaterial.mockResolvedValue({ id: 'bmat_y' });
    uploadMaterialThumbnail.mockResolvedValue({ downloadUrl: 'https://s/y.jpg' });
    updateMaterial.mockResolvedValue(undefined);

    await uploadHatchImageMaterial({
      file: fileNamed('.png'),
      companyId: 'c1',
      userId: 'u1',
      fallbackName: 'Material image',
    });

    expect(saveMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ nameEl: 'Material image', nameEn: 'Material image' }),
    );
  });

  it('tears down the orphan doc and does not register when the upload fails', async () => {
    saveMaterial.mockResolvedValue({ id: 'bmat_z' });
    uploadMaterialThumbnail.mockRejectedValue(new Error('boom'));
    deleteMaterial.mockResolvedValue(undefined);

    await expect(
      uploadHatchImageMaterial({
        file: fileNamed('bad.png'),
        companyId: 'c1',
        userId: 'u1',
        fallbackName: 'Fallback',
      }),
    ).rejects.toThrow('boom');

    expect(deleteMaterial).toHaveBeenCalledWith('bmat_z');
    expect(updateMaterial).not.toHaveBeenCalled();
    expect(getUserMaterialImageUrl('bmat_z')).toBeNull();
  });

  it('fails fast (no doc created) when the file is invalid', async () => {
    validateMaterialThumbnailFile.mockImplementation(() => {
      throw new Error('format');
    });

    await expect(
      uploadHatchImageMaterial({
        file: fileNamed('note.txt'),
        companyId: 'c1',
        userId: 'u1',
        fallbackName: 'Fallback',
      }),
    ).rejects.toThrow('format');

    expect(saveMaterial).not.toHaveBeenCalled();
  });
});
