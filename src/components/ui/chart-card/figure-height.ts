/**
 * @module chart-card/figure-height
 * @enterprise ADR-710 — The plot height steps, as a leaf module.
 *
 * Plot heights. Named steps, not free numbers, so cards line up across screens.
 *
 * `sm` was added when `reports/` migrated: its 34 charts carried five arbitrary pixel
 * heights (250/280/300/320/350) that no grid agreed on. They map onto three steps —
 * which is the point of naming them.
 *
 * `strip` is the short band of a **small-multiples** stack (ADR-777 §8.72): a second measure
 * of a different scale gets its own plot on the shared time axis instead of a second y-axis
 * — and a band that only has to show "which days, how many" does not need a full plot height.
 *
 * ## Why a leaf module
 *
 * A loading skeleton must reserve the **same** height the plot will take, or the page jumps
 * when the chart arrives (measured: ADR-777 §8.72.8). Importing the step from
 * `ChartCardFigure` would drag recharts into the initial bundle the skeleton exists to spare;
 * restating `'h-56'` in the skeleton would be a second source of truth. Hence: here, alone.
 */
export const CHART_FIGURE_HEIGHT = {
  strip: 'h-28',
  sm: 'h-56',
  md: 'h-64',
  lg: 'h-72',
} as const;

export type ChartCardFigureSize = keyof typeof CHART_FIGURE_HEIGHT;
