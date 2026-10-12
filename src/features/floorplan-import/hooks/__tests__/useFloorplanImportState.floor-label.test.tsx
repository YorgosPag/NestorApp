/**
 * ADR-914 §8.18 — ο οδηγός εισαγωγής δείχνει τον όροφο με το ΙΔΙΟ όνομα που δείχνουν οι καρτέλες.
 *
 * Το περιστατικό (παραγωγή, 2026-10-12): βήμα «Όροφος» με «F» / «SP», καρτέλες με «Θεμελίωση» /
 * «Απόληξη Κλιμακοστασίου». Ο οδηγός διάβαζε `name || 'Όροφος N'`· οι καρτέλες `longName` πρώτα.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useFloorplanImportState } from '../useFloorplanImportState';
import { storedFloorLabel } from '@/lib/floor/floor-label-bundle';

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'usr_test', companyId: 'co_test' }, loading: false }),
}));

jest.mock('@/hooks/useFirestoreProperties', () => ({
  useFirestoreProperties: () => ({ properties: [], loading: false }),
}));

const FLOORS = [
  { id: 'flr_f', number: -2, name: 'F', longName: 'Θεμελίωση', kind: 'foundation' },
  { id: 'flr_0', number: 0, name: '' },
  { id: 'flr_sp', number: 5, name: 'SP', longName: 'Απόληξη Κλιμακοστασίου', kind: 'stair-penthouse' },
];

const getSpy = jest.fn(async (url: string) => {
  if (url.includes('floors')) return { floors: FLOORS };
  if (url.includes('buildings')) return { buildings: [{ id: 'bldg_1', name: 'Κτίριο Α' }] };
  if (url.includes('projects')) return { projects: [{ id: 'proj_1', name: 'Έργο Α' }] };
  return { companies: [{ id: 'co_test', companyName: 'ALFA' }] };
});

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (url: string) => getSpy(url), post: jest.fn() },
}));

type WizardState = { current: ReturnType<typeof useFloorplanImportState> };

async function pickAndAdvance(result: WizardState, id: string): Promise<void> {
  await waitFor(() => expect(result.current.currentStepItems.some((item) => item.id === id)).toBe(true));
  act(() => result.current.selectEntity(id));
  act(() => result.current.handleNext());
}

async function openAtFloorStep(): Promise<WizardState> {
  const { result } = renderHook(() => useFloorplanImportState({ isOpen: true }));
  await pickAndAdvance(result, 'co_test');
  await pickAndAdvance(result, 'proj_1');
  await pickAndAdvance(result, 'bldg_1');
  await waitFor(() => expect(result.current.currentStepItems).toHaveLength(FLOORS.length));
  return result;
}

describe('useFloorplanImportState — ετικέτα ορόφου', () => {
  it('ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: «Θεμελίωση» / «Απόληξη Κλιμακοστασίου», όχι «F» / «SP»', async () => {
    const result = await openAtFloorStep();

    expect(result.current.currentStepItems.map((item) => item.label)).toEqual([
      'Θεμελίωση',
      'Ισόγειο',
      'Απόληξη Κλιμακοστασίου',
    ]);
  });

  it('ο οδηγός και οι καρτέλες ρωτούν τον ΙΔΙΟ κανόνα', async () => {
    const result = await openAtFloorStep();

    expect(result.current.currentStepItems.map((item) => item.label)).toEqual(FLOORS.map(storedFloorLabel));
  });

  it('το όνομα που επιλέχθηκε φτάνει στη σύνοψη και στην ετικέτα του αρχείου', async () => {
    const result = await openAtFloorStep();

    act(() => result.current.selectEntity('flr_sp'));
    act(() => result.current.jumpToUpload('floor'));

    expect(result.current.selection.floorName).toBe('Απόληξη Κλιμακοστασίου');
    expect(result.current.uploadConfig?.entityLabel).toBe('Απόληξη Κλιμακοστασίου');
  });
});
