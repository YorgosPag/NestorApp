/**
 * ADR-916 §7 Ζ34 (Φ-Δ.3 · Φ-Δ.4) — **οι πράξεις του γραφείου**: ένα σχήμα για όλες.
 *   · επιτυχία ⇒ ειδοποίηση επιτυχίας + ξαναφόρτωση · `true` (ο διάλογος κλείνει)
 *   · άρνηση ⇒ ο λόγος από το λεξιλόγιο + ξαναφόρτωση (η οθόνη ήταν μπαγιάτικη) · `true`
 *   · «δεν μπόρεσα» ⇒ σφάλμα, **καμία** ξαναφόρτωση · `false` (ο διάλογος μένει ανοιχτός με ό,τι έγραψε ο άνθρωπος)
 */

import { act, renderHook } from '@testing-library/react';

const mockNotify = { success: jest.fn(), error: jest.fn() };
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => mockNotify }));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const mockDecide = jest.fn();
jest.mock('@/services/property-handover/property-handover-file-decision.client', () => ({
  decideHandoverFileFromScreen: (...args: unknown[]) => mockDecide(...args),
}));
const mockRenew = jest.fn();
jest.mock('@/services/property-handover/property-handover-invitation-renewal.client', () => ({
  renewHandoverInvitationFromScreen: (...args: unknown[]) => mockRenew(...args),
}));

import { useHandoverOfficeActions } from '../useHandoverOfficeActions';

const REQUEST = { fileId: 'f_doc', choice: 'deliver' as const, expected: null, reason: 'Ελέγχθηκε από τον νομικό', confirmConfidential: false };
const K = 'properties-detail:handover.fileDecision';

beforeEach(() => jest.clearAllMocks());

function setup() {
  const reload = jest.fn();
  const { result } = renderHook(() => useHandoverOfficeActions('prop_1', reload));
  return { result, reload };
}

describe('Ζ34 — ένα σχήμα πράξης για όλη την καρτέλα', () => {
  it.each([
    ['decided', `${K}.success`],
    ['unchanged', `${K}.success`],
  ] as const)('%s ⇒ επιτυχία + ξαναφόρτωση + true', async (kind, message) => {
    mockDecide.mockResolvedValue({ kind });
    const { result, reload } = setup();
    let done = false;
    await act(async () => { done = await result.current.decideFile(REQUEST); });
    expect(done).toBe(true);
    expect(mockDecide).toHaveBeenCalledWith('prop_1', REQUEST);
    expect(mockNotify.success).toHaveBeenCalledWith(message);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.busyId).toBeNull();
  });

  it('άρνηση ⇒ ο λόγος + ξαναφόρτωση + true', async () => {
    mockDecide.mockResolvedValue({ kind: 'refused', reason: 'stale' });
    const { result, reload } = setup();
    let done = false;
    await act(async () => { done = await result.current.decideFile(REQUEST); });
    expect(done).toBe(true);
    expect(mockNotify.error).toHaveBeenCalledWith(`${K}.refusal.stale`);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('«δεν μπόρεσα» ⇒ σφάλμα, ΚΑΜΙΑ ξαναφόρτωση, false', async () => {
    mockDecide.mockResolvedValue({ kind: 'failed' });
    const { result, reload } = setup();
    let done = true;
    await act(async () => { done = await result.current.decideFile(REQUEST); });
    expect(done).toBe(false);
    expect(mockNotify.error).toHaveBeenCalledWith(`${K}.failed`);
    expect(reload).not.toHaveBeenCalled();
  });

  it('η «Νέα πρόσκληση» περνά από το ΙΔΙΟ σχήμα (Φ-Δ.3)', async () => {
    mockRenew.mockResolvedValue({ kind: 'refused', reason: 'not-renewable' });
    const { result, reload } = setup();
    await act(async () => { await result.current.renew('phov_1', false); });
    expect(mockRenew).toHaveBeenCalledWith('prop_1', { handoverId: 'phov_1', confirmDeclined: false });
    expect(mockNotify.error).toHaveBeenCalledWith('properties-detail:handover.renewal.refusal.not-renewable');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
