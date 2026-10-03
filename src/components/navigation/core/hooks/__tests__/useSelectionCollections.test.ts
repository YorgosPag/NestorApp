/**
 * Άγκυρα του SSoT `useSelectionCollections` (ADR-744 §26): οι δύο παράγωγες συλλογές
 * της επιλογής που ήταν αντιγραμμένες σε `NavigationTree` / `MobileNavigation`
 * (και η πρώτη και στο `useDesktopNavData`).
 */

import { renderHook } from '@testing-library/react';
import { useBuildingProperties, useProjectBuildings } from '../useSelectionCollections';

const navigationState: Record<string, unknown> = {};
jest.mock('../../NavigationContext', () => ({ useNavigation: () => navigationState }));

function setNavigation(state: Record<string, unknown>): void {
  for (const key of Object.keys(navigationState)) delete navigationState[key];
  Object.assign(navigationState, state);
}

describe('useProjectBuildings', () => {
  it('κενό χωρίς επιλεγμένο έργο — και δεν ρωτά καν τα κτίρια', () => {
    const getBuildingsForProject = jest.fn();
    setNavigation({ selectedProject: null, getBuildingsForProject });
    const { result } = renderHook(() => useProjectBuildings());
    expect(result.current).toEqual([]);
    expect(getBuildingsForProject).not.toHaveBeenCalled();
  });

  it('τα κτίρια του επιλεγμένου έργου, από τη realtime πηγή', () => {
    const buildings = [{ id: 'b1' }, { id: 'b2' }];
    const getBuildingsForProject = jest.fn(() => buildings);
    setNavigation({ selectedProject: { id: 'p1' }, getBuildingsForProject });
    const { result } = renderHook(() => useProjectBuildings());
    expect(getBuildingsForProject).toHaveBeenCalledWith('p1');
    expect(result.current).toBe(buildings);
  });
});

describe('useBuildingProperties', () => {
  it('κενό χωρίς επιλεγμένο κτίριο', () => {
    setNavigation({ selectedBuilding: null });
    const { result } = renderHook(() => useBuildingProperties());
    expect(result.current).toEqual([]);
  });

  it('ΟΛΟΙ οι όροφοι ΠΡΩΤΑ, μετά όσα κρέμονται απευθείας από το κτίριο', () => {
    setNavigation({
      selectedBuilding: {
        floors: [{ properties: [{ id: 'f1a' }, { id: 'f1b' }] }, { properties: [{ id: 'f2a' }] }],
        properties: [{ id: 'd1' }],
      },
    });
    const { result } = renderHook(() => useBuildingProperties());
    expect(result.current.map(p => p.id)).toEqual(['f1a', 'f1b', 'f2a', 'd1']);
  });

  it('κτίριο χωρίς ορόφους ή χωρίς απευθείας ακίνητα δεν σκάει', () => {
    setNavigation({ selectedBuilding: { properties: [{ id: 'd1' }] } });
    expect(renderHook(() => useBuildingProperties()).result.current.map(p => p.id)).toEqual(['d1']);
    setNavigation({ selectedBuilding: { floors: [{ properties: [{ id: 'f1' }] }] } });
    expect(renderHook(() => useBuildingProperties()).result.current.map(p => p.id)).toEqual(['f1']);
  });
});
