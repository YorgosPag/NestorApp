/**
 * material-appearance-thumbnail-store tests (ADR-687 Φ6).
 *
 * The offscreen sphere renderer is mocked (jsdom has no WebGL), so we assert the
 * store's cache/signature/failure logic in isolation: one render per unique
 * appearance, cached data URLs, distinct signatures per visual field, and a
 * graceful null (no retry storm) when rendering is unavailable.
 */

const renderMock = jest.fn<string | null, [unknown]>();
jest.mock('../material-thumbnail-sphere', () => ({
  renderAppearanceThumbnail: (def: unknown) => renderMock(def),
}));

import type { PbrMaterialDef } from '../../../bim/materials/material-catalog-defs';
import {
  appearanceThumbnailSignature,
  materialAppearanceThumbnailStore,
  __resetMaterialAppearanceThumbnailStoreForTests,
} from '../material-appearance-thumbnail-store';

const glass: PbrMaterialDef = {
  color: 0x4ade80, roughness: 0.1, metalness: 0,
  transmission: 0.7, ior: 1.5, thickness: 0.65,
};

beforeEach(() => {
  __resetMaterialAppearanceThumbnailStoreForTests();
  renderMock.mockReset();
});

describe('appearanceThumbnailSignature', () => {
  it('is stable for the same def and distinct for a changed physical field', () => {
    const sig = appearanceThumbnailSignature(glass);
    expect(appearanceThumbnailSignature({ ...glass })).toBe(sig);
    expect(appearanceThumbnailSignature({ ...glass, transmission: 0.2 })).not.toBe(sig);
    expect(appearanceThumbnailSignature({ ...glass, ior: 2.0 })).not.toBe(sig);
    expect(appearanceThumbnailSignature({ ...glass, clearcoat: 1 })).not.toBe(sig);
  });

  it('defaults optional fields so a bare def gets a stable key', () => {
    const bare: PbrMaterialDef = { color: 0xffffff, roughness: 0.5, metalness: 0 };
    expect(appearanceThumbnailSignature(bare)).toBe(appearanceThumbnailSignature({ ...bare }));
  });
});

describe('materialAppearanceThumbnailStore', () => {
  it('renders once per signature and caches the data URL', () => {
    renderMock.mockReturnValue('data:image/png;base64,AAA');
    const sig = appearanceThumbnailSignature(glass);

    materialAppearanceThumbnailStore.preload(sig, glass);
    expect(materialAppearanceThumbnailStore.getUrl(sig)).toBe('data:image/png;base64,AAA');
    expect(renderMock).toHaveBeenCalledTimes(1);

    materialAppearanceThumbnailStore.preload(sig, glass); // cache hit → no re-render
    expect(renderMock).toHaveBeenCalledTimes(1);
  });

  it('renders distinct signatures separately', () => {
    renderMock.mockReturnValue('data:image/png;base64,BBB');
    const s1 = appearanceThumbnailSignature(glass);
    const s2 = appearanceThumbnailSignature({ ...glass, color: 0xff0000 });
    materialAppearanceThumbnailStore.preload(s1, glass);
    materialAppearanceThumbnailStore.preload(s2, { ...glass, color: 0xff0000 });
    expect(renderMock).toHaveBeenCalledTimes(2);
  });

  it('records a failure once (no retry storm) when rendering is unavailable', () => {
    renderMock.mockReturnValue(null); // no-WebGL / draw failure
    const sig = appearanceThumbnailSignature(glass);

    materialAppearanceThumbnailStore.preload(sig, glass);
    expect(materialAppearanceThumbnailStore.getUrl(sig)).toBeUndefined();
    expect(renderMock).toHaveBeenCalledTimes(1);

    materialAppearanceThumbnailStore.preload(sig, glass); // failed → not retried
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
