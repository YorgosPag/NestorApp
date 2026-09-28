'use client';

/**
 * @fileoverview **Η ΔΙΑΜΕΣΟΣ ΤΙΜΗ ΣΥΜΒΟΛΑΙΟΥ ΑΝΑ ΤΡΙΜΗΝΟ** — 8 τρίμηνα, με το μεσαίο 50% (ADR-889 §6 Φ2 · ADR-890 Φ2).
 * @related components/ui/chart-card (ADR-710 — το ΕΝΑ κέλυφος γραφήματος) · `area-contracts-view.ts`
 * @module components/area-market/ContractTrendChart
 *
 * 🔑 **ΤΟ ΚΕΝΟ ΜΕΝΕΙ ΚΕΝΟ.** Τρίμηνο κάτω από το κατώφλι έχει `null` (όχι μηδέν, όχι παρεμβολή) και η γραμμή
 * **δεν** το γεφυρώνει (`connectNulls={false}`). Μια γραμμή που ενώνει δύο αξιόπιστα σημεία πάνω από ένα
 * αναξιόπιστο θα υπονοούσε συνέχεια που δεν μετρήθηκε. Ο πίνακας δεδομένων του κελύφους λέει το ίδιο με παύλα.
 *
 * ⚡ Default export: φορτώνεται **μόνο** με `next/dynamic` — το recharts δεν μπαίνει στο αρχικό bundle της
 * δημόσιας σελίδας περιοχής (SEO, ADR-890 §5.5).
 */

import React, { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { ChartCardFigure, ChartCardHeader, ChartCardTooltip, ChartPlot, seriesColorVar, type ChartSeries } from '@/components/ui/chart-card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isReportedStatCell, MARKET_STAT_MIN_SAMPLE } from '@/lib/market/market-statistics';

import type { ContractTrendPoint } from './area-contracts-view';

const NS = 'market-contracts';
const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const;
const MUTED = 'hsl(var(--muted-foreground))';

interface TrendDatum {
  readonly quarter: string;
  readonly median: number | null;
  readonly p25: number | null;
  readonly p75: number | null;
}

export interface ContractTrendChartProps {
  readonly points: readonly ContractTrendPoint[];
  /** Ποσό μονάδας → κείμενο με μονάδα (π.χ. «2.450 €/m²»). */
  readonly formatPrice: (amount: number) => string;
}

function toDatum(point: ContractTrendPoint, label: string): TrendDatum {
  const cell = isReportedStatCell(point.cell) ? point.cell : null;
  return { quarter: label, median: cell?.median ?? null, p25: cell?.p25 ?? null, p75: cell?.p75 ?? null };
}

export default function ContractTrendChart({ points, formatPrice }: ContractTrendChartProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const data = useMemo(
    () => points.map((point) => toDatum(point, t(`${NS}:trend.quarter`, { quarter: point.q, year: point.year }))),
    [points, t],
  );
  const series = useMemo<readonly ChartSeries<TrendDatum>[]>(
    () => [
      { key: 'median', label: t(`${NS}:trend.median`) },
      { key: 'p25', label: t(`${NS}:trend.p25`), description: t(`${NS}:trend.range`), color: MUTED },
      { key: 'p75', label: t(`${NS}:trend.p75`), description: t(`${NS}:trend.range`), color: MUTED },
    ],
    [t],
  );

  return (
    <ChartPlot series={series} data={data} categoryKey="quarter" categoryLabel={t(`${NS}:trend.title`)} formatValue={formatPrice}>
      <ChartCardHeader title={t(`${NS}:trend.title`)} />
      <ChartCardFigure size="sm" caption={t(`${NS}:trend.gaps`, { min: MARKET_STAT_MIN_SAMPLE })}>
        <LineChart data={[...data]} margin={CHART_MARGIN}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="quarter" tickLine={false} minTickGap={16} />
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
