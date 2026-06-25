/**
 * ADR-526 Φ4 (Wizard Tekton import wiring) — covers the smart-upload changes
 * that let `.tek` files flow through the «Εισαγωγή Κάτοψης (Wizard)» pipeline:
 *
 *   1. `detectFloorplanFormat` classifies `.tek` / `.tek.txt` as `'tek'`
 *      (reusing the `isTekFileName` SSoT, not a new ext check).
 *   2. `uploadSmart` short-circuits the `'tek'` format with a success result and
 *      NEVER touches the legacy DXF uploader — the scene is rendered client-side
 *      by `handleFileImport` → `importTekFile` once `onSceneImported` fires.
 */

import { renderHook } from '@testing-library/react';
import {
  detectFloorplanFormat,
  useFloorplanSmartUpload,
} from '../useFloorplanSmartUpload';
import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';

// Legacy DXF uploader — must stay untouched for `.tek`.
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

describe('useFloorplanSmartUpload.uploadSmart — ADR-526 Φ4 Tekton branch', () => {
  // entityType 'building' → resolveFloorId() === null → no wipe pre-flight, so
  // the test exercises the pure `'tek'` short-circuit in isolation.
  const config: FloorplanUploadConfig = {
    companyId: 'co_test',
    entityType: ENTITY_TYPES.BUILDING,
    entityId: 'bld_test',
    domain: FILE_DOMAINS.CONSTRUCTION,
    category: FILE_CATEGORIES.FLOORPLANS,
    userId: 'usr_test',
  };

  beforeEach(() => uploadFloorplanSpy.mockClear());

  it('returns { success: true, format: "tek" } without calling the DXF uploader', async () => {
    const { result } = renderHook(() => useFloorplanSmartUpload(config));

    const res = await result.current.uploadSmart(makeFile('ΣΚΑΛΑ.tek.txt'));

    expect(res).toEqual({ success: true, format: 'tek' });
    expect(uploadFloorplanSpy).not.toHaveBeenCalled();
  });

  it('still routes `.dxf` to the legacy uploader (no regression)', async () => {
    uploadFloorplanSpy.mockResolvedValueOnce({ success: true, fileRecord: { id: 'file_1' } });
    const { result } = renderHook(() => useFloorplanSmartUpload(config));

    const res = await result.current.uploadSmart(makeFile('plan.dxf'));

    expect(uploadFloorplanSpy).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ success: true, fileId: 'file_1', format: 'dxf' });
  });
});
