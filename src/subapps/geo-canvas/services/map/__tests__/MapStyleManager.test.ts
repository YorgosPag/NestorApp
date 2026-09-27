/**
 * Άγκυρα της **προεπιλογής** του χάρτη αναζήτησης/αγγελίας (ADR-891 §9): ανοίγει στον ΔΙΚΟ μας χάρτη, που
 * ακολουθεί το θέμα· οι εναλλακτικές CARTO μένουν ίδιες σε κάθε θέμα, και ο καταρράκτης πέφτει σε αυτές.
 */

import { INITIAL_MAP_STYLE, MAP_STYLES, getAllMapStyleUrls, mapStyleManager } from '../MapStyleManager';
import { protomapsStyle } from '@/lib/maps/protomaps-style';

describe('MapStyleManager — θέμα και προεπιλογή', () => {
  it('ανοίγει στο «greece» = ο δικός μας χάρτης, ανά θέμα', () => {
    expect(INITIAL_MAP_STYLE).toBe('greece');
    expect(mapStyleManager.getStyleUrl('greece', 'light')).toBe(protomapsStyle('protomaps-greece', 'light'));
    expect(mapStyleManager.getStyleUrl('greece', 'dark')).toBe(protomapsStyle('protomaps-greece', 'dark'));
  });

  it('ίδιο θέμα ⇒ ΙΔΙΟ αντικείμενο (κανένα re-init του χάρτη σε render)', () => {
    expect(getAllMapStyleUrls('dark')).toBe(getAllMapStyleUrls('dark'));
  });

  it.each(MAP_STYLES.filter((s) => s !== 'greece'))('%s: ίδιο σε κάθε θέμα (πηγή με ένα στυλ)', (style) => {
    expect(mapStyleManager.getStyleUrl(style, 'light')).toBe(mapStyleManager.getStyleUrl(style, 'dark'));
  });

  it('αν ο διακομιστής μας δεν απαντήσει, ο καταρράκτης πέφτει σε τρίτο πάροχο', () => {
    expect(mapStyleManager.getFallbackStyle('greece')).toBe('osm');
  });
});
