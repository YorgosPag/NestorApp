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
import { GEOGRAPHIC_CONFIG } from '../../../../config/geographic-config';
import { basemapStyle, rasterStyleSpecification, type BasemapSourceId } from '@/lib/maps/basemap-catalog';

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

/** Ποια πηγή του μητρώου ζωγραφίζει κάθε υπόβαθρο. */
const MAP_STYLE_SOURCE: Readonly<Record<MapStyleType, BasemapSourceId>> = {
  osm: 'carto-positron',
  voyager: 'carto-voyager',
  dark: 'carto-dark-matter',
  greece: 'osm-raster',
};

export interface MapStyleConfig {
  /** Σε ποιο υπόβαθρο πέφτουμε όταν ένα δεν φορτώσει· `null` = τέλος της αλυσίδας. */
  fallbackCascade: Record<MapStyleType, MapStyleType | null>;
  loadingTimeouts: Record<MapStyleType, number>;
}

const DEFAULT_CONFIG: MapStyleConfig = {
  fallbackCascade: {
    greece: 'osm', // OSM raster → CARTO Positron
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
 * Το προεπιλεγμένο υπόβαθρο: το OSM raster του μητρώου, ελαφρά αποκορεσμένο για να διαβάζονται οι δείκτες
 * από πάνω του, με αρχική θέαση την Ελλάδα.
 */
function greeceStyle(): StyleSpecification {
  return {
    ...rasterStyleSpecification('osm-raster', {
      name: 'Greece Focused',
      paint: { 'raster-saturation': 0.1, 'raster-contrast': 0.2 },
    }),
    center: [GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE, GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE],
    zoom: 6.5,
    bearing: 0,
    pitch: 0,
  };
}

function styleOf(styleType: MapStyleType): MapStyleUrl {
  return styleType === 'greece' ? greeceStyle() : basemapStyle(MAP_STYLE_SOURCE[styleType]);
}

// ============================================================================
// 🎨 MAP STYLE MANAGER
// ============================================================================

export class MapStyleManager {
  private readonly config: MapStyleConfig;
  private readonly styles: Readonly<Record<MapStyleType, MapStyleUrl>>;

  constructor(config?: Partial<MapStyleConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.styles = Object.fromEntries(MAP_STYLES.map((style) => [style, styleOf(style)])) as Record<
      MapStyleType,
      MapStyleUrl
    >;
  }

  /** Το στυλ/URL που δέχεται το `mapStyle` της MapLibre. */
  getStyleUrl(styleType: MapStyleType): MapStyleUrl {
    return this.styles[styleType];
  }

  /** Όλα τα υπόβαθρα, για όποιον κρατά τον διακόπτη. */
  getStyleUrls(): Record<MapStyleType, MapStyleUrl> {
    return { ...this.styles };
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

/** Όλα τα στυλ, με κλειδί το υπόβαθρο. */
export const getAllMapStyleUrls = (): Record<MapStyleType, MapStyleUrl> => mapStyleManager.getStyleUrls();
