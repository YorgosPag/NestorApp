/**
 * ADR-643 Φ4 (delete) — hatch image removal orchestrator tests.
 * Verifies: Firestore doc delete → best-effort Storage delete order, storage
 * failure is swallowed (doc already gone), doc-delete failure propagates BEFORE any
 * storage op, and the no-URL path skips storage entirely.
 */

const deleteMaterial = jest.fn();
const deleteMaterialThumbnailByUrl = jest.fn();

jest.mock('../MaterialLibraryService', () => ({
  createMaterialLibraryService: () => ({ deleteMaterial }),
}));

jest.mock('../bim-material-thumbnail-upload.service', () => ({
  deleteMaterialThumbnailByUrl: (url: string) => deleteMaterialThumbnailByUrl(url),
}));

// Self-contained (no out-of-scope ref): the logger is built at the service's module
// top level, so the factory must not touch a not-yet-initialised outer const (TDZ).
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { deleteHatchImageMaterial } from '../hatch-image-delete.service';

const BASE = { assetId: 'bmat_x', companyId: 'c1', userId: 'u1' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('deleteHatchImageMaterial() (ADR-643 Φ4 delete)', () => {
  it('deletes the Firestore doc then the Storage thumbnail (both, right args)', async () => {
    deleteMaterial.mockResolvedValue(undefined);
    deleteMaterialThumbnailByUrl.mockResolvedValue(undefined);

    await deleteHatchImageMaterial({ ...BASE, thumbnailUrl: 'https://s/img.jpg' });

    expect(deleteMaterial).toHaveBeenCalledWith('bmat_x');
    expect(deleteMaterialThumbnailByUrl).toHaveBeenCalledWith('https://s/img.jpg');
  });

  it('swallows a Storage failure (doc already deleted → orphan blob logged, no throw)', async () => {
    deleteMaterial.mockResolvedValue(undefined);
    deleteMaterialThumbnailByUrl.mockRejectedValue(new Error('storage down'));

    await expect(
      deleteHatchImageMaterial({ ...BASE, thumbnailUrl: 'https://s/img.jpg' }),
    ).resolves.toBeUndefined();

    expect(deleteMaterial).toHaveBeenCalledWith('bmat_x');
    expect(deleteMaterialThumbnailByUrl).toHaveBeenCalledWith('https://s/img.jpg');
  });

  it('propagates a doc-delete failure BEFORE touching Storage (nothing removed)', async () => {
    deleteMaterial.mockRejectedValue(new Error('BUILTIN_NOT_MUTABLE'));

    await expect(
      deleteHatchImageMaterial({ ...BASE, thumbnailUrl: 'https://s/img.jpg' }),
    ).rejects.toThrow('BUILTIN_NOT_MUTABLE');

    expect(deleteMaterialThumbnailByUrl).not.toHaveBeenCalled();
  });

  it('skips Storage entirely when no thumbnailUrl is provided', async () => {
    deleteMaterial.mockResolvedValue(undefined);

    await deleteHatchImageMaterial({ ...BASE });

    expect(deleteMaterial).toHaveBeenCalledWith('bmat_x');
    expect(deleteMaterialThumbnailByUrl).not.toHaveBeenCalled();
  });
});
