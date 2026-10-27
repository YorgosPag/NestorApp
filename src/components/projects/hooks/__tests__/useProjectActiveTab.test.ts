/**
 * useProjectActiveTab — η καρτέλα της σελίδας έργου ζει στη διεύθυνση (ADR-242 Βήμα 3).
 *
 * Καρφώνει:
 *   - ο σύνδεσμος του SSoT (`getProjectTabUrl`) ανοίγει **αυτή** την καρτέλα·
 *   - κλικ ⇒ `?tab=` (refresh / «πίσω» από άλλη σελίδα / κοινοποίηση την κρατούν)·
 *   - αλλαγή έργου ⇒ η καρτέλα **μένει** (η επιλογή γράφει μόνο το `projectId`)·
 *   - «Νέο έργο» ⇒ προεπιλογή, και η διεύθυνση **δεν** πειράζεται (το πρόχειρο δεν έχει διεύθυνση)·
 *   - το πρόχειρο **έγινε** έργο ⇒ η καρτέλα του μεταφέρεται στη διεύθυνση, χωρίς ούτε ένα render με την παλιά·
 *   - «Ακύρωση» ⇒ καμία μεταφορά·
 *   - κάθε `ProjectDeepLinkTab` είναι επιλέξιμη καρτέλα του config (αλλιώς ο σύνδεσμος πέφτει σιωπηλά στη «Γενικά»).
 */

import { renderHook, act } from '@testing-library/react';
import { useProjectActiveTab, type ProjectActiveTabInput } from '../useProjectActiveTab';
import { getSelectableProjectTabIds } from '@/config/project-tabs-config';
import { getProjectTabUrl, type ProjectDeepLinkTab } from '@/lib/navigation/project-urls';

/** Εξαντλητικό απέναντι στον τύπο: νέο μέλος του `ProjectDeepLinkTab` χωρίς γραμμή εδώ = σφάλμα τύπου. */
const DEEP_LINK_TABS: Record<ProjectDeepLinkTab, true> = { locations: true, budget: true };

function startAt(url: string): void {
  window.history.replaceState(null, '', url);
}

async function flushUrlNotifications(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function renderTab(initial: ProjectActiveTabInput) {
  const seen: string[] = [];
  const hook = renderHook((props: ProjectActiveTabInput) => {
    const state = useProjectActiveTab(props);
    seen.push(state.activeTab);
    return state;
  }, { initialProps: initial });
  return { ...hook, seen };
}

const VIEWING = { isCreateMode: false, hasSelection: true };
const DRAFT = { isCreateMode: true, hasSelection: true };

describe('useProjectActiveTab', () => {
  beforeEach(() => startAt('/projects?projectId=p_1'));

  it('every deep-link tab is a selectable project tab', () => {
    const selectable = getSelectableProjectTabIds();
    for (const tab of Object.keys(DEEP_LINK_TABS)) expect(selectable).toContain(tab);
  });

  it('the default tab is first and link-only tabs are not selectable', () => {
    const selectable = getSelectableProjectTabIds();
    expect(selectable[0]).toBe('general');
    expect(selectable).not.toContain('procurement');
  });

  it('getProjectTabUrl opens that tab', () => {
    startAt(getProjectTabUrl('p_1', 'budget'));
    const { result } = renderTab(VIEWING);
    expect(result.current.activeTab).toBe('budget');
  });

  it('a tab click is written to the URL, and survives a project change', async () => {
    const { result } = renderTab(VIEWING);

    act(() => result.current.setActiveTab('budget'));
    await flushUrlNotifications();
    expect(window.location.search).toBe('?projectId=p_1&tab=budget');

    // Η επιλογή άλλου έργου γράφει ΜΟΝΟ το projectId (useSelectedEntityUrlState).
    act(() => startAt('/projects?projectId=p_2&tab=budget'));
    await flushUrlNotifications();
    expect(result.current.activeTab).toBe('budget');
  });

  it('"New project" opens on the default tab and leaves the URL alone', async () => {
    startAt('/projects?projectId=p_1&tab=budget');
    const { result, rerender } = renderTab(VIEWING);

    rerender(DRAFT);
    expect(result.current.activeTab).toBe('general');

    act(() => result.current.setActiveTab('locations'));
    expect(result.current.activeTab).toBe('locations');
    expect(window.location.search).toBe('?projectId=p_1&tab=budget');
  });

  it('a created draft carries its tab into the URL — never one render with the stale tab', async () => {
    startAt('/projects?projectId=p_1&tab=budget');
    const { result, rerender, seen } = renderTab(VIEWING);
    rerender(DRAFT);
    act(() => result.current.setActiveTab('locations'));

    seen.length = 0;
    rerender(VIEWING);
    await flushUrlNotifications();

    expect(window.location.search).toBe('?projectId=p_1&tab=locations');
    expect(result.current.activeTab).toBe('locations');
    expect(seen).not.toContain('budget');
  });

  it('cancelling a draft carries nothing', async () => {
    startAt('/projects?projectId=p_1&tab=budget');
    const { result, rerender } = renderTab(VIEWING);
    rerender(DRAFT);
    act(() => result.current.setActiveTab('locations'));

    rerender({ isCreateMode: false, hasSelection: false });
    await flushUrlNotifications();

    expect(window.location.search).toBe('?projectId=p_1&tab=budget');
  });
});
