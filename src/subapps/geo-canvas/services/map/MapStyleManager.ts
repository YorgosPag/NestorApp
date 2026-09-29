/**
 * 🎨 MAP STYLE MANAGER — τα υπόβαθρα του χάρτη γεωαναφοράς / αναζήτησης, ως **επιλογές πάνω στο μητρώο**.
 *
 * Εδώ ζει **μόνο** το λεξιλόγιο της διεπαφής (ποια υπόβαθρα, με ποια σειρά, τι γίνεται όταν ένα αποτύχει).
 * **Πού** είναι τα πλακίδια και **με ποιους όρους** το ξέρει μόνο το `@/lib/maps/basemap-catalog`
 * (ADR-891 Φ1) — κανένα URL δεν γράφεται πια εδώ (CHECK 3.95).
 *
 * ⚠️ **ΤΙ ΕΦΥΓΕ ΚΑΙ ΓΙΑΤΙ (2026-09-27, απόφαση Giorgio)**: `terrain` (OpenTopoMap), `watercolor` και `toner`
 * (Stadia Stamen) — οι όροι τους **απαγορεύουν** εμπορική χρήση. Το `satellite` μετονομάστηκε σε `voyager`:
 * ήταν το CARTO Voyager, δηλαδή **οδικός** χάρτης με όνομα δορυφόρου. Τα ids δεν αποθηκεύονται πουθενά
 * (μόνο React state), άρα η μετονομασία δεν σπάει δεδομένα.
 *
 * @module MapStyleManager
 */

import type { StyleSpecification } from 'maplibre-gl';
import {
  basemapStyle,
  DEFAULT_BASEMAP_SOURCE_ID,
  isVectorArchiveSourceId,
  type BasemapScheme,
  type BasemapSourceId,
} from '@/lib/maps/basemap-catalog';
import { protomapsStyle } from '@/lib/maps/protomaps-style';

// ============================================================================
// 🎯 ΤΟ ΛΕΞΙΛΟΓΙΟ
// ============================================================================

/**
 * Τα διαθέσιμα υπόβαθρα, **σε σειρά παρουσίασης**.
 *
 * 🔑 **Ο πίνακας είναι η αυθεντία, ο τύπος παράγεται** — ίδιο ιδίωμα με τα `COMMERCIAL_STATUSES` /
 * `OFFER_KINDS`. Νέο υπόβαθρο: γραμμή εδώ + γραμμή στο {@link MAP_STYLE_SOURCE} + εικονίδιο/όνομα στο
 * `map-chrome.ts` (ο `Record` δεν μεταγλωττίζεται αλλιώς).
 */
export const MAP_STYLES = ['osm', 'voyager', 'dark', 'greece'] as const;

export type MapStyleType = (typeof MAP_STYLES)[number];

/**
 * **Το υπόβαθρο με το οποίο ΑΝΟΙΓΕΙ κάθε χάρτης** — ό,τι βλέπει ο επισκέπτης πριν αγγίξει τον
 * διακόπτη. Ένα όνομα και όχι κυριολεκτικό στο `useMapState`, επειδή έχει **δεύτερο** αναγνώστη:
 * το στιγμιότυπο της κάρτας «Τα ακίνητά μου» (ADR-777 §8.70 Φάση 2) οφείλει να δείχνει **το
 * ίδιο** υπόβαθρο με τον δημόσιο χάρτη.
 */
export const INITIAL_MAP_STYLE: MapStyleType = 'greece';

export type MapStyleUrl = string | StyleSpecification;

/**
 * Ποια πηγή του μητρώου ζωγραφίζει κάθε υπόβαθρο.
 *
 * 🔑 `greece` = ο **δικός μας** χάρτης (PMTiles, ADR-891 §9): ακολουθεί το θέμα και δεν εξαρτάται από τρίτο.
 * Αν ο διακομιστής μας δεν απαντήσει, ο καταρράκτης του {@link DEFAULT_CONFIG} πέφτει στη CARTO.
 */
const MAP_STYLE_SOURCE: Readonly<Record<MapStyleType, BasemapSourceId>> = {
  osm: 'carto-positron',
  voyager: 'carto-voyager',
  dark: 'carto-dark-matter',
  greece: DEFAULT_BASEMAP_SOURCE_ID,
};

export interface MapStyleConfig {
  /** Σε ποιο υπόβαθρο πέφτουμε όταν ένα δεν φορτώσει· `null` = τέλος της αλυσίδας. */
  fallbackCascade: Record<MapStyleType, MapStyleType | null>;
  loadingTimeouts: Record<MapStyleType, number>;
}

const DEFAULT_CONFIG: MapStyleConfig = {
  fallbackCascade: {
    greece: 'osm', // ο δικός μας διακομιστής → CARTO Positron
    voyager: 'osm',
    dark: 'osm',
    osm: null,
  },
  loadingTimeouts: {
    greece: 1200,
    osm: 800,
    voyager: 1000,
    dark: 800,
  },
};

/**
 * Το στυλ ενός υποβάθρου για το θέμα. Οι πηγές με ένα στυλ (CARTO) αγνοούν το θέμα· ο δικός μας χάρτης το
 * ακολουθεί (ίδιες πηγές, άλλα χρώματα ⇒ καμία νέα λήψη πλακιδίων στην αλλαγή θέματος).
 */
function styleOf(styleType: MapStyleType, scheme: BasemapScheme): MapStyleUrl {
  const id = MAP_STYLE_SOURCE[styleType];
  return isVectorArchiveSourceId(id) ? protomapsStyle(id, scheme) : basemapStyle(id);
}

type StylesByScheme = Readonly<Record<MapStyleType, MapStyleUrl>>;

function stylesFor(scheme: BasemapScheme): StylesByScheme {
  return Object.fromEntries(MAP_STYLES.map((style) => [style, styleOf(style, scheme)])) as Record<
    MapStyleType,
    MapStyleUrl
  >;
}

// ============================================================================
// 🎨 MAP STYLE MANAGER
// ============================================================================

export class MapStyleManager {
  private readonly config: MapStyleConfig;
  private readonly styles: Readonly<Record<BasemapScheme, StylesByScheme>>;

  constructor(config?: Partial<MapStyleConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.styles = { light: stylesFor('light'), dark: stylesFor('dark') };
  }

  /** Το στυλ/URL που δέχεται το `mapStyle` της MapLibre, για το θέμα που βάφει. */
  getStyleUrl(styleType: MapStyleType, scheme: BasemapScheme): MapStyleUrl {
    return this.styles[scheme][styleType];
  }

  /**
   * Όλα τα υπόβαθρα του θέματος, για όποιον κρατά τον διακόπτη. Ίδιο θέμα ⇒ **ίδιο** αντικείμενο, ώστε ένα
   * `useMemo` με εξάρτηση το θέμα να μη βλέπει «νέα στυλ» σε κάθε render.
   */
  getStyleUrls(scheme: BasemapScheme): StylesByScheme {
    return this.styles[scheme];
  }

  /** Το επόμενο υπόβαθρο της αλυσίδας ανάκαμψης. */
  getFallbackStyle(currentStyle: MapStyleType): MapStyleType | null {
    return this.config.fallbackCascade[currentStyle];
  }

  getLoadingTimeout(styleType: MapStyleType): number {
    return this.config.loadingTimeouts[styleType];
  }
}

/** Το κοινό στιγμιότυπο. */
export const mapStyleManager = new MapStyleManager();

/** Όλα τα στυλ του θέματος, με κλειδί το υπόβαθρο. */
export const getAllMapStyleUrls = (scheme: BasemapScheme): Readonly<Record<MapStyleType, MapStyleUrl>> =>
  mapStyleManager.getStyleUrls(scheme);
