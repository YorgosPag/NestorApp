/**
 * ADR-914 §2.20 — το `levelFloorId` της ρύθμισης φτάνει ως το FileRecord.
 *
 * Το περιστατικό (παραγωγή, 2026-10-13): δύο κατόψεις επιπέδων μεζονέτας γράφτηκαν ΧΩΡΙΣ
 * `levelFloorId`. Η ρύθμιση το είχε· το hook το έχανε στη χειρόγραφη αντιγραφή πεδίων προς το
 * `uploadFileWithPolicy`, και το gateway δεν είχε καν θέση για αυτό. Χωρίς το πεδίο: ο έλεγχος
 * «υπάρχει ήδη κάτοψη;» δεν βρίσκει ποτέ τίποτα (καμία διαδοχή), και η καρτέλα κατόψεων του
 * ακινήτου τις δείχνει όλες στο πρώτο επίπεδο.
 */

import { act, renderHook } from '@testing-library/react';
import { useFloorplanUpload, type FloorplanUploadConfig } from '../useFloorplanUpload';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';

const uploadSpy = jest.fn();
jest.mock('@/services/filesystem/upload-orchestrator-gateway', () => ({
  uploadFileWithPolicy: (...args: unknown[]) => uploadSpy(...args),
}));

jest.mock('@/services/floorplans/floorplan-processing-mutation-gateway', () => ({
  processFloorplanWithPolicy: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/floorplans/FloorplanProcessor', () => ({
  isFloorplanFile: () => true,
}));

const maisonetteLevel: FloorplanUploadConfig = {
  companyId: 'co_test',
  domain: FILE_DOMAINS.CONSTRUCTION,
  category: FILE_CATEGORIES.FLOORPLANS,
  userId: 'usr_test',
  entityType: ENTITY_TYPES.PROPERTY,
  entityId: 'prop_maisonette',
  levelFloorId: 'flr_upper',
};

const dxf = () => new File(['0\nSECTION'], 'plan.dxf');

beforeEach(() => {
  uploadSpy.mockReset().mockResolvedValue({ fileId: 'file_1', downloadUrl: 'u', fileRecord: { id: 'file_1' } });
});

describe('useFloorplanUpload — ο όροφος της όψης', () => {
  it('ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: επίπεδο πολυεπίπεδης μονάδας ⇒ το `levelFloorId` φεύγει προς το gateway', async () => {
    const { result } = renderHook(() => useFloorplanUpload(maisonetteLevel));

    let res: Awaited<ReturnType<typeof result.current.uploadFloorplan>> | undefined;
    await act(async () => { res = await result.current.uploadFloorplan(dxf()); });

    expect(res?.success).toBe(true);
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy.mock.calls[0][1]).toMatchObject({ levelFloorId: 'flr_upper', entityId: 'prop_maisonette' });
  });

  it('χωρίς επίπεδο ⇒ κανένα `levelFloorId` (όχι `undefined` κλειδί στο FileRecord)', async () => {
    const { levelFloorId: _omit, ...singleLevel } = maisonetteLevel;
    const { result } = renderHook(() => useFloorplanUpload(singleLevel));

    await act(async () => { await result.current.uploadFloorplan(dxf()); });

    expect(uploadSpy.mock.calls[0][1]).not.toHaveProperty('levelFloorId');
  });
});
