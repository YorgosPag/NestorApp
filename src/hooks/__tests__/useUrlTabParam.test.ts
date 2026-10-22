/**
 * useUrlTabParam / useActiveUrlTab — το συμβόλαιο «η καρτέλα ζει στη διεύθυνση» (ADR-242 Βήμα 3).
 *
 * Καρφώνει:
 *   - ανάγνωση από το query string, με επικύρωση απέναντι στις υπαρκτές καρτέλες (άγνωστη ⇒ προεπιλογή, ποτέ κενή σκηνή)·
 *   - εγγραφή με `replaceState` — **καμία** νέα καταχώριση ιστορικού (5 κλικ ≠ 5 «πίσω»)·
 *   - η προεπιλογή **σβήνει** το κλειδί (μία οθόνη = μία διεύθυνση)·
 *   - άσχετα κλειδιά (π.χ. `projectId`) **μένουν**·
 *   - `heal` ξαναγράφει άκυρη τιμή, χωρίς `heal` όχι.
 *
 * @see src/hooks/useUrlTabParam.ts
 */

import { renderHook, act } from '@testing-library/react';
import { useActiveUrlTab, useUrlTabParam } from '../useUrlTabParam';

const TABS = ['general', 'locations', 'budget'] as const;

function startAt(url: string): void {
  window.history.replaceState(null, '', url);
}

/** Η ειδοποίηση του `url-query-state` φεύγει σε microtask (βλ. `useSelectedEntityUrlState.test.ts`). */
async function flushUrlNotifications(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useUrlTabParam', () => {
  beforeEach(() => startAt('/projects?projectId=p_1'));

  it('reads the raw value (null when absent)', () => {
    const { result } = renderHook(() => useUrlTabParam('tab'));
    expect(result.current.raw).toBeNull();
  });

  it('writes with replaceState, keeping unrelated params', async () => {
    const pushSpy = jest.spyOn(window.history, 'pushState');
    const lengthBefore = window.history.length;
    const { result } = renderHook(() => useUrlTabParam('tab'));

    act(() => result.current.write('budget'));
    await flushUrlNotifications();

    expect(window.location.search).toBe('?projectId=p_1&tab=budget');
    expect(window.history.length).toBe(lengthBefore);
    expect(pushSpy).not.toHaveBeenCalled();
    expect(result.current.raw).toBe('budget');
    pushSpy.mockRestore();
  });

  it('omit removes the key', async () => {
    startAt('/projects?projectId=p_1&tab=budget');
    const { result } = renderHook(() => useUrlTabParam('tab'));

    act(() => result.current.write('general', true));
    await flushUrlNotifications();

    expect(window.location.search).toBe('?projectId=p_1');
  });
});

describe('useActiveUrlTab', () => {
  beforeEach(() => startAt('/projects?projectId=p_1'));

  it('defaults to the first tab when the key is absent', () => {
    const { result } = renderHook(() => useActiveUrlTab('tab', TABS));
    expect(result.current.activeTab).toBe('general');
  });

  it('opens the tab the URL names (deep link / refresh / Back)', () => {
    startAt('/projects?projectId=p_1&tab=budget');
    const { result } = renderHook(() => useActiveUrlTab('tab', TABS));
    expect(result.current.activeTab).toBe('budget');
  });

  it('an unknown tab falls back to the default — never an empty scene', () => {
    startAt('/projects?projectId=p_1&tab=procurement');
    const { result } = renderHook(() => useActiveUrlTab('tab', TABS));
    expect(result.current.activeTab).toBe('general');
    // Χωρίς `heal` η διεύθυνση δεν πειράζεται (ασύγχρονες καρτέλες θα έχαναν έγκυρο σύνδεσμο).
    expect(window.location.search).toBe('?projectId=p_1&tab=procurement');
  });

  it('setActiveTab writes a non-default tab and the screen follows', async () => {
    const { result } = renderHook(() => useActiveUrlTab('tab', TABS));

    act(() => result.current.setActiveTab('locations'));
    await flushUrlNotifications();

    expect(window.location.search).toBe('?projectId=p_1&tab=locations');
    expect(result.current.activeTab).toBe('locations');
  });

  it('returning to the default removes the key (one screen, one address)', async () => {
    startAt('/projects?projectId=p_1&tab=budget');
    const { result } = renderHook(() => useActiveUrlTab('tab', TABS));

    act(() => result.current.setActiveTab('general'));
    await flushUrlNotifications();

    expect(window.location.search).toBe('?projectId=p_1');
    expect(result.current.activeTab).toBe('general');
  });

  it('heal rewrites an invalid value away', async () => {
    startAt('/projects?projectId=p_1&tab=nope');
    renderHook(() => useActiveUrlTab('tab', TABS, { heal: true }));
    await flushUrlNotifications();

    expect(window.location.search).toBe('?projectId=p_1');
  });
});
