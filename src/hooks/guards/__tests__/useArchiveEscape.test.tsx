/**
 * ⚓ useArchiveEscape — «Αρχειοθέτηση αντί για διαγραφή» (ADR-329 §3.9)
 *
 * Καρφώνει τα τρία που δεν φαίνονται στην οθόνη αν χαλάσουν:
 *  1. το ΑΝ προσφέρεται το αποφασίζει ο διακομιστής (`archivable`), όχι η οθόνη·
 *  2. η έξοδος έχει ΣΤΑΘΕΡΗ ταυτότητα όσο δεν αλλάζει τίποτα (αλλιώς ο διάλογος ξαναχτίζεται
 *     σε κάθε render)·
 *  3. αποτυχία αρχειοθέτησης ΔΕΝ κλείνει τον διάλογο — ο άνθρωπος πρέπει να το δει.
 */

import { renderHook, act } from '@testing-library/react';

import { useArchiveEscape } from '../useArchiveEscape';
import type { DependencyCheckResult } from '@/config/deletion-registry';

const mockArchive = jest.fn();
const mockNotify = jest.fn();

jest.mock('@/services/trash.service', () => ({
  TrashService: { archive: (...args: unknown[]) => mockArchive(...args) },
}));
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ notify: mockNotify }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
}));

const BLOCKED_BY_REFERENCES: DependencyCheckResult = {
  allowed: false,
  dependencies: [{ label: 'Επιμετρήσεις (BOQ)', collection: 'boq_items', count: 2, documentIds: [] }],
  totalDependents: 2,
  message: 'Υπάρχουν εξαρτήσεις',
  archivable: true,
};

const BLOCKED_BY_BUYER: DependencyCheckResult = {
  allowed: false,
  dependencies: [],
  totalDependents: 0,
  message: 'Το ακίνητο έχει αγοραστή',
};

beforeEach(() => {
  mockArchive.mockReset();
  mockNotify.mockReset();
});

function setup() {
  const onArchived = jest.fn();
  const hook = renderHook(() => useArchiveEscape({ kind: 'property', onArchived }));
  return { hook, onArchived };
}

describe('useArchiveEscape', () => {
  it('🔴 δεν προσφέρει έξοδο όταν ο διακομιστής δεν τη δηλώνει', () => {
    const { hook } = setup();

    expect(hook.result.current(BLOCKED_BY_BUYER, 'prop_1')).toBeUndefined();
    expect(hook.result.current({ ...BLOCKED_BY_REFERENCES, archivable: false }, 'prop_1')).toBeUndefined();
  });

  it('προσφέρει έξοδο με κείμενα από τον χώρο «trash»', () => {
    const { hook } = setup();

    expect(hook.result.current(BLOCKED_BY_REFERENCES, 'prop_1')).toMatchObject({
      label: 'archiveInstead',
      hint: 'archiveHint',
      pending: false,
    });
  });

  it('🔴 η έξοδος κρατά ΣΤΑΘΕΡΗ ταυτότητα ανάμεσα σε renders', () => {
    const { hook } = setup();

    const first = hook.result.current(BLOCKED_BY_REFERENCES, 'prop_1');
    hook.rerender();
    const second = hook.result.current(BLOCKED_BY_REFERENCES, 'prop_1');

    expect(second).toBe(first);
    expect(hook.result.current(BLOCKED_BY_REFERENCES, 'prop_2')).not.toBe(first);
  });

  it('αρχειοθετεί τη ΣΥΓΚΕΚΡΙΜΕΝΗ εγγραφή, ειδοποιεί, και παραδίδει στον καλούντα', async () => {
    mockArchive.mockResolvedValue(undefined);
    const { hook, onArchived } = setup();

    await act(async () => {
      hook.result.current(BLOCKED_BY_REFERENCES, 'prop_1')?.onAction();
    });

    expect(mockArchive).toHaveBeenCalledWith('property', 'prop_1');
    expect(mockNotify).toHaveBeenCalledWith('archiveSuccess', { type: 'success' });
    expect(onArchived).toHaveBeenCalledWith('prop_1');
    expect(hook.result.current(BLOCKED_BY_REFERENCES, 'prop_1')?.pending).toBe(false);
  });

  it('🔴 αποτυχία: ειδοποιεί με σφάλμα και ΔΕΝ καλεί onArchived (ο διάλογος μένει ανοιχτός)', async () => {
    mockArchive.mockRejectedValue(new Error('409'));
    const { hook, onArchived } = setup();

    await act(async () => {
      hook.result.current(BLOCKED_BY_REFERENCES, 'prop_1')?.onAction();
    });

    expect(mockNotify).toHaveBeenCalledWith('archiveFailed', { type: 'error' });
    expect(onArchived).not.toHaveBeenCalled();
  });
});
