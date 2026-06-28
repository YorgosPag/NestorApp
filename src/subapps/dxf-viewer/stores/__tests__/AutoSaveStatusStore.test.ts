/**
 * Tests για το AutoSaveStatusStore — reactive SSoT κανάλι του scene auto-save
 * status (ribbon-cascade fix, profiler 2026-06-28).
 */

import {
  autoSaveStatusStore,
  __resetAutoSaveStatusForTest,
} from '../AutoSaveStatusStore';

describe('AutoSaveStatusStore', () => {
  beforeEach(() => {
    __resetAutoSaveStatusForTest();
  });

  it('αρχικό snapshot = idle / null', () => {
    expect(autoSaveStatusStore.get()).toEqual({
      currentFileName: null,
      lastSaveTime: null,
      saveStatus: 'idle',
    });
  });

  it('set ενημερώνει το snapshot και ειδοποιεί τους subscribers', () => {
    let n = 0;
    autoSaveStatusStore.subscribe(() => { n += 1; });
    const t = new Date(0);
    autoSaveStatusStore.set({ currentFileName: 'a.dxf', lastSaveTime: t, saveStatus: 'saving' });
    expect(n).toBe(1);
    expect(autoSaveStatusStore.get()).toEqual({
      currentFileName: 'a.dxf',
      lastSaveTime: t,
      saveStatus: 'saving',
    });
  });

  it('set με ίδιες τιμές = no-op (ίδιο ref, χωρίς notify) — useSyncExternalStore-safe', () => {
    let n = 0;
    autoSaveStatusStore.subscribe(() => { n += 1; });
    const t = new Date(0);
    autoSaveStatusStore.set({ currentFileName: 'a.dxf', lastSaveTime: t, saveStatus: 'success' });
    const ref = autoSaveStatusStore.get();
    expect(n).toBe(1);

    // Ίδιες τιμές ξανά (νέο object literal) → καμία αλλαγή, ίδιο ref, χωρίς notify.
    autoSaveStatusStore.set({ currentFileName: 'a.dxf', lastSaveTime: t, saveStatus: 'success' });
    expect(n).toBe(1);
    expect(autoSaveStatusStore.get()).toBe(ref);
  });

  it('μετά το unsubscribe δεν ειδοποιεί', () => {
    let n = 0;
    const off = autoSaveStatusStore.subscribe(() => { n += 1; });
    autoSaveStatusStore.set({ currentFileName: 'a.dxf', lastSaveTime: null, saveStatus: 'saving' });
    off();
    autoSaveStatusStore.set({ currentFileName: 'a.dxf', lastSaveTime: null, saveStatus: 'idle' });
    expect(n).toBe(1);
  });

  it('get επιστρέφει νέα reference μόνο όταν αλλάζει πεδίο', () => {
    const a = autoSaveStatusStore.get();
    autoSaveStatusStore.set({ currentFileName: null, lastSaveTime: null, saveStatus: 'idle' });
    expect(autoSaveStatusStore.get()).toBe(a); // ταυτόσημο με initial → ίδιο ref
    autoSaveStatusStore.set({ currentFileName: 'b.dxf', lastSaveTime: null, saveStatus: 'idle' });
    expect(autoSaveStatusStore.get()).not.toBe(a); // πραγματική αλλαγή → νέο ref
  });
});
