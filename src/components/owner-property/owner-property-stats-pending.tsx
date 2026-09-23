/**
 * @fileoverview **Οι χώροι των στατιστικών όσο δεν ξέρουμε τίποτα** — χωρίς κείμενο (ADR-777 §8.72).
 * @related OwnerPropertyStatsRow.tsx · OwnerPropertyStatsPanel.tsx · OwnerPropertyCard.tsx · OwnerPropertyDetailContent.tsx
 * @module components/owner-property/owner-property-stats-pending
 *
 * 🔴 **ΓΙΑΤΙ ΔΙΚΟ ΤΟΥΣ ΑΡΧΕΙΟ**: η γραμμή και ο πίνακας ζουν πίσω από όριο `next/dynamic` (CHECK 3.34 Κ2),
 * ώστε τα κλειδιά τους να μη μπαίνουν στο route slice. Ο γεννήτορας ακολουθεί **στατικές** εισαγωγές ανά
 * αρχείο: αν η σελίδα εισήγαγε τον σκελετό από το αρχείο της γραμμής, θα ξανατραβούσε **όλα** τα κλειδιά
 * της — το όριο θα υπήρχε μόνο στο όνομα. Εδώ δεν υπάρχει ούτε μία κλήση `t()`.
 *
 * Κάθε σκελετός έχει το **ύψος** του τελικού περιεχομένου: μηδέν μετατόπιση όταν φτάσουν οι αριθμοί.
 */

import React from 'react';

/** Η γραμμή της κάρτας — `loading` του ορίου **και** κατάσταση «δεν γέμισε ακόμη το namespace». */
export function StatsRowPending(): React.ReactElement {
  return (
    <p aria-hidden className="m-0 h-5">
      <span className="block h-4 w-48 animate-pulse rounded bg-muted" />
    </p>
  );
}

/** Ο πίνακας της λεπτομέρειας — ίδιο πλαίσιο με τον τελικό. */
export function StatsPanelPending(): React.ReactElement {
  return <p aria-hidden className="m-0 h-24 animate-pulse rounded-md border border-border bg-card" />;
}
