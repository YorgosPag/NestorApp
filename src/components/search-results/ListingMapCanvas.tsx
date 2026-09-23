'use client';

/**
 * **Ο ΠΥΡΗΝΑΣ του χάρτη καταχωρίσεων** — ένας χάρτης, πολλοί καταναλωτές (ADR-777 §8.71).
 *
 * 🔑 Ζούσε μέσα στον `ResultsMap` (493/500 γραμμές). Χωρίστηκε όταν ήρθε **δεύτερος
 * καταναλωτής με άλλη πηγή δεδομένων**: ο χάρτης χαρτοφυλακίου του κατόχου («Τα ακίνητά μου»)
 * ζωγραφίζει από το **σημάδι** (`publication.mapMark`), όχι από `PublicListing`. Ο πυρήνας
 * δέχεται λοιπόν **έτοιμο** `ListingGeoJson` — βγαλμένο από τον **έναν** ζωγράφο
 * (`listingFeature`) — και δεν ξέρει τίποτα για τιμές, popup ή αναζήτηση.
 *
 * ⚠️ **Extract, όχι αντίγραφο**: ό,τι είναι εδώ **έφυγε** από τον `ResultsMap`, με τα σχόλιά
 * του αυτούσια. Ο `ResultsMap` είναι πλέον λεπτό περιτύλιγμα με το **ίδιο** εξωτερικό API.
 *
 * Ό,τι είναι ειδικό του καταναλωτή (πινακίδες τιμής, φούσκα) μπαίνει ως `children`, **μέσα**
 * στον χάρτη, ώστε να κάθεται πάνω από τις πηγές.
 */

import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { InteractiveMap } from '@/subapps/geo-canvas/components/InteractiveMap';
import { PolygonSystemProvider } from '@/subapps/geo-canvas/systems/polygon-system';
import type { MapInstance } from '@/subapps/geo-canvas/hooks/map/useMapInteractions';
import { splitListingGeometry, type ListingGeoJson } from '@/lib/listings/listings-geojson';
import { listingBounds } from '@/lib/listings/listing-map-bounds';
import { NO_LISTING_FOCUS, type ListingFocus } from '@/lib/listings/listing-focus';
import { ResultsMapSources } from './ResultsMapSources';
import { readListingMapPaint } from './listing-map-paint';
import type { GeoBoundingBox } from '@/types/geo/coordinates';
import { readMapArea, sameMapArea } from './results-map-area';
import {
  fitMapToArea,
  fitMapToBounds,
  listingIdOf,
  type MapEventTarget,
  type MapMoveEvent,
  type MapPointerEvent,
} from './results-map-contract';

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

export interface ListingMapCanvasProps {
  /**
   * **Τα σχήματα, ΕΤΟΙΜΑ** — από τον **έναν** ζωγράφο (`listingFeature`, μέσω
   * `listingsToGeoJson` για την αναζήτηση ή `ownerPortfolioGeoJson` για τον κάτοχο).
   *
   * ⚠️ Ο πυρήνας **δεν** παράγει γεωμετρία: αν την παρήγαγε, κάθε νέα πηγή δεδομένων θα
   * χρειαζόταν δεύτερο δρόμο προς το ίδιο σχήμα.
   */
  readonly geojson: ListingGeoJson;
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
   * **Η ΠΕΡΙΟΧΗ ΠΟΥ ΡΩΤΗΘΗΚΕ** — `null` = κανείς δεν ρώτησε *(ADR-777 §8.63)*.
   *
   * 🔴 **ΗΤΑΝ `areaLocked: boolean`, ΚΑΙ Η ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ ΤΟ ΚΑΤΕΔΕΙΞΕ ΩΣ ΜΙΣΟ**
   * *(2026-09-07)*. Η σημαία απαντούσε *«μην καδράρεις»* — και ο χάρτης έμενε **όπου
   * έτυχε**. Μετρημένο στην οθόνη: ένας σύνδεσμος `?box=37.8,23.5,38.1,23.9` έκοβε
   * σωστά τη λίστα σε **1 εδώ · 3 ίσως · 5 εκτός**, ενώ ο χάρτης δίπλα έδειχνε
   * **ολόκληρη την Πελοπόννησο**. Δηλαδή ο άνθρωπος έβλεπε λίστα κομμένη σε περιοχή
   * που **δεν του δείχναμε πουθενά** — ακριβώς η ασυμφωνία λίστας/χάρτη που ο
   * κανόνας 27 απαγορεύει, στην πιο σημαντική διαδρομή της Α3 *(ο κοινοποιημένος
   * σύνδεσμος)*.
   *
   * 🔑 **Η περιοχή απαντά ΚΑΙ ΤΑ ΔΥΟ ερωτήματα** — *«μην καδράρεις στα δεδομένα»*
   * **και** *«κάδραρε ΕΔΩ»*. Μια σημαία μπορούσε να απαντήσει μόνο το πρώτο.
   *
   * ⚠️ Εφαρμόζεται **ΜΙΑ φορά ανά περιοχή**, ποτέ σε κάθε απόδοση: αλλιώς κάθε
   * σύρσιμο θα γεννούσε `fitBounds` με `padding`, δηλαδή ένα ορατό **τίναγμα** πάνω
   * στην κίνηση του ίδιου του ανθρώπου.
   *
   * 🔴 **ΚΑΙ ΤΟ ΚΛΕΙΔΩΜΑ ΠΑΡΑΜΕΝΕΙ — ΧΩΡΙΣ ΑΥΤΟ ΥΠΑΡΧΕΙ ΑΝΑΔΡΑΣΗ, ΚΑΙ ΕΙΝΑΙ ΟΡΑΤΗ**:
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
   * αργή**, όχι ανύπαρκτη *(μάθημα Βήματος 2: early cutoff αντί για ρολόι)*.
   */
  readonly searchArea?: GeoBoundingBox | null;
  /** Επικαλύψεις του καταναλωτή (πινακίδες, φούσκα) — αποδίδονται **μέσα** στον χάρτη. */
  readonly children?: React.ReactNode;
}

/** Οι χειριστές, διαβασμένοι **τη στιγμή του συμβάντος** (κανόνας 2 του ADR-040). */
type MapHandlers = Pick<ListingMapCanvasProps, 'onPeek' | 'onSelect' | 'onClear' | 'onAreaChange'>;
interface HandlersRef { readonly current: MapHandlers }

/**
 * Παρατήρηση μεγέθους + ρητό `resize()` μετά το πρώτο καρέ.
 */
function watchMapSize(
  target: MapEventTarget,
  observerRef: { current: ResizeObserver | null },
): void {
  /*
    🔴 **Ο ΧΑΡΤΗΣ ΗΤΑΝ ΜΑΥΡΟΣ ΩΣΠΟΥ Ο ΑΝΘΡΩΠΟΣ ΤΟΝ ΑΚΟΥΜΠΟΥΣΕ** *(ADR-777 §8.56)*.
    Μετρημένο: **45 tiles `200`**, καμβάς **σωστός** (`1587×633 = 1984×792 × dpr 0,8`),
    WebGL **ζωντανό** — το καρέ ήταν σωστά υπολογισμένο και **ποτέ ζωγραφισμένο**.
    Το `resize()` είναι ο επίσημος τρόπος να ξαναρχίσει ο βρόχος απόδοσης, και είναι
    **ταυτοδύναμο**: αν τίποτα δεν άλλαξε, κοστίζει ένα καρέ.
    ⚠️ Ο παρατηρητής απαντά σε **αλλαγές** (παράθυρο, στάσεις φύλλου)· το ρητό
    διπλό-`rAF` από κάτω απαντά σε **αυτή** τη στιγμή, όπου το μέγεθος δεν αλλάζει ποτέ.
  */
  observerRef.current?.disconnect();
  const observer = new ResizeObserver(() => target.resize());
  observer.observe(target.getContainer());
  observerRef.current = observer;

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
}

/** Ο χάρτης αναφέρει πού κοιτάει — ΠΟΤΕ δεν αποφασίζει (βλ. `onAreaChange`). */
function bindAreaReporting(target: MapEventTarget, handlersRef: HandlersRef): void {
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
}

/** Κλικ / πέρασμα δείκτη / κλικ στο κενό — **μόνο** αν υπάρχει καταναλωτής επιλογής. */
function bindSelection(target: MapEventTarget, handlersRef: HandlersRef): void {
  // ⚠️ Χωρίς καταναλωτή επιλογής **δεν δένεται τίποτα** — ούτε κλικ, ούτε δείκτης.
  // Βλ. {@link ListingMapCanvasProps.onSelect}: δείκτης «χεράκι» χωρίς αποτέλεσμα είναι
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
}

export function ListingMapCanvas({
  geojson,
  focus = NO_LISTING_FOCUS,
  onPeek,
  onSelect,
  onClear,
  onAreaChange,
  searchArea = null,
  children,
}: ListingMapCanvasProps) {
  /**
   * 🔴 **ΧΩΡΙΣΜΕΝΗ ΣΕ ΔΥΟ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΤΑΞΗ — ΕΙΝΑΙ ΠΕΡΙΟΡΙΣΜΟΣ** *(ADR-777 §8.66)*.
   * Το supercluster δέχεται **μόνο** `Point`/`MultiPoint`: μια πηγή με `cluster: true`
   * **αγνοεί** κάθε πολύγωνό της, χωρίς σφάλμα και χωρίς προειδοποίηση. Ενωμένες, τα
   * μετρημένα περιγράμματα θα **εξαφανίζονταν** από τον χάρτη.
   */
  const geometry = useMemo(() => splitListingGeometry(geojson), [geojson]);
  /**
   * 🔴 **ΤΟ ΚΑΔΡΟ ΡΩΤΑΕΙ ΤΟ ΠΛΗΡΕΣ ΣΥΝΟΛΟ, ΟΧΙ ΤΑ ΣΗΜΕΙΑ** *(ADR-777 §8.66)*. Η κοπή
   * σε δύο πηγές είναι περιορισμός **της βιβλιοθήκης** — δεν είναι νέα αλήθεια για το
   * *«πού είναι τα αποτελέσματα»*. Καδραρισμένο μόνο στα σημεία, ένα σύνολο από
   * **μετρημένα περιγράμματα** *(η κορυφαία βαθμίδα της Α5)* θα άφηνε τον χάρτη στην
   * προεπιλογή του: **οθόνη που φαίνεται άδεια ενώ έχει αποτελέσματα** — ακριβώς το
   * ζωντανό εύρημα που γέννησε το `listingBounds`.
   */
  const bounds = useMemo(() => listingBounds(geojson), [geojson]);

  const { mark, surface } = readListingMapPaint();

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
  const searchAreaRef = useRef(searchArea);
  useEffect(() => { searchAreaRef.current = searchArea; }, [searchArea]);

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
   * Ο παρατηρητής μεγέθους του χάρτη — δες τον λόγο μέσα στο `watchMapSize`.
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
    // ⚠️ Ο έλεγχος του κλειδώματος είναι **πρώτος**: δες {@link ListingMapCanvasProps.searchArea}.
    if (!target || !bounds || searchAreaRef.current !== null) return;

    // ⚠️ Το περιθώριο, το ταβάνι ζουμ και η ακαριαία άφιξη **δεν γράφονται εδώ**: ήταν
    // αντιγραμμένα inline δύο φορές, δίπλα στο αρχείο που τα κρατούσε ήδη. Ο λόγος
    // κάθε μιας είναι γραμμένος στο `fitMapToBounds`.
    fitMapToBounds(target, bounds);
  }, [bounds]);

  /**
   * 🔴 **ΚΑΔΡΑΡΙΣΜΑ ΣΤΗΝ ΠΕΡΙΟΧΗ ΠΟΥ ΡΩΤΗΘΗΚΕ — ΜΙΑ ΦΟΡΑ ΑΝΑ ΠΕΡΙΟΧΗ.**
   *
   * ⚠️ **Ο έλεγχος ταυτότητας ΔΕΝ είναι βελτιστοποίηση.** Χωρίς αυτόν, κάθε σύρσιμο
   * θα κατέληγε σε `fitBounds` **πάνω στην κίνηση του ίδιου του ανθρώπου** — και
   * επειδή το `fitBounds` προσθέτει `padding: 64`, το κάδρο που θα προέκυπτε θα ήταν
   * **ελαφρώς μεγαλύτερο** από αυτό που ζήτησε: ορατό **τίναγμα** σε κάθε κίνηση.
   *
   * 🔑 **Η δική μας κίνηση ΔΕΝ αναφέρεται πίσω** — το `moveend` που γεννά αυτό το
   * `fitBounds` δεν έχει `originalEvent`, άρα ο ακροατής τον αγνοεί. Ο κύκλος
   * κλείνει **δομικά**, όχι με χρονόμετρο.
   */
  const framedAreaRef = useRef<GeoBoundingBox | null>(null);
  useEffect(() => {
    const target = mapRef.current;
    if (!target || !searchArea) return;
    if (sameMapArea(framedAreaRef.current, searchArea)) return;

    framedAreaRef.current = searchArea;
    fitMapToArea(target, searchArea);
  }, [searchArea]);

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
    /*
      🔑 **ΔΥΟ ΔΙΑΔΡΟΜΕΣ ΠΡΟΣ ΤΗΝ ΙΔΙΑ, ΤΑΥΤΟΔΥΝΑΜΗ ΠΡΑΞΗ** — belt-and-suspenders
      (N.7.2 #4), όχι διπλή αλήθεια: τα effects από πάνω μπορεί να έχουν **ήδη** τρέξει
      με `mapRef.current === null` (ο χάρτης φόρτωνε ακόμη) και να μην ξανατρέξουν.
      Η **δηλωμένη περιοχή προηγείται** των δεδομένων: ο άνθρωπος είπε πού κοιτάει.
    */
    const readyArea = searchAreaRef.current;
    if (readyArea) {
      framedAreaRef.current = readyArea;
      fitMapToArea(target, readyArea);
    } else if (readyBounds) {
      fitMapToBounds(target, readyBounds);
    }

    watchMapSize(target, mapObserverRef);
    bindAreaReporting(target, handlersRef);
    bindSelection(target, handlersRef);
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
      <ResultsMapSources geometry={geometry} mark={mark} surface={surface} focus={focus} />

      {/*
        Οι επικαλύψεις του καταναλωτή — **μετά** την πηγή, ώστε να κάθονται πάνω από τα
        σχήματα (πινακίδες τιμής, φούσκα της αναζήτησης· φούσκα του κατόχου).
      */}
      {children}
    </InteractiveMap>
    </PolygonSystemProvider>
  );
}
