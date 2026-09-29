/**
 * ADR-890 §16 — οι λέξεις κάθε βαθμίδας: κάθε σελίδα μιλά για τα **δικά** της παιδιά, με κλειδιά που υπάρχουν.
 * Φρουρός αντιγραφής: τρία σχεδόν ίδια μπλοκ `t('…')` — ένα λάθος ομάδας («Δήμοι» στη σελίδα Περιφέρειας) εδώ κοκκινίζει.
 */

import el from '@/i18n/locales/el/area-market.json';
import elPriceMap from '@/i18n/locales/el/price-map.json';
import { ADMIN_LEVEL } from '@/lib/geo/admin-area-index-file';
import { AREA_MARKET_LEVELS } from '@/types/area-market';

import { areaLevelName, childMapWordsOf } from '../area-level-words';

const NAMESPACES: Readonly<Record<string, unknown>> = { 'area-market': el, 'price-map': elPriceMap };

/** Ένα `t` που επιστρέφει το κλειδί — και ρίχνει όταν το κλειδί ΔΕΝ υπάρχει στο ελληνικό locale. */
function keyT(key: string, values?: Record<string, unknown>): string {
  const [ns, path] = key.split(':');
  let node: unknown = NAMESPACES[ns];
  for (const part of path.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  if (typeof node !== 'string') throw new Error(`λείπει το κλειδί ${key}`);
  return values === undefined ? key : `${key}${JSON.stringify(values)}`;
}
const t = keyT as unknown as Parameters<typeof childMapWordsOf>[0];

describe('areaLevelName', () => {
  it.each(AREA_MARKET_LEVELS)('βαθμίδα %i ⇒ δική της λέξη', (level) => {
    expect(() => areaLevelName(t, level)).not.toThrow();
  });

  it('τέσσερις βαθμίδες, τέσσερις διαφορετικές λέξεις', () => {
    expect(new Set(AREA_MARKET_LEVELS.map((level) => areaLevelName(t, level))).size).toBe(4);
  });
});

describe('childMapWordsOf', () => {
  it.each([
    [ADMIN_LEVEL.region, 'regionalUnits'],
    [ADMIN_LEVEL.regionalUnit, 'municipalities'],
    [ADMIN_LEVEL.municipality, 'municipalUnits'],
  ])('βαθμίδα %i ⇒ οι λέξεις της ομάδας «%s», όλες υπαρκτά κλειδιά', (level, group) => {
    const words = childMapWordsOf(t, level);
    expect(words).not.toBeNull();
    for (const text of [words?.title, words?.prices, words?.hint, words?.caption('x'), words?.parentLabel('1 €')]) {
      expect(text).toContain(`childMap.${group}.`);
    }
    expect(words?.parentLabel('1 €')).toContain('"price":"1 €"');
  });

  it('η Δ.Ε. (και κάθε βαθμίδα χωρίς παιδιά με σελίδα) ⇒ null', () => {
    expect(childMapWordsOf(t, ADMIN_LEVEL.municipalUnit)).toBeNull();
    expect(childMapWordsOf(t, ADMIN_LEVEL.community)).toBeNull();
  });

  it('η διαγράμμιση του Δήμου είναι ΙΔΙΑ λέξη με τον χάρτη της αναζήτησης (ένα κλειδί, `price-map`)', () => {
    expect(childMapWordsOf(t, ADMIN_LEVEL.municipality)?.inherited).toBe('price-map:legend.inherited');
    expect(childMapWordsOf(t, ADMIN_LEVEL.regionalUnit)?.inherited).toBe('area-market:childMap.municipalities.inherited');
  });
});
