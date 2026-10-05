/**
 * 🧭 Η ΑΓΚΥΡΑ ΤΩΝ ΤΡΙΩΝ ΔΡΟΜΩΝ ΤΗΣ ΣΚΗΝΗΣ (ADR-899 §9 θέμα 9, 2026-10-05) — η απόφαση ως καθαρή συνάρτηση.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Δ1: η σειρά αλλάζει (API πριν από την ενσωματωμένη σκηνή, ή bytes πριν από το API).
 * - Δ2: ο δρόμος bytes μιας εγγραφής CAD παίρνει το `downloadUrl` του συνοδευτικού αντί για το πρωτότυπο.
 * - Δ3: πρωτότυπο διαβάζεται πριν ολοκληρωθεί το ανέβασμα · ή ο φρουρός εφαρμόζεται και στα `.json`.
 * - Δ4: η πηγή «μόνο bytes» περνά από φρουρό κατάστασης που δεν έχει.
 */

jest.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('@/services/firestore/firestore-query.service', () => ({
  firestoreQueryService: { subscribeDoc: jest.fn(() => () => undefined) },
}));
// ⚠️ Το `t` ΣΤΑΘΕΡΟ: είναι στα deps του φορτωτή — νέο `t` ανά render = άπειρος βρόχος fetch (παγίδα θέματος 8).
jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});
jest.mock('../floorplan-scene-bytes', () => ({
  loadSceneFromBytes: jest.fn(),
  UnreadableScenePayloadError: class UnreadableScenePayloadError extends Error {},
}));

import { buildProxyUrl } from '@/lib/storage/storage-object-url';
import type { DxfSceneData, FileRecord } from '@/types/file-record';

import { renderHook, waitFor } from '@testing-library/react';

import { planSceneLoad, useFloorplanSceneLoader } from '../useFloorplanSceneLoader';

const DXF = 'companies/c1/entities/property/p1/domains/construction/categories/floorplans/files/file_9.dxf';
const SCENE = DXF.replace(/\.dxf$/, '.scene.json');
const sceneUrl = `https://firebasestorage.googleapis.com/v0/b/bucket.test/o/${encodeURIComponent(SCENE)}?alt=media&token=t`;
const scene = { entities: [] } as unknown as DxfSceneData;

const record = (fields: Partial<FileRecord>): FileRecord =>
  ({ id: 'file_9', ext: 'dxf', status: 'ready', originalFilename: 'Ισόγειο 1.dxf', storagePath: DXF, ...fields }) as FileRecord;

// Δ5 — η έκβαση «ακόμη επεξεργάζεται» (202 του scene API) δεν είχε καμία άγκυρα: η μετάλλαξη που την έσβηνε επέζησε.
describe('useFloorplanSceneLoader — scene API 202', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('🔴 Δ5 202 ⇒ ονομασμένη ειδοποίηση, καμία σκηνή, και η φόρτωση τελειώνει', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 202, ok: true }) as unknown as typeof fetch;
    const file = record({ processedData: { fileType: 'dxf', processedDataPath: SCENE } as FileRecord['processedData'] });
    const { result } = renderHook(() => useFloorplanSceneLoader(file, true, 'dxf'));
    await waitFor(() => expect(result.current.sceneError).toBe('floorplan.processingInProgress'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadedScene).toBeNull();
    expect(result.current.isEmpty).toBe(false);
  });
});

describe('planSceneLoad', () => {
  test('🔴 Δ1 ενσωματωμένη σκηνή νικά το API · το API νικά τα bytes', () => {
    const processed = { fileType: 'dxf', processedDataPath: SCENE } as FileRecord['processedData'];
    expect(planSceneLoad(record({ processedData: { ...processed, scene } as FileRecord['processedData'] }), 'dxf'))
      .toEqual({ kind: 'embedded', scene });
    expect(planSceneLoad(record({ processedData: processed, downloadUrl: sceneUrl }), 'dxf'))
      .toEqual({ kind: 'api', fileId: 'file_9' });
  });

  test('🔴 Δ2 εγγραφή CAD χωρίς `processedDataPath` ⇒ bytes του ΠΡΩΤΟΤΥΠΟΥ, όχι του συνοδευτικού', () => {
    expect(planSceneLoad(record({ downloadUrl: sceneUrl, userDrawingUnits: 'mm' as FileRecord['userDrawingUnits'] }), 'dxf'))
      .toEqual({ kind: 'bytes', url: buildProxyUrl(DXF), fileName: 'Ισόγειο 1.dxf', userDrawingUnits: 'mm' });
  });

  test('🔴 Δ3 το πρωτότυπο περιμένει το ανέβασμα — τα `.json` όχι', () => {
    const pending = record({ status: 'pending' as FileRecord['status'] });
    expect(planSceneLoad(pending, 'dxf')).toEqual({ kind: 'none' });
    expect(planSceneLoad(pending, 'json').kind).toBe('bytes');
  });

  test('χωρίς URL και χωρίς μονοπάτι ⇒ none', () => {
    expect(planSceneLoad(record({ storagePath: '' }), 'dxf')).toEqual({ kind: 'none' });
  });

  test('🔴 Δ4 πηγή «μόνο bytes» ⇒ το URL της αυτούσιο, χωρίς φρουρό κατάστασης', () => {
    expect(planSceneLoad({ kind: 'bytes', url: 'https://signed.test/a.dxf', fileName: 'a.dxf' }, 'dxf'))
      .toEqual({ kind: 'bytes', url: 'https://signed.test/a.dxf', fileName: 'a.dxf', userDrawingUnits: undefined });
    expect(planSceneLoad({ kind: 'bytes', url: '', fileName: 'a.dxf' }, 'dxf')).toEqual({ kind: 'none' });
  });
});
