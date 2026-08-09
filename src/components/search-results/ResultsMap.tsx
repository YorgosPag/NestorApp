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

import React, { useMemo, useCallback } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import { InteractiveMap } from '@/subapps/geo-canvas/components/InteractiveMap';
import { PolygonSystemProvider } from '@/subapps/geo-canvas/systems/polygon-system';
import type { MapInstance } from '@/subapps/geo-canvas/hooks/map/useMapInteractions';
import { readRootCssVar } from '@/subapps/dxf-viewer/config/color-config';
import { listingsToGeoJson } from '@/lib/listings/listings-geojson';
import type { PublicListing } from '@/types/public-listing';

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
  readonly highlightedId: string | null;
  readonly onSelect: (id: string) => void;
}

/** Ακτίνες σε pixel. **Κατηγορικά διακριτές**, όχι διαβαθμίσεις που μοιάζουν. */
const RADIUS = { pin: 7, ring: 7, neighbourhood: 34, city: 90 } as const;

const SOURCE_ID = 'public-listings';

/**
 * Το ορθογώνιο που περικλείει **ό,τι ζωγραφίζεται** — ή `null` αν δεν ζωγραφίζεται τίποτα.
 *
 * 🔴 **Χωρίς αυτό ο χάρτης δείχνει την προεπιλογή του, δηλαδή ΑΛΛΟ ΜΕΡΟΣ.** Βρέθηκε
 * ζωντανά (στιγμιότυπο 2026-08-10): έξι σωστά σχήματα στη Θεσσαλονίκη, με τον χάρτη
 * καρφωμένο στην κεντρική Ελλάδα ⇒ **οθόνη που φαίνεται άδεια ενώ έχει αποτελέσματα**.
 * Είναι η ίδια οικογένεια σφάλματος με τη σιωπηλή εξαφάνιση της Α5: το να μην τα δείχνεις
 * και το να μην πας εκεί που είναι, καταλήγουν στην ίδια εντύπωση.
 */
function boundsOf(data: ReturnType<typeof listingsToGeoJson>): [[number, number], [number, number]] | null {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;

  for (const feature of data.features) {
    const coords: Array<[number, number]> = feature.geometry.type === 'Point'
      ? [feature.geometry.coordinates as [number, number]]
      : (feature.geometry.coordinates[0] as Array<[number, number]>);
    for (const [lng, lat] of coords) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }

  return Number.isFinite(west) ? [[west, south], [east, north]] : null;
}

export function ResultsMap({ listings, highlightedId, onSelect }: ResultsMapProps) {
  const data = useMemo(() => listingsToGeoJson(listings), [listings]);
  const bounds = useMemo(() => boundsOf(data), [data]);

  // `hsl(var(--chart-1))` δεν το καταλαβαίνει το MapLibre — θέλει συγκεκριμένο χρώμα.
  const mark = `hsl(${readRootCssVar('--chart-1', '210 80% 50%')})`;
  const surface = `hsl(${readRootCssVar('--card', '0 0% 100%')})`;

  /**
   * Το κλικ δένεται στα **επίπεδα**, όχι σε δείκτες DOM — γιατί δεν υπάρχουν δείκτες
   * DOM (βλ. `listings-geojson.ts`). Ο δεσμός χάρτη → λίστα είναι **η μισή** απαίτηση
   * της Α3· η άλλη μισή (λίστα → χάρτης) ζει στο `highlightedId`.
   */
  const handleMapReady = useCallback((map: MapInstance) => {
    const target = map as unknown as {
      on: (ev: string, layer: string, cb: (e: { features?: Array<{ properties?: Record<string, unknown> }> }) => void) => void;
      getCanvas: () => HTMLCanvasElement;
      fitBounds: (b: [[number, number], [number, number]], o?: Record<string, unknown>) => void;
    };

    // ⚠️ `padding` **υποχρεωτικό**: χωρίς αυτό μια πινέζα στην άκρη κάθεται πάνω στο
    // σύνορο και μοιάζει κομμένη· και `maxZoom`, γιατί ΕΝΑ αποτέλεσμα δίνει ορθογώνιο
    // μηδενικού εμβαδού — ο χάρτης θα ζουμάριζε σε επίπεδο δρόμου, ισχυρισμός
    // ακρίβειας που το ίδιο το σχήμα μπορεί να μην κάνει.
    if (bounds) target.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 0 });
    for (const layerId of CLICKABLE_LAYER_IDS) {
      target.on('click', layerId, (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === 'string') onSelect(id);
      });
      target.on('mouseenter', layerId, () => { target.getCanvas().style.cursor = 'pointer'; });
      target.on('mouseleave', layerId, () => { target.getCanvas().style.cursor = ''; });
    }
  }, [onSelect, bounds]);

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
      showStatusBar={false}
      showMapControls={false}
      className="h-full w-full"
      onMapReady={handleMapReady}
    >
      <Source id={SOURCE_ID} type="geojson" data={data}>
        {/* ΜΟΝΟ ΠΟΛΗ — σκιασμένη περιοχή. ΠΟΤΕ πινέζα (Α5). */}
        <Layer
          id="listing-city"
          type="circle"
          filter={['==', ['get', 'shape'], 'shaded-city']}
          paint={{ 'circle-radius': RADIUS.city, 'circle-color': mark, 'circle-opacity': 0.12,
                   'circle-stroke-width': 1, 'circle-stroke-color': mark, 'circle-stroke-opacity': 0.35 }}
        />
        {/* ΣΥΝΟΙΚΙΑ — μικρότερος σκιασμένος κύκλος (πρότυπο Airbnb). */}
        <Layer
          id="listing-neighbourhood"
          type="circle"
          filter={['==', ['get', 'shape'], 'shaded-circle']}
          paint={{ 'circle-radius': RADIUS.neighbourhood, 'circle-color': mark, 'circle-opacity': 0.18,
                   'circle-stroke-width': 1, 'circle-stroke-color': mark, 'circle-stroke-opacity': 0.5 }}
        />
        {/* ΜΕΤΡΗΜΕΝΟ ΠΕΡΙΓΡΑΜΜΑ — πραγματικό σχήμα, γεμάτο + περίγραμμα. */}
        <Layer
          id="listing-outline-fill"
          type="fill"
          filter={['==', ['get', 'shape'], 'outline']}
          paint={{ 'fill-color': mark, 'fill-opacity': 0.3 }}
        />
        <Layer
          id="listing-outline-line"
          type="line"
          filter={['==', ['get', 'shape'], 'outline']}
          paint={{ 'line-color': mark, 'line-width': 2 }}
        />
        {/* ΔΡΟΜΟΣ ΧΩΡΙΣ ΑΡΙΘΜΟ — πινέζα με ΔΑΚΤΥΛΙΟ: κενό κέντρο, παχύ περίγραμμα. */}
        <Layer
          id="listing-pin-ring"
          type="circle"
          filter={['==', ['get', 'shape'], 'pin-with-ring']}
          paint={{ 'circle-radius': RADIUS.ring, 'circle-color': surface, 'circle-opacity': 1,
                   'circle-stroke-width': 3, 'circle-stroke-color': mark }}
        />
        {/* ΑΚΡΙΒΗΣ ΔΙΕΥΘΥΝΣΗ — συμπαγής πινέζα. */}
        <Layer
          id="listing-pin"
          type="circle"
          filter={['==', ['get', 'shape'], 'pin']}
          paint={{ 'circle-radius': RADIUS.pin, 'circle-color': mark, 'circle-opacity': 1,
                   'circle-stroke-width': 2, 'circle-stroke-color': surface }}
        />
        {/*
          Η ΕΠΙΣΗΜΑΝΣΗ από τη λίστα — δακτύλιος ΓΥΡΩ από το σχήμα, ποτέ αλλαγή του
          σχήματος: η επισήμανση είναι «ποιο κοιτάς», η ακρίβεια είναι «τι ξέρουμε».
          Δύο ερωτήματα, δύο κανάλια — αλλιώς το hover θα έλεγε ψέματα για τη γνώση μας.
        */}
        <Layer
          id="listing-highlight"
          type="circle"
          filter={['==', ['get', 'id'], highlightedId ?? ' ']}
          paint={{ 'circle-radius': RADIUS.pin + 8, 'circle-color': mark, 'circle-opacity': 0,
                   'circle-stroke-width': 2, 'circle-stroke-color': mark, 'circle-stroke-opacity': 0.9 }}
        />
      </Source>
    </InteractiveMap>
    </PolygonSystemProvider>
  );
}

