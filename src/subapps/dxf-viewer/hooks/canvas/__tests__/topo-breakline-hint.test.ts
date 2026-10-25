/**
 * ADR-920 Β4.8 Γ — το prompt του εργαλείου ασυνεχειών λέει ΠΑΝΤΑ το ζωντανό πλήθος, όποιος κι αν
 * έγραψε τις ασυνέχειες. Τρέχει πάνω στο ΠΡΑΓΜΑΤΙΚΟ `TopoPointStore` — οι γραφείς καλούνται όπως
 * στην παραγωγή (κλικ, ribbon clear, έγκριση αυτόματων, επαναφορά/cascade).
 */
jest.mock('@/i18n', () => ({
  i18n: {
    t: (key: string, opts?: { count?: number }): string => `${key}|${opts?.count ?? '-'}`,
  },
}));

import {
  addBreakline, clearTopo, getTopoBreaklines, removeBreakline, setTopoBreaklines, setTopoPoints,
  setTopoBoundary,
} from '../../../systems/topography/TopoPointStore';
import type { Breakline, TopoPoint3D } from '../../../systems/topography/topo-types';
import { toolHintOverrideStore } from '../../toolHintOverrideStore';
import { showTopoBreaklineHint, startTopoBreaklineHintSync } from '../topo-breakline-hint';

const V: readonly TopoPoint3D[] = [{ x: 0, y: 0, z: 2 }, { x: 10, y: 0, z: 2 }];
const hint = (): string | null => toolHintOverrideStore.getSnapshot();
const status = (key: string, count: number): string => `topoBreakline.status.${key}|${count}`;

function breaklines(n: number): Breakline[] {
  return Array.from({ length: n }, (_, i) => ({ id: `bl_${i}`, vertices: [...V], closed: false }));
}

describe('topo-breakline-hint — παραγόμενο από το store', () => {
  let stop: () => void = () => undefined;

  beforeEach(() => {
    clearTopo();
    toolHintOverrideStore.setOverride(null);
    stop = startTopoBreaklineHintSync();
  });
  afterEach(() => stop());

  it('ξεκινά idle με το τρέχον πλήθος', () => {
    expect(hint()).toBe(status('awaitingEntity', 0));
  });

  it('κλικ: η ενέργεια γράφεται ΜΕΤΑ τη μετάλλαξη και κερδίζει, με το νέο πλήθος', () => {
    addBreakline(V, false, 'ent_1');
    showTopoBreaklineHint('addedElevation');
    expect(hint()).toBe(status('addedElevation', 1));
  });

  it('κλικ αφαίρεσης: το πλήθος μειώνεται', () => {
    const id = addBreakline(V, false, 'ent_1');
    removeBreakline(id ?? '');
    showTopoBreaklineHint('removed');
    expect(hint()).toBe(status('removed', 0));
  });

  it('ribbon «Καθαρισμός»: το μήνυμα επιστρέφει στο idle με 0', () => {
    addBreakline(V);
    addBreakline(V);
    showTopoBreaklineHint('addedProximity');
    setTopoBreaklines([]);
    expect(hint()).toBe(status('awaitingEntity', 0));
  });

  it('επαναφορά επιπέδου / cascade νέας εισαγωγής (setTopoBreaklines): νέο πλήθος', () => {
    setTopoBreaklines(breaklines(3));
    expect(hint()).toBe(status('awaitingEntity', 3));
  });

  it('έγκριση αυτόματων (addBreakline χωρίς κλικ): το πλήθος ανεβαίνει', () => {
    setTopoBreaklines(breaklines(1));
    addBreakline(V);
    addBreakline(V);
    expect(hint()).toBe(status('awaitingEntity', 3));
    expect(getTopoBreaklines()).toHaveLength(3);
  });

  it('αλλαγή σημείων ή ορίου ΔΕΝ σβήνει το μήνυμα ενέργειας', () => {
    addBreakline(V, false, 'ent_1');
    showTopoBreaklineHint('addedElevation');
    setTopoPoints([{ x: 1, y: 1, z: 3 }]);
    setTopoBoundary(null);
    expect(hint()).toBe(status('addedElevation', 1));
  });

  it('μετά το stop καμία ενημέρωση (το εργαλείο δεν κατέχει πια το prompt)', () => {
    stop();
    toolHintOverrideStore.setOverride('ξένο εργαλείο');
    setTopoBreaklines(breaklines(2));
    expect(hint()).toBe('ξένο εργαλείο');
  });
});
