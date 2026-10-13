/**
 * ADR-914 §2.20 — το βήμα «Ακίνητο» δείχνει κάθε ακίνητο που ΠΙΑΝΕΙ τον όροφο.
 *
 * Το περιστατικό (παραγωγή, 2026-10-13): μεζονέτα με επίπεδα στον 1ο και στον 2ο όροφο. Ο
 * άνθρωπος διαλέγει «2ος Όροφος» ⇒ «Δεν βρέθηκαν στοιχεία», «Επόμενο» ανενεργό. Ο οδηγός ρωτούσε
 * τον διακομιστή `floorId ==`, που ταιριάζει μόνο τον ΚΥΡΙΟ όροφο· ο κανόνας «πολυεπίπεδη μονάδα
 * εμφανίζεται σε κάθε όροφο που πιάνει» (`propertiesOnFloor`, ADR-329 §3.7.1) υπήρχε, αλλού.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useFloorplanImportState } from '../useFloorplanImportState';

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'usr_test', companyId: 'co_test' }, loading: false }),
}));

const MAISONETTE = {
  id: 'prop_maisonette',
  name: 'Μεζονέτα',
  floorId: 'flr_1',
  isMultiLevel: true,
  levels: [
    { floorId: 'flr_1', floorNumber: 1, name: '1ος Όροφος', isPrimary: true },
    { floorId: 'flr_2', floorNumber: 2, name: '2ος Όροφος', isPrimary: false },
  ],
};
const APARTMENT = { id: 'prop_apartment', name: 'Διαμέρισμα', floorId: 'flr_1' };
const PROPERTIES = [MAISONETTE, APARTMENT];

/** Ο διακομιστής, όπως είναι: `floorId` ⇒ ισότητα με τον ΚΥΡΙΟ όροφο. */
jest.mock('@/hooks/useFirestoreProperties', () => ({
  useFirestoreProperties: (options: { floorId?: string; autoFetch?: boolean }) => ({
    properties: options.autoFetch === false
      ? []
      : PROPERTIES.filter((p) => !options.floorId || p.floorId === options.floorId),
    loading: false,
  }),
}));

const FLOORS = [
  { id: 'flr_1', number: 1, name: '1', longName: '1ος Όροφος' },
  { id: 'flr_2', number: 2, name: '2', longName: '2ος Όροφος' },
  { id: 'flr_3', number: 3, name: '3', longName: '3ος Όροφος' },
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

async function openAtPropertyStep(floorId: string): Promise<WizardState> {
  const { result } = renderHook(() => useFloorplanImportState({ isOpen: true }));
  await pickAndAdvance(result, 'co_test');
  await pickAndAdvance(result, 'proj_1');
  await pickAndAdvance(result, 'bldg_1');
  await pickAndAdvance(result, floorId);
  expect(result.current.step).toBe(5);
  return result;
}

describe('useFloorplanImportState — ακίνητα του ορόφου', () => {
  it('ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: ο όροφος του ΔΕΥΤΕΡΟΥ επιπέδου μιας μεζονέτας τη δείχνει', async () => {
    const result = await openAtPropertyStep('flr_2');

    expect(result.current.unitItems.map((u) => u.id)).toEqual(['prop_maisonette']);
  });

  it('η επιλογή της προεπιλέγει το επίπεδο του ορόφου που ήδη διάλεξε ο άνθρωπος', async () => {
    const result = await openAtPropertyStep('flr_2');

    act(() => result.current.selectProperty('prop_maisonette'));

    expect(result.current.selection.levelFloorId).toBe('flr_2');
    expect(result.current.selection.levelName).toBe('2ος Όροφος');
    expect(result.current.canProceed).toBe(true);
  });

  it('ο άνθρωπος αλλάζει επίπεδο, και η ρύθμιση ανεβάσματος δένει στον όροφο ΕΚΕΙΝΟΥ', async () => {
    const result = await openAtPropertyStep('flr_2');

    act(() => result.current.selectProperty('prop_maisonette'));
    act(() => result.current.selectLevel('flr_1'));
    act(() => result.current.handleNext());

    expect(result.current.uploadConfig?.levelFloorId).toBe('flr_1');
    expect(result.current.uploadConfig?.linkedTo).toContain('floor:flr_1');
  });

  it('ο κύριος όροφος δείχνει και τα μονοεπίπεδα· μονοεπίπεδο ⇒ κανένα επίπεδο', async () => {
    const result = await openAtPropertyStep('flr_1');

    expect(result.current.unitItems.map((u) => u.id).sort()).toEqual(['prop_apartment', 'prop_maisonette']);

    act(() => result.current.selectProperty('prop_apartment'));

    expect(result.current.selection.levelFloorId).toBeNull();
    expect(result.current.canProceed).toBe(true);
  });

  it('όροφος που δεν τον πιάνει κανένα ακίνητο ⇒ κενή λίστα, δεν προχωρά', async () => {
    const result = await openAtPropertyStep('flr_3');

    expect(result.current.unitItems).toEqual([]);
    expect(result.current.canProceed).toBe(false);
  });
});
