'use client';

/**
 * SpendAnalyticsChart — **η μία κάρτα** της οθόνης analytics προμηθειών.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ (μετρημένο 2026-08-01, ADR-742 §7quaterdecies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η μετανάστευση στο `<ChartCard>` (ADR-710) αφαίρεσε το πλαίσιο κάρτας, το
 * υπόμνημα και την κενή κατάσταση από πέντε αρχεία — και **αποκάλυψε** αυτό που
 * έμενε από κάτω: η ίδια δήλωση φλοιού, πέντε φορές. Το `jscpd:diff` βρήκε
 * **5 κλώνους**· η εξαγωγή των αξόνων τους έριξε σε **3**, και οι τρεις ήταν
 * το ίδιο πράγμα: *«σκελετός φόρτωσης → section → ChartCard → Header → Figure»*.
 *
 * 🔴 **Η κεντρικοποίηση γεννάει τον κλώνο** — όγδοη μετρημένη φορά στο ADR-742.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΓΙΑΤΙ ΑΥΤΟ ΔΕΝ ΕΙΝΑΙ Η ΠΑΓΙΔΑ ΤΗΣ ΥΠΕΡ-ΠΑΡΑΜΕΤΡΟΠΟΙΗΜΕΝΗΣ FABRIQUE
 * ─────────────────────────────────────────────────────────────────────────────
 * Το ADR-698 τεκμηρίωσε ακριβώς την αντίθετη κίνηση ως **anti-pattern**:
 * fabrique που δέχεται **hooks** (`resolveShare`, `loadEntityHeader`, …), όπου
 * κάθε υλοποίηση hook ήταν ο ίδιος κώδικας με άλλο ουσιαστικό — δηλαδή η
 * διπλοτυπία απλώς μετακόμισε στο αντικείμενο ρυθμίσεων του καλούντα.
 *
 * Η λύση του ADR-698 ήταν **δευτεροτάξια fabrique που δέχεται ΔΕΔΟΜΕΝΑ**, και
 * αυτό είναι εδώ: κάθε prop είναι **τιμή** (τίτλος, μήνυμα, δήλωση σειρών), όχι
 * συνάρτηση που ξαναγράφει μηχανισμό. Η **μόνη** ανά-γράφημα μεταβλητότητα —
 * η σύνθεση recharts — περνά ως `children`, όπως ακριβώς το κάνει και το ίδιο
 * το `ChartCard`.
 *
 * 🔑 **Δεν υπάρχει prop `type`.** Ούτε `showLegend`, ούτε `showTooltip`: αυτά τα
 * αποφασίζει το shell από τη δήλωση σειρών. Αν κάποτε μπει boolean εδώ, αυτό
 * είναι το σήμα ότι το αρχείο ξαναγίνεται `ReportChart.tsx`.
 *
 * @module app/procurement/analytics/_components/SpendAnalyticsChart
 * @see ADR-710 (chart-card shell) · ADR-698 (δευτεροτάξια fabrique) · ADR-742 §7quaterdecies
 */

import type { ReactElement, ReactNode } from 'react';
import {
  ChartCard,
  type ChartCardFigureSize,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { KpiChartSkeleton } from '@/components/projects/procurement/overview/skeleton/KpiSkeleton';

export interface SpendAnalyticsChartProps<TDatum extends object> {
  /** Τίτλος της κάρτας — ήδη μεταφρασμένος. */
  readonly title: string;
  /** Μήνυμα όταν δεν υπάρχει τίποτα να σχεδιαστεί — ήδη μεταφρασμένο. */
  readonly emptyMessage: string;
  /** Οι σειρές, δηλωμένες μία φορά· οδηγούν θέμα, υπόμνημα, πίνακα και σήμανση. */
  readonly series: readonly ChartSeries<TDatum>[];
  /** Οι γραμμές, σε σειρά σχεδίασης. */
  readonly data: readonly TDatum[];
  /** Το πεδίο που ονομάζει την κατηγορία (x). */
  readonly categoryKey: Extract<keyof TDatum, string>;
  /** Επικεφαλίδα της στήλης κατηγορίας στον πίνακα δεδομένων. */
  readonly categoryLabel: string;
  /** Μορφοποίηση τιμής σειράς — άξονας, tooltip και πίνακας τη μοιράζονται. */
  readonly formatValue: (value: number) => string;
  /** Πρόταση κάτω από το γράφημα. */
  readonly caption?: string;
  /** Ονομασμένο βήμα ύψους. */
  readonly size?: ChartCardFigureSize;
  /**
   * Ο σκελετός φόρτωσης είναι **κατάσταση της κάρτας**, όχι της σελίδας: κάθε
   * γράφημα φορτώνει ανεξάρτητα από τα υπόλοιπα.
   */
  readonly isLoading: boolean;
  /** Πέρασμα από τη σελίδα (π.χ. `col-span-full`). */
  readonly className?: string;
  /** Χειριστήρια δίπλα στον τίτλο (επιλογέας έργου, εξαγωγή…). */
  readonly headerActions?: ReactNode;
  /** Η σύνθεση recharts — **η μόνη** ανά-γράφημα μεταβλητότητα. */
  readonly children: ReactElement;
}

export function SpendAnalyticsChart<TDatum extends object>({
  title,
  emptyMessage,
  series,
  data,
  categoryKey,
  categoryLabel,
  formatValue,
  caption,
  size,
  isLoading,
  className,
  headerActions,
  children,
}: SpendAnalyticsChartProps<TDatum>) {
  if (isLoading) return <KpiChartSkeleton />;

  return (
    <section className={className}>
      <ChartCard
        series={series}
        data={data}
        categoryKey={categoryKey}
        categoryLabel={categoryLabel}
        formatValue={formatValue}
      >
        <ChartCard.Header title={title}>{headerActions}</ChartCard.Header>
        <ChartCard.Figure caption={caption} emptyMessage={emptyMessage} size={size}>
          {children}
        </ChartCard.Figure>
      </ChartCard>
    </section>
  );
}
