'use client';

/**
 * @fileoverview **Η ΓΡΑΜΜΗ ΤΑΣΗΣ ΜΙΑΣ ΔΙΑΜΕΣΟΥ** — διάμεσος + μεσαίο 50% ανά περίοδο. **Ένα** γράφημα για δύο πηγές:
 * τρίμηνα τιμών συμβολαίου (ADR-889 Φ2) και μήνες ζητούμενων τιμών (ADR-890 §13).
 * @related components/ui/chart-card (ADR-710 — το ΕΝΑ κέλυφος γραφήματος) · `area-contracts-view.ts` ·
 *   `area-market-insight-view.ts`
 * @module components/area-market/MarketTrendChart
 *
 * 🔑 **ΤΟ ΚΕΝΟ ΜΕΝΕΙ ΚΕΝΟ.** Περίοδος κάτω από το κατώφλι έχει `null` (όχι μηδέν, όχι παρεμβολή) και η γραμμή **δεν**
 * τη γεφυρώνει (`connectNulls={false}`). Μια γραμμή που ενώνει δύο αξιόπιστα σημεία πάνω από ένα αναξιόπιστο θα
 * υπονοούσε συνέχεια που δεν μετρήθηκε. Ο πίνακας δεδομένων του κελύφους λέει το ίδιο με παύλα.
 *
 * 🔑 **Μία περίοδος ανά χρήση** (`quarter` · `month`) — γενίκευση του `ContractTrendChart` (ADR-890 §13), όχι δεύτερο
 * γράφημα. Ετικέτες, τίτλος και λεζάντα λύνονται **εδώ μέσα**, πίσω από το `next/dynamic`: έτσι τα κλειδιά τους
 * **δεν** μπαίνουν στο route slice του πρώτου καρέ (CHECK 3.34 — μετρήθηκε ότι αλλιώς θα έμπαιναν).
 *
 * ⚡ Default export: φορτώνεται **μόνο** με `next/dynamic` — το recharts δεν μπαίνει στο αρχικό bundle της
 * δημόσιας σελίδας περιοχής (SEO, ADR-890 §5.5).
 */

import React, { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { ChartCardFigure, ChartCardHeader, ChartCardTooltip, ChartPlot, seriesColorVar, type ChartSeries } from '@/components/ui/chart-card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarMonth } from '@/lib/intl-formatting';
import { isReportedStatCell, MARKET_STAT_MIN_SAMPLE, type StatCell } from '@/lib/market/market-statistics';

const NS = 'market-contracts';
const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const;
const MUTED = 'hsl(var(--muted-foreground))';

/** Τρίμηνο (`YYYY-Qn`, συμβόλαια) ή μήνας (`YYYY-MM`, ζητούμενες). */
type MarketTrendPeriod = 'quarter' | 'month';

/** Ένα σημείο: η περίοδος (`YYYY-Qn` ή `YYYY-MM`) και το κελί της. */
interface MarketTrendPoint {
  readonly period: string;
  readonly cell: StatCell;
}

interface TrendDatum {
  readonly period: string;
  readonly median: number | null;
  readonly p25: number | null;
  readonly p75: number | null;
}

interface MarketTrendChartProps {
  readonly period: MarketTrendPeriod;
  readonly points: readonly MarketTrendPoint[];
  /** Ποσό μονάδας → κείμενο με μονάδα (π.χ. «2.450 €/m²»). */
  readonly formatPrice: (amount: number) => string;
}

function toDatum(point: MarketTrendPoint, label: string): TrendDatum {
  const cell = isReportedStatCell(point.cell) ? point.cell : null;
  return { period: label, median: cell?.median ?? null, p25: cell?.p25 ?? null, p75: cell?.p75 ?? null };
}

export default function MarketTrendChart({ period, points, formatPrice }: MarketTrendChartProps): React.ReactElement {
  const { t } = useTranslation([NS, 'area-market']);
  const data = useMemo(
    () => points.map((point) => toDatum(point, period === 'month'
      ? formatCalendarMonth(point.period, undefined, 'short')
      : t(`${NS}:trend.quarter`, { quarter: Number(point.period.slice(6)), year: Number(point.period.slice(0, 4)) }))),
    [period, points, t],
  );
  const title = period === 'month' ? t('area-market:trend.title') : t(`${NS}:trend.title`);
  const caption = period === 'month'
    ? t('area-market:trend.gaps', { min: MARKET_STAT_MIN_SAMPLE })
    : t(`${NS}:trend.gaps`, { min: MARKET_STAT_MIN_SAMPLE });
  const series = useMemo<readonly ChartSeries<TrendDatum>[]>(
    () => [
      { key: 'median', label: t(`${NS}:trend.median`) },
      { key: 'p25', label: t(`${NS}:trend.p25`), description: t(`${NS}:trend.range`), color: MUTED },
      { key: 'p75', label: t(`${NS}:trend.p75`), description: t(`${NS}:trend.range`), color: MUTED },
    ],
    [t],
  );

  return (
    <ChartPlot series={series} data={data} categoryKey="period" categoryLabel={title} formatValue={formatPrice}>
      <ChartCardHeader title={title} />
      <ChartCardFigure size="sm" caption={caption}>
        <LineChart data={[...data]} margin={CHART_MARGIN}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="period" tickLine={false} minTickGap={16} />
          <YAxis tickFormatter={formatPrice} tickLine={false} axisLine={false} width={72} />
          <ChartCardTooltip />
          <Line dataKey="p75" stroke={MUTED} strokeDasharray="4 4" dot={false} connectNulls={false} isAnimationActive={false} />
          <Line dataKey="p25" stroke={MUTED} strokeDasharray="4 4" dot={false} connectNulls={false} isAnimationActive={false} />
          <Line dataKey="median" stroke={seriesColorVar('median')} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ChartCardFigure>
    </ChartPlot>
  );
}
