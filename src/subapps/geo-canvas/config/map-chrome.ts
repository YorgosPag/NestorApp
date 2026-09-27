/**
 * @fileoverview **ΤΟ ΧΡΩΜΙΟ ΤΟΥ ΧΑΡΤΗ** — ποιος κοιτάζει, και άρα τι του δίνουμε.
 * @related ADR-777 §2.2 (απόφαση Giorgio) · Α3 · Α8 · CHECK 3.52
 * @module subapps/geo-canvas/config/map-chrome
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΟΝΟΜΑΣΜΕΝΟ ΠΡΟΡΥΘΜΙΣΜΕΝΟ ΚΑΙ ΟΧΙ ΑΛΛΟ ΕΝΑ `boolean`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο ίδιος χάρτης σερβίρεται σε **τρία** ακροατήρια. Μέχρι σήμερα η διαφορά τους
 * εκφραζόταν με **δύο ανεξάρτητα `boolean`** (`showStatusBar` · `showMapControls`) —
 * και το ελάττωμα που γέννησε αυτό το αρχείο είναι ότι **έλειπε το τρίτο**: ο
 * `GeoCoordinateDisplay` αποδιδόταν **χωρίς καμία συνθήκη**
 * (`InteractiveMapContainer:393`), οπότε ο δημόσιος χάρτης έβγαζε πάνελ με
 * συντεταγμένες, υψόμετρο και **επτά** στυλ χάρτη σε επισκέπτη που ζητούσε σπίτι.
 *
 * 🔑 **Δεν απέκλιναν οι δύο σημαίες — ΔΕΝ ΥΠΗΡΞΕ ΠΟΤΕ ΤΡΙΤΗ.** Είναι *ακριβώς* το
 * σχήμα της CHECK 3.52 (τρεις χειρόγραφες λίστες `pathname` που ήταν δομικά τυφλές
 * σε route group): προσθέτοντας **άλλη μία** σημαία, το επόμενο overlay που θα
 * γραφτεί θα εμφανιστεί **πάλι** στον δημόσιο χάρτη χωρίς να το αποφασίσει κανείς.
 * ⇒ Η θεραπεία δεν είναι μία σημαία παραπάνω· είναι να πάψει η ερώτηση να είναι
 * ανά-widget και να γίνει **ανά ακροατήριο, μία φορά**.
 *
 * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΑ ΜΕΓΑΛΑ.** Το Google Maps JS API λύνει το ίδιο με σάκο
 * `MapOptions` (`zoomControl` · `streetViewControl` · `mapTypeControl` …) — δηλαδή
 * **ακριβώς** το (Ν+1) `boolean`, με κάθε νέο control να προσγειώνεται ορατό. Το
 * Mapbox GL το κάνει **opt-in** (`map.addControl(…)`), που κλείνει τη διαρροή αλλά
 * ανοίγει την **αντίθετη**: ένα control μπορεί να **ξεχαστεί** στο εσωτερικό εργαλείο
 * και κανείς δεν το μαθαίνει. Εδώ το πρότυπο είναι το **view template** του Revit:
 * ονομασμένο σύνολο που **οφείλει να απαντήσει για κάθε κατηγορία**, οπότε νέα
 * κατηγορία **δεν μεταγλωττίζεται** μέχρι να αποφασιστεί τι κάνει σε **κάθε**
 * ακροατήριο. `Record<MapChromePreset, MapChromeCapabilities>` — κλειστό και στους
 * **δύο** άξονες: ούτε διαρροή, ούτε παράλειψη.
 */

import { Map, Moon, Flag, Route, type LucideIcon } from 'lucide-react';
import { INITIAL_MAP_STYLE, MAP_STYLES, type MapStyleType } from '../services/map/MapStyleManager';

// ============================================================================
// 1. Ο ΚΑΤΑΛΟΓΟΣ ΤΩΝ ΥΠΟΒΑΘΡΩΝ — εικονίδιο + τεχνικό όνομα, μία φορά
// ============================================================================

/** Τι ξέρουμε για ένα υπόβαθρο, πέρα από το πού είναι τα πλακίδιά του. */
export interface MapStyleCatalogEntry {
  readonly icon: LucideIcon;
  /** Το **τεχνικό** όνομα — για τον επαγγελματία, που θέλει να ξέρει ΠΟΙΑ πηγή. */
  readonly labelKey: string;
}

/**
 * `Record<MapStyleType, …>` **επίτηδες**: όγδοο υπόβαθρο στο {@link MAP_STYLES} δεν
 * μεταγλωττίζεται μέχρι κάποιος να του δώσει εικονίδιο και όνομα.
 */
export const MAP_STYLE_CATALOG: Readonly<Record<MapStyleType, MapStyleCatalogEntry>> = {
  osm: { icon: Map, labelKey: 'map.controls.openStreetMap' },
  voyager: { icon: Route, labelKey: 'map.controls.voyager' },
  dark: { icon: Moon, labelKey: 'map.controls.darkMode' },
  greece: { icon: Flag, labelKey: 'map.controls.greece' },
};

// ============================================================================
// 2. ΤΑ ΑΚΡΟΑΤΗΡΙΑ
// ============================================================================

/**
 * Τα τρία ακροατήρια του **ίδιου** χάρτη — μετρημένα από τους τρεις σημερινούς
 * καταναλωτές, όχι επινοημένα:
 *
 * - `workspace` — ο πλήρης χώρος εργασίας γεωαναφοράς (`GeoCanvasContent`)
 * - `embedded`  — χάρτης μέσα σε εσωτερική οθόνη (`AddressMap`)· οι συντεταγμένες
 *                 εκεί είναι **εργαλείο**, όχι θόρυβος
 * - `showcase`  — η **δημόσια** αναζήτηση (`ResultsMap`)· ο επισκέπτης ψάχνει σπίτι
 */
export const MAP_CHROME_PRESETS = ['workspace', 'embedded', 'showcase'] as const;

export type MapChromePreset = (typeof MAP_CHROME_PRESETS)[number];

/** Μία επιλογή υποβάθρου, **με την ετικέτα που ταιριάζει στο ακροατήριο**. */
export interface BasemapChoice {
  readonly style: MapStyleType;
  readonly labelKey: string;
}

/**
 * Τι δίνει ο χάρτης σε κάθε ακροατήριο.
 *
 * ⚠️ **Κάθε πεδίο είναι υποχρεωτικό.** Νέο overlay ⇒ νέο πεδίο ⇒ **και τα τρία**
 * προρυθμισμένα οφείλουν να απαντήσουν. Αυτή είναι ολόκληρη η αξία του αρχείου.
 */
export interface MapChromeCapabilities {
  /** Ποια υπόβαθρα προσφέρονται, **με σειρά** — υποσύνολο του {@link MAP_STYLES}. */
  readonly basemaps: readonly BasemapChoice[];
  /**
   * Πώς παρουσιάζονται.
   *
   * 🔴 **`labels` στο δημόσιο δεν είναι γούστο — είναι η Α8.** Τα εικονίδια εξηγούνται
   * μόνο με **tooltip**, και το tooltip **δεν υπάρχει στην αφή**: σε κινητό ο
   * επισκέπτης βλέπει επτά ανώνυμα τετράγωνα. Η Α8 απαιτεί η **θέαση** να δουλεύει
   * υποχρεωτικά και σε κινητό, άρα η εικονική εκδοχή είναι εκεί **δομικά ακατάλληλη**.
   *
   * `none` — ένα μόνο υπόβαθρο, άρα **κανένας** διακόπτης: ένα κουμπί που δεν αλλάζει τίποτα
   * είναι θόρυβος (Zillow · Idealista δεν δείχνουν διακόπτη χωρίς πραγματική εναλλακτική).
   */
  readonly basemapSwitcher: 'icons' | 'labels' | 'none';
  /** Ζωντανή ένδειξη γεωγρ. μήκους/πλάτους/υψομέτρου. */
  readonly coordinateReadout: boolean;
  /** Τα εργαλεία επιλογής σημείου + ο πλήρης επιλογέας στυλ (`GeoMapControls`). */
  readonly pickerControls: boolean;
  /** Η μπάρα κατάστασης βαθμονόμησης (`GeoStatusBar`). */
  readonly statusBar: boolean;
  /**
   * Το υπόμνημα ακρίβειας (`GeoAccuracyLegend`).
   *
   * ⚠️ **Μετρημένο:** το ίδιο το component επιστρέφει `null` χωρίς σημεία ελέγχου, και
   * σημεία ελέγχου έχει **μόνο** ο `workspace` (οι άλλοι δύο περνούν `controlPoints: []`).
   * Δηλώνεται `false` εκεί που ήταν **ήδη πάντα αόρατο**, ώστε ο πίνακας να λέει την
   * αλήθεια αντί να κρύβει έναν φρουρό που δεν πυροδοτεί ποτέ (ADR-749 §5).
   */
  readonly accuracyLegend: boolean;
}

/** Ο πλήρης κατάλογος ως επιλογές — τεχνικά ονόματα, για τον επαγγελματία. */
const ALL_BASEMAPS: readonly BasemapChoice[] = MAP_STYLES.map((style) => ({
  style,
  labelKey: MAP_STYLE_CATALOG[style].labelKey,
}));

/**
 * 🔑 **Το ΕΝΑ υπόβαθρο του δημόσιου — αυτό με το οποίο ανοίγει** (ADR-891 Φ1, απόφαση Giorgio).
 *
 * Μέχρι τις 2026-09-27 εδώ υπήρχαν «Χάρτης» + «Δορυφόρος», με **δύο** ψεύδη: ο «Δορυφόρος» ήταν
 * το CARTO Voyager (οδικός χάρτης), και ο «Χάρτης» ήταν το CARTO Positron — **άλλος** χάρτης από
 * εκείνον με τον οποίο άνοιγε η σελίδα (`INITIAL_MAP_STYLE`), οπότε κατά το άνοιγμα **κανένα**
 * κουμπί δεν ήταν πατημένο. Δωρεάν αεροφωτογραφία για εμπορική χρήση δεν υπάρχει (ADR-891 §5)·
 * όταν υπάρξει, μπαίνει εδώ ως δεύτερη γραμμή και ο διακόπτης επιστρέφει.
 */
const SHOWCASE_BASEMAPS: readonly BasemapChoice[] = [{ style: INITIAL_MAP_STYLE, labelKey: 'map.basemap.map' }];

/** Έχει το πάνελ υποβάθρου κάτι να δείξει; Ούτε διακόπτη ούτε συντεταγμένες ⇒ δεν αποδίδεται καθόλου. */
export function showsBasemapPanel(capabilities: MapChromeCapabilities): boolean {
  return capabilities.basemapSwitcher !== 'none' || capabilities.coordinateReadout;
}

export const MAP_CHROME: Readonly<Record<MapChromePreset, MapChromeCapabilities>> = {
  workspace: {
    basemaps: ALL_BASEMAPS,
    basemapSwitcher: 'icons',
    coordinateReadout: true,
    pickerControls: true,
    statusBar: true,
    accuracyLegend: true,
  },
  embedded: {
    basemaps: ALL_BASEMAPS,
    basemapSwitcher: 'icons',
    coordinateReadout: true,
    pickerControls: false,
    statusBar: false,
    accuracyLegend: false,
  },
  showcase: {
    basemaps: SHOWCASE_BASEMAPS,
    basemapSwitcher: 'none',
    coordinateReadout: false,
    pickerControls: false,
    statusBar: false,
    accuracyLegend: false,
  },
};
