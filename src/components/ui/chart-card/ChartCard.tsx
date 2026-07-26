'use client';

/**
 * @module chart-card/ChartCard
 * @enterprise ADR-710 — The card shell every chart with a plot is rendered in.
 *
 * ## What this is, and what it deliberately is not
 *
 * It is a **compound** component: the root publishes a description of the data and
 * nothing else, and the slots (`Header`, `Figure`, `Summary`, `Editor`) supply
 * structure. Each chart passes its own recharts composition as children.
 *
 * It is **not** a type-driven wrapper. There is no `type: 'bar' | 'line' | …` prop
 * and consequently no switch that has to grow when a chart type is added — the shape
 * this project already has in `reports/core/ReportChart.tsx`, where five chart types
 * and ~15 optional booleans meet in one component. That shape moves the duplication
 * into the call-site's config object, where only a token-level clone detector can see
 * it (`reference_over_parameterised_factory_clone.md`, ADR-698/699/321).
 *
 * The rule this file is held to: **the shell never branches on who is calling it.**
 * Every decision it makes is read from the data description — a legend appears
 * because there are two series, not because a caller asked for one.
 *
 * ## The single declaration
 *
 * `series` is declared once per chart and drives four readers at once — theming,
 * legend, data table, and the marks themselves. See `chart-card-series.ts`.
 *
 * @example
 * <ChartCard
 *   series={[{ key: 'construction', label: t('maturity.construction') }]}
 *   data={chartData}
 *   categoryKey="year"
 *   categoryLabel={t('maturity.year')}
 *   formatValue={fmtEuro}
 * >
 *   <ChartCard.Header title={t('maturity.title')}>{addButton}</ChartCard.Header>
 *   <ChartCard.Figure emptyMessage={t('maturity.emptyState')} size="lg">
 *     <BarChart data={chartData}>…</BarChart>
 *   </ChartCard.Figure>
 * </ChartCard>
 */

import { useId, useMemo, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChartCardProvider, type ChartCardContextValue } from './chart-card-context';
import { toChartConfig, type ChartSeries } from './chart-card-series';
import { ChartCardHeader } from './ChartCardHeader';
import { ChartCardFigure } from './ChartCardFigure';
import { ChartCardSummary, ChartCardSummaryItem } from './ChartCardSummary';
import { ChartCardTooltip } from './ChartCardTooltip';
import { ChartCardEditor } from './editor/ChartCardEditor';

/** Default category renderer — years, labels and ids all read as their own text. */
function defaultFormatCategory(value: unknown): string {
  return value == null ? '' : String(value);
}

export interface ChartCardProps<TDatum extends object> {
  /** The plotted series, in canonical order. Declared once, read by four consumers. */
  readonly series: readonly ChartSeries<TDatum>[];
  /** The plotted rows, in plot order. */
  readonly data: readonly TDatum[];
  /** Field naming the category (x) of each datum. */
  readonly categoryKey: Extract<keyof TDatum, string>;
  /** Translated header for the category column of the data table. */
  readonly categoryLabel: string;
  /** Translated sentence explaining the category, shown on its column header. */
  readonly categoryDescription?: string;
  /** Renders a series value as text. Axis ticks, tooltip and table all use it. */
  readonly formatValue: (value: number) => string;
  /** Renders a category as text. Defaults to `String(value)`. */
  readonly formatCategory?: (value: unknown) => string;
  /** Header / figure / summary / editor slots. */
  readonly children: ReactNode;
}

function ChartCardRoot<TDatum extends object>({
  series,
  data,
  categoryKey,
  categoryLabel,
  categoryDescription,
  formatValue,
  formatCategory = defaultFormatCategory,
  children,
}: ChartCardProps<TDatum>) {
  const generatedId = useId();
  const cardId = `chart-card-${generatedId.replace(/:/g, '')}`;

  const value = useMemo<ChartCardContextValue>(
    () => ({
      cardId,
      series,
      data,
      categoryKey,
      categoryLabel,
      categoryDescription,
      formatValue,
      formatCategory,
      config: toChartConfig(series),
    }),
    [
      cardId,
      series,
      data,
      categoryKey,
      categoryLabel,
      categoryDescription,
      formatValue,
      formatCategory,
    ],
  );

  return (
    <ChartCardProvider value={value}>
      <Card>
        <CardContent className="pt-6">
          <section aria-labelledby={`${cardId}-title`}>{children}</section>
        </CardContent>
      </Card>
    </ChartCardProvider>
  );
}

/**
 * Slots are attached to the root so a call-site reads as one structure. They are the
 * same components exported individually from the barrel — attaching them adds a
 * spelling, not a second implementation.
 */
export const ChartCard = Object.assign(ChartCardRoot, {
  Header: ChartCardHeader,
  Figure: ChartCardFigure,
  Tooltip: ChartCardTooltip,
  Summary: ChartCardSummary,
  SummaryItem: ChartCardSummaryItem,
  Editor: ChartCardEditor,
});
