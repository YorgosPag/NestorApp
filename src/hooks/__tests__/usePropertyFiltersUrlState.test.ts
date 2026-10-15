/**
 * @fileoverview ADR-840 §7.7 — ΜΙΑ κατάσταση φίλτρων ακινήτων: η διεύθυνση.
 *
 * 🔴 Το περιστατικό: πλέγμα και κάτοψη καλούσαν **χωριστά** τον `usePublicPropertyViewer`, με `useState` μέσα ⇒
 *    η εναλλαγή προβολής (unmount → mount) έσβηνε τα φίλτρα. Το test «unmount → νέο mount ⇒ ίδια φίλτρα» είναι
 *    ακριβώς αυτή η εναλλαγή· αν κάποιος ξαναβάλει τοπική κατάσταση, κοκκινίζει.
 */

import { act, renderHook } from '@testing-library/react';

import { usePropertyFiltersUrlState } from '../usePropertyFiltersUrlState';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const CATALOG = [
  { projectId: 'pA', buildingId: 'bA1', floor: 1 },
  { projectId: 'pA', buildingId: 'bA2', floor: 2 },
  { projectId: 'pB', buildingId: 'bB1', floor: 0 },
];

function startAt(url: string): void {
  window.history.replaceState(null, '', url);
}

/** Η ειδοποίηση του `url-query-state` φεύγει σε microtask — βλ. `useSelectedEntityUrlState.test.ts`. */
async function flushUrlNotifications(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('usePropertyFiltersUrlState', () => {
  beforeEach(() => startAt('/o/ws/properties'));

  it('διαβάζει τα φίλτρα από τη διεύθυνση (σύνδεσμος / refresh)', () => {
    startAt('/o/ws/properties?project=pA&status=for-sale');
    const { result } = renderHook(() => usePropertyFiltersUrlState(CATALOG));
    expect(result.current.filters.project).toEqual(['pA']);
    expect(result.current.filters.status).toEqual(['for-sale']);
  });

  it('η αλλαγή γράφεται στη διεύθυνση, κρατώντας προβολή και fragment', async () => {
    startAt('/o/ws/properties?view=floorplan#frag');
    const { result } = renderHook(() => usePropertyFiltersUrlState(CATALOG));
    act(() => result.current.updateFilters({ project: ['pB'] }));
    await flushUrlNotifications();
    expect(window.location.search).toBe('?view=floorplan&project=pB');
    expect(window.location.hash).toBe('#frag');
    expect(result.current.filters.project).toEqual(['pB']);
  });

  it('αλλαγή προβολής (unmount → νέο mount) ⇒ ΙΔΙΑ φίλτρα', async () => {
    const grid = renderHook(() => usePropertyFiltersUrlState(CATALOG));
    act(() => grid.result.current.updateFilters({ project: ['pA'], areaRange: { min: 50, max: undefined } }));
    await flushUrlNotifications();
    grid.unmount();

    const floorplan = renderHook(() => usePropertyFiltersUrlState(CATALOG));
    expect(floorplan.result.current.filters.project).toEqual(['pA']);
    expect(floorplan.result.current.filters.areaRange).toEqual({ min: 50, max: undefined });
  });

  it('δύο αλλαγές στο ίδιο tick δεν πατούν η μία την άλλη (ζωντανά params, όχι closure)', async () => {
    const { result } = renderHook(() => usePropertyFiltersUrlState(CATALOG));
    act(() => {
      result.current.updateFilters({ status: ['for-sale'] });
      result.current.updateFilters({ propertyType: ['apartment'] });
    });
    await flushUrlNotifications();
    expect(result.current.filters.status).toEqual(['for-sale']);
    expect(result.current.filters.propertyType).toEqual(['apartment']);
  });

  it('ο καταρράκτης κρίνει ΚΑΙ τον σύνδεσμο: κτίριο ξένο προς το έργο πέφτει', () => {
    startAt('/o/ws/properties?project=pA&building=bB1');
    const { result } = renderHook(() => usePropertyFiltersUrlState(CATALOG));
    expect(result.current.filters.building).toEqual([]);
  });

  it('άδειος κατάλογος (δεδομένα που φορτώνουν) ⇒ ούτε η κατάσταση ούτε η διεύθυνση «καθαρίζονται»', () => {
    startAt('/o/ws/properties?project=pA&building=bB1');
    const { result } = renderHook(() => usePropertyFiltersUrlState([]));
    expect(result.current.filters.building).toEqual(['bB1']);
    expect(window.location.search).toBe('?project=pA&building=bB1');
  });
});
