'use client';

/**
 * @fileoverview **Η ΕΠΙΦΑΝΕΙΑ ΤΟΥ ΧΑΡΤΗ** για τον εντοπισμό τόπου — μία, για τρεις χειρονομίες.
 * @related ADR-777 · SPEC-777A §13.6 · §21.4 · components/geo/PlaceChooser.tsx
 * @module components/geo/PlaceMap
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ **ΜΙΑ** ΕΠΙΦΑΝΕΙΑ ΚΑΙ ΟΧΙ ΤΡΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι τρεις χειρονομίες του §21.4 που γίνονται **πάνω στον χάρτη** — διάλεξε κτίριο ·
 * βάλε πινέζα · ζωγράφισε περίγραμμα — είναι, από την πλευρά της επιφάνειας, **η ίδια
 * πράξη**: ένα κλικ σε συντεταγμένες. Ό,τι διαφέρει είναι **τι ζωγραφίζεται μετά**,
 * και αυτό είναι δεδομένο (`outline`, `pin`), όχι δεύτερος χάρτης.
 *
 * 🔑 Τρεις χάρτες θα ήταν το σχήμα που το SPEC-777-CHANGELOG **ήδη κατήγγειλε**:
 * *«ο χάρτης υπάρχει **ΤΡΕΙΣ** φορές … ADR-749 σε χαρτογραφική μορφή»*. Δεν
 * προστίθεται τέταρτος.
 *
 * ⚠️ **Καμία νέα εξάρτηση.** `react-map-gl/maplibre` είναι ήδη εγκατεστημένο και το
 * `OSM_MAP_STYLE` υπάρχει ως SSoT στο `components/projects/ika/map-shared` — το ίδιο
 * που χρησιμοποιούν οι δύο χάρτες του ΙΚΑ. Ένα εργαλείο σχεδίασης από πακέτο
 * (`mapbox-gl-draw`) θα ήταν **νέα άδεια προς έλεγχο** (N.5) για κάτι που εδώ είναι
 * ένας πίνακας κορυφών.
 *
 * ⛔ **ΔΕΝ αγγίζει το Geo-Canvas** (ADR-782, ξένο subapp με ανοιχτή δουλειά τρίτου).
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Layer,
  Map,
  Marker,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';

import { OSM_MAP_STYLE } from '@/components/projects/ika/map-shared';
import { Spinner } from '@/components/ui/spinner/Spinner';
import { useFocusCamera } from '@/components/geo/use-focus-camera';
import { outlineToGeoJson, pointsToGeoJson } from '@/lib/geo/geo-geojson';
import { geoCircleOutline } from '@/lib/geo/geo-ring';
import {
  focusPresentation,
  shapeHasHalo,
  shapeHasPin,
  type PlaceFocus,
} from '@/lib/geo/geocoding-focus';
import { cn } from '@/lib/utils';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';

/** Ζουμ κτιρίου — αρκετά κοντά ώστε ένα κλικ να διακρίνει **κτίριο**, όχι τετράγωνο. */
const BUILDING_ZOOM = 18;

const SHAPE_SOURCE = 'place-shape';
const TRACE_SOURCE = 'place-trace';
const HALO_SOURCE = 'place-halo';

/* eslint-disable design-system/no-hardcoded-colors -- Το MapLibre δέχεται ΜΟΝΟ literal
   χρώματα στο `paint`: δεν αποτιμά CSS custom properties. Ίδιος λόγος και ίδια
   δήλωση με το `map-shared/map-styles.ts`, που είναι ο SSoT των στρώσεων χάρτη. */
const SHAPE_FILL = {
  id: 'place-shape-fill',
  type: 'fill' as const,
  source: SHAPE_SOURCE,
  paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.18 },
};

const SHAPE_LINE = {
  id: 'place-shape-line',
  type: 'line' as const,
  source: SHAPE_SOURCE,
  paint: { 'line-color': '#2563eb', 'line-width': 2 },
};

const TRACE_LINE = {
  id: 'place-trace-line',
  type: 'line' as const,
  source: TRACE_SOURCE,
  paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-dasharray': [2, 2] },
};

/**
 * 🔴 **Ο ΚΥΚΛΟΣ ΑΒΕΒΑΙΟΤΗΤΑΣ ΕΙΝΑΙ ΣΚΟΠΙΜΑ ΑΛΛΟ ΧΡΩΜΑ ΑΠΟ ΤΟ ΚΤΙΡΙΟ.**
 *
 * Το μπλε (`#2563eb`) σημαίνει σε αυτή την επιφάνεια **«αυτό είναι το πράγμα»** — το
 * επιλεγμένο κτίριο, το σχέδιο του ανθρώπου. Ένας κύκλος «περίπου εδώ» με το ίδιο
 * χρώμα θα διαβαζόταν ως **επιλεγμένο σχήμα**, δηλαδή θα έλεγε ακριβώς το αντίθετο
 * από ό,τι εννοεί. Το κεχριμπαρένιο είναι το καθιερωμένο χρώμα της **επιφύλαξης**.
 *
 * ⚠️ **Και η γραμμή είναι ΔΙΑΚΕΚΟΜΜΕΝΗ, καρτογραφική σύμβαση**: συνεχές περίγραμμα
 * σημαίνει **όριο που υπάρχει** (ιδιοκτησία, κτίριο). Αυτός ο κύκλος **δεν είναι
 * όριο** — είναι το εύρος του τι δεν ξέρουμε, και δεν έχει καμία θέση στον κόσμο.
 */
const HALO_FILL = {
  id: 'place-halo-fill',
  type: 'fill' as const,
  source: HALO_SOURCE,
  paint: { 'fill-color': '#d97706', 'fill-opacity': 0.12 },
};

const HALO_LINE = {
  id: 'place-halo-line',
  type: 'line' as const,
  source: HALO_SOURCE,
  paint: { 'line-color': '#d97706', 'line-width': 2, 'line-dasharray': [3, 2] },
};
/* eslint-enable design-system/no-hardcoded-colors */

export interface PlaceMapProps {
  /** Πού κοιτάζει ο χάρτης όταν ανοίγει. */
  readonly center: GeoPoint;
  /**
   * Ο άνθρωπος πάτησε εδώ.
   *
   * ⚠️ **Προαιρετικό, και η απουσία είναι ΝΟΗΜΑ**: ο ίδιος χάρτης χρησιμεύει και ως
   * **απάντηση** (η καρτέλα του τόπου δείχνει το περίγραμμα ενός τόπου που έχει ήδη
   * επιλεγεί). Ένα `onPick={() => {}}` εκεί θα ήταν χειριστήριο που **δέχεται** κλικ
   * και τα πετά — δηλαδή επιφάνεια που υπόσχεται πράξη χωρίς να την κάνει. Χωρίς
   * `onPick` ο δείκτης μένει προεπιλεγμένος και δεν προσκαλείται κανείς να πατήσει.
   */
  readonly onPick?: (point: GeoPoint) => void;
  /** Κλειστό σχήμα προς εμφάνιση — κτίριο OSM (**ζωντανά**) ή ολοκληρωμένο σχέδιο. */
  readonly outline?: GeoOutline | null;
  /** Οι κορυφές που **σχεδιάζονται τώρα** — ανοιχτή γραμμή, όχι σχήμα. */
  readonly trace?: readonly GeoPoint[];
  /** Πινέζα. */
  readonly pin?: GeoPoint | null;
  /**
   * **Η ΑΠΑΝΤΗΣΗ ΤΟΥ ΓΕΩΚΩΔΙΚΟΠΟΙΗΤΗ** — η κάμερα την ακολουθεί, και η αβεβαιότητά της
   * ζωγραφίζεται.
   *
   * ⚠️ **Προαιρετικό, όπως το `onPick`**: οι τρεις άλλες επιφάνειες που χρησιμοποιούν
   * αυτόν τον χάρτη (`PlaceSummary`, `DemandAreaOutline`, `DemandFrontageField`) δεν
   * έχουν γεωκωδικοποιητή — δείχνουν σχήμα που **ήδη** επιλέχθηκε. Ένα υποχρεωτικό
   * `focus` θα τις ανάγκαζε να επινοήσουν απάντηση που δεν πήρε κανείς.
   *
   * ⛔ **ΔΕΝ αντικαθιστά το `center`.** Το `center` απαντά *«πού ανοίγει ο χάρτης»*
   * (μία φορά)· το `focus` *«πού πήγε επειδή κάποιος ρώτησε»* (κάθε φορά). Τα δύο
   * ενωμένα σε ένα prop θα ξανάφερναν ακριβώς τη βλάβη που το `use-focus-camera`
   * τεκμηριώνει: τιμή που **μοιάζει** αντιδραστική και διαβάζεται μία φορά.
   */
  readonly focus?: PlaceFocus | null;
  /**
   * **Ρωτάμε τώρα** — ο χάρτης το δείχνει, δεν το υπονοεί.
   *
   * 🔴 **ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΜΟΝΟ ΣΤΗ ΓΡΑΜΜΗ ΚΑΤΑΣΤΑΣΗΣ** *(αναφορά Giorgio, 02/09)*: ο
   * άνθρωπος μόλις πάτησε **πάνω στον χάρτη**, και το μάτι του είναι εκεί. Ένας δείκτης
   * διακόσιμα εικονοστοιχεία πιο κάτω είναι **σωστός και αόρατος** — απαντά σε ερώτηση
   * που κανείς δεν κοιτάζει τη στιγμή που τη ρωτά. Η ανάδραση ανήκει **στο σημείο της
   * πράξης**· η *διατύπωση* του αποτελέσματος ανήκει στη γραμμή κατάστασης.
   *
   * ⚠️ **Διαφορετικό από το `disabled`**: εκείνο λέει *«μην πατάς»* (η καταχώρηση
   * τρέχει)· αυτό *«ρωτάω»*. Ενωμένα σε ένα prop, ο χάρτης δεν θα μπορούσε να δείχνει
   * αναμονή **χωρίς** να απαγορεύει το επόμενο κλικ — και η αναζήτηση κτιρίου είναι
   * ακριβώς η περίπτωση όπου ο άνθρωπος **επιτρέπεται** να αλλάξει γνώμη.
   */
  readonly busy?: boolean;
  readonly disabled?: boolean;
  readonly heightClass?: string;
}

/**
 * Ο κύκλος της αβεβαιότητας ως δακτύλιος — ή `null` όταν δεν υπάρχει τι να δηλωθεί.
 *
 * 🔑 Εξήχθη από το σώμα του {@link PlaceMap} ώστε η συνάρτηση της επιφάνειας να μείνει
 * **απόδοση**: η ερώτηση *«τι σχήμα έχει η επιφύλαξη;»* απαντιέται από τον SSoT
 * ({@link focusPresentation} + {@link geoCircleOutline}), όχι μέσα σε ένα JSX δέντρο.
 */
function halosOf(focus: PlaceFocus | null): GeoOutline | null {
  if (focus === null) return null;

  const { shape, uncertaintyMetres } = focusPresentation(focus);
  if (!shapeHasHalo(shape) || uncertaintyMetres === null) return null;

  return geoCircleOutline(focus.point, uncertaintyMetres);
}

/**
 * Ό,τι ζωγραφίζεται **μέσα** στον χάρτη — εξηγμένο ώστε η {@link PlaceMap} να μείνει
 * *«στήσε τον χάρτη»* και αυτό να είναι *«τι φαίνεται πάνω του»*.
 *
 * 🔑 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ, ΟΧΙ ΑΙΣΘΗΤΙΚΗ.** Στο MapLibre το z-order **είναι**
 * η σειρά προσθήκης, και εδώ διαβάζεται από κάτω προς τα πάνω ως ιεραρχία
 * **βεβαιότητας**: ο κύκλος της επιφύλαξης πρώτος (πιο κάτω απ' όλα), μετά το σχήμα
 * που ξέρουμε, μετά ό,τι κρατά ο άνθρωπος στο χέρι του. Αν η επιφύλαξη ζωγραφιζόταν
 * τελευταία, θα σκέπαζε **κυριολεκτικά** τη βεβαιότητα.
 */
function PlaceMapLayers({
  halo,
  outline,
  trace,
  pin,
  focus,
}: {
  readonly halo: GeoOutline | null;
  readonly outline: GeoOutline | null;
  readonly trace: readonly GeoPoint[];
  readonly pin: GeoPoint | null;
  readonly focus: PlaceFocus | null;
}): React.ReactElement {
  return (
    <>
      {halo !== null && (
        <Source id={HALO_SOURCE} type="geojson" data={outlineToGeoJson(halo)}>
          <Layer {...HALO_FILL} />
          <Layer {...HALO_LINE} />
        </Source>
      )}

      {outline !== null && outline.length >= 3 && (
        <Source id={SHAPE_SOURCE} type="geojson" data={outlineToGeoJson(outline)}>
          <Layer {...SHAPE_FILL} />
          <Layer {...SHAPE_LINE} />
        </Source>
      )}

      {/* ⚠️ Η **υπό σχεδίαση** γραμμή είναι ξεχωριστή πηγή από το κλειστό σχήμα: ένα
          ημιτελές σχέδιο **δεν είναι** πολύγωνο, και το να ζωγραφιζόταν ως γεμάτο
          σχήμα θα έλεγε στον άνθρωπο ότι έκλεισε κάτι που δεν έκλεισε. */}
      {trace.length >= 2 && (
        <Source id={TRACE_SOURCE} type="geojson" data={pointsToGeoJson(trace)}>
          <Layer {...TRACE_LINE} />
        </Source>
      )}

      {trace.map((vertex, index) => (
        <Marker key={`${vertex.lat}:${vertex.lng}:${index}`} latitude={vertex.lat} longitude={vertex.lng}>
          <span className="block size-2 rounded-full border border-background bg-foreground" />
        </Marker>
      ))}

      {pin !== null && (
        <Marker latitude={pin.lat} longitude={pin.lng} anchor="bottom">
          <MapPin className="size-6 text-foreground" aria-hidden />
        </Marker>
      )}

      {/*
        🔑 **Η ΠΙΝΕΖΑ ΚΑΙ Ο ΔΑΚΤΥΛΙΟΣ ΔΕΝ ΑΠΟΚΛΕΙΟΝΤΑΙ** — και αυτό ακριβώς έχανε η
        πρώτη γραφή. Ο πίνακας της **Α5** ορίζει `pin-with-ring` για τον *δρόμο χωρίς
        αριθμό*: η πινέζα λέει *«ξέρουμε τον δρόμο»*, ο κύκλος *«όχι το κτίριο»*. Ένα
        από τα δύο μόνο του λέει **μισή** αλήθεια — και η μισή αλήθεια εδώ έχει
        κατεύθυνση: σκέτη πινέζα υπόσχεται περισσότερα απ' όσα ξέρουμε.

        ⚠️ Η απόφαση **δεν λαμβάνεται εδώ**: το {@link shapeHasPin} τη διαβάζει από τον
        SSoT της Α5. Ένας έλεγχος βαθμού σε αυτή τη γραμμή θα ήταν δεύτερη αρχή για την
        ίδια ερώτηση — ακριβώς το λάθος που αυτό το commit διόρθωσε.
      */}
      {focus !== null && shapeHasPin(focusPresentation(focus).shape) && (
        <Marker latitude={focus.point.lat} longitude={focus.point.lng} anchor="bottom">
          <MapPin className="size-7 text-[hsl(var(--text-info))] drop-shadow" aria-hidden />
        </Marker>
      )}
    </>
  );
}

export function PlaceMap({
  center,
  onPick,
  outline = null,
  trace = [],
  pin = null,
  focus = null,
  busy = false,
  disabled = false,
  heightClass = 'h-80',
}: PlaceMapProps): React.ReactElement {
  const interactive = onPick !== undefined && !disabled;
  const mapRef = useRef<MapRef | null>(null);

  /**
   * ⚠️ **Ο ΧΑΡΤΗΣ ΔΕΝ ΔΕΧΕΤΑΙ ΕΝΤΟΛΕΣ ΠΡΙΝ ΦΟΡΤΩΣΕΙ.** Μια απάντηση που φτάνει όσο το
   * στυλ κατεβαίνει θα έπεφτε στο κενό — **σιωπηλά**, και μόνο μερικές φορές: ακριβώς
   * το είδος βλάβης που εμφανίζεται στον αργό υπολογιστή του χρήστη και ποτέ στον
   * γρήγορο του προγραμματιστή. Το `ready` κάνει την πτήση να **περιμένει**.
   */
  const [ready, setReady] = useState(false);
  useFocusCamera(mapRef, ready, focus);

  const halo = useMemo(() => halosOf(focus), [focus]);

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      if (!interactive) return;
      onPick?.({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    },
    [interactive, onPick],
  );

  return (
    <figure className={cn('relative overflow-hidden rounded-lg border border-border', heightClass)}>
      <Map
        ref={mapRef}
        initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: BUILDING_ZOOM }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={OSM_MAP_STYLE}
        onLoad={() => setReady(true)}
        onClick={handleClick}
        cursor={interactive ? 'crosshair' : 'default'}
        attributionControl={false}
      >
        <PlaceMapLayers halo={halo} outline={outline} trace={trace} pin={pin} focus={focus} />
      </Map>

      {/*
        ⚠️ **`pointer-events-none`** — ο δείκτης **ανακοινώνει**, δεν εμποδίζει: ο
        άνθρωπος πρέπει να μπορεί να πατήσει αλλού όσο ρωτάμε, γιατί συχνά κατάλαβε
        αμέσως ότι αστόχησε. Ένα διαφανές στρώμα που τρώει κλικ θα τον ανάγκαζε να
        περιμένει απάντηση **που δεν τον ενδιαφέρει πια**.

        🔑 **Χωρίς `role`/`aria-live` εδώ, επίτηδες**: η ίδια πληροφορία ανακοινώνεται
        **μία** φορά, από τη γραμμή κατάστασης (`PlaceChooserStatus`). Δύο ζωντανές
        περιοχές για ένα γεγονός σημαίνει ότι ο αναγνώστης οθόνης το λέει **δύο φορές**.
      */}
      {busy && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-background/85 p-3 shadow-lg">
            <Spinner size="medium" aria-label="" />
          </span>
        </span>
      )}
    </figure>
  );
}
