/**
 * @jest-environment node
 *
 * ADR-920 §14.12 Β4 — η διεύθυνση ενός πλακιδίου σύντηξης γράφεται και διαβάζεται από το ίδιο αρχείο (`basemap-catalog.ts`).
 */

import { ELEVATION_FUSION_URL_SCHEME, elevationFusionTileTemplate, parseElevationFusionTileUrl } from '../basemap-catalog';

/** Ό,τι κάνει η MapLibre στο πρότυπο: βάζει τους αριθμούς του πλακιδίου. */
const fill = (template: string, z: number, x: number, y: number): string =>
  template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

describe('διεύθυνση πλακιδίου σύντηξης', () => {
  it('ό,τι γράφει το πρότυπο το διαβάζει πίσω η ανάγνωση', () => {
    const url = fill(elevationFusionTileTemplate('s7'), 18, 147_892, 98_765);
    expect(parseElevationFusionTileUrl(url)).toEqual({ surface: 's7', z: 18, x: 147_892, y: 98_765 });
  });

  it('κλειδί επιφάνειας με χαρακτήρες διεύθυνσης επιστρέφει αυτούσιο', () => {
    const url = fill(elevationFusionTileTemplate('a/b c?d'), 3, 4, 2);
    expect(parseElevationFusionTileUrl(url)?.surface).toBe('a/b c?d');
  });

  it.each([
    'https://example.org/s1/3/4/2',
    `${ELEVATION_FUSION_URL_SCHEME}s1/3/4`,
    `${ELEVATION_FUSION_URL_SCHEME}s1/3/4/2/9`,
    `${ELEVATION_FUSION_URL_SCHEME}s1/3/x/2`,
    `${ELEVATION_FUSION_URL_SCHEME}%E0%A4%A/3/4/2`,
  ])('ό,τι δεν είναι πλακίδιο σύντηξης δεν διαβάζεται: %s', (url) => {
    expect(parseElevationFusionTileUrl(url)).toBeNull();
  });
});
