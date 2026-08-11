'use client';

/**
 * @fileoverview **Ζ4 ΣΤΗ ΦΟΡΜΑ** — «*Μεγάλου Αλεξάνδρου, αλλά μόνο αυτό το κομμάτι της*».
 * @related ADR-777 · SPEC-777A §13.4 (ODbL) · components/geo/outline-draft.tsx
 * @module components/demand/form/DemandAreaOutline
 *
 * 🔑 **Καμία νέα μηχανή σχεδίασης**: ο ίδιος `useOutlineDraft` και ο ίδιος `PlaceMap`
 * που εξυπηρετούν τη χειρονομία `drawn` του §13.6. Μία επιφάνεια, δύο ερωτήσεις
 * τομέα — και τα **ίδια** όρια εγκυρότητας, γιατί το σχήμα είναι σχήμα.
 *
 * ⚠️ **Το περίγραμμα εδώ είναι ΠΑΝΤΑ ανθρώπινο, και γι' αυτό επιτρέπεται να
 * αποθηκευτεί** (§13.4 · `DemandPlace.area`: *«προέλευση **πάντα** ανθρώπινη ⇒
 * επιτρέπεται αποθήκευση σχήματος· περίγραμμα αντλημένο από OSM δεν επιτρέπεται να
 * καταλήξει εδώ»*). Η διαδρομή είναι **δομικά** καθαρή: ο επιλογέας κτιρίου παράγει
 * `placeRef`, ποτέ `placeOutline` — δεν υπάρχει καλώδιο από το OSM προς αυτό το πεδίο.
 */

import React, { useEffect } from 'react';

import { PlaceMap } from '@/components/geo/PlaceMap';
import { OutlineDraftControls, useOutlineDraft } from '@/components/geo/outline-draft';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { vertexCentroid } from '@/lib/geo/geo-ring';
import type { GeoOutline } from '@/types/geo/coordinates';

const NS = 'search-results';

export interface DemandAreaOutlineProps {
  readonly outline: GeoOutline | null;
  readonly onDrawn: (outline: GeoOutline | null) => void;
}

export function DemandAreaOutline({
  outline,
  onDrawn,
}: DemandAreaOutlineProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const draft = useOutlineDraft(outline);

  /**
   * ⚠️ **Ανεβάζει `null` όσο το σχήμα δεν είναι έγκυρο**, και αυτό είναι ο μηχανισμός
   * που κρατά τον φραγμό υποβολής (`area-not-drawn`) **αληθινό**: αν ανέβαινε το
   * ημιτελές σχέδιο, η φόρμα θα νόμιζε ότι έχει περιοχή ενώ ο άνθρωπος έχει δύο
   * κορυφές.
   */
  useEffect(() => {
    onDrawn(draft.outline);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ο γονέας κρατά νέα ταυτότητα callback ανά απόδοση
  }, [draft.outline]);

  const center =
    draft.vertices.length > 0
      ? vertexCentroid(draft.vertices)
      : { lat: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE, lng: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE };

  return (
    <section className="space-y-2">
      <p className="text-sm text-muted-foreground">{t(`${NS}:place.modeHint.draw`)}</p>
      <PlaceMap
        center={center}
        onPick={draft.addVertex}
        trace={draft.vertices}
        outline={draft.outline}
      />
      <p className="text-xs text-muted-foreground">{t(`${NS}:place.attribution`)}</p>
      <OutlineDraftControls draft={draft} />
    </section>
  );
}
