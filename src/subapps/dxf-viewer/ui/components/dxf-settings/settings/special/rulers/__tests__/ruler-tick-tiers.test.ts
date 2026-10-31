/**
 * Βαθμίδες γραμμών χάρακα. Τα κλειδιά χτίζονται δυναμικά, άρα η CHECK 3.8 δεν τα βλέπει:
 * αυτή η άγκυρα κρατά ότι κάθε κλειδί υπάρχει και στις δύο γλώσσες.
 */

import el from '@/i18n/locales/el/dxf-viewer-settings.json';
import en from '@/i18n/locales/en/dxf-viewer-settings.json';
import type { RulerAxisSettings } from '../../../../../../../systems/rulers-grid/config';
import { RULER_TICK_LABEL_KEYS, RULER_TICK_TIERS, rulerTickLabelKey } from '../ruler-tick-tiers';
import type { RulerTickTier } from '../ruler-tick-tiers';

const TIERS: readonly RulerTickTier[] = ['major', 'minor'];

const axis = {
  showMajorTicks: true,
  showMinorTicks: false,
  majorTickColor: '#111111',
  minorTickColor: '#222222',
  majorTickLength: 10,
  minorTickLength: 5,
} as RulerAxisSettings;

function lookup(tree: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>(
    (node, segment) => (node as Record<string, unknown> | undefined)?.[segment],
    tree,
  );
}

describe('βαθμίδες γραμμών χάρακα', () => {
  it('κάθε βαθμίδα διαβάζει τα ΔΙΚΑ της πεδία', () => {
    expect(RULER_TICK_TIERS.major.visible(axis)).toBe(true);
    expect(RULER_TICK_TIERS.minor.visible(axis)).toBe(false);
    expect(RULER_TICK_TIERS.major.color(axis)).toBe('#111111');
    expect(RULER_TICK_TIERS.minor.color(axis)).toBe('#222222');
    expect(RULER_TICK_TIERS.major.length(axis)).toBe(10);
    expect(RULER_TICK_TIERS.minor.length(axis)).toBe(5);
  });

  it('🔴 κάθε βαθμίδα γράφει ΜΟΝΟ τα δικά της πεδία', () => {
    expect(RULER_TICK_TIERS.major.patchVisible(false)).toEqual({ showMajorTicks: false });
    expect(RULER_TICK_TIERS.minor.patchVisible(false)).toEqual({ showMinorTicks: false });
    expect(RULER_TICK_TIERS.major.patchColor('#fff')).toEqual({ majorTickColor: '#fff' });
    expect(RULER_TICK_TIERS.minor.patchColor('#fff')).toEqual({ minorTickColor: '#fff' });
    expect(RULER_TICK_TIERS.major.patchLength(20)).toEqual({ majorTickLength: 20 });
    expect(RULER_TICK_TIERS.minor.patchLength(20)).toEqual({ minorTickLength: 20 });
  });

  describe.each(TIERS)('κλειδιά της βαθμίδας %s', (tier) => {
    it.each(RULER_TICK_LABEL_KEYS)('🔴 %s υπάρχει σε el και en', (key) => {
      const full = rulerTickLabelKey(tier, key);
      expect(typeof lookup(el, full)).toBe('string');
      expect(typeof lookup(en, full)).toBe('string');
    });
  });
});
