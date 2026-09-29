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

export type BasemapProviderId = 'osmf' | 'carto' | 'nestor';

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
  /**
   * Ό,τι **διανέμουμε εμείς** στον browser από αυτόν τον πάροχο (γραμματοσειρές, εικονίδια), με την άδειά του.
   * Κενός πίνακας = δεν διανέμουμε τίποτα (τα πλακίδια τα σερβίρει ο τρίτος). Για αυτοφιλοξενούμενο πάροχο είναι
   * **η μόνη δήλωση**: τα `.pbf` ζουν εκτός git, άρα το CHECK 3.69 δομικά δεν τα βλέπει (ADR-891 §9).
   */
  readonly distributedAssets: readonly BasemapDistributedAsset[];
}

/** Ένα κομμάτι που σερβίρουμε εμείς, και ο όρος της άδειας που το συνοδεύει. */
export interface BasemapDistributedAsset {
  readonly asset: string;
  readonly spdx: 'OFL-1.1' | 'MIT';
  /** Πού ταξιδεύει το κείμενο της άδειας μαζί με τα αντίγραφα (διαδρομή μέσα στον φάκελο assets του bundle). */
  readonly licenseFile: string;
}

/** Η λέξη «OpenStreetMap» ως σύνδεσμος προς τη σελίδα της άδειας — οδηγία απόδοσης του OSMF. */
const OSM_LINK: MapAttributionSegment = { text: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' };

// ⚠️ Κανονική μορφή: ποτέ δύο διαδοχικά κομμάτια κειμένου — ό,τι δίνει και το `attributionSegmentsFromHtml`,
// ώστε ο κύκλος πίνακας → HTML → κομμάτια να επιστρέφει τον ίδιο πίνακα (άγκυρα Δ).
const OSM_ATTRIBUTION: readonly MapAttributionSegment[] = [{ text: '© ' }, OSM_LINK, { text: ' contributors' }];

// ── Ο ΔΙΚΟΣ ΜΑΣ ΔΙΑΚΟΜΙΣΤΗΣ ΥΠΟΒΑΘΡΟΥ (ADR-891 §9) ─────────────────────────────────────────────────────────────
// Ένα bundle, σερβιρισμένο στατικά με HTTP Range (Caddy στο Netcup, `infra/basemap/`). Τα ονόματα φέρουν την
// έκδοση ⇒ `Cache-Control: immutable`: νέο build = νέο όνομα, ποτέ αντικατάσταση στη θέση του. Ο γεννήτορας
// (`npm run build:basemap`) διαβάζει ΑΥΤΕΣ τις σταθερές, άρα ο κατάλογος και το bundle δεν αποκλίνουν σιωπηλά.

/** Ο διακομιστής της παραγωγής. Υποτομέας και όχι διαδρομή: οι διαδρομές του Coolify v4 έχουν γνωστά σφάλματα. */
const PRODUCTION_BASEMAP_ORIGIN = 'https://maps.nestorconstruct.gr';

/**
 * Από πού σερβίρεται το bundle. Το `NEXT_PUBLIC_BASEMAP_ORIGIN` υπάρχει **μόνο** για τον τοπικό έλεγχο
 * (`npm run basemap:serve`) — η παραγωγή δεν το ορίζει.
 */
export const BASEMAP_BUNDLE_ORIGIN = (process.env.NEXT_PUBLIC_BASEMAP_ORIGIN ?? PRODUCTION_BASEMAP_ORIGIN).replace(/\/+$/, '');

/** Το build Protomaps του αρχείου που σερβίρεται (`YYYYMMDD`). Το αλλάζει η ανανέωση (Φ5). */
export const BASEMAP_ARCHIVE_BUILD = '20260926';

/** Το commit του `protomaps/basemaps-assets` (γραμματοσειρές + sprites) — καρφωμένο με sha256 στον γεννήτορα. */
export const BASEMAP_ASSETS_REVISION = '028c18f713baecad011301ff7a69acc39bcc2ae7';

/**
 * **Η έκδοση του ΠΕΡΙΕΧΟΜΕΝΟΥ των assets** — αλλάζει όταν αλλάζει ό,τι χτίζουμε **εμείς** πάνω στο ίδιο
 * upstream commit (ADR-891 §9.5). Μπαίνει στη διαδρομή, γιατί ο διακομιστής σερβίρει `immutable`: ένα νέο
 * περιεχόμενο στο **ίδιο** όνομα δεν θα το έβλεπε ποτέ browser που είχε το παλιό.
 * - `2`: οι στοίβες {@link BASEMAP_MATH_SUPPLEMENTED_FONTSTACKS} + Noto Sans Math (`≈` κ.ά.).
 */
export const BASEMAP_ASSETS_EDITION = 2;

/** Το όνομα του αρχείου ενός build μέσα στο bundle (`YYYYMMDD` → `greece-YYYYMMDD.pmtiles`). */
export function basemapArchiveFileName(build: string): string {
  return `greece-${build}.pmtiles`;
}

/** Διαδρομές **μέσα** στο bundle — τις ίδιες γράφει ο γεννήτορας και ζητά ο χάρτης. */
export const BASEMAP_BUNDLE_PATHS = {
  archive: basemapArchiveFileName(BASEMAP_ARCHIVE_BUILD),
  assets: `assets/${BASEMAP_ASSETS_REVISION.slice(0, 12)}-e${BASEMAP_ASSETS_EDITION}`,
} as const;

// ── ΓΡΑΜΜΑΤΟΣΕΙΡΕΣ ΧΑΡΤΗ (ADR-891 §9.5) ─────────────────────────────────────────────────────────────────────────
// Η MapLibre ζωγραφίζει κείμενο **μόνο** από στοίβες που σερβίρει ο glyph server του στυλ. Στοίβα που δεν
// υπάρχει ⇒ 404 ⇒ τοπική εφεδρεία TinySDF με τη γραμματοσειρά του **browser**. Εύρος που φορτώνει αλλά δεν
// έχει τον χαρακτήρα ⇒ ο χαρακτήρας **σβήνει σιωπηλά**. Γι' αυτό οι στοίβες είναι τύπος, όχι κυριολεκτικά.

/** Οι στοίβες του bundle μας: ό,τι ζητά το `@protomaps/basemaps` 5.x (`text-font`) + Devanagari (με έκφραση). */
export const BASEMAP_FONTSTACKS = [
  'Noto Sans Regular',
  'Noto Sans Medium',
  'Noto Sans Italic',
  'Noto Sans Devanagari Regular v1',
] as const;

export type BasemapFontstack = (typeof BASEMAP_FONTSTACKS)[number];

/**
 * Οι στοίβες όπου ο γεννήτορας προσθέτει το **Noto Sans Math** ως τελευταίο face: μπαίνει **μόνο** ό,τι λείπει,
 * όπως κάνει το `font-maker` με πολλά TTF. Το upstream (`create_fonts.sh` του Protomaps) δεν το περιλαμβάνει ⇒
 * το `≈` (U+2248) έλειπε, ενώ το εύρος `8704-8959` φόρτωνε κανονικά (μετρημένο 2026-09-28).
 */
export const BASEMAP_MATH_SUPPLEMENTED_FONTSTACKS: readonly BasemapFontstack[] = ['Noto Sans Regular', 'Noto Sans Medium'];

/**
 * **Η στοίβα ΚΑΘΕ ετικέτας της εφαρμογής πάνω σε υπόβαθρο** (π.χ. ο αριθμός του συσσωματώματος).
 *
 * 🔑 Όχι «η γραμματοσειρά του δικού μας χάρτη», αλλά **η τομή όσων σερβίρουν ΟΛΟΙ οι glyph servers** του
 * καταλόγου ({@link basemapGlyphFontstacks}): ο χάρτης αγγελιών αλλάζει υπόβαθρο (CARTO) και πέφτει σε CARTO αν
 * ο διακομιστής μας δεν απαντήσει — η ετικέτα πρέπει να βγαίνει **ίδια** σε όλα. Το CHECK 3.95 (Κ3) απαιτεί κάθε
 * `symbol` layer με `text-field` να τη ζητά από εδώ.
 */
export const BASEMAP_OVERLAY_TEXT_FONT: BasemapFontstack[] = ['Noto Sans Regular'];

/** Το σχήμα του πρωτοκόλλου που καταχωρίζει το σύνορο (`pmtiles-protocol.ts`). */
export const PMTILES_URL_SCHEME = 'pmtiles://';

/** `pmtiles://https://…` → `https://…` — ό,τι θα ζητηθεί πραγματικά από το δίκτυο. */
export function unwrapArchiveUrl(url: string): string {
  return url.startsWith(PMTILES_URL_SCHEME) ? url.slice(PMTILES_URL_SCHEME.length) : url;
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return origin;
  }
}

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
    distributedAssets: [],
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
    distributedAssets: [],
  },
  nestor: {
    id: 'nestor',
    // Ο τοπικός διακομιστής ελέγχου δηλώνεται μόνο όταν τον ορίζει ρητά το περιβάλλον.
    hosts: [...new Set([hostOf(PRODUCTION_BASEMAP_ORIGIN), hostOf(BASEMAP_BUNDLE_ORIGIN)])],
    terms: {
      // Δικά μας αντίγραφα δεδομένων ODbL: μόνος όρος η απόδοση, κανένα όριο, καμία εξάρτηση από τρίτο.
      commercialUse: 'allowed',
      freeMonthlyRequests: null,
      hasServiceLevelAgreement: false,
      prefetchAllowed: true,
      offlineAllowed: true,
      termsUrl: 'https://www.openstreetmap.org/copyright',
    },
    attribution: OSM_ATTRIBUTION,
    distributedAssets: [
      { asset: 'Γραμματοσειρές χάρτη Noto Sans (glyphs .pbf)', spdx: 'OFL-1.1', licenseFile: 'fonts/OFL.txt' },
      { asset: 'Noto Sans Math (συμπλήρωμα συμβόλων στα glyphs .pbf)', spdx: 'OFL-1.1', licenseFile: 'fonts/NotoSansMath-OFL.txt' },
      { asset: 'Εικονίδια χάρτη Protomaps (sprites, από tangrams/icons)', spdx: 'MIT', licenseFile: 'sprites/LICENSE.md' },
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
  /**
   * Στοίβες που σερβίρει ο glyph server **του τρίτου** και που ζητάμε εμείς (ετικέτες εφαρμογής). Δήλωση
   * **μετρημένη**, όχι υπόθεση: ο πάροχος τις αλλάζει χωρίς commit από εμάς (ADR-891 §9.5).
   */
  readonly glyphFontstacks: readonly string[];
}

/** Τα δύο θέματα της εφαρμογής — ο χάρτης φόντου ακολουθεί όποιο βάφει (ADR-891 §9). */
export type BasemapScheme = 'light' | 'dark';

/**
 * Αρχείο PMTiles (vector) + γραμματοσειρές + sprites από **ένα** bundle. Το στυλ το χτίζει ο χτίστης του client
 * (`protomaps-style.ts`), γιατί ο κατάλογος μένει φύλλο χωρίς εξαρτήσεις εκτέλεσης.
 */
export interface VectorArchiveBasemapSource extends BasemapSourceBase {
  readonly format: 'vector-archive';
  /** `pmtiles://https://…/greece-YYYYMMDD.pmtiles` — ό,τι δέχεται το `source.url` της MapLibre. */
  readonly archiveUrl: string;
  /** Πρότυπο glyphs της MapLibre (`{fontstack}/{range}.pbf`). */
  readonly glyphsUrl: string;
  /** Βάση των sprites· το όνομα του flavor μπαίνει στο τέλος. */
  readonly spriteBaseUrl: string;
  /** Όνομα flavor του `@protomaps/basemaps` ανά θέμα. */
  readonly flavors: Readonly<Record<BasemapScheme, string>>;
  /** Γλώσσα ονομάτων (`name:el`, με υποχώρηση στο τοπικό `name`). */
  readonly lang: string;
  readonly maxZoom: number;
}

export type BasemapSource = RasterBasemapSource | StyleBasemapSource | VectorArchiveBasemapSource;

/**
 * Οι στοίβες του glyph server της CARTO που **μετρήθηκαν** (2026-09-28, αποσυμπιεσμένα `.pbf`): σερβίρονται, και τα
 * εύρη `0-255`/`8704-8959` έχουν ψηφία, `+`, `·` **και** `≈`. Το `Noto Sans Regular` το ζητούν ήδη τα στυλ της.
 */
const CARTO_GLYPH_FONTSTACKS: readonly string[] = ['Noto Sans Regular', 'Open Sans Regular', 'Open Sans Bold'];

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
    glyphFontstacks: CARTO_GLYPH_FONTSTACKS,
  },
  'carto-voyager': {
    format: 'style',
    provider: 'carto',
    kind: 'street',
    styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    glyphFontstacks: CARTO_GLYPH_FONTSTACKS,
  },
  'carto-dark-matter': {
    format: 'style',
    provider: 'carto',
    kind: 'street',
    styleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    glyphFontstacks: CARTO_GLYPH_FONTSTACKS,
  },
  'protomaps-greece': {
    format: 'vector-archive',
    provider: 'nestor',
    kind: 'street',
    archiveUrl: `${PMTILES_URL_SCHEME}${BASEMAP_BUNDLE_ORIGIN}/${BASEMAP_BUNDLE_PATHS.archive}`,
    glyphsUrl: `${BASEMAP_BUNDLE_ORIGIN}/${BASEMAP_BUNDLE_PATHS.assets}/fonts/{fontstack}/{range}.pbf`,
    spriteBaseUrl: `${BASEMAP_BUNDLE_ORIGIN}/${BASEMAP_BUNDLE_PATHS.assets}/sprites/v4`,
    flavors: { light: 'light', dark: 'dark' },
    lang: 'el',
    // Η βαθύτερη ζώνη του γεννήτορα (ADR-891 §7.2)· πέρα από αυτή η MapLibre μεγεθύνει τα z15 (overzoom).
    maxZoom: 15,
  },
} as const satisfies Record<string, BasemapSource>;

export type BasemapSourceId = keyof typeof BASEMAP_SOURCE_TABLE;

/** Οι πηγές raster — οι μόνες που μπορεί να ζωγραφίσει ο καμβάς DXF (δεν διαβάζει στυλ vector). */
export type RasterBasemapSourceId = {
  [K in BasemapSourceId]: (typeof BASEMAP_SOURCE_TABLE)[K]['format'] extends 'raster' ? K : never;
}[BasemapSourceId];

/** Οι πηγές αρχείου vector — το στυλ τους εξαρτάται από το θέμα και το χτίζει το `protomaps-style.ts`. */
export type VectorArchiveBasemapSourceId = {
  [K in BasemapSourceId]: (typeof BASEMAP_SOURCE_TABLE)[K]['format'] extends 'vector-archive' ? K : never;
}[BasemapSourceId];

/** Οι πηγές με **ένα** στυλ, ανεξάρτητο από το θέμα (raster ή έτοιμο style.json τρίτου). */
export type StaticBasemapSourceId = Exclude<BasemapSourceId, VectorArchiveBasemapSourceId>;

export const BASEMAP_SOURCES: Readonly<Record<BasemapSourceId, BasemapSource>> = BASEMAP_SOURCE_TABLE;

export function rasterBasemapSource(id: RasterBasemapSourceId): RasterBasemapSource {
  return BASEMAP_SOURCE_TABLE[id];
}

export function vectorArchiveBasemapSource(id: VectorArchiveBasemapSourceId): VectorArchiveBasemapSource {
  return BASEMAP_SOURCE_TABLE[id];
}

export function isVectorArchiveSourceId(id: BasemapSourceId): id is VectorArchiveBasemapSourceId {
  return BASEMAP_SOURCE_TABLE[id].format === 'vector-archive';
}

export function basemapProviderOf(source: BasemapSource): BasemapProvider {
  return BASEMAP_PROVIDERS[source.provider];
}

/**
 * Οι στοίβες που σερβίρει ο glyph server της πηγής. **Κενό = καμία ετικέτα**: στυλ raster δεν έχει `glyphs`, και
 * εκεί ένα `symbol` layer με `text-field` δεν ζωγραφίζει τίποτα.
 */
export function basemapGlyphFontstacks(source: BasemapSource): readonly string[] {
  if (source.format === 'vector-archive') return BASEMAP_FONTSTACKS;
  return source.format === 'style' ? source.glyphFontstacks : [];
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

/**
 * Ό,τι δέχεται το `mapStyle` της MapLibre για πηγή **με ένα στυλ**: URL στυλ, ή στυλ raster που χτίσαμε.
 * Οι πηγές αρχείου vector ζητούν θέμα ⇒ `protomapsStyle` (`protomaps-style.ts`).
 */
export function basemapStyle(id: StaticBasemapSourceId): string | StyleSpecification {
  const source = BASEMAP_SOURCES[id];
  if (source.format === 'vector-archive') throw new Error(`${id}: vector-archive source — build it with protomapsStyle`);
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
