/**
 * ADR-920 Β4.8 — η παλέτα του χάρτη εδάφους: ίδιο πλήθος με τις κλάσεις του config, κάθε token δηλωμένο και στα ΔΥΟ θέματα
 * με την ΙΔΙΑ τιμή (χαρτί και στα δύο), και η διάταξη της φωτεινότητας μονότονη (διαβάζεται χωρίς απόχρωση).
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { LISTING_TERRAIN_SLOPE_BANDS_PCT } from '@/lib/terrain/publication/listing-terrain-config';
import { TERRAIN_SLOPE_FILL_CLASS, terrainSlopeFillClass } from '../terrain-map-palette';

const GLOBALS_CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

/** Οι δηλώσεις ενός custom property στο `globals.css`, με τη σειρά που εμφανίζονται (ανοιχτό θέμα, μετά σκοτεινό). */
function declarationsOf(token: string): string[] {
  const pattern = new RegExp(`^\\s*${token}:\\s*([^;]+);`, 'gm');
  return [...GLOBALS_CSS.matchAll(pattern)].map((match) => match[1].trim());
}

const tokenOf = (cls: string): string => {
  const match = /var\((--[a-z0-9-]+)\)/.exec(cls);
  if (!match) throw new Error(`no token in ${cls}`);
  return match[1];
};

describe('terrain-map-palette', () => {
  it('μία κλάση χρώματος ανά κλάση κλίσης του config', () => {
    expect(TERRAIN_SLOPE_FILL_CLASS).toHaveLength(LISTING_TERRAIN_SLOPE_BANDS_PCT.length + 1);
  });

  it('κάθε token δηλώνεται ΔΥΟ φορές (δύο θέματα) με την ΙΔΙΑ τιμή — το χαρτί δεν αλλάζει με το θέμα', () => {
    for (const cls of TERRAIN_SLOPE_FILL_CLASS) {
      const values = declarationsOf(tokenOf(cls));
      expect(values).toHaveLength(2);
      expect(values[0]).toBe(values[1]);
    }
  });

  it('η φωτεινότητα πέφτει αυστηρά από την επίπεδη στην απότομη κλάση', () => {
    const lightness = TERRAIN_SLOPE_FILL_CLASS.map((cls) => Number(/([\d.]+)%\s*$/.exec(declarationsOf(tokenOf(cls))[0])?.[1]));
    for (let i = 1; i < lightness.length; i++) expect(lightness[i]).toBeLessThan(lightness[i - 1]);
  });

  it('κλάση πέρα από την παλέτα παίρνει τη σκουρότερη, ποτέ undefined', () => {
    expect(terrainSlopeFillClass(0)).toBe(TERRAIN_SLOPE_FILL_CLASS[0]);
    expect(terrainSlopeFillClass(9)).toBe(TERRAIN_SLOPE_FILL_CLASS[TERRAIN_SLOPE_FILL_CLASS.length - 1]);
    expect(terrainSlopeFillClass(-1)).toBe(TERRAIN_SLOPE_FILL_CLASS[0]);
  });
});
