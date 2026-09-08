'use client';

/**
 * @fileoverview **Η ΧΑΡΑΓΜΕΝΗ ΠΕΡΙΟΧΗ, ΟΠΩΣ ΤΗ ΒΛΕΠΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ** — μόνο ανάγνωση.
 * @related ADR-846 Φάση 3 · components/geo/PlaceMap · types/agency-coverage
 * @module components/mandate/CoverageOutlineMap
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🏆 ΕΔΩ ΠΛΗΡΩΝΕΤΑΙ ΤΟ ΔΕΥΤΕΡΟ ΣΚΕΛΟΣ ΤΗΣ #6 — ΚΑΙ ΤΟ ΠΟΛΥΓΩΝΟ ΤΟ ΠΛΗΡΩΝΕΙ ΚΑΛΥΤΕΡΑ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Η απαγόρευση #6 του `types/agency-profile.ts` δεν έλεγε *«μεγάλο νούμερο»* — έλεγε
 * ότι ο ισχυρισμός εμβέλειας είναι **οπτικά αόρατος**. Η **ακτίνα** το πλήρωσε
 * γράφοντας «έως 30 χλμ» με λέξεις: μετάφραση αριθμού σε πρόταση.
 *
 * 🔑 **Το χαραγμένο σχήμα δεν χρειάζεται μετάφραση — δείχνεται.** Ο επισκέπτης βλέπει
 * **ακριβώς** ό,τι δήλωσε ο επαγγελματίας, στην ίδια μορφή που το δήλωσε. Ένα «~85
 * τ.χλμ.» από μόνο του θα ήταν χειρότερο από το «30 χλμ» της ακτίνας: εμβαδόν χωρίς
 * σχήμα δεν λέει **πού**.
 *
 * ⚠️ **ΜΟΝΟ ΑΝΑΓΝΩΣΗ — κανένα `onPick`.** Το ίδιο το `PlaceMap` το τεκμηριώνει: *«ένα
 * `onPick={() => {}}` θα ήταν χειριστήριο που δέχεται κλικ και τα πετά»*. Χωρίς αυτό, ο
 * δείκτης μένει προεπιλεγμένος και **δεν προσκαλείται κανείς να πατήσει**.
 *
 * ⚠️ **Η ΑΝΑΦΟΡΑ ΠΗΓΗΣ ΤΩΝ ΠΛΑΚΙΔΙΩΝ ΕΙΝΑΙ ΥΠΟΧΡΕΩΣΗ ΑΔΕΙΑΣ, ΟΧΙ ΔΙΑΚΟΣΜΗΣΗ**: το
 * `PlaceMap` ορίζει `attributionControl={false}` και **κάθε** καταναλωτής γράφει τη
 * γραμμή ο ίδιος *(`PlaceChooser` · `PlaceSummary` · `DemandAreaOutline`)*. Παράλειψή
 * της εδώ θα ήταν παράβαση σε **δημόσια** σελίδα — τη μόνη που βλέπουν ανώνυμοι.
 */

import React from 'react';

import { PlaceMap } from '@/components/geo/PlaceMap';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ringsFootprint } from '@/lib/geo/geo-footprint';
import { mapZoomForRadiusKm } from '@/lib/geo/geo-map-zoom';
import { vertexCentroid } from '@/lib/geo/geo-ring';
import type { GeoOutline } from '@/types/geo/coordinates';

/** Δεμένο με το `h-64` παρακάτω — δες `lib/geo/geo-map-zoom.ts`. */
const MAP_HEIGHT_PX = 256;

/** Το namespace της χάραξης — **εγγυημένο κέλυφος**, άρα το route slice δεν μεγαλώνει. */
const DRAW_NS = 'search-results';

export interface CoverageOutlineMapProps {
  readonly outline: GeoOutline;
}

export function CoverageOutlineMap({ outline }: CoverageOutlineMapProps): React.ReactElement {
  const { t } = useTranslation([DRAW_NS]);

  /**
   * 🔑 **Το ΙΔΙΟ αποτύπωμα που κρίνει ο κριτής δίνει και το ζουμ.** Το `center` του
   * αποτυπώματος **δεν υπόσχεται ότι είναι μέσα** στο σχήμα *(κοίλο σχήμα)*, αλλά για
   * κάμερα αυτό είναι αδιάφορο: ο περιγεγραμμένος κύκλος **περιέχει** το σχήμα, άρα ένα
   * ζουμ που τον χωράει το χωράει **ολόκληρο** — που είναι όλη η δουλειά εδώ.
   */
  const footprint = ringsFootprint([outline]);
  const centre = footprint?.center ?? vertexCentroid(outline);
  const zoom = mapZoomForRadiusKm(footprint?.outerKm ?? 0, MAP_HEIGHT_PX);

  return (
    <figure className="m-0 flex flex-col gap-1">
      <PlaceMap center={centre} outline={outline} heightClass="h-64" initialZoom={zoom} />
      <figcaption className="text-xs text-muted-foreground">
        {t(`${DRAW_NS}:place.attribution`)}
      </figcaption>
    </figure>
  );
}
