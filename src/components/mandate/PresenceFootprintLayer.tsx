'use client';

/**
 * @fileoverview **ΔΗΛΩΣΗ ‖ ΑΠΟΔΕΙΞΗ ΣΤΟΝ ΧΑΡΤΗ** — πού έχει **ενεργές αγγελίες** ο επαγγελματίας που κοιτάς (ADR-896 §7.3).
 * @related CoverageFootprintLayer (η δήλωση, δίπλα) · lib/agency/showcase-map.ts (`presenceFootprintGeoJson`) ·
 *   lib/agency/showcase-presence.ts (ADR-846 — ο παραγωγός)
 * @module components/mandate/PresenceFootprintLayer
 *
 * 🏆 **ΠΕΡΑ ΑΠΟ ΤΟ ZILLOW**: ο Zillow κατατάσσει με όγκο αποθέματος και **δεν λέει ποτέ** ποια πηγή έφερε τον πράκτορα.
 * Εδώ, δίπλα σε ό,τι **δήλωσε** ο επαγγελματίας, φαίνεται ό,τι **αποδεικνύεται** από τις αγγελίες του — και ο επισκέπτης
 * βλέπει με μια ματιά αν συμφωνούν.
 *
 * 🔑 **ΔΙΑΚΡΙΣΗ ΜΕ ΣΧΗΜΑ, ΟΧΙ ΜΕ ΧΡΩΜΑ** (CHECK 3.41): η δήλωση είναι **περιοχή** (γέμισμα + γραμμή· διακεκομμένη στο
 * hover)· η απόδειξη είναι **κουκκίδες** — σημειακό περίγραμμα χωρίς γέμισμα, και κύκλοι-σημεία. Ίδιο χρώμα, άλλη μορφή.
 *
 * 🔴 **ADR-846 Φ5δ**: ποτέ διεύρυνση, ποτέ αριθμός· η παρουσία **δεν** μπαίνει στη σειρά (άγκυρα
 * `agency-directory-order.test.ts`). Η κάμερα **δεν** κινείται γι' αυτήν — πετά μόνο στη δήλωση της επιλογής (§4.4).
 */

import React, { useMemo } from 'react';

import { Layer, Source } from '@/lib/maps/maplibre';
import { presenceFootprintGeoJson } from '@/lib/agency/showcase-map';
import { BELOW_LISTINGS } from '@/components/search-results/boundary-paint';
import { readListingMapPaint } from '@/components/search-results/listing-map-paint';
import type { GeoCircle } from '@/types/geo/coordinates';

/** Σημειακή γραμμή: παύλα μηδενικού μήκους + στρογγυλό άκρο = κουκκίδα. Μορφή, όχι χρώμα. */
const DOTTED = [0, 2];
const DOT_LINE_WIDTH = 2.5;
const DOT_RADIUS = 4;
const HALO_WIDTH = 1.5;

export function PresenceFootprintLayer({ presence }: { readonly presence: readonly GeoCircle[] }): React.ReactElement | null {
  const data = useMemo(() => presenceFootprintGeoJson(presence), [presence]);
  if (presence.length === 0) return null;

  const paint = readListingMapPaint();

  return (
    <Source id="presence-footprint" type="geojson" data={data}>
      <Layer
        id="presence-footprint-line"
        type="line"
        beforeId={BELOW_LISTINGS}
        filter={['==', ['geometry-type'], 'Polygon']}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': paint.mark, 'line-width': DOT_LINE_WIDTH, 'line-dasharray': DOTTED }}
      />
      <Layer
        id="presence-footprint-point"
        type="circle"
        beforeId={BELOW_LISTINGS}
        filter={['==', ['geometry-type'], 'Point']}
        paint={{
          'circle-radius': DOT_RADIUS,
          'circle-color': paint.mark,
          'circle-stroke-color': paint.surface,
          'circle-stroke-width': HALO_WIDTH,
        }}
      />
    </Source>
  );
}
