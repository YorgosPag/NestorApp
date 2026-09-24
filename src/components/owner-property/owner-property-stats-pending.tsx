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

/**
 * 📐 **Η ΓΕΩΜΕΤΡΙΑ ΤΩΝ ΠΛΑΚΙΔΙΩΝ ΤΗΣ ΚΑΡΤΑΣ — ΜΙΑ, για σκελετό ΚΑΙ τιμές** (ADR-777 §8.74.7).
 *
 * 🔴 Μετρημένο σε browser (2026-09-24): η γραμμή ήταν κείμενο που **αναδιπλωνόταν** — 1 γραμμή ο σκελετός,
 * **3** γραμμές οι τιμές (το «Νέα μέτρηση — …» + η 4η μετρική της §8.74) ⇒ CLS 0,0012 στο `/offers/[id]`.
 * Κανένα «ύψος στο περίπου» δεν το λύνει, γιατί οι γραμμές εξαρτώνται από κείμενο **και** πλάτος.
 * Θεραπεία = πλακίδια (Zillow «Views · Saves · Contacts», idealista «Visitas · Contactos · Favoritos»):
 * **σταθερός** αριθμός πλακιδίων · **σταθερές** γραμμές, `truncate` · το **ίδιο** πλέγμα. Ό,τι στήλες κι αν
 * χωρέσουν, τις ίδιες βλέπουν σκελετός και τιμές ⇒ **CLS 0 εκ κατασκευής**, σε κάθε πλάτος.
 */
export const CARD_KPI_GRID = 'grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-2';
/** Προβολές · επαφές · αποθηκεύσεις · ημέρες στην αγορά. */
export const CARD_KPI_COUNT = 4;
export const CARD_KPI_TILE = 'flex min-w-0 flex-col gap-0.5 rounded-md border border-border px-2 py-1.5';
/** Κάθε γραμμή έχει **δηλωμένο** ύψος: το περιεχόμενο δεν μπορεί να το αλλάξει (`truncate`, όχι αναδίπλωση). */
export const CARD_KPI_LINE = {
  label: 'block h-4 truncate text-xs leading-4',
  value: 'block h-6 truncate text-base leading-6',
  detail: 'block h-4 truncate text-xs leading-4',
} as const;

/** Η γραμμή της κάρτας — `loading` του ορίου **και** κατάσταση «δεν γέμισε ακόμη το namespace». */
export function StatsRowPending(): React.ReactElement {
  return (
    <span aria-hidden className={CARD_KPI_GRID}>
      {Array.from({ length: CARD_KPI_COUNT }, (_, index) => (
        <span key={index} className={CARD_KPI_TILE}>
          <span className={CARD_KPI_LINE.label}><span className={cn(BLOCK, 'h-3 w-16')} /></span>
          <span className={cn(CARD_KPI_LINE.value, 'py-1')}><span className={cn(BLOCK, 'h-4 w-10')} /></span>
          <span className={CARD_KPI_LINE.detail}><span className={cn(BLOCK, 'h-3 w-20')} /></span>
        </span>
      ))}
    </span>
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

/** Οι τρεις ζώνες του `OwnerPropertyStatsChart` — `loading` του `next/dynamic` και μέρος του σκελετού του πίνακα. */
export function StatsChartPending(): React.ReactElement {
  return (
    <span aria-hidden className="flex flex-col gap-6">
      <BandPending size="sm" />
      <BandPending size="strip" />
      <BandPending size="strip" captioned />
    </span>
  );
}

/**
 * **Το πλέγμα των δεικτών — ΜΙΑ σταθερά για πίνακα ΚΑΙ σκελετό.** Όταν ήταν δύο αντίγραφα, ένας
 * πέμπτος δείκτης (§8.74) θα άλλαζε το ένα και όχι το άλλο ⇒ ο σκελετός θα είχε άλλο ύψος από τον
 * πίνακα, δηλαδή ακριβώς το CLS που μετρήθηκε και διορθώθηκε στο §8.72.8.
 */
export const STATS_KPI_GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5';

/** Πόσοι δείκτες — προβολές · επαφές · επαφές/1.000 · αποθηκεύσεις · ημέρες στην αγορά. */
export const STATS_KPI_COUNT = 5;

/** Το περιεχόμενο του πίνακα — κεφαλίδα · «Μετράμε από» · 5 δείκτες · γράφημα · εξέλιξη τιμής. */
export function StatsPanelSkeleton(): React.ReactElement {
  return (
    <>
      <span aria-hidden className="flex items-center justify-between gap-2">
        <span className={cn(BLOCK, 'h-6 w-40')} />
        <span className={cn(BLOCK, 'h-9 w-44')} />
      </span>
      <span aria-hidden className={cn(BLOCK, 'h-10')} />
      <span aria-hidden className={STATS_KPI_GRID}>
        {Array.from({ length: STATS_KPI_COUNT }, (_, index) => (
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
