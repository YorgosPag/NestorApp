/**
 * ADR-920 Β4.8 — οι αριθμοί του χάρτη εδάφους: ακρίβεια = της ισοδιάστασης, εύρη κλίσης, «ίχνος» ≠ «μηδέν».
 */

import { formatNumber, formatPercentage } from '@/lib/intl-formatting';
import type { TerrainMapSlopeRegion } from '@/lib/terrain/publication/terrain-map-regions';

import { areaShareLabel, fractionDigitsOf, metresOf, slopeRangeLabel } from '../terrain-map-words';

/** `t` που επιστρέφει το κλειδί με τις τιμές — ελέγχουμε ΠΟΙΟ κλειδί και ΤΙ τιμές, όχι τη μετάφραση. */
const t = ((key: string, values: Record<string, string> = {}) =>
  `${key}${JSON.stringify(values)}`) as unknown as Parameters<typeof slopeRangeLabel>[0];

const region = (fromPct: number, toPct: number | null, areaShare = 0): TerrainMapSlopeRegion =>
  ({ classIndex: 0, fromPct, toPct, areaShare, pathData: '' });

describe('fractionDigitsOf', () => {
  it.each([[1, 0], [2, 0], [0.5, 1], [0.1, 1], [0.25, 2], [0.05, 2], [0.0001, 3]])('%p m → %p δεκαδικά', (step, digits) => {
    expect(fractionDigitsOf(step)).toBe(digits);
  });
});

describe('metresOf', () => {
  // Η γλώσσα του `getCurrentLocale` δεν είναι σταθερή στο jest ⇒ το αναμενόμενο από τον ΙΔΙΟ μορφοποιητή, με ρητά δεκαδικά.
  const fixed = (value: number, digits: number) =>
    formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });

  it('120,5 με ισοδιάσταση 0,5 · 121,0 με 0,1 (ο αριθμός δεν «χάνει» το μηδέν της ακρίβειας) · 121 με 1', () => {
    expect(metresOf(120.5, 0.5)).toBe(fixed(120.5, 1));
    expect(metresOf(121, 0.1)).toBe(fixed(121, 1));
    expect(metresOf(121, 0.1)).toMatch(/0$/u);
    expect(metresOf(121, 1)).toBe('121');
  });
});

describe('slopeRangeLabel', () => {
  it('κλειστή κλάση → `range` με από / έως · ανοιχτή → `rangeOpen` μόνο με από', () => {
    expect(slopeRangeLabel(t, region(5, 15))).toBe(
      `listing-detail:terrain.map.slope.range${JSON.stringify({ from: formatPercentage(5, { maximumFractionDigits: 0 }), to: formatPercentage(15, { maximumFractionDigits: 0 }) })}`,
    );
    expect(slopeRangeLabel(t, region(25, null))).toBe(
      `listing-detail:terrain.map.slope.rangeOpen${JSON.stringify({ from: formatPercentage(25, { maximumFractionDigits: 0 }) })}`,
    );
  });
});

describe('areaShareLabel', () => {
  it('μηδέν = «0 %» · ίχνος (> 0, < 0,1 %) = «κάτω από 0,1 %», ποτέ «0 %» · αλλιώς το ποσοστό', () => {
    expect(areaShareLabel(t, 0)).toBe(formatPercentage(0));
    expect(areaShareLabel(t, 0.0004)).toBe(`listing-detail:terrain.map.slope.lessThan${JSON.stringify({ value: formatPercentage(0.1) })}`);
    expect(areaShareLabel(t, 0.375)).toBe(formatPercentage(37.5));
  });
});
