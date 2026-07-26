'use client';

/**
 * @module ui/chart-card
 * @enterprise ADR-710 — Chart card shell (SSoT).
 *
 * The one shell a chart with a plot is rendered in. Import `ChartCard` and compose;
 * do not import `ResponsiveContainer` from `recharts` directly — that bypasses the
 * theming, the legend, the empty state and the data table all at once, which is how
 * the codebase ended up with 28 files each drawing its own card.
 *
 * Two levels, same slots: **`ChartCard`** when the chart owns its section, **`ChartPlot`**
 * when the enclosing region already draws the card and spends the heading (`ReportSection`
 * does, in 58 places). Picking wrong is not a judgement call — `ChartCard` throws and
 * names the fix. See `surface-context.tsx`.
 *
 * @see chart-card-series.ts — the single series declaration, and the measured palette
 */

export { ChartCard, type ChartCardProps } from './ChartCard';
export { ChartPlot, type ChartPlotProps } from './ChartPlot';
export { ChartCardHeader, type ChartCardHeaderProps } from './ChartCardHeader';
export {
  ChartCardFigure,
  type ChartCardFigureProps,
  type ChartCardFigureSize,
} from './ChartCardFigure';
export { ChartCardDataTable, type ChartCardDataTableProps } from './ChartCardDataTable';
export { ChartCardTooltip, type ChartCardTooltipProps } from './ChartCardTooltip';
export {
  ChartCardSummary,
  ChartCardSummaryItem,
  type ChartCardSummaryProps,
  type ChartCardSummaryItemProps,
} from './ChartCardSummary';

export { ChartCardEditor } from './editor/ChartCardEditor';
export {
  useEntrySubmit,
  type UseEntrySubmitOptions,
  type UseEntrySubmitResult,
} from './editor/use-entry-submit';
export {
  useRepeatingRows,
  type UseRepeatingRowsOptions,
  type UseRepeatingRowsResult,
} from './editor/use-repeating-rows';

export {
  CHART_BAR_RADIUS,
  CHART_POLARITY_COLORS,
  CHART_SERIES_LIMIT,
  CHART_SERIES_PALETTE,
  CHART_STACK_SPACER,
  CHART_STATUS_RAMP,
  chartPolarityColor,
  chartPolarityTone,
  chartSeriesColor,
  seriesColorVar,
  toChartConfig,
  type ChartPolarity,
  type ChartSeries,
  type ChartSeriesDescriptor,
  type ChartTone,
} from './chart-card-series';

export { useChartCard, type ChartCardContextValue } from './chart-card-context';
