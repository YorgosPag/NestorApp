'use client';

/**
 * @module chart-card/ChartCard
 * @enterprise ADR-710 — The card shell every chart that owns its section is rendered in.
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
 * ## This file is one line of behaviour
 *
 * Everything above is implemented by {@link ChartPlot}. `ChartCard` adds the frame and
 * refuses to nest — see `surface-context.tsx` for why that refusal is a throw rather
 * than a silent degrade, and `ChartPlot.tsx` for why the frame is a separate level of
 * composition rather than a `frame` prop.
 *
 * If the enclosing region already draws a card and spends a heading — `ReportSection`
 * does, in 58 places — reach for `ChartPlot` instead. The throw will say so.
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

import { Card, CardContent } from '@/components/ui/card';
import { assertOutsideSurface, useIsInsideSurface } from '@/components/ui/surface-context';
import { ChartPlotRoot, CHART_SHELL_SLOTS, type ChartPlotProps } from './ChartPlot';

/** Identical to {@link ChartPlotProps} — the frame adds no configuration of its own. */
export type ChartCardProps<TDatum extends object> = ChartPlotProps<TDatum>;

function ChartCardRoot<TDatum extends object>(props: ChartCardProps<TDatum>) {
  const isNested = useIsInsideSurface();
  if (isNested) {
    assertOutsideSurface('ChartCard', 'ChartPlot');
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <ChartPlotRoot {...props} />
      </CardContent>
    </Card>
  );
}

/**
 * Slots are attached to the root so a call-site reads as one structure. They are the
 * same components exported individually from the barrel, and the same object `ChartPlot`
 * carries — attaching them adds a spelling, not a second implementation.
 */
export const ChartCard = Object.assign(ChartCardRoot, CHART_SHELL_SLOTS);
