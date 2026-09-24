'use client';

/**
 * @fileoverview **Χωρίς φωτογραφία: ο χάρτης της θέσης — ή η ΔΗΛΩΜΕΝΗ απουσία.** Ένα σχήμα, δύο κάρτες.
 * @related ADR-777 §8.70 (Φάση 2) · §8.80 · owner-property/OwnerPropertyCardCover · search-results/ListingCardCover
 * @module components/listing-map-snapshot/MapOrAbsenceCover
 *
 * 🔑 **Εξήχθη όταν απέκτησε δεύτερο καταναλωτή** (N.0.2 · N.18): η κάρτα «Τα ακίνητά μου» (§8.70) και η
 * κάρτα αποτελεσμάτων (§8.80). Δύο αντίγραφα θα σήμαιναν δύο αποφάσεις για το ίδιο ερώτημα —
 * «τι δείχνω όταν δεν υπάρχει φωτογραφία;» — και θα απέκλιναν την πρώτη μέρα.
 *
 * ⛔ **Η ΑΠΟΥΣΙΑ ΔΕΝ ΓΕΜΙΖΕΙ ΜΕ ΞΕΝΗ ΕΙΚΟΝΑ** (§25.5.2): ο χάρτης **δεν** είναι «ενδεικτική εικόνα» —
 * είναι **πραγματική** πληροφορία αυτής της αγγελίας, με το ίδιο σχήμα ακρίβειας που βλέπει ο
 * επισκέπτης (πινέζα · δακτύλιος · σκιασμένη περιοχή). Χωρίς σημάδι, χωρίς provider ή σε αποτυχία, το
 * πλαίσιο **λέει** την κατάσταση με κείμενο — κανένα εικονίδιο σπιτιού.
 *
 * 🔑 **Το πλαίσιο είναι ΙΔΙΟ σε όλες τις καταστάσεις** (φωτογραφία · χάρτης · απουσία): η κάρτα χωρίς
 * φωτογραφία έχει το ύψος της κάρτας με φωτογραφία, και το πλέγμα δεν γίνεται σκαλοπάτια.
 */

import React from 'react';

import type { ListingMapMark } from '@/lib/listings/listing-map-mark';

import { ListingMapSnapshot } from './ListingMapSnapshot';

interface MapOrAbsenceCoverProps {
  /** `null` ⇒ η αγγελία δεν έχει δημόσιο σημάδι: κατευθείαν η δηλωμένη απουσία. */
  readonly mark: ListingMapMark | null;
  /** Το κουτί (αναλογία, πλάτος, στρογγύλεμα) — ίδιο με το πλαίσιο της φωτογραφίας. */
  readonly frameClassName: string;
  /** Το alt του χάρτη — λέει **τίνος** θέση δείχνει. */
  readonly mapAlt: string;
  /** Το κείμενο φόρτωσης του χάρτη για αναγνώστη οθόνης. */
  readonly mapLoadingLabel: string;
  /** Η λεζάντα της απουσίας («Χωρίς φωτογραφία»). */
  readonly absenceLabel: string;
  /** Προαιρετική θεραπεία κάτω από τη λεζάντα της απουσίας (π.χ. «Πρόσθεσε φωτογραφίες»). */
  readonly absenceAction?: React.ReactNode;
  /** Προαιρετική επικάλυψη πάνω στον χάρτη. */
  readonly mapOverlay?: React.ReactNode;
}

export function MapOrAbsenceCover({
  mark,
  frameClassName,
  mapAlt,
  mapLoadingLabel,
  absenceLabel,
  absenceAction,
  mapOverlay,
}: MapOrAbsenceCoverProps): React.ReactElement {
  const absence = (
    <figure
      className={`${frameClassName} m-0 flex flex-col items-center justify-center gap-2 border border-dashed border-border p-3 text-center`}
    >
      <figcaption className="text-xs text-muted-foreground">{absenceLabel}</figcaption>
      {absenceAction}
    </figure>
  );
  if (mark === null) return absence;

  return (
    <ListingMapSnapshot
      mark={mark}
      alt={mapAlt}
      className={frameClassName}
      fallback={absence}
      loadingLabel={mapLoadingLabel}
    >
      {mapOverlay}
    </ListingMapSnapshot>
  );
}
