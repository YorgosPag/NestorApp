/**
 * =============================================================================
 * ΑΓΚΥΡΑ ΚΑΛΟΥΝΤΑ — η πλαϊνή λίστα ΔΕΝ λέει «επιτυχία» σε μπλοκάρισμα (ADR-777 §8.69.13)
 * =============================================================================
 *
 * 🔴 Εδώ το ελάττωμα ήταν το **αντίθετο** του `ChangePriceDialog`: το αποτέλεσμα του φύλακα
 * αγνοούνταν, και το «Ενημερώθηκε» έβγαινε **και** όταν ο φύλακας μπλόκαρε ή ο άνθρωπος ακύρωσε.
 */
import { act, renderHook } from '@testing-library/react';

import type { GuardResult } from '@/hooks/impact-guard/guard-result';

const runExistingPropertyUpdate = jest.fn<Promise<GuardResult>, unknown[]>();
const notifySuccess = jest.fn();
const notifyError = jest.fn();

jest.mock('@/hooks/useGuardedPropertyMutation', () => ({
  useGuardedPropertyMutation: () => ({
    ImpactDialog: null,
    runExistingPropertyUpdate: (...args: unknown[]) => runExistingPropertyUpdate(...args),
  }),
}));
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success: notifySuccess, error: notifyError }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }),
}));
jest.mock('@/services/property/property-mutation-feedback', () => ({
  translatePropertyMutationError: (error: Error) => `translated:${error.message}`,
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν τα imports
import { usePropertiesSidebar } from '../usePropertiesSidebar';

const VIEWER_PROPS = { properties: [{ id: 'p1', name: 'Α1' }], selectedFloorId: null };

function renderSidebar() {
  return renderHook(() => usePropertiesSidebar([], VIEWER_PROPS as never, VIEWER_PROPS.properties[0] as never));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePropertiesSidebar — επιτυχία ΜΟΝΟ σε `completed`', () => {
  it.each(['blocked', 'cancelled'] as const)('🔴 `%s` ⇒ ΚΑΝΕΝΑ «Ενημερώθηκε», κανένα σφάλμα', async (outcome) => {
    runExistingPropertyUpdate.mockResolvedValue({ outcome });
    const { result } = renderSidebar();

    await act(async () => { await result.current.handleUpdateProperty('p1', { name: 'Α2' }); });

    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('`completed` ⇒ «Ενημερώθηκε»', async () => {
    runExistingPropertyUpdate.mockResolvedValue({ outcome: 'completed' });
    const { result } = renderSidebar();

    await act(async () => { await result.current.handleUpdateProperty('p1', { name: 'Α2' }); });

    expect(notifySuccess).toHaveBeenCalledWith('viewer.messages.updateSuccess');
  });

  it('`failed` ⇒ μεταφρασμένο σφάλμα ΚΑΙ απόρριψη προς τον καλούντα (όπως πριν στο `allow`)', async () => {
    const boom = new Error('boom');
    runExistingPropertyUpdate.mockResolvedValue({ outcome: 'failed', error: boom });
    const { result } = renderSidebar();

    await act(async () => {
      await expect(result.current.handleUpdateProperty('p1', { name: 'Α2' })).rejects.toBe(boom);
    });

    expect(notifyError).toHaveBeenCalledWith('translated:boom');
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});
