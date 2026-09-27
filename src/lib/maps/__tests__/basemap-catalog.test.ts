/**
 * Άγκυρες του **μητρώου υποβάθρων** (ADR-891 Φ1).
 *
 * 🔑 **ΔΕΥΤΕΡΗ ΦΩΝΗ**: οι όροι των παρόχων γράφονται εδώ **ξανά, με το χέρι**, από τις σελίδες όρων
 * (OSMF Tile Usage Policy · CARTO Basemaps FAQ, 2026-09-27). Ένα test που διάβαζε τον πίνακα για να
 * κρίνει τον πίνακα θα ήταν ο κριτής που κρίνει τον εαυτό του. Αν αλλάξει κάποιος όρος στον πίνακα,
 * κοκκινίζει εδώ ⇒ κάποιος πρέπει να ξαναδιαβάσει τη σελίδα όρων.
 */

import {
  BASEMAP_PROVIDERS,
  BASEMAP_SOURCES,
  attributionHtml,
  basemapProviderOf,
  basemapProviderOfHost,
  basemapStyle,
  rasterStyleSpecification,
  type BasemapProviderId,
  type BasemapProviderTerms,
} from '../basemap-catalog';
import { attributionSegmentsFromHtml } from '../map-attribution';

describe('Α — οι πάροχοι και οι όροι τους, γραμμένοι δεύτερη φορά', () => {
  const TERMS: ReadonlyArray<readonly [BasemapProviderId, Partial<BasemapProviderTerms>]> = [
    ['osmf', { freeMonthlyRequests: null, hasServiceLevelAgreement: false, prefetchAllowed: false, offlineAllowed: false }],
    ['carto', { commercialUse: 'allowed-within-quota', freeMonthlyRequests: 1_000_000, hasServiceLevelAgreement: false }],
  ];

  it.each(TERMS)('%s', (id, expected) => {
    expect(BASEMAP_PROVIDERS[id].terms).toMatchObject(expected);
  });

  it('ο πίνακας κρίνει ΚΑΘΕ πάροχο — κανένας δεν ξεφεύγει', () => {
    expect(TERMS.map(([id]) => id).sort()).toEqual(Object.keys(BASEMAP_PROVIDERS).sort());
  });

  it.each(Object.values(BASEMAP_PROVIDERS))('$id: απόδοση ΜΗ κενή, με σύνδεσμο προς το OpenStreetMap', (provider) => {
    expect(provider.attribution.length).toBeGreaterThan(0);
    expect(provider.attribution).toContainEqual({ text: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' });
  });

  it.each(Object.values(BASEMAP_PROVIDERS))('$id: δηλώνει διακομιστές και σελίδα όρων https', (provider) => {
    expect(provider.hosts.length).toBeGreaterThan(0);
    expect(provider.terms.termsUrl).toMatch(/^https:\/\//);
  });
});

describe('Β — οι πηγές', () => {
  it('οι τέσσερις γνωστές — έφυγαν Stadia και OpenTopoMap (μόνο μη εμπορική χρήση)', () => {
    expect(Object.keys(BASEMAP_SOURCES).sort()).toEqual(['carto-dark-matter', 'carto-positron', 'carto-voyager', 'osm-raster']);
  });

  it.each(Object.entries(BASEMAP_SOURCES))('%s: ο διακομιστής της ανήκει στον ΔΙΚΟ της πάροχο', (_id, source) => {
    const url = source.format === 'raster' ? source.urlTemplate : source.styleUrl;
    expect(basemapProviderOfHost(new URL(url.replace(/\{[xyz]\}/g, '0')).hostname)).toBe(basemapProviderOf(source));
  });
});

describe('Γ — ο ΕΝΑΣ χτίστης στυλ raster', () => {
  const style = rasterStyleSpecification('osm-raster', { name: 'Test', paint: { 'raster-saturation': 0.1 } });

  it('έγκυρο στυλ v8 με μία πηγή και ένα στρώμα που τη δείχνει', () => {
    expect(style.version).toBe(8);
    expect(style.name).toBe('Test');
    expect(Object.keys(style.sources)).toEqual(['osm-raster']);
    expect(style.layers).toEqual([
      { id: 'osm-raster-layer', type: 'raster', source: 'osm-raster', paint: { 'raster-saturation': 0.1 } },
    ]);
  });

  it('η πηγή κουβαλά URL, μέγεθος, zoom και απόδοση ΑΠΟ τον πίνακα', () => {
    expect(style.sources['osm-raster']).toEqual({
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
  });

  it('χωρίς paint, το στρώμα δεν φέρει κενό paint', () => {
    expect(rasterStyleSpecification('osm-raster').layers[0]).not.toHaveProperty('paint');
  });

  it('στυλ παρόχου ⇒ URL· raster ⇒ στυλ που χτίσαμε', () => {
    expect(basemapStyle('carto-positron')).toBe('https://basemaps.cartocdn.com/gl/positron-gl-style/style.json');
    expect(typeof basemapStyle('osm-raster')).toBe('object');
  });
});

describe('Δ — η απόδοση κάνει τον κύκλο HTML ↔ κομμάτια χωρίς απώλεια', () => {
  it.each(Object.values(BASEMAP_PROVIDERS))('$id', (provider) => {
    expect(attributionSegmentsFromHtml(attributionHtml(provider.attribution))).toEqual(provider.attribution);
  });

  it('το κείμενο ΔΙΑΦΕΥΓΕΙ — κανένα ωμό HTML από τον πίνακα', () => {
    expect(attributionHtml([{ text: '<b>x</b> & "y"' }])).toBe('&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;');
  });
});

describe('Ε — ποιος διακομιστής ανήκει σε ποιον', () => {
  it.each([
    ['tile.openstreetmap.org', 'osmf'],
    ['basemaps.cartocdn.com', 'carto'],
    ['tiles.basemaps.cartocdn.com', 'carto'], // έμμεσος: τον φορτώνει το style.json της CARTO
    ['TILES.BASEMAPS.CARTOCDN.COM', 'carto'],
  ])('%s → %s', (host, provider) => {
    expect(basemapProviderOfHost(host)?.id).toBe(provider);
  });

  it.each(['tiles.stadiamaps.com', 'tile.opentopomap.org', 'evilbasemaps.cartocdn.com.attacker.io', 'cartocdn.com'])(
    '%s → κανείς',
    (host) => {
      expect(basemapProviderOfHost(host)).toBeNull();
    },
  );
});
