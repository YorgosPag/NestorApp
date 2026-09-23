/**
 * @fileoverview **Οι χώροι των στατιστικών όσο δεν ξέρουμε τίποτα** — χωρίς κείμενο (ADR-777 §8.72).
 * @related OwnerPropertyStatsRow.tsx · OwnerPropertyStatsPanel.tsx · OwnerPropertyStatsChart.tsx ·
 *   OwnerPropertyCard.tsx · OwnerPropertyDetailContent.tsx · components/ui/chart-card/figure-height.ts
 * @module components/owner-property/owner-property-stats-pending
 *
 * 🔴 **ΓΙΑΤΙ ΔΙΚΟ ΤΟΥΣ ΑΡΧΕΙΟ**: η γραμμή και ο πίνακας ζουν πίσω από όριο `next/dynamic` (CHECK 3.34 Κ2),
 * ώστε τα κλειδιά τους να μη μπαίνουν στο route slice. Ο γεννήτορας ακολουθεί **στατικές** εισαγωγές ανά
 * αρχείο: αν η σελίδα εισήγαγε τον σκελετό από το αρχείο της γραμμής, θα ξανατραβούσε **όλα** τα κλειδιά
 * της — το όριο θα υπήρχε μόνο στο όνομα. Εδώ δεν υπάρχει ούτε μία κλήση `t()`.
 *
 * 📐 **Ο σκελετός έχει τη ΔΟΜΗ του τελικού, όχι ένα ύψος στο περίπου.** Ο πρώτος σκελετός ήταν ένα
 * `h-24` για πίνακα ~1.070px, και το «Φόρτωση…» μίας γραμμής τον μάζευε ακόμη πιο πολύ ⇒ μετρημένο
 * CLS 0,056 στη ζωντανή σελίδα (ADR-777 §8.72.8). Εδώ κάθε μπλοκ καθρεφτίζει ένα μπλοκ του πίνακα, και
 * τα ύψη των γραφημάτων διαβάζονται από τα **ίδια** ονομασμένα βήματα με το `ChartCardFigure`
 * (`CHART_FIGURE_HEIGHT` — αρχείο-φύλλο, χωρίς recharts). Μένει μόνο ο πίνακας τιμής, που έχει όσες
 * γραμμές έχει το ιστορικό και είναι τελευταίος — δεν σπρώχνει τίποτα μέσα στο πλαίσιο.
 */

import React from 'react';

import { CHART_FIGURE_HEIGHT, type ChartCardFigureSize } from '@/components/ui/chart-card/figure-height';
import { cn } from '@/lib/utils';

const BLOCK = 'block animate-pulse rounded bg-muted';

/** Η γραμμή της κάρτας — `loading` του ορίου **και** κατάσταση «δεν γέμισε ακόμη το namespace». */
export function StatsRowPending(): React.ReactElement {
  return (
    <p aria-hidden className="m-0 h-5">
      <span className={cn(BLOCK, 'h-4 w-48')} />
    </p>
  );
}

/** Μία ζώνη γραφήματος: τίτλος (`ChartCardHeader`) · σχέδιο · (λεζάντα) · «Προβολή ως πίνακα». */
function BandPending({ size, captioned = false }: { readonly size: ChartCardFigureSize; readonly captioned?: boolean }): React.ReactElement {
  return (
    <span className="flex flex-col">
      <span className={cn(BLOCK, 'mb-4 h-7 w-40')} />
      <span className={cn(BLOCK, 'rounded-md', CHART_FIGURE_HEIGHT[size])} />
      {captioned && <span className={cn(BLOCK, 'mt-2 h-10')} />}
      <span className={cn(BLOCK, 'mt-4 h-5 w-44')} />
    </span>
  );
}

/** Οι δύο ζώνες του `OwnerPropertyStatsChart` — `loading` του `next/dynamic` και μέρος του σκελετού του πίνακα. */
export function StatsChartPending(): React.ReactElement {
  return (
    <span aria-hidden className="flex flex-col gap-6">
      <BandPending size="sm" />
      <BandPending size="strip" captioned />
    </span>
  );
}

/** Το περιεχόμενο του πίνακα — κεφαλίδα · «Μετράμε από» · 4 δείκτες · γράφημα · εξέλιξη τιμής. */
export function StatsPanelSkeleton(): React.ReactElement {
  return (
    <>
      <span aria-hidden className="flex items-center justify-between gap-2">
        <span className={cn(BLOCK, 'h-6 w-40')} />
        <span className={cn(BLOCK, 'h-9 w-44')} />
      </span>
      <span aria-hidden className={cn(BLOCK, 'h-10')} />
      <span aria-hidden className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className={cn(BLOCK, 'h-40 rounded-md')} />
        ))}
      </span>
      <StatsChartPending />
      <span aria-hidden className={cn(BLOCK, 'h-12')} />
    </>
  );
}

/** Ο πίνακας της λεπτομέρειας πριν γεμίσει το namespace — ίδιο πλαίσιο και ίδια δομή με τον τελικό. */
export function StatsPanelPending(): React.ReactElement {
  return (
    <section aria-hidden className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
      <StatsPanelSkeleton />
    </section>
  );
}
