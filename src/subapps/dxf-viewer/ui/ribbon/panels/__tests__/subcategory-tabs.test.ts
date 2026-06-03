/**
 * ADR-377 Phase D — subcategory tab model tests.
 *
 * Verifies the opening Door/Window/Cutout split + single-tab categories,
 * and that no taxonomy key is lost or duplicated across the tab model.
 */

import { getSubcategoryTabs } from '../subcategory-tabs';
import { SUBCATEGORY_TAXONOMY } from '../../../../config/bim-subcategories';

const tabs = getSubcategoryTabs();
const byId = (id: string) => tabs.find((t) => t.id === id);

describe('getSubcategoryTabs — structure', () => {
  it('produces 9 tabs (6 single + 3 opening split)', () => {
    expect(tabs).toHaveLength(9);
  });

  it('single-tab categories carry their full taxonomy key set', () => {
    for (const cat of ['wall', 'slab', 'column', 'beam', 'stair', 'slab-opening'] as const) {
      const tab = byId(cat);
      expect(tab?.category).toBe(cat);
      expect(tab?.keys).toEqual(SUBCATEGORY_TAXONOMY[cat]);
    }
  });
});

describe('getSubcategoryTabs — opening split', () => {
  it('Door tab holds all door-* keys plus sliding-track', () => {
    const door = byId('opening-door');
    expect(door?.category).toBe('opening');
    expect(door?.keys).toContain('door-opening');
    expect(door?.keys).toContain('door-plan-swing');
    expect(door?.keys).toContain('sliding-track');
    expect(door?.keys).not.toContain('window-frame');
  });

  it('Window tab holds only window-* keys', () => {
    const win = byId('opening-window');
    expect(win?.keys.every((k) => k.startsWith('window-'))).toBe(true);
    expect(win?.keys).toContain('window-opening');
  });

  it('Cutout tab holds only wall-cutout-* keys', () => {
    const cut = byId('opening-cutout');
    expect(cut?.keys.every((k) => k.startsWith('wall-cutout-'))).toBe(true);
    expect(cut?.keys).toContain('wall-cutout-jambs');
  });

  it('opening split tabs together cover every opening key exactly once', () => {
    const splitKeys = [
      ...(byId('opening-door')?.keys ?? []),
      ...(byId('opening-window')?.keys ?? []),
      ...(byId('opening-cutout')?.keys ?? []),
    ].sort();
    const taxonomy = [...SUBCATEGORY_TAXONOMY.opening].sort();
    expect(splitKeys).toEqual(taxonomy);
  });
});
