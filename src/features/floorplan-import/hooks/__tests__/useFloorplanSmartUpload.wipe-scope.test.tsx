/**
 * ADR-914 §2.17 — η εισαγωγή κάτοψης ΑΚΙΝΗΤΟΥ δεν ζητά ποτέ wipe ορόφου.
 *
 * Το περιστατικό (παραγωγή, 2026-10-12): εισαγωγή DXF για επίπεδο πολυεπίπεδης μονάδας ⇒ πρώτο
 * αίτημα `POST /api/floorplans/wipe-floor`. Το `levelFloorId` απαντά «ποιον όροφο ΑΠΕΙΚΟΝΙΖΕΙ η
 * κάτοψη» (ADR-236) — διαβαζόταν ως «ποιον όροφο ΑΝΤΙΚΑΘΙΣΤΑ».
 */

import { renderHook } from '@testing-library/react';
import { useFloorplanSmartUpload } from '../useFloorplanSmartUpload';
import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';

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

const postSpy = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: (...args: unknown[]) => postSpy(...args), get: jest.fn() },
}));

const base = {
  companyId: 'co_test',
  domain: FILE_DOMAINS.CONSTRUCTION,
  category: FILE_CATEGORIES.FLOORPLANS,
  userId: 'usr_test',
};

const maisonetteLevel: FloorplanUploadConfig = {
  ...base,
  entityType: ENTITY_TYPES.PROPERTY,
  entityId: 'prop_maisonette',
  levelFloorId: 'flr_upper',
};

const storey: FloorplanUploadConfig = { ...base, entityType: ENTITY_TYPES.FLOOR, entityId: 'flr_upper' };

const dxf = () => new File(['0\nSECTION'], 'plan.dxf');

beforeEach(() => {
  uploadFloorplanSpy.mockReset().mockResolvedValue({ success: true, fileRecord: { id: 'file_1' } });
  postSpy.mockReset().mockResolvedValue({});
});

describe('useFloorplanSmartUpload — εμβέλεια του wipe', () => {
  it('ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: επίπεδο πολυεπίπεδης μονάδας ⇒ κανένα wipe ορόφου, το αρχείο ανεβαίνει', async () => {
    const { result } = renderHook(() => useFloorplanSmartUpload(maisonetteLevel));

    const res = await result.current.uploadSmart(dxf());

    expect(postSpy).not.toHaveBeenCalled();
    expect(result.current.resolveFloorId()).toBeNull();
    expect(res).toEqual({ success: true, fileId: 'file_1', format: 'dxf', error: undefined });
  });

  it('όροφος ⇒ το wipe της όψης του τρέχει πριν από το ανέβασμα, όπως πριν', async () => {
    const { result } = renderHook(() => useFloorplanSmartUpload(storey));

    await result.current.uploadSmart(dxf());

    expect(postSpy).toHaveBeenCalledWith('/api/floorplans/wipe-floor', { floorId: 'flr_upper', wipeBim: false });
    expect(postSpy.mock.invocationCallOrder[0]).toBeLessThan(uploadFloorplanSpy.mock.invocationCallOrder[0]);
  });

  it('PDF για ακίνητο ⇒ αρνείται, δεν γράφει στο υπόβαθρο του ορόφου', async () => {
    const { result } = renderHook(() => useFloorplanSmartUpload(maisonetteLevel));

    const res = await result.current.uploadSmart(new File(['%PDF'], 'plan.pdf', { type: 'application/pdf' }));

    expect(res.success).toBe(false);
    expect(postSpy).not.toHaveBeenCalled();
  });
});
