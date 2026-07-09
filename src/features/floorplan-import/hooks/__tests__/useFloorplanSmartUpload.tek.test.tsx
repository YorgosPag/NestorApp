/**
 * ADR-526 Φ4/Φ5 (Wizard Tekton import wiring + persistence) — covers the smart-upload
 * behaviour that lets `.tek` files flow through the «Εισαγωγή Κάτοψης (Wizard)» pipeline:
 *
 *   1. `detectFloorplanFormat` classifies `.tek` / `.tek.txt` as `'tek'`
 *      (reusing the `isTekFileName` SSoT, not a new ext check).
 *   2. Φ5 — `uploadSmart` routes `'tek'` through the SAME legacy uploader as DXF so a
 *      canonical FileRecord `fileId` flows downstream → `handleFileImport` fires
 *      `linkSceneToLevel` + auto-saves the derived scene blob → the plan survives a
 *      hard refresh (Φ4 was render-only with no `fileId` → the scene was lost on reload).
 *      The SceneModel parse stays client-side (`handleFileImport` → `importTekFile`).
 */

import { renderHook } from '@testing-library/react';
import {
  detectFloorplanFormat,
  useFloorplanSmartUpload,
} from '../useFloorplanSmartUpload';
import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';

// Legacy uploader — Φ5: `.tek` now rides the SAME path as DXF (FileRecord + Storage).
const uploadFloorplanSpy = jest.fn();
jest.mock('@/hooks/useFloorplanUpload', () => ({
  useFloorplanUpload: () => ({
    uploadFloorplan: uploadFloorplanSpy,
    isUploading: false,
    progress: 0,
    error: null,
    errorCode: null,
    clearError: jest.fn(),
  }),
}));

function makeFile(name: string, type = ''): File {
  return new File(['<tekton></tekton>'], name, { type });
}

describe('detectFloorplanFormat — ADR-526 Φ4 Tekton', () => {
  it('classifies `.tek` and `.tek.txt` (any case) as "tek"', () => {
    expect(detectFloorplanFormat(makeFile('ΣΚΑΛΑ.tek'))).toBe('tek');
    expect(detectFloorplanFormat(makeFile('ΣΚΑΛΑ.tek.txt'))).toBe('tek');
    expect(detectFloorplanFormat(makeFile('PLAN.TEK'))).toBe('tek');
  });

  it('still classifies the existing formats correctly', () => {
    expect(detectFloorplanFormat(makeFile('plan.dxf'))).toBe('dxf');
    expect(detectFloorplanFormat(makeFile('plan.pdf', 'application/pdf'))).toBe('pdf');
    expect(detectFloorplanFormat(makeFile('plan.png', 'image/png'))).toBe('image');
    expect(detectFloorplanFormat(makeFile('notes.txt'))).toBe('unknown');
  });
});

describe('useFloorplanSmartUpload.uploadSmart — ADR-526 Φ5 Tekton persistence', () => {
  // entityType 'building' → resolveFloorId() === null → no wipe pre-flight, so
  // the test exercises the `'tek'` upload branch in isolation.
  const config: FloorplanUploadConfig = {
    companyId: 'co_test',
    entityType: ENTITY_TYPES.BUILDING,
    entityId: 'bld_test',
    domain: FILE_DOMAINS.CONSTRUCTION,
    category: FILE_CATEGORIES.FLOORPLANS,
    userId: 'usr_test',
  };

  beforeEach(() => uploadFloorplanSpy.mockClear());

  it('Φ5 — routes `.tek` through the legacy uploader and returns its canonical fileId', async () => {
    uploadFloorplanSpy.mockResolvedValueOnce({ success: true, fileRecord: { id: 'file_tek' } });
    const { result } = renderHook(() => useFloorplanSmartUpload(config));

    const res = await result.current.uploadSmart(makeFile('ΣΚΑΛΑ.tek.txt'));

    // fileId flows downstream → linkSceneToLevel + scene-blob auto-save → survives refresh.
    expect(res).toEqual({ success: true, fileId: 'file_tek', format: 'tek' });
    expect(uploadFloorplanSpy).toHaveBeenCalledTimes(1);
    expect(uploadFloorplanSpy).toHaveBeenCalledWith(expect.any(File));
  });

  it('propagates a `.tek` upload failure (no phantom fileId)', async () => {
    uploadFloorplanSpy.mockResolvedValueOnce({ success: false, error: 'boom' });
    const { result } = renderHook(() => useFloorplanSmartUpload(config));

    const res = await result.current.uploadSmart(makeFile('PLAN.TEK'));

    expect(res).toEqual({ success: false, fileId: undefined, format: 'tek', error: 'boom' });
  });

  it('still routes `.dxf` to the legacy uploader (no regression)', async () => {
    uploadFloorplanSpy.mockResolvedValueOnce({ success: true, fileRecord: { id: 'file_1' } });
    const { result } = renderHook(() => useFloorplanSmartUpload(config));

    const res = await result.current.uploadSmart(makeFile('plan.dxf'));

    expect(uploadFloorplanSpy).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ success: true, fileId: 'file_1', format: 'dxf' });
  });
});
