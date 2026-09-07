'use client';

/**
 * Ο χάρτης της οθόνης 2 — **δανεισμένος**, όχι νέος (ADR-777 Α4 βήμα 1).
 *
 * 🔑 Ο μηχανισμός είναι **αποδεδειγμένος σε παραγωγή**: ο `AddressMap` ήδη εισάγει τον
 * ίδιο `InteractiveMap` του Geo-Canvas και του δίνει κενό `transformState` (τα control
 * points είναι λεπτομέρεια του DXF, όχι του χάρτη). Δεν χτίζεται δεύτερος χάρτης, και
 * **δεν μετακομίζει κώδικας** — «*μετακινούμε ΚΑΤΑΝΑΛΩΤΕΣ, όχι ΑΡΧΕΙΑ*» (κανόνας 19).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΧΡΩΜΑ ΔΕΝ ΕΙΝΑΙ ΤΟ ΚΑΝΑΛΙ — ΕΙΝΑΙ ΤΟ ΣΧΗΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Και τα πέντε ορατά σχήματα βάφονται με **το ίδιο** χρώμα. Αυτό δεν είναι παράλειψη:
 * είναι η **CHECK 3.41** (WCAG 1.4.1) εφαρμοσμένη σωστά — αν η ακρίβεια ξεχώριζε με
 * απόχρωση, θα ήταν αδιάκριτη για όποιον δεν τη διακρίνει, και θα εξαφανιζόταν σε
 * ασπρόμαυρη εκτύπωση ή σε φωτεινό ήλιο. Ξεχωρίζουν σε **μέγεθος, δακτύλιο και
 * γέμισμα** — κανάλια που δεν εξαρτώνται από την όραση χρώματος.
 *
 * Το χρώμα διαβάζεται από το `--chart-1`, δηλαδή από την **επικυρωμένη** κατηγορική
 * παλέτα (CHECK 3.32: ζώνη φωτεινότητας, κορεσμός, CVD ΔE≥8 κατά Machado 2009,
 * αντίθεση ≥3:1) — και μέσω του **υπάρχοντος** `readRootCssVar`, που το ίδιο του το
 * σχόλιο δηλώνει ως «*the SINGLE place*» που αγγίζει `getComputedStyle` για tokens.
 */

import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { Source } from '@/lib/maps/maplibre';
import { InteractiveMap } from '@/subapps/geo-canvas/components/InteractiveMap';
import { PolygonSystemProvider } from '@/subapps/geo-canvas/systems/polygon-system';
import type { MapInstance } from '@/subapps/geo-canvas/hooks/map/useMapInteractions';
import { readRootCssVar } from '@/subapps/dxf-viewer/config/color-config';
import { listingsToGeoJson } from '@/lib/listings/listings-geojson';
import { listingBounds } from '@/lib/listings/listing-map-bounds';
import { listingPriceMarkers } from '@/lib/listings/listing-price-markers';
import { NO_LISTING_FOCUS, type ListingFocus } from '@/lib/listings/listing-focus';
import { ListingMapPopup } from './ListingMapPopup';
import { ListingPriceMarkers } from './ListingPriceMarkers';
import { ResultsMapLayers, RADIUS } from './ResultsMapLayers';
import type { PublicListing } from '@/types/public-listing';
import type { GeoBoundingBox } from '@/types/geo/coordinates';
import { readMapArea, type MapAreaSource } from './results-map-area';

/**
 * Τα επίπεδα που δέχονται κλικ. **Κάθε ορατό σχήμα**, όχι μόνο η πινέζα — αλλιώς οι
 * αγγελίες με σκιασμένη περιοχή θα ήταν ορατές αλλά **μη επιλέξιμες**, δηλαδή θα
 * τιμωρούνταν στη διεπαφή επειδή ξέρουμε λιγότερα γι' αυτές.
 */
const CLICKABLE_LAYER_IDS = [
  'listing-pin',
  'listing-pin-ring',
  'listing-neighbourhood',
  'listing-city',
  'listing-outline-fill',
] as const;

interface ResultsMapProps {
  readonly listings: readonly PublicListing[];
  /**
   * **Η ΕΣΤΙΑΣΗ ΟΛΟΚΛΗΡΗ** — δύο ερωτήσεις, δύο κανάλια βαψίματος.
   *
   * ⚠️ Προαιρετική: η **οθόνη 3** δείχνει τον ίδιο χάρτη για **μία** αγγελία, όπου δεν
   * υπάρχει τίποτα να επισημανθεί σε σχέση με τίποτα άλλο.
   */
  readonly focus?: ListingFocus;
  /**
   * **Ο ΔΕΙΚΤΗΣ ΠΕΡΑΣΕ ΑΠΟ ΠΑΝΩ** — εφήμερο, ακούσιο, δεκάδες φορές το λεπτό.
   *
   * ⛔ **Ο καταναλωτής ΔΕΝ επιτρέπεται να κυλήσει τίποτα από αυτό.** Είναι το ελάττωμα
   * που η **Figma** μέτρησε και απέσυρε στο Layers panel — δες
   * `hooks/listings/useListingRevealTracking.ts`.
   */
  readonly onPeek?: (id: string | null) => void;
  /**
   * Τα ενεργά φίλτρα ως ερώτημα — **ταξιδεύουν και από το popup**.
   *
   * 🔑 Χωρίς αυτό, ο σύνδεσμος του popup θα ήταν η **μία** διαδρομή προς την οθόνη 3
   * που **χάνει** την αναζήτηση, ενώ η κάρτα δίπλα του την κρατά. Δύο σύνδεσμοι προς
   * το ίδιο ακίνητο με διαφορετική συμπεριφορά επιστροφής είναι ακριβώς η απώλεια που
   * η Α3 μέτρησε στο **75%**.
   */
  readonly filterQuery?: string;
  /**
   * Κλικ σε σχήμα → επιλογή στη λίστα. **Προαιρετικό, και η απουσία έχει νόημα.**
   *
   * 🔴 Η **οθόνη 3** δείχνει τον ίδιο χάρτη για **μία** αγγελία: εκεί δεν υπάρχει
   * λίστα να επιλεγεί, και ο επισκέπτης είναι **ήδη** πάνω στο ακίνητο. Χωρίς αυτό,
   * ο χάρτης θα έβαφε δείκτη «χεράκι» πάνω σε σχήμα που **δεν κάνει τίποτα** — μια
   * υπόσχεση διάδρασης που δεν τηρείται, δηλαδή το ίδιο είδος ψέματος με την πινέζα
   * πάνω σε πόλη. Ο ζωγράφος είναι **ένας**· αλλάζει το ερώτημα, όχι ο χάρτης.
   */
  readonly onSelect?: (id: string) => void;
  /**
   * **ΚΛΙΚ ΣΕ ΚΕΝΟ ΣΗΜΕΙΟ ΤΟΥ ΧΑΡΤΗ** — η ρητή έξοδος από την επιλογή.
   *
   * 🔑 Είναι η **τρίτη** διαδρομή ακύρωσης, δίπλα στο `×` του popup και στο `Escape`.
   * Μια επίμονη κατάσταση χωρίς ορατό τρόπο εξόδου είναι παγίδα: ο άνθρωπος που πάτησε
   * κατά λάθος πινέζα δεν πρέπει να χρειάζεται να μαντέψει πώς ξεφεύγει.
   */
  readonly onClear?: () => void;
  /**
   * **Ο ΧΑΡΤΗΣ ΑΝΑΦΕΡΕΙ ΠΟΥ ΚΟΙΤΑΕΙ** — μετά από κάθε σύρσιμο/ζουμ *(ADR-777 §8.63)*.
   *
   * 🔑 **Αναφέρει ΠΑΝΤΑ· ΔΕΝ αποφασίζει ποτέ.** Το αν το κάδρο θα γίνει φίλτρο είναι
   * **πολιτική** — τη διακόπτει ο άνθρωπος με τον διακόπτη *«Αναζήτηση καθώς
   * μετακινώ»* — και ζει στον γονιό. Ένας χάρτης που έκρινε ο ίδιος πότε αξίζει να
   * μιλήσει θα ήταν **δεύτερος** τόπος απόφασης, και ο διακόπτης θα σταματούσε να
   * είναι η μοναδική αλήθεια για το τι ζήτησε ο επισκέπτης.
   *
   * ⚠️ Προαιρετικό: η **οθόνη 3** δείχνει τον ίδιο χάρτη για **μία** αγγελία, όπου
   * δεν υπάρχει λίστα να φιλτραριστεί.
   */
  readonly onAreaChange?: (area: GeoBoundingBox) => void;
  /**
   * **ΜΗΝ ΚΑΔΡΑΡΕΙΣ ΜΟΝΟΣ ΣΟΥ — Ο ΑΝΘΡΩΠΟΣ ΤΟΠΟΘΕΤΗΣΕ ΤΟΝ ΧΑΡΤΗ** *(ADR-777 §8.63)*.
   *
   * 🔴 **ΧΩΡΙΣ ΑΥΤΟ ΥΠΑΡΧΕΙ ΑΝΑΔΡΑΣΗ, ΚΑΙ ΕΙΝΑΙ ΟΡΑΤΗ**: ο άνθρωπος σέρνει ⇒ το κάδρο
   * γίνεται φίλτρο ⇒ μένουν λιγότερες αγγελίες ⇒ αλλάζουν τα `bounds` του καταλόγου ⇒
   * το `fitBounds` **ξανακαδράρει πιο σφιχτά** ⇒ ο χάρτης **πηδά κάτω από τα δάχτυλά
   * του**, και το νέο κάδρο κόβει κι άλλες. Το φαινόμενο είναι ακριβώς αυτό που τα
   * καταγεγραμμένα παράπονα για την Airbnb περιγράφουν ως *«καταλύματα εμφανίζονται
   * και εξαφανίζονται στην παραμικρή κίνηση»*.
   *
   * 🔑 **Η λύση δεν είναι χρονική (debounce), είναι ΣΗΜΑΣΙΟΛΟΓΙΚΗ**: όταν υπάρχει
   * **δηλωμένη** περιοχή, το αυτόματο καδράρισμα δεν έχει τίποτα να προσφέρει — ο
   * άνθρωπος έχει ήδη πει πού κοιτάει. Ένα χρονόμετρο θα έκανε την ανάδραση **πιο
   * αργή**, όχι ανύπαρκτη *(μάθημα του Βήματος 2: early cutoff αντί για ρολόι)*.
   */
  readonly areaLocked?: boolean;
}


const SOURCE_ID = 'public-listings';

/**
 * Η όψη του MapLibre που **χρειάζεται πραγματικά** αυτό το αρχείο.
 *
 * ⚠️ Το `MapInstance` του Geo-Canvas δεν εκθέτει τη διεπαφή συμβάντων ανά επίπεδο, και
 * η μετάβαση γινόταν ήδη με `as unknown`. Γράφεται **μία** φορά, ονομασμένη, αντί να
 * επαναληφθεί σε κάθε χειριστή — έτσι μια αλλαγή της βιβλιοθήκης σπάει σε **ένα**
 * σημείο αντί για πέντε.
 */
interface MapPointerEvent {
  readonly features?: Array<{ properties?: Record<string, unknown> }>;
  readonly point: { x: number; y: number };
}

/**
 * Το συμβάν κίνησης του χάρτη — **και το ένα πεδίο που μας ενδιαφέρει**.
 *
 * 🔑 **Το `originalEvent` απαντά «ποιος το ζήτησε;»** και είναι το καθιερωμένο ιδίωμα
 * του MapLibre: υπάρχει όταν την κίνηση την προκάλεσε **άνθρωπος** (σύρσιμο, ρόδα,
 * κουμπί ζουμ) και **λείπει** όταν την προκάλεσε ο κώδικάς μας (`fitBounds`).
 *
 * 🔴 **Χωρίς αυτόν τον έλεγχο, το ΑΡΧΙΚΟ καδράρισμα θα γραφόταν στη διεύθυνση σαν να
 * το ζήτησε ο επισκέπτης** — δηλαδή κάθε άνθρωπος που απλώς **άνοιξε** τη σελίδα θα
 * αποκτούσε αμέσως φίλτρο περιοχής που δεν διάλεξε ποτέ, και ο κοινοποιημένος
 * σύνδεσμος θα κουβαλούσε ένα ερώτημα που κανείς δεν έθεσε.
 */
interface MapMoveEvent {
  readonly originalEvent?: unknown;
}

interface MapEventTarget extends MapAreaSource {
  on: (
    ev: string,
    layerOrHandler: string | ((e: MapPointerEvent) => void) | ((e: MapMoveEvent) => void),
    cb?: (e: MapPointerEvent) => void
  ) => void;
  getCanvas: () => HTMLCanvasElement;
  getContainer: () => HTMLElement;
  resize: () => void;
  fitBounds: (b: [[number, number], [number, number]], o?: Record<string, unknown>) => void;
  queryRenderedFeatures: (
    point: { x: number; y: number },
    options?: { layers?: readonly string[] }
  ) => Array<{ properties?: Record<string, unknown> }>;
}

/** Η ταυτότητα της αγγελίας κάτω από τον δείκτη, ή `null` αν δεν είναι αγγελία. */
function listingIdOf(event: MapPointerEvent): string | null {
  const id = event.features?.[0]?.properties?.id;
  return typeof id === 'string' ? id : null;
}

export function ResultsMap({
  listings,
  focus = NO_LISTING_FOCUS,
  filterQuery = '',
  onPeek,
  onSelect,
  onClear,
  onAreaChange,
  areaLocked = false,
}: ResultsMapProps) {
  const data = useMemo(() => listingsToGeoJson(listings), [listings]);
  const bounds = useMemo(() => listingBounds(data), [data]);

  /**
   * 🏆 **ΟΙ ΤΙΜΕΣ ΠΑΝΩ ΣΤΟΝ ΧΑΡΤΗ — ΤΙΜΕΣ *ΚΑΙ* ΚΟΥΚΙΔΕΣ, ΠΟΤΕ ΤΙΜΕΣ *ΑΝΤΙ ΓΙΑ*** (Ε2).
   *
   * Τα επτά επίπεδα από κάτω μένουν **ανέπαφα**: κάθε αγγελία με θέση εξακολουθεί να
   * έχει το σχήμα της, όσες κι αν είναι. Η πινακίδα είναι **προσθήκη σε υποσύνολο** —
   * ποιο, το κρίνει ο `listingPriceMarkers` και **μόνο** αυτός (τρεις κανόνες: ξέρουμε
   * ΠΟΥ, ξέρουμε ΠΟΣΟ, και μέσα στο φραγμένο πλήθος).
   *
   * 🔑 **Τρέφεται από το `data`, όχι από τα `listings`.** Η θέση της πινακίδας πρέπει να
   * είναι **η ίδια συντεταγμένη** με το σχήμα, όχι μια δεύτερη μετατροπή σε `[lng, lat]`
   * που «πρέπει» να συμφωνεί — δες την κεφαλίδα του `listings-geojson.ts`.
   */
  const priceMarkers = useMemo(() => listingPriceMarkers(listings, data), [listings, data]);

  // `hsl(var(--chart-1))` δεν το καταλαβαίνει το MapLibre — θέλει συγκεκριμένο χρώμα.
  const mark = `hsl(${readRootCssVar('--chart-1', '210 80% 50%')})`;
  const surface = `hsl(${readRootCssVar('--card', '0 0% 100%')})`;

  const selectedListing = useMemo(
    () => (focus.selected === null ? null : (listings.find((l) => l.id === focus.selected) ?? null)),
    [listings, focus.selected]
  );

  /**
   * 🔴 **ΟΙ ΧΕΙΡΙΣΤΕΣ ΔΙΑΒΑΖΟΝΤΑΙ ΤΗ ΣΤΙΓΜΗ ΤΟΥ ΣΥΜΒΑΝΤΟΣ, ΠΟΤΕ ΩΣ ΣΤΙΓΜΙΟΤΥΠΟ.**
   *
   * Είναι ο **κεντρικός κανόνας 2 του ADR-040**, εδώ για **δύο** ανεξάρτητους λόγους:
   *
   * 1. **Ορθότητα.** Οι ακροατές δένονται **μία φορά**, στο `load` του MapLibre. Ένας
   *    χειριστής που έκλεισε μέσα του το `onSelect` της πρώτης απόδοσης θα καλούσε για
   *    πάντα **εκείνη** τη συνάρτηση — δηλαδή θα έγραφε σε παλιά κατάσταση.
   * 2. **Απόδοση — και η προειδοποίηση είναι γραμμένη στην ίδια την πηγή.** Ο
   *    `InteractiveMapContainer:332` λέει ρητά *«new function every render caused Map
   *    re-init»*. Με τα props στις εξαρτήσεις, **κάθε κίνηση του ποντικιού** θα άλλαζε
   *    την ταυτότητα του `handleMapReady` — δηλαδή θα απειλούσε επαναρχικοποίηση του
   *    χάρτη στα 60fps. Το `useCallback([])` το κάνει **δομικά αδύνατο**.
   */
  const handlersRef = useRef({ onPeek, onSelect, onClear, onAreaChange });
  useEffect(() => {
    handlersRef.current = { onPeek, onSelect, onClear, onAreaChange };
  }, [onPeek, onSelect, onClear, onAreaChange]);

  /**
   * 🔴 **ΚΑΙ ΤΑ `bounds` ΔΙΑΒΑΖΟΝΤΑΙ ΑΠΟ ΑΝΑΦΟΡΑ — ΜΕΤΡΗΜΕΝΟ ΛΑΘΟΣ, ΟΧΙ ΠΡΟΛΗΨΗ.**
   *
   * Η πρώτη γραφή της διόρθωσης έβαλε τα `bounds` στις εξαρτήσεις του `handleMapReady`
   * *«μόνο για το αρχικό κάδρο»* — και **ζωντανά ο χάρτης πέθανε**: μαύρισε, το popup
   * εξαφανίστηκε ενώ η κάρτα έμενε επιλεγμένη *(δηλαδή η κατάσταση React ζούσε και ο
   * χάρτης όχι)*. Ο λόγος είναι γραμμένος στην πηγή, στο `InteractiveMapContainer:332`:
   * *«new function every render caused Map re-init»* — το `onMapReady` περνά μέσα σε
   * `useMemo`, άρα **νέα ταυτότητα = νέος χάρτης**.
   *
   * ⇒ Ο κατάλογος φτάνει από το δίκτυο ⇒ `bounds` αλλάζουν ⇒ ο χάρτης **ξαναστήνεται
   * ακριβώς τη στιγμή που αποκτά κάτι να δείξει**. Η προειδοποίηση δεν ήταν θεωρητική.
   */
  const boundsRef = useRef(bounds);
  useEffect(() => { boundsRef.current = bounds; }, [bounds]);

  /**
   * ⚠️ **ΑΝΑΦΟΡΑ, ΟΧΙ ΕΞΑΡΤΗΣΗ** — για τον λόγο που γράφεται από πάνω για τα `bounds`:
   * το `handleMapReady` έχει **κενό** πίνακα εξαρτήσεων ως συμβόλαιο, και κάθε νέα
   * ταυτότητα εκεί σημαίνει **επανα-αρχικοποίηση MapLibre**, δηλαδή **μαύρη οθόνη**.
   */
  const areaLockedRef = useRef(areaLocked);
  useEffect(() => { areaLockedRef.current = areaLocked; }, [areaLocked]);

  /**
   * 🔴 **ΤΟ ΚΑΔΡΑΡΙΣΜΑ ΕΙΝΑΙ ΕΦΕ ΤΩΝ ΔΕΔΟΜΕΝΩΝ, ΟΧΙ ΒΗΜΑ ΤΗΣ ΑΡΧΙΚΟΠΟΙΗΣΗΣ.**
   *
   * Ζούσε **μέσα** στο `onMapReady`, δηλαδή έτρεχε στο `load` του MapLibre — τη στιγμή
   * που το `usePublicListings` **δεν έχει απαντήσει**: `listings = []` ⇒ `bounds = null`
   * ⇒ **καμία κλήση, ποτέ**. Η αγγελία φτάνει από **δίκτυο**, ο χάρτης είναι **τοπικός**:
   * ό,τι καδράρει «όταν είναι έτοιμος ο χάρτης» ρωτά τον λάθος από τους δύο.
   *
   * ✅ Κλείνει και **δεύτερο, προϋπάρχον**: με το καδράρισμα δεμένο στο `load`, μια
   * αλλαγή φίλτρων άφηνε τον χάρτη στην **παλιά** περιοχή.
   */
  const mapRef = useRef<MapEventTarget | null>(null);

  /**
   * Ο παρατηρητής μεγέθους του χάρτη — δες τον λόγο μέσα στο `handleMapReady`.
   *
   * ⚠️ **Η αποσύνδεση είναι υποχρεωτική.** Ένας `ResizeObserver` κρατά ζωντανό το
   * στοιχείο που παρατηρεί **και** το κλείσιμο πάνω στο `target`: χωρίς αυτό, κάθε
   * πλοήγηση μακριά από την οθόνη 2 αφήνει πίσω της έναν ολόκληρο χάρτη MapLibre.
   */
  const mapObserverRef = useRef<ResizeObserver | null>(null);
  useEffect(() => () => {
    mapObserverRef.current?.disconnect();
    mapObserverRef.current = null;
  }, []);

  useEffect(() => {
    const target = mapRef.current;
    // ⚠️ Ο έλεγχος του κλειδώματος είναι **πρώτος**: δες {@link ResultsMapProps.areaLocked}.
    if (!target || !bounds || areaLockedRef.current) return;

    // ⚠️ `padding` **υποχρεωτικό**: χωρίς αυτό μια πινέζα στην άκρη κάθεται πάνω στο
    // σύνορο και μοιάζει κομμένη· και `maxZoom`, γιατί ΕΝΑ αποτέλεσμα δίνει ορθογώνιο
    // μηδενικού εμβαδού — ο χάρτης θα ζουμάριζε σε επίπεδο δρόμου, ισχυρισμός
    // ακρίβειας που το ίδιο το σχήμα μπορεί να μην κάνει.
    target.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 0 });
  }, [bounds]);

  const handleMapReady = useCallback((map: MapInstance) => {
    const target = map as unknown as MapEventTarget;
    /*
      🔑 **Η αναφορά μπαίνει ΠΡΩΤΗ, και η σειρά έχει σημασία.** Ο κατάλογος μπορεί να
      έχει ήδη φτάσει όσο ο χάρτης φόρτωνε· τότε το effect από πάνω έχει **ήδη τρέξει
      με `mapRef.current === null`** και δεν πρόκειται να ξανατρέξει (τα `bounds` δεν
      άλλαξαν). Γι' αυτό το καδράρισμα επαναλαμβάνεται **και εδώ**: δύο διαδρομές προς
      την ίδια, **ταυτοδύναμη** πράξη — belt-and-suspenders (N.7.2 #4), όχι διπλή αλήθεια.
    */
    mapRef.current = target;
    const readyBounds = boundsRef.current;
    if (readyBounds && !areaLockedRef.current) {
      target.fitBounds(readyBounds, { padding: 64, maxZoom: 15, duration: 0 });
    }

    /*
      🔴 **Ο ΧΑΡΤΗΣ ΗΤΑΝ ΜΑΥΡΟΣ ΩΣΠΟΥ Ο ΑΝΘΡΩΠΟΣ ΤΟΝ ΑΚΟΥΜΠΟΥΣΕ** *(ADR-777 §8.56)*.
      Μετρημένο: **45 tiles `200`**, καμβάς **σωστός** (`1587×633 = 1984×792 × dpr 0,8`),
      WebGL **ζωντανό** — το καρέ ήταν σωστά υπολογισμένο και **ποτέ ζωγραφισμένο**.
      Το `resize()` είναι ο επίσημος τρόπος να ξαναρχίσει ο βρόχος απόδοσης, και είναι
      **ταυτοδύναμο**: αν τίποτα δεν άλλαξε, κοστίζει ένα καρέ.
      ⚠️ Ο παρατηρητής απαντά σε **αλλαγές** (παράθυρο, στάσεις φύλλου)· το ρητό
      διπλό-`rAF` από κάτω απαντά σε **αυτή** τη στιγμή, όπου το μέγεθος δεν αλλάζει ποτέ.
    */
    mapObserverRef.current?.disconnect();
    const observer = new ResizeObserver(() => target.resize());
    observer.observe(target.getContainer());
    mapObserverRef.current = observer;

    /*
      🔴 **ΚΑΙ ΕΝΑ ΡΗΤΟ `resize()` ΜΕΤΑ ΤΟ ΠΡΩΤΟ ΚΑΡΕ — Ο ΠΑΡΑΤΗΡΗΤΗΣ ΔΕΝ ΑΡΚΕΙ.**

      Μετρημένο ζωντανά: με **μόνο** τον `ResizeObserver` ο χάρτης έμενε **μαύρος** στην
      πρώτη φόρτωση. Ο λόγος είναι ο ορισμός του παρατηρητή: πυροδοτεί σε **αλλαγή**
      μεγέθους, και εδώ το μέγεθος **δεν αλλάζει ποτέ** μετά το `load` — το `1587×633`
      μετρήθηκε **σωστό** ήδη πριν το πρώτο βάψιμο. Ο παρατηρητής μένει σωστός για ό,τι
      έρχεται (παράθυρο, στάσεις του φύλλου)· **δεν** απαντά σε αυτή τη στιγμή.

      🔑 **Διπλό `requestAnimationFrame`**: το πρώτο κλείνει το καρέ όπου ζήτησε το
      MapLibre τη γεωμετρία του, το δεύτερο τρέχει **αφού** ο περιηγητής έχει συνθέσει.
      Ένα μόνο rAF είναι **πολύ νωρίς** — η ίδια στιγμή, με άλλο όνομα.

      ⚠️ **Ταυτοδύναμο και φθηνό**: αν όλα είναι εντάξει, κοστίζει **ένα** καρέ.
    */
    requestAnimationFrame(() => requestAnimationFrame(() => target.resize()));

    /*
      🔴 **Ο ΧΑΡΤΗΣ ΑΡΧΙΖΕΙ ΝΑ ΜΙΛΑΕΙ** *(ADR-777 §8.63)*. Δενόταν **τίποτα** ως σήμερα:
      μετρημένο με grep, δεν υπήρχε ούτε ένας `moveend` σε όλο το έργο.

      ⚠️ **ΠΡΙΝ από την πρόωρη έξοδο του `onSelect` παρακάτω, ΕΠΙΤΗΔΕΣ.** Το «πού
      κοιτάω» και το «τι διάλεξα» είναι **δύο** ερωτήσεις: μια οθόνη που φιλτράρει από
      τον χάρτη χωρίς να επιτρέπει επιλογή είναι απολύτως νοητή, και με τη σύνδεση
      παρακάτω θα έμενε σιωπηλή **χωρίς κανένα μήνυμα**.

      ⚠️ **Ο ακροατής δένεται ΜΙΑ φορά και διαβάζει από αναφορά** — κανόνας 2 του
      ADR-040. Μια εξάρτηση εδώ θα άλλαζε την ταυτότητα του `handleMapReady`, δηλαδή
      **μαύρη οθόνη** (η προειδοποίηση είναι μετρημένη, όχι θεωρητική).
    */
    target.on('moveend', (event: MapMoveEvent) => {
      if (!event.originalEvent) return;
      const area = readMapArea(target);
      if (area !== null) handlersRef.current.onAreaChange?.(area);
    });

    // ⚠️ Χωρίς καταναλωτή επιλογής **δεν δένεται τίποτα** — ούτε κλικ, ούτε δείκτης.
    // Βλ. {@link ResultsMapProps.onSelect}: δείκτης «χεράκι» χωρίς αποτέλεσμα είναι
    // υπόσχεση που δεν τηρείται.
    if (!handlersRef.current.onSelect) return;

    for (const layerId of CLICKABLE_LAYER_IDS) {
      target.on('click', layerId, (event) => {
        const id = listingIdOf(event);
        if (id !== null) handlersRef.current.onSelect?.(id);
      });

      /*
        🔴 **`mousemove` ΚΑΙ ΟΧΙ ΜΟΝΟ `mouseenter` — Η ΔΙΑΦΟΡΑ ΕΙΝΑΙ ΟΡΑΤΗ.**
        Το `mouseenter` ενός επιπέδου πυροδοτείται όταν ο δείκτης μπαίνει **στο επίπεδο**,
        όχι σε κάθε σχήμα του. Δύο γειτονικές πινέζες ζουν στο **ίδιο** `listing-pin`:
        περνώντας από τη μία στην άλλη **δεν** υπάρχει νέο `mouseenter`, άρα η επισήμανση
        θα κόλλαγε στην πρώτη. Το `mousemove` ρωτά **ποιο σχήμα** είναι από κάτω, κάθε
        φορά — και ο έλεγχος ταυτότητας στον καταναλωτή (`useListingFocus.peek`) κόβει
        την επανάληψη, ώστε να μην υπάρχει απόδοση χωρίς αλλαγή.
      */
      target.on('mousemove', layerId, (event) => {
        target.getCanvas().style.cursor = 'pointer';
        handlersRef.current.onPeek?.(listingIdOf(event));
      });

      target.on('mouseleave', layerId, () => {
        target.getCanvas().style.cursor = '';
        handlersRef.current.onPeek?.(null);
      });
    }

    /*
      **ΚΛΙΚ ΣΤΟ ΚΕΝΟ = ΑΚΥΡΩΣΗ.**

      ⚠️ **Ο έλεγχος είναι υποχρεωτικός**: το καθολικό `click` πυροδοτείται **και** όταν
      το κλικ έπεσε πάνω σε σχήμα — δηλαδή χωρίς αυτόν, κάθε επιλογή θα ακυρωνόταν από
      το ίδιο της το κλικ, μέσα στον ίδιο κύκλο συμβάντων. Ρωτάμε τα **ίδια** επίπεδα
      που δέχονται κλικ: μία λίστα, δύο χρήσεις, καμία ευκαιρία να αποκλίνουν.
    */
    target.on('click', (event: MapPointerEvent) => {
      const hit = target.queryRenderedFeatures(event.point, { layers: CLICKABLE_LAYER_IDS });
      if (hit.length === 0) handlersRef.current.onClear?.();
    });
    /*
      🔴 **ΚΕΝΟΣ ΠΙΝΑΚΑΣ ΕΞΑΡΤΗΣΕΩΝ — ΚΑΙ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ, ΟΧΙ ΒΕΛΤΙΣΤΟΠΟΙΗΣΗ.**
      Αυτή η συνάρτηση περνά ως `onMapReady` μέσα σε `useMemo` του
      `InteractiveMapContainer`: **κάθε** αλλαγή ταυτότητας ξαναστήνει τον χάρτη
      (*«new function every render caused Map re-init»*, γρ. 332). Ό,τι χρειάζεται
      διαβάζεται από αναφορά **τη στιγμή του συμβάντος** — κανόνας 2 του ADR-040.
    */
  }, []);

  return (
    /*
     * 🔴 **Ο `PolygonSystemProvider` ΔΕΝ είναι προαιρετικός** — ο `InteractiveMap` πετά
     * ρητά χωρίς αυτόν. Το έμαθα ζωντανά (η σελίδα μεταγλωττίστηκε και **έσκασε**), και
     * είναι το ίδιο ακριβώς που κάνει ο `AddressMap` σε παραγωγή (γρ. 298).
     *
     * 🔑 Είναι επίσης η **θέση** όπου θα κουμπώσει το «σχεδίασε την περιοχή σου» της Α4
     * §27.4 — το σύστημα πολυγώνων είναι ήδη εδώ, δεν χρειάζεται να μετακομίσει τίποτα.
     */
    <PolygonSystemProvider>
    <InteractiveMap
      transformState={{ controlPoints: [], isCalibrated: false, quality: null, rmsError: null, matrix: null }}
      /*
       * 🔑 **Ένα όνομα, όχι δύο σημαίες.** Ήταν `showStatusBar={false}` +
       * `showMapControls={false}` — και **δεν αρκούσε**: ο `GeoCoordinateDisplay`
       * αποδιδόταν χωρίς καμία συνθήκη, οπότε ο επισκέπτης που ψάχνει σπίτι έβλεπε
       * γεωγραφικό μήκος, πλάτος, **υψόμετρο** και **επτά** στυλ χάρτη. Το `showcase`
       * αφήνει **δύο** υπόβαθρα με λέξεις («Χάρτης» / «Δορυφόρος»), και **τίποτα άλλο**.
       */
      chrome="showcase"
      className="h-full w-full"
      onMapReady={handleMapReady}
    >
      <Source id={SOURCE_ID} type="geojson" data={data}>
        <ResultsMapLayers mark={mark} surface={surface} focus={focus} />
      </Source>

      {/*
        Οι πινακίδες τιμής — **μετά** την πηγή, ώστε να κάθονται πάνω από τα σχήματα,
        και **πριν** τη φούσκα, που πρέπει να μένει πάνω από όλα.

        ⚠️ Το `RADIUS.pin` δίνεται ως prop: η ακτίνα της πινέζας έχει **μία** αυθεντία,
        και το κενό της πινακίδας παράγεται από αυτήν αντί να το μαντέψει δεύτερος.
      */}
      <ListingPriceMarkers
        markers={priceMarkers}
        focus={focus}
        pinRadiusPx={RADIUS.pin}
        onPeek={onPeek}
        onSelect={onSelect}
      />

      {/*
        🏆 **Η ΑΠΑΝΤΗΣΗ ΕΚΕΙ ΠΟΥ ΚΟΙΤΑΖΕΙ** — πρότυπο Zillow/Redfin/Airbnb.

        ⚠️ **Δεμένο στο `selected`, ΠΟΤΕ στο `peeked`.** Ένα popup που ανοίγει με το
        πέρασμα του δείκτη αναβοσβήνει σε κάθε διαδρομή του ποντικιού και **σκεπάζει τις
        γειτονικές πινέζες** — κρύβει ακριβώς αυτό που ο άνθρωπος πήγαινε να δει. Δες
        την κεφαλίδα του `ListingMapPopup`.
      */}
      {selectedListing !== null && onClear && (
        <ListingMapPopup listing={selectedListing} filterQuery={filterQuery} onClose={onClear} />
      )}
    </InteractiveMap>
    </PolygonSystemProvider>
  );
}

