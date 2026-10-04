/**
 * ADR-898 §21.6 Ε3 — η υποβολή της φόρμας «νέα θέση» **δεν καταπίνει** την αποτυχία: πηγαίνει στον ΕΝΑ βοηθό
 * (ήταν `console.error` και τίποτα στον άνθρωπο — π.χ. `POLICY_DUPLICATE_CODE`).
 */

import { act, renderHook } from '@testing-library/react';

import type { Translate } from '@/i18n/hooks/useTranslation';

import { useParkingCreateForm } from '../useParkingCreateForm';

const createParking = jest.fn();
jest.mock('@/services/parking-mutation-gateway', () => ({
  createParkingWithPolicy: (...args: unknown[]) => createParking(...args),
}));

const dispatch = jest.fn();
jest.mock('@/services/realtime/RealtimeService', () => ({
  RealtimeService: { dispatch: (...args: unknown[]) => dispatch(...args) },
}));

jest.mock('@/hooks/useEntityNameSuggestion', () => ({
  useEntityNameSuggestion: () => (typeLabel: string) => typeLabel,
}));

const t = ((key: string) => key) as unknown as Translate;

function setup() {
  const onCreated = jest.fn(async () => undefined);
  const reportFailure = jest.fn();
  const view = renderHook(() =>
    useParkingCreateForm({ buildingId: 'bld_A', projectId: 'prj_1', t, onCreated, reportFailure }),
  );
  act(() => view.result.current.handleCreateNumberChange('Π-1'));
  return { ...view, onCreated, reportFailure };
}

beforeEach(() => {
  createParking.mockReset();
  dispatch.mockReset();
});

describe('useParkingCreateForm', () => {
  it('αποτυχία δημιουργίας ⇒ αναφέρεται (πράξη + γενικό μήνυμα), η φόρμα ξεκλειδώνει, τίποτα δεν ξαναδιαβάζεται', async () => {
    const refused = Object.assign(new Error('conflict'), { errorCode: 'POLICY_DUPLICATE_CODE' });
    createParking.mockRejectedValueOnce(refused);
    const { result, onCreated, reportFailure } = setup();

    await act(async () => { await result.current.handleCreate(); });

    expect(reportFailure).toHaveBeenCalledTimes(1);
    expect(reportFailure).toHaveBeenCalledWith(refused, 'create', 'messages.createError');
    expect(result.current.creating).toBe(false);
    expect(onCreated).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('επιτυχία ⇒ γεγονός + ανάγνωση της λίστας, καμία αναφορά αποτυχίας', async () => {
    createParking.mockResolvedValueOnce({ parkingSpotId: 'park_1' });
    const { result, onCreated, reportFailure } = setup();

    await act(async () => { await result.current.handleCreate(); });

    expect(createParking).toHaveBeenCalledWith({ payload: expect.objectContaining({ number: 'Π-1', buildingId: 'bld_A', projectId: 'prj_1' }) });
    expect(dispatch).toHaveBeenCalledWith('PARKING_CREATED', expect.objectContaining({ parkingSpotId: 'park_1' }));
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(reportFailure).not.toHaveBeenCalled();
  });
});
