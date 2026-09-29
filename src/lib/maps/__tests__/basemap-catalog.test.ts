/**
 * Άγκυρες του **μητρώου υποβάθρων** (ADR-891 Φ1).
 *
 * 🔑 **ΔΕΥΤΕΡΗ ΦΩΝΗ**: οι όροι των παρόχων γράφονται εδώ **ξανά, με το χέρι**, από τις σελίδες όρων
 * (OSMF Tile Usage Policy · CARTO Basemaps FAQ, 2026-09-27). Ένα test που διάβαζε τον πίνακα για να
 * κρίνει τον πίνακα θα ήταν ο κριτής που κρίνει τον εαυτό του. Αν αλλάξει κάποιος όρος στον πίνακα,
 * κοκκινίζει εδώ ⇒ κάποιος πρέπει να ξαναδιαβάσει τη σελίδα όρων.
 */

import {
  BASEMAP_ARCHIVE_BUILD,
  BASEMAP_BUNDLE_PATHS,
  BASEMAP_PROVIDERS,
  BASEMAP_SOURCES,
  attributionHtml,
  basemapArchiveFileName,
  basemapProviderOf,
  basemapProviderOfHost,
  BASEMAP_FALLBACK_SOURCE_ID,
  BASEMAP_OVERLAY_TEXT_FONT,
  DEFAULT_BASEMAP_SOURCE_ID,
  basemapGlyphFontstacks,
  basemapStyle,
  isVectorArchiveSourceId,
  unwrapArchiveUrl,
  vectorArchiveBasemapSource,
  type BasemapProviderId,
  type BasemapProviderTerms,
  type BasemapSource,
} from '../basemap-catalog';
import { attributionSegmentsFromHtml } from '../map-attribution';

describe('Α — οι πάροχοι και οι όροι τους, γραμμένοι δεύτερη φορά', () => {
  const TERMS: ReadonlyArray<readonly [BasemapProviderId, Partial<BasemapProviderTerms>]> = [
    ['osmf', { freeMonthlyRequests: null, hasServiceLevelAgreement: false, prefetchAllowed: false, offlineAllowed: false }],
    ['carto', { commercialUse: 'allowed-within-quota', freeMonthlyRequests: 1_000_000, hasServiceLevelAgreement: false }],
    // Δικά μας αντίγραφα ODbL (ADR-891 §9): κανένα όριο, prefetch και offline επιτρέπονται.
    ['nestor', { commercialUse: 'allowed', freeMonthlyRequests: null, prefetchAllowed: true, offlineAllowed: true }],
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
  it('οι πέντε γνωστές — έφυγαν Stadia και OpenTopoMap (μόνο μη εμπορική χρήση), ήρθε η δική μας (Φ3)', () => {
    expect(Object.keys(BASEMAP_SOURCES).sort()).toEqual([
      'carto-dark-matter',
      'carto-positron',
      'carto-voyager',
      'osm-raster',
      'protomaps-greece',
    ]);
  });

  function primaryUrl(source: BasemapSource): string {
    if (source.format === 'raster') return source.urlTemplate.replace(/\{[xyz]\}/g, '0');
    return source.format === 'style' ? source.styleUrl : unwrapArchiveUrl(source.archiveUrl);
  }

  it.each(Object.entries(BASEMAP_SOURCES))('%s: ο διακομιστής της ανήκει στον ΔΙΚΟ της πάροχο', (_id, source) => {
    expect(basemapProviderOfHost(new URL(primaryUrl(source)).hostname)).toBe(basemapProviderOf(source));
  });
});

describe('Ζ — ο δικός μας χάρτης (ADR-891 §9)', () => {
  const source = vectorArchiveBasemapSource('protomaps-greece');

  it('σερβίρεται από το maps.nestorconstruct.gr (υποτομέας, όχι διαδρομή του Coolify)', () => {
    expect(source.archiveUrl).toBe('pmtiles://https://maps.nestorconstruct.gr/greece-20260926.pmtiles');
    expect(source.glyphsUrl).toBe('https://maps.nestorconstruct.gr/assets/028c18f713ba-e2/fonts/{fontstack}/{range}.pbf');
    expect(source.spriteBaseUrl).toBe('https://maps.nestorconstruct.gr/assets/028c18f713ba-e2/sprites/v4');
  });

  it('το όνομα του αρχείου φέρει το build — immutable cache χωρίς ψέματα', () => {
    expect(BASEMAP_BUNDLE_PATHS.archive).toBe(basemapArchiveFileName(BASEMAP_ARCHIVE_BUILD));
    expect(BASEMAP_ARCHIVE_BUILD).toMatch(/^\d{8}$/);
  });

  it('ένα flavor ανά θέμα της εφαρμογής, ελληνικά ονόματα, zoom όσο η βαθύτερη ζώνη', () => {
    expect(source.flavors).toEqual({ light: 'light', dark: 'dark' });
    expect(source.lang).toBe('el');
    expect(source.maxZoom).toBe(15);
  });

  it('ό,τι διανέμουμε εμείς δηλώνεται με άδεια και αρχείο άδειας — οι τρίτοι δεν διανέμουν μέσω μας', () => {
    expect(BASEMAP_PROVIDERS.nestor.distributedAssets.map((a) => [a.spdx, a.licenseFile])).toEqual([
      ['OFL-1.1', 'fonts/OFL.txt'],
      ['OFL-1.1', 'fonts/NotoSansMath-OFL.txt'], // ADR-891 §9.5 — συμπλήρωμα συμβόλων (notofonts @55773c3e)
      ['MIT', 'sprites/LICENSE.md'],
    ]);
    expect(BASEMAP_PROVIDERS.osmf.distributedAssets).toEqual([]);
    expect(BASEMAP_PROVIDERS.carto.distributedAssets).toEqual([]);
  });

  it('στατικό στυλ ΔΕΝ χτίζεται για πηγή vector — ο τύπος το αποκλείει, το runtime το ξαναλέει', () => {
    expect(isVectorArchiveSourceId('protomaps-greece')).toBe(true);
    expect(isVectorArchiveSourceId('osm-raster')).toBe(false);
  });

  it('pmtiles://https://x → https://x · οτιδήποτε άλλο μένει ίδιο', () => {
    expect(unwrapArchiveUrl('pmtiles://https://a.b/c')).toBe('https://a.b/c');
    expect(unwrapArchiveUrl('https://a.b/c')).toBe('https://a.b/c');
  });
});

describe('Γ — ο ΕΝΑΣ χτίστης στυλ raster', () => {
  const built = basemapStyle('osm-raster');
  if (typeof built === 'string') throw new Error('osm-raster: αναμενόταν στυλ που χτίσαμε, όχι URL');
  const style = built;

  it('έγκυρο στυλ v8 με μία πηγή και ένα στρώμα που τη δείχνει', () => {
    expect(style.version).toBe(8);
    expect(style.name).toBe('osm-raster');
    expect(Object.keys(style.sources)).toEqual(['osm-raster']);
    expect(style.layers).toEqual([{ id: 'osm-raster-layer', type: 'raster', source: 'osm-raster' }]);
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
    ['maps.nestorconstruct.gr', 'nestor'],
  ])('%s → %s', (host, provider) => {
    expect(basemapProviderOfHost(host)?.id).toBe(provider);
  });

  it.each([
    'tiles.stadiamaps.com',
    'tile.opentopomap.org',
    'evilbasemaps.cartocdn.com.attacker.io',
    'cartocdn.com',
    'maps.nestorconstruct.gr.attacker.io',
    'nestorconstruct.gr',
  ])(
    '%s → κανείς',
    (host) => {
      expect(basemapProviderOfHost(host)).toBeNull();
    },
  );
});

describe('Δ — ΚΑΜΙΑ ΠΡΟΕΠΙΛΟΓΗ ΣΕ ΕΞΩΤΕΡΙΚΗ ΠΗΓΗ (ADR-891 Φ4)', () => {
  it('το φόντο με το οποίο ανοίγει κάθε χάρτης το σερβίρουμε ΕΜΕΙΣ', () => {
    expect(BASEMAP_SOURCES[DEFAULT_BASEMAP_SOURCE_ID].provider).toBe('nestor');
  });

  it('η εφεδρεία είναι ΑΛΛΟΣ πάροχος — αλλιώς πέφτει μαζί με τον δικό μας', () => {
    const fallback = BASEMAP_SOURCES[BASEMAP_FALLBACK_SOURCE_ID];
    expect(fallback.provider).not.toBe(BASEMAP_SOURCES[DEFAULT_BASEMAP_SOURCE_ID].provider);
  });

  it('και σερβίρει τη στοίβα των ετικετών της εφαρμογής — αλλιώς οι αριθμοί σβήνουν στην αποτυχία', () => {
    const glyphs = basemapGlyphFontstacks(BASEMAP_SOURCES[BASEMAP_FALLBACK_SOURCE_ID]);
    expect(glyphs).toEqual(expect.arrayContaining(BASEMAP_OVERLAY_TEXT_FONT));
  });
});
