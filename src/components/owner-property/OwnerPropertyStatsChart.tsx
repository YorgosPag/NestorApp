'use client';

/**
 * @fileoverview **ΠΡΟΒΟΛΕΣ ΚΑΙ ΕΠΑΦΕΣ ΑΝΑ ΗΜΕΡΑ — ΔΥΟ ΖΩΝΕΣ, ΕΝΑΣ ΧΡΟΝΟΣ** (ADR-777 §8.72 Φάση 2).
 * @related components/ui/chart-card (ADR-710 — το ΕΝΑ κέλυφος γραφήματος) · lib/listings/listing-stats-view.ts
 * @module components/owner-property/OwnerPropertyStatsChart
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΔΥΟ ΓΡΑΦΗΜΑΤΑ ΚΑΙ ΟΧΙ ΕΝΑ ΜΕ ΔΥΟ ΑΞΟΝΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι προβολές είναι δεκάδες την ημέρα, οι επαφές μονάδες. Σε **κοινό** άξονα οι επαφές δεν
 * φαίνονται· με **δεύτερο** άξονα y το μάτι συγκρίνει ύψη που δεν συγκρίνονται (το λάθος νούμερο
 * ένα των γραφημάτων). ⇒ **Small multiples**: κάθε μέγεθος στη δική του ζώνη, στον **ίδιο** άξονα
 * χρόνου, με συγχρονισμένο σταυρόνημα (`syncId`) — ο κέρσορας σε μια μέρα φωτίζει και τις δύο.
 *
 * 🏆 **Τα γεγονότα τιμής πάνω στον χρόνο**: κάθετη γραμμή σε κάθε αλλαγή τιμής ή διάθεσης, και στις
 * δύο ζώνες. Το Rightmove σημειώνει τα δικά του γεγονότα (αναβάθμιση προβολής)· εδώ σημειώνεται η
 * απόφαση του **κατόχου**, ώστε η αιτία να κάθεται δίπλα στο αποτέλεσμα.
 *
 * ⚠️ **Πριν από το `countingSince` δεν υπάρχει μηδέν**: οι γραμμές έχουν `null` (το recharts δεν
 * σχεδιάζει ράβδο) και η περιοχή σκιάζεται ως «χωρίς μέτρηση». Ο πίνακας δεδομένων του κελύφους
 * λέει το ίδιο με παύλα.
 *
 * ⚡ Default export: φορτώνεται **μόνο** με `next/dynamic` από τον πίνακα — το recharts δεν μπαίνει
 * στο αρχικό bundle της σελίδας.
 */

import React, { useId, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts';

import {
  CHART_BAR_RADIUS,
  ChartCardFigure,
  ChartCardHeader,
  ChartCardTooltip,
  ChartPlot,
  seriesColorVar,
  type ChartCardFigureSize,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay, formatNumber } from '@/lib/intl-formatting';
import type { ListingPriceEvent, ListingStatsDay } from '@/lib/listings/listing-stats-view';

const S = 'property-market:offer.stats';

const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const;
const MUTED = 'hsl(var(--muted-foreground))';
const NOT_COUNTED_FILL = 'hsl(var(--muted))';

const formatCount = (value: number): string => formatNumber(value, { maximumFractionDigits: 0 });
const formatDay = (value: unknown): string => formatCalendarDay(String(value));

type SeriesKey = 'views' | 'contacts';

/** Η τελευταία **μη** μετρημένη ημέρα του εύρους — ή `null` αν μετράμε όλο το εύρος. */
function lastUncountedDay(days: readonly ListingStatsDay[]): string | null {
  let last: string | null = null;
  for (const day of days) {
    if (day.views !== null || day.contacts !== null) break;
    last = day.day;
  }
  return last;
}

interface BandProps {
  readonly seriesKey: SeriesKey;
  readonly days: readonly ListingStatsDay[];
  readonly events: readonly ListingPriceEvent[];
  readonly syncId: string;
  readonly size: ChartCardFigureSize;
  readonly caption?: string;
}

/** **Μία ζώνη** — ράβδοι ανά ημέρα, σκίαση «χωρίς μέτρηση», γραμμές γεγονότων. */
function StatsBand({ seriesKey, days, events, syncId, size, caption }: BandProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const series = useMemo<readonly ChartSeries<ListingStatsDay>[]>(
    () => [{ key: seriesKey, label: t(`${S}.chart.${seriesKey}Series`) }],
    [seriesKey, t],
  );
  const firstDay = days[0]?.day;
  const uncountedUntil = lastUncountedDay(days);

  return (
    <ChartPlot
      series={series}
      data={days}
      categoryKey="day"
      categoryLabel={t(`${S}.chart.day`)}
      formatValue={formatCount}
      formatCategory={formatDay}
    >
      <ChartCardHeader title={t(`${S}.chart.${seriesKey}Title`)} />
      <ChartCardFigure size={size} caption={caption} emptyMessage={t(`${S}.chart.empty`)}>
        <BarChart data={[...days]} syncId={syncId} margin={CHART_MARGIN}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="day" tickFormatter={formatDay} tickLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tickFormatter={formatCount} tickLine={false} axisLine={false} width={40} />
          <ChartCardTooltip />
          {uncountedUntil !== null && firstDay !== undefined && (
            <ReferenceArea
              x1={firstDay}
              x2={uncountedUntil}
              fill={NOT_COUNTED_FILL}
              fillOpacity={0.6}
              ifOverflow="extendDomain"
            />
          )}
          {events.map((event) => (
            <ReferenceLine key={`${event.day}-${event.kind}`} x={event.day} stroke={MUTED} strokeDasharray="4 4" />
          ))}
          <Bar dataKey={seriesKey} fill={seriesColorVar(seriesKey)} radius={CHART_BAR_RADIUS} isAnimationActive={false} />
        </BarChart>
      </ChartCardFigure>
    </ChartPlot>
  );
}

export interface OwnerPropertyStatsChartProps {
  readonly days: readonly ListingStatsDay[];
  readonly events: readonly ListingPriceEvent[];
}

export default function OwnerPropertyStatsChart({ days, events }: OwnerPropertyStatsChartProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  // Ένα `syncId` ανά ζεύγος: δύο πίνακες στην ίδια σελίδα δεν μοιράζονται ποτέ σταυρόνημα.
  const syncId = `listing-stats-${useId().replace(/:/g, '')}`;

  return (
    <section className="flex flex-col gap-6">
      <StatsBand seriesKey="views" days={days} events={events} syncId={syncId} size="sm" />
      <StatsBand
        seriesKey="contacts"
        days={days}
        events={events}
        syncId={syncId}
        size="strip"
        caption={t(`${S}.chart.caption`)}
      />
    </section>
  );
}
