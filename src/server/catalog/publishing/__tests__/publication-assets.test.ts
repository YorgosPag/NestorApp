/**
 * ADR-923 §5.6.1 · ADR-899 — ξένο SVG δεν φτάνει ποτέ στο `sharp` μέσα από το δίχτυ ασφαλείας της έκδοσης.
 */
import type { LayoutDocument } from '@/subapps/catalog/publishing/layout-model';
import type { CatalogAssetDefinition } from '@/subapps/catalog/types/asset';
import type { StoredCatalogRecord } from '../../catalog-store.server';
import { ensureCatalogAssetRenditions } from '../../catalog-asset-renditions.server';
import { resolvePublicationAssets } from '../publication-assets.server';

let mockFile: Record<string, unknown> | undefined;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ data: () => mockFile }) }) }) }),
}));
jest.mock('@/server/files/file-record-bucket', () => ({ fileRecordBucket: jest.fn() }));
jest.mock('../../catalog-asset-renditions.server', () => ({ ensureCatalogAssetRenditions: jest.fn(async () => null) }));

const asset = { kind: 'image', fileId: 'f1' } as unknown as StoredCatalogRecord<CatalogAssetDefinition>;
const resolve = () => resolvePublicationAssets({} as LayoutDocument, new Map([['a1', asset]]));

describe('resolvePublicationAssets: αρχεία χωρίς αποδόσεις', () => {
  beforeEach(() => jest.clearAllMocks());

  it('SVG ⇒ renditionMissing, χωρίς να ζητηθεί απόδοση', async () => {
    mockFile = { ext: 'svg', contentType: 'image/svg+xml', storagePath: 'x.svg' };
    await expect(resolve()).rejects.toMatchObject({ failure: 'renditionMissing' });
    expect(ensureCatalogAssetRenditions).not.toHaveBeenCalled();
  });

  it('εικόνα που αποδίδεται περνά στο δίχτυ ασφαλείας', async () => {
    mockFile = { ext: 'png', contentType: 'image/png', storagePath: 'x.png' };
    await expect(resolve()).rejects.toMatchObject({ failure: 'renditionMissing' });
    expect(ensureCatalogAssetRenditions).toHaveBeenCalledTimes(1);
  });
});
