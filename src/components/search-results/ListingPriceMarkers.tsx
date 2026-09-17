'use client';

/**
 * **Η ΠΙΝΑΚΙΔΑ ΤΙΜΗΣ ΠΑΝΩ ΣΤΟΝ ΧΑΡΤΗ** — ADR-777 §8.60 (Ε2).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ DOM ΚΑΙ ΟΧΙ `symbol` LAYER — ΜΕΤΡΗΜΕΝΟΣ ΦΡΑΓΜΟΣ, ΟΧΙ ΠΡΟΤΙΜΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρήθηκε 2026-09-06: `grep -rn "glyphs|sprite"` στο `src/subapps/geo-canvas/` και
 * στο `src/lib/maps/` επιστρέφει **μηδέν γραμμές**, σε **επτά** τύπους στυλ. Το
 * MapLibre **δεν σχεδιάζει κείμενο χωρίς `glyphs`** (SDF γραμματοσειρές σε `.pbf`):
 * ένα `symbol` layer με `text-field` πάνω σε αυτά τα στυλ δεν ζωγραφίζει τίποτα —
 * **σιωπηλά**. Είναι το σχήμα «*πράσινο που σημαίνει «δεν κοίταξα»*» που το `CLAUDE.md`
 * καταγράφει σε N.11 · N.12 · N.18.
 *
 * Ο δρόμος «self-hosted glyphs ή τρίτος πάροχος» **παρουσιάστηκε και απορρίφθηκε**
 * (απόφαση Giorgio 2026-09-06), για τρεις λόγους που δεν είναι γούστο:
 *
 * 1. **Κείμενο μέσα σε WebGL καμβά είναι αόρατο σε ΚΑΘΕ πύλη μας** — 3.38, 3.39, 3.40,
 *    3.45 διαβάζουν CSS/tokens. Θα ήταν το **μοναδικό** κείμενο της οθόνης χωρίς φύλακα
 *    αντίθεσης, και το ίδιο ισχύει για τον αναγνώστη οθόνης: καμβάς δεν έχει κείμενο.
 * 2. **Νέα εξάρτηση/άδεια/πάροχος** — ενεργοποιεί την **CHECK 3.69** (μητρώο αδειών
 *    γραμματοσειρών) για δυνατότητα που εδώ χρησιμοποιείται σε **≤40 στοιχεία**.
 * 3. Το `Marker` **περνά ήδη** από το εγκεκριμένο σύνορο `@/lib/maps/maplibre` μαζί με
 *    το φύλλο στυλ του (**CHECK 3.75**), και ο `ListingMapPopup` αποδεικνύει σε
 *    παραγωγή ότι παιδί μέσα στον `InteractiveMap` δουλεύει. **Μηδέν νέα υποδομή.**
 *
 * ⚠️ **ΤΟ ΤΙΜΗΜΑ, ΕΙΠΩΜΕΝΟ**: το `symbol` layer θα έφερνε **δωρεάν σύγκρουση
 * ετικετών** (`text-allow-overlap: false`). Οι κόμβοι DOM **δεν** την έχουν. Η
 * απάντηση εδώ είναι η **στοίβα**: αδιαφανής πινακίδα + περίγραμμα + `z-index` κατά
 * κατάσταση, ώστε η επικάλυψη να διαβάζεται σαν στοίβα καρτών και **ο δείκτης να
 * ανεβάζει** όποια κοιτάς. Είναι ακριβώς η συμπεριφορά του Airbnb σε χαμηλό zoom.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΧΡΩΜΑ ΕΙΝΑΙ **ΣΤΑΘΕΡΟ**, ΚΑΙ ΕΙΝΑΙ Η ΙΔΙΑ ΕΞΑΙΡΕΣΗ ΜΕ ΤΗ ΓΚΑΛΕΡΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `ListingCardGallery` το πλήρωσε ζωντανά: τελείες με `bg-background` *(token του
 * θέματος)* ήταν **ορατές στη μία κάρτα και αόρατες στη διπλανή**, γιατί από πίσω δεν
 * κάθεται επιφάνεια του θέματος αλλά **φωτογραφία**. Εδώ από πίσω κάθεται **raster
 * tile** — και χειρότερα, το υπόβαθρο αλλάζει με τον διακόπτη «Χάρτης / Δορυφόρος»
 * **χωρίς** να αλλάξει το θέμα. Μια πινακίδα με tokens θα ήταν σκούρα πάνω σε δορυφόρο
 * στο σκοτεινό θέμα. ⇒ **Αδιαφανές λευκό με μαύρο κείμενο**, όπως Zillow/Redfin/Airbnb.
 *
 * ⚠️ **ΟΙ ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ ΞΕΧΩΡΙΖΟΥΝ ΧΩΡΙΣ ΧΡΩΜΑ** (CHECK 3.41 / WCAG 1.4.1): η
 * επισήμανση μεγαλώνει την πινακίδα και βαραίνει τη σκιά, η επιλογή **αντιστρέφει** τη
 * φωτεινότητα και μεγαλώνει κι άλλο. Και τα δύο επιβιώνουν σε ασπρόμαυρη εκτύπωση.
 */

import React, { useMemo } from 'react';
import { Marker } from '@/lib/maps/maplibre';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { headlinePriceLabel } from '@/lib/listings/listing-price-label';
import {
  listingFocusStrength,
  type ListingFocus,
  type ListingFocusStrength,
} from '@/lib/listings/listing-focus';
import type { ListingPriceMarker } from '@/lib/listings/listing-price-markers';
import { useStayTotal } from './StayTotalsContext';

interface ListingPriceMarkersProps {
  /** Ποιες αγγελίες πήραν πινακίδα — **κρίση του `listingPriceMarkers`**, όχι εδώ. */
  readonly markers: readonly ListingPriceMarker[];
  readonly focus: ListingFocus;
  /**
   * Η ακτίνα της πινέζας σε pixel, **από τον ζωγράφο**.
   *
   * 🔑 **Prop και όχι σταθερά εδώ**, ώστε το `RADIUS.pin` να μείνει **μία** αυθεντία.
   * Ένα δεύτερο `7` γραμμένο εδώ θα ήταν σωστό μέχρι την πρώτη φορά που κάποιος αλλάξει
   * το πρώτο — και η βλάβη θα ήταν **πινακίδα που ακουμπά την πινέζα**, δηλαδή ορατή
   * μόνο σε προσεκτικό μάτι.
   */
  readonly pinRadiusPx: number;
  readonly onPeek?: (id: string | null) => void;
  readonly onSelect?: (id: string) => void;
}

/**
 * Το κενό ανάμεσα στην κορυφή της πινέζας και τη βάση της πινακίδας.
 *
 * ⚠️ Προστίθεται στο **περίγραμμα** της πινέζας (`circle-stroke-width: 2`) συν μια
 * ανάσα, ώστε η πινακίδα να **δείχνει** την πινέζα αντί να την καπακώνει.
 */
const PLAQUE_CLEARANCE_PX = 5;

/** Ό,τι δεν αλλάζει με την κατάσταση. */
const PLAQUE_BASE = [
  'cursor-pointer select-none whitespace-nowrap rounded-full border',
  'px-2 py-0.5 text-xs font-semibold leading-tight tabular-nums',
  'transition-transform duration-150 motion-reduce:transition-none',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black',
  'focus-visible:ring-offset-1 focus-visible:ring-offset-white',
].join(' ');

/**
 * Η όψη ανά ένταση εστίασης.
 *
 * ⚠️ `Record<ListingFocusStrength, …>` **επίτηδες**: μια τέταρτη ένταση στο
 * `listing-focus.ts` **σπάει τη μεταγλώττιση εδώ**, αντί να πέσει σιωπηλά σε προεπιλογή
 * και να ζωγραφίσει την πινακίδα σαν να μην τη διάλεξε κανείς.
 */
const PLAQUE_STATE: Readonly<Record<ListingFocusStrength, string>> = {
  none: 'border-black/15 bg-white text-black shadow-md',
  peeked: 'border-black/30 bg-white text-black shadow-lg scale-110',
  selected: 'border-white/30 bg-black text-white shadow-xl scale-125',
};

/**
 * Ποια πινακίδα κάθεται **πάνω** όταν δύο επικαλύπτονται.
 *
 * 🔑 Αυτό είναι η **απάντηση στη σύγκρουση ετικετών** που το `symbol` layer θα έδινε
 * δωρεάν: ό,τι κοιτάς ανεβαίνει, ό,τι διάλεξες μένει πάνω από όλα. Οι τιμές είναι
 * **τοπικές** μέσα στο δοχείο δεικτών του χάρτη — καμία σχέση με την **καθολική**
 * κλίμακα στρώσεων που φυλάει η CHECK 3.50, γι' αυτό δεν ζητούν token ρόλου.
 */
const MARKER_LAYER: Readonly<Record<ListingFocusStrength, string>> = {
  none: 'z-10',
  peeked: 'z-20',
  selected: 'z-30',
};

export function ListingPriceMarkers({
  markers,
  focus,
  pinRadiusPx,
  onPeek,
  onSelect,
}: ListingPriceMarkersProps) {
  /*
    ⚠️ **Μεμονωμένο tuple, όχι λογοτεχνικό `[0, -12]` μέσα στο JSX.** Ο `Marker` του
    react-map-gl συγκρίνει το `offset` με `arePointsEqual` σε **κάθε** απόδοση και
    καλεί `setOffset` όταν διαφέρει· ένας νέος πίνακας ανά απόδοση θα περνούσε τη
    σύγκριση τιμής, αλλά θα γεννούσε 40 πίνακες σε κάθε κίνηση του ποντικιού.
  */
  const offset = useMemo<[number, number]>(
    () => [0, -(pinRadiusPx + PLAQUE_CLEARANCE_PX)],
    [pinRadiusPx],
  );

  return (
    <>
      {markers.map((marker) => (
        <PriceMarker
          key={marker.id}
          marker={marker}
          offset={offset}
          strength={listingFocusStrength(focus, marker.id)}
          onPeek={onPeek}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

interface PriceMarkerProps {
  readonly marker: ListingPriceMarker;
  readonly offset: readonly [number, number];
  readonly strength: ListingFocusStrength;
  readonly onPeek?: (id: string | null) => void;
  readonly onSelect?: (id: string) => void;
}

/**
 * Μία πινακίδα — **πραγματικό `<button>`**, ποτέ `<div role="button">`.
 *
 * 🔴 **ΓΙΑΤΙ Η ΕΠΙΛΟΓΗ ΖΕΙ ΣΤΟ `<Marker onClick>` ΚΑΙ ΟΧΙ ΣΤΟ `onClick` ΤΟΥ ΚΟΥΜΠΙΟΥ.**
 * Ο δείκτης ζει **μέσα στο `canvasContainer`** του MapLibre, δηλαδή ο ίδιος ο χάρτης
 * είναι **πρόγονός** του. Η React (17+) ακούει στη **ρίζα** της εφαρμογής, που είναι
 * ακόμη πιο ψηλά ⇒ ένα `onClick` στο κουμπί θα έτρεχε **ΜΕΤΑ** τον καθολικό ακροατή
 * του χάρτη. Και ο καθολικός ακροατής του `ResultsMap` ρωτά `queryRenderedFeatures`
 * **στο σημείο του δείκτη** — που είναι ~12px **πάνω** από την πινέζα, άρα δεν βρίσκει
 * τίποτα και καλεί `onClear()`: **η ίδια η πινακίδα θα ακύρωνε την επιλογή της**.
 *
 * ✅ Ο `Marker` της react-map-gl δένει `addEventListener('click')` **στο ίδιο το
 * στοιχείο του δείκτη**, δηλαδή **κάτω** από το `canvasContainer`: τρέχει **πρώτος**,
 * και το `stopPropagation` στο **γνήσιο** συμβάν κόβει τον χάρτη πριν προλάβει.
 *
 * 🔑 **Το πληκτρολόγιο δουλεύει ακέραιο**: `Enter`/`Space` σε εστιασμένο `<button>`
 * παράγουν γνήσιο `click` που **αναδύεται** — άρα περνά από τον ίδιο ακροατή.
 * (Και το `mousedown → preventDefault` που βάζει η MapLibre σε κάθε δείκτη είναι
 * **ευεργετικό** εδώ: το κλικ δεν σέρνει τον χάρτη και δεν αφήνει δαχτυλίδι εστίασης.)
 */
function PriceMarker({ marker, offset, strength, onPeek, onSelect }: PriceMarkerProps) {
  const { t } = useTranslation();
  const stayTotal = useStayTotal(marker.id);
  /*
    🔴 **Ποσό ΜΑΖΙ με μονάδα** («50 €/νύχτα»), από το ΕΝΑ σημείο μορφοποίησης: στον ίδιο
    χάρτη κάθονται πώληση, μίσθωμα και διανυκτέρευση (ADR-835 §4.4). Με ημερομηνίες
    που το κατάλυμα δέχεται, το **σύνολο** της διαμονής («150 € · 3 νύχτες», §8.60.12).
  */
  const price = headlinePriceLabel(t, marker, stayTotal);

  return (
    <Marker
      longitude={marker.lng}
      latitude={marker.lat}
      anchor="bottom"
      offset={offset as [number, number]}
      className={MARKER_LAYER[strength]}
      onClick={(event) => {
        event.originalEvent.stopPropagation();
        onSelect?.(marker.id);
      }}
    >
      <button
        type="button"
        data-listing-id={marker.id}
        /*
          🔑 **Το ορατό κείμενο περιέχεται στο προσβάσιμο όνομα** (WCAG 2.5.3, *Label in
          Name*): όποιος λέει «τετρακόσιες πενήντα χιλιάδες» σε φωνητικό χειρισμό
          χτυπά αυτό το κουμπί. Ο τίτλος μπαίνει **μπροστά** γιατί μια οθόνη με 40
          πινακίδες θα ανακοίνωνε αλλιώς σαράντα σκέτα ποσά.
        */
        aria-label={t('search-results:map.priceMarker.aria', { title: marker.title, price })}
        className={`${PLAQUE_BASE} ${PLAQUE_STATE[strength]}`}
        onMouseEnter={() => onPeek?.(marker.id)}
        onMouseLeave={() => onPeek?.(null)}
        onFocus={() => onPeek?.(marker.id)}
        onBlur={() => onPeek?.(null)}
      >
        {price}
      </button>
    </Marker>
  );
}
