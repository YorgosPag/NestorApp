/**
 * @fileoverview **ΤΟ ΜΗΤΡΩΟ ΤΩΝ ΥΠΟΒΑΘΡΩΝ** — ποιος μας δίνει πλακίδια, από ποιους διακομιστές, με ποιους
 * όρους, και τι οφείλουμε να γράφουμε ως απόδοση. Η **μία** δήλωση για κάθε χάρτη της εφαρμογής.
 * @related ADR-891 Φ1 · ADR-782 (υπόβαθρο DXF) · ADR-777 §8.70 (στιγμιότυπο) · CHECK 3.95
 * @module lib/maps/basemap-catalog
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι τις 2026-09-27 οι πηγές ζούσαν σε **πέντε** αρχεία (δύο νεκρά), με **τρεις** πανομοιότυπους
 * χτίστες raster στυλ, και ο χάρτης εργασίας πρόσφερε **τρία** υπόβαθρα που η άδειά τους **απαγορεύει**
 * εμπορική χρήση (Stadia Stamen: στυλ CC BY-NC-SA · OpenTopoMap: μόνο μη εμπορικό). Κανείς δεν το είχε
 * αποφασίσει — απλώς κανείς δεν ρωτούσε, γιατί οι όροι δεν ήταν γραμμένοι πουθενά.
 *
 * 🔑 **ΟΙ ΟΡΟΙ ΕΙΝΑΙ ΠΕΔΙΑ, ΟΧΙ ΣΧΟΛΙΑ** (πρότυπο του `basemap-source.ts` του DXF, που το έκανε πρώτο):
 * - `commercialUse` **δεν έχει** τιμή «μόνο μη εμπορικό». Πάροχος με τέτοιους όρους **δεν μεταγλωττίζεται**
 *   — για να μπει, πρέπει να αλλάξει ο **τύπος**, δηλαδή να το δει άνθρωπος.
 * - `prefetchAllowed` το διαβάζει ο προγραμματιστής αιτημάτων του DXF (`maxPrefetchRing`).
 * - `hosts` το διαβάζει ο φύλακας εκτέλεσης (`basemap-request-sentinel.ts`): περιλαμβάνει και τους
 *   **έμμεσους** διακομιστές — το style.json της CARTO φορτώνει πλακίδια από `tiles.basemaps.cartocdn.com`
 *   (μετρημένο 2026-09-27), που κανένα grep στον κώδικα δεν μπορεί να δει.
 *
 * 🏆 **ΠΕΡΑ ΑΠΟ ΤΗΝ ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ.** Το kepler.gl δηλώνει υπόβαθρα ως `{id, label, url, icon}`: ο
 * κατάλογος ξέρει **πού**, όχι **με ποιους όρους**. Εδώ η ίδια γραμμή κρατά και τη νομική υποχρέωση, και
 * φυλάγεται σε **δύο** στρώσεις: στατικά (CHECK 3.95: κανένα URL πλακιδίων έξω από αυτό το αρχείο) και την
 * ώρα της εκτέλεσης (`transformRequest` της MapLibre — το ίδιο που κάνει ένα CSP, στοχευμένα στον χάρτη).
 *
 * ⚠️ **Φύλλο**: μόνο `import type` — το διαβάζουν client, server και ο καμβάς DXF.
 *
 * @see https://operations.osmfoundation.org/policies/tiles/
 * @see https://docs.carto.com/faqs/carto-basemaps
 */

import type { RasterLayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { MapAttributionSegment } from './map-attribution';

// ============================================================================
// 1. ΠΑΡΟΧΟΙ — ποιος, από πού, με ποιους όρους
// ============================================================================

export type BasemapProviderId = 'osmf' | 'carto';

/**
 * Οι όροι χρήσης, όπως τους δηλώνει ο πάροχος.
 *
 * ⚠️ Το `commercialUse` **δεν** έχει τιμή `'non-commercial'` — επίτηδες (βλ. επικεφαλίδα).
 */
export interface BasemapProviderTerms {
  /** `allowed-within-quota`: δωρεάν μέχρι το `freeMonthlyRequests`, μετά πληρωμή. */
  readonly commercialUse: 'allowed' | 'allowed-within-quota';
  /** Δωρεάν αιτήματα πλακιδίων ανά μήνα· `null` = ο πάροχος δεν δηλώνει όριο. */
  readonly freeMonthlyRequests: number | null;
  readonly hasServiceLevelAgreement: boolean;
  /** Επιτρέπεται να ζητήσουμε πλακίδια **έξω** από όσα βλέπει ο χρήστης; */
  readonly prefetchAllowed: boolean;
  /** Επιτρέπεται αποθήκευση για χρήση χωρίς δίκτυο; */
  readonly offlineAllowed: boolean;
  readonly termsUrl: string;
}

export interface BasemapProvider {
  readonly id: BasemapProviderId;
  /**
   * Κάθε διακομιστής από τον οποίο φορτώνει ο πάροχος — **και** οι έμμεσοι (TileJSON, glyphs, sprites).
   * Ακριβές όνομα, ή `*.` πρόθεμα για κάθε υποτομέα.
   */
  readonly hosts: readonly string[];
  readonly terms: BasemapProviderTerms;
  /**
   * Η απόδοση: νομικός όρος και εμπορικό σήμα, **όχι** μήνυμα διεπαφής — δεν περνά από `t()`.
   * Κενός πίνακας σημαίνει «κανείς δεν την έγραψε»· η άγκυρα το απαγορεύει για κάθε πάροχο.
   */
  readonly attribution: readonly MapAttributionSegment[];
}

/** Η λέξη «OpenStreetMap» ως σύνδεσμος προς τη σελίδα της άδειας — οδηγία απόδοσης του OSMF. */
const OSM_LINK: MapAttributionSegment = { text: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' };

// ⚠️ Κανονική μορφή: ποτέ δύο διαδοχικά κομμάτια κειμένου — ό,τι δίνει και το `attributionSegmentsFromHtml`,
// ώστε ο κύκλος πίνακας → HTML → κομμάτια να επιστρέφει τον ίδιο πίνακα (άγκυρα Δ).
const OSM_ATTRIBUTION: readonly MapAttributionSegment[] = [{ text: '© ' }, OSM_LINK, { text: ' contributors' }];

export const BASEMAP_PROVIDERS: Readonly<Record<BasemapProviderId, BasemapProvider>> = {
  osmf: {
    id: 'osmf',
    hosts: ['tile.openstreetmap.org'],
    terms: {
      // Ανεκτή, αλλά «may be withdrawn at any point» — καμία εγγύηση για πληρωμένους πελάτες.
      commercialUse: 'allowed',
      freeMonthlyRequests: null,
      hasServiceLevelAgreement: false,
      // «any pre-emptive fetching of tiles other than those a user is actively viewing» απαγορεύεται.
      prefetchAllowed: false,
      offlineAllowed: false,
      termsUrl: 'https://operations.osmfoundation.org/policies/tiles/',
    },
    attribution: OSM_ATTRIBUTION,
  },
  carto: {
    id: 'carto',
    hosts: ['basemaps.cartocdn.com', '*.basemaps.cartocdn.com'],
    terms: {
      // Πάνω από 1 εκατ./μήνα: CARTO Basemaps Commercial, 500 $/μήνα (ADR-891 §1).
      commercialUse: 'allowed-within-quota',
      freeMonthlyRequests: 1_000_000,
      hasServiceLevelAgreement: false,
      prefetchAllowed: true,
      offlineAllowed: false,
      termsUrl: 'https://docs.carto.com/faqs/carto-basemaps',
    },
    attribution: [
      { text: '© ' },
      { text: 'CARTO', href: 'https://carto.com/attributions' },
      { text: ' © ' },
      OSM_LINK,
      { text: ' contributors' },
    ],
  },
};

// ============================================================================
// 2. ΠΗΓΕΣ — τα υπόβαθρα που μπορεί να ζητήσει ένας χάρτης
// ============================================================================

/** Τι είδους περιεχόμενο δείχνει μια πηγή. `aerial` δεν υπάρχει ακόμα: καμία δωρεάν εμπορική πηγή (ADR-891 §5). */
export type BasemapImageryKind = 'street' | 'aerial' | 'topographic';

interface BasemapSourceBase {
  readonly provider: BasemapProviderId;
  readonly kind: BasemapImageryKind;
}

/** Πλακίδια raster με πρότυπο `{z}/{x}/{y}` — το στυλ το χτίζουμε εμείς. */
export interface RasterBasemapSource extends BasemapSourceBase {
  readonly format: 'raster';
  readonly urlTemplate: string;
  readonly tileSizePx: number;
  /** Το βαθύτερο επίπεδο που σερβίρει ο πάροχος — πέρα από αυτό, βέβαιο 404. */
  readonly maxZoom: number;
}

/** Έτοιμο στυλ MapLibre του παρόχου — η απόδοση έρχεται από το TileJSON του. */
export interface StyleBasemapSource extends BasemapSourceBase {
  readonly format: 'style';
  readonly styleUrl: string;
}

export type BasemapSource = RasterBasemapSource | StyleBasemapSource;

const BASEMAP_SOURCE_TABLE = {
  'osm-raster': {
    format: 'raster',
    provider: 'osmf',
    kind: 'street',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileSizePx: 256,
    maxZoom: 19,
  },
  'carto-positron': {
    format: 'style',
    provider: 'carto',
    kind: 'street',
    styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
  'carto-voyager': {
    format: 'style',
    provider: 'carto',
    kind: 'street',
    styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  },
  'carto-dark-matter': {
    format: 'style',
    provider: 'carto',
    kind: 'street',
    styleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
} as const satisfies Record<string, BasemapSource>;

export type BasemapSourceId = keyof typeof BASEMAP_SOURCE_TABLE;

/** Οι πηγές raster — οι μόνες που μπορεί να ζωγραφίσει ο καμβάς DXF (δεν διαβάζει στυλ vector). */
export type RasterBasemapSourceId = {
  [K in BasemapSourceId]: (typeof BASEMAP_SOURCE_TABLE)[K]['format'] extends 'raster' ? K : never;
}[BasemapSourceId];

export const BASEMAP_SOURCES: Readonly<Record<BasemapSourceId, BasemapSource>> = BASEMAP_SOURCE_TABLE;

export function rasterBasemapSource(id: RasterBasemapSourceId): RasterBasemapSource {
  return BASEMAP_SOURCE_TABLE[id];
}

export function basemapProviderOf(source: BasemapSource): BasemapProvider {
  return BASEMAP_PROVIDERS[source.provider];
}

// ============================================================================
// 3. ΣΤΥΛ MAPLIBRE — ο ΕΝΑΣ χτίστης
// ============================================================================

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Κομμάτια απόδοσης → το HTML που περιμένει το `source.attribution` της MapLibre. Το αντίστροφο του
 * `attributionSegmentsFromHtml` (`map-attribution.ts`), ώστε ο πίνακας να είναι η μόνη αυθεντία.
 */
export function attributionHtml(segments: readonly MapAttributionSegment[]): string {
  return segments
    .map(({ text, href }) =>
      href === undefined ? escapeHtml(text) : `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`,
    )
    .join('');
}

export interface RasterStyleOptions {
  readonly name?: string;
  readonly paint?: RasterLayerSpecification['paint'];
}

/**
 * Στυλ MapLibre (v8) για πηγή raster. Αντικαθιστά τους τρεις χειρόγραφους χτίστες που υπήρχαν
 * (`createGreeceCustomStyle`, `OSM_MAP_STYLE`, `MAP_STYLES.DEVELOPMENT`).
 */
export function rasterStyleSpecification(
  id: RasterBasemapSourceId,
  options: RasterStyleOptions = {},
): StyleSpecification {
  return buildRasterStyle(id, rasterBasemapSource(id), options);
}

function buildRasterStyle(id: BasemapSourceId, source: RasterBasemapSource, options: RasterStyleOptions): StyleSpecification {
  const layer: RasterLayerSpecification = { id: `${id}-layer`, type: 'raster', source: id };
  return {
    version: 8,
    name: options.name ?? id,
    sources: {
      [id]: {
        type: 'raster',
        tiles: [source.urlTemplate],
        tileSize: source.tileSizePx,
        maxzoom: source.maxZoom,
        attribution: attributionHtml(basemapProviderOf(source).attribution),
      },
    },
    layers: [options.paint === undefined ? layer : { ...layer, paint: options.paint }],
  };
}

/** Ό,τι δέχεται το `mapStyle` της MapLibre για αυτή την πηγή: URL στυλ, ή στυλ που χτίσαμε. */
export function basemapStyle(id: BasemapSourceId): string | StyleSpecification {
  const source = BASEMAP_SOURCES[id];
  return source.format === 'style' ? source.styleUrl : buildRasterStyle(id, source, {});
}

// ============================================================================
// 4. ΔΙΑΚΟΜΙΣΤΕΣ — τι δικαιούται να ζητήσει ένας χάρτης
// ============================================================================

function hostMatches(hostname: string, pattern: string): boolean {
  return pattern.startsWith('*.') ? hostname.endsWith(pattern.slice(1)) : hostname === pattern;
}

/** Ο πάροχος που δηλώνει αυτόν τον διακομιστή, ή `null` αν δεν τον δηλώνει κανείς. */
export function basemapProviderOfHost(hostname: string): BasemapProvider | null {
  const host = hostname.toLowerCase();
  return Object.values(BASEMAP_PROVIDERS).find((p) => p.hosts.some((pattern) => hostMatches(host, pattern))) ?? null;
}
