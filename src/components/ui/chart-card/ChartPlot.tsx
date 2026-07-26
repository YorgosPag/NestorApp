'use client';

/**
 * @module chart-card/ChartPlot
 * @enterprise ADR-710 §11 — The chart shell, without the frame.
 *
 * ## Why this level exists
 *
 * `ChartCard` renders a `<Card>`. That is right when the chart owns its section, and
 * wrong when something else already does — `ReportSection` frames and titles 58 regions
 * of this app, 33 of which hold a chart. Rendering `ChartCard` inside one produces a card
 * inside a card and a heading inside a heading.
 *
 * The industry answer is not a `frame` prop. Martin Fowler's headless-component pattern
 * puts it plainly: **the wrapper belongs to the consumer, not to the component.** Carbon
 * follows it for dataviz — a Carbon chart does not render its own tile. So the shell
 * splits into two levels of composition rather than growing a boolean:
 *
 * - **`ChartPlot`** (here) — the description, the slots, the plot. No frame.
 * - **`ChartCard`** — `<Card>` + `ChartPlot`. One line of difference, not a second
 *   implementation, which is what keeps a token-level clone detector quiet (N.18).
 *
 * Everything a chart declares and every slot it composes is identical at both levels;
 * `ChartCard.Figure` and `ChartPlot.Figure` are the same component object.
 *
 * ## The heading level is published here, deliberately
 *
 * `headingTag` is computed at this root — *before* `SurfaceBoundary` deepens the tree —
 * and handed to slots through the card context. So the title renders at the level of the
 * shell that owns it, while anything nested inside sits one level below. A `ChartCard`
 * on a page titles itself `<h3>` exactly as it did before this split; a `ChartPlot`
 * inside a `ReportSection` that already spent the `<h3>` titles itself `<h4>`.
 *
 * @see surface-context.tsx — why depth is context and not a prop
 */

import { Children, isValidElement, useId, useMemo, type ReactNode } from 'react';
import { SurfaceBoundary, useHeadingTag } from '@/components/ui/surface-context';
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

/**
 * Whether this composition titles itself.
 *
 * The shell's accessible name is the heading `ChartCardHeader` renders. A frameless plot
 * inside a `ReportSection` has no header — the section already spent the heading — so
 * pointing `aria-labelledby` at that heading's id would reference an element that is never
 * rendered. A dangling reference is worse than no name: the region loses its name *and*
 * fails validation, silently.
 *
 * Read from the composition rather than from a prop, for the same reason nesting depth is:
 * "does this shell title itself" is a fact about what was composed, not a caller's
 * preference. The failure direction is safe — a header the scan cannot see costs a name,
 * never a broken reference.
 */
function titlesItself(children: ReactNode): boolean {
  return Children.toArray(children).some(
    (child) => isValidElement(child) && child.type === ChartCardHeader,
  );
}

export interface ChartPlotProps<TDatum extends object> {
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
  /**
   * Canonical category sequence — pass it when the plot colors by category rather than
   * by series (pie, donut, category-colored bars), and color the marks with
   * `chartCategoryColor(order, category)`.
   *
   * Declaring the order rather than the colors is what makes the reports-shell defect
   * unwritable: two categories cannot be handed the same slot, because neither the
   * chart nor the shell picks a slot at all.
   */
  readonly categoryOrder?: readonly string[];
  /** Renders a series value as text. Axis ticks, tooltip and table all use it. */
  readonly formatValue: (value: number) => string;
  /** Renders a category as text. Defaults to `String(value)`. */
  readonly formatCategory?: (value: unknown) => string;
  /** Header / figure / summary / editor slots. */
  readonly children: ReactNode;
}

export function ChartPlotRoot<TDatum extends object>({
  series,
  data,
  categoryKey,
  categoryLabel,
  categoryDescription,
  categoryOrder,
  formatValue,
  formatCategory = defaultFormatCategory,
  children,
}: ChartPlotProps<TDatum>) {
  const generatedId = useId();
  const cardId = `chart-card-${generatedId.replace(/:/g, '')}`;
  const headingTag = useHeadingTag();

  const value = useMemo<ChartCardContextValue>(
    () => ({
      cardId,
      headingTag,
      series,
      data,
      categoryKey,
      categoryLabel,
      categoryDescription,
      categoryOrder,
      formatValue,
      formatCategory,
      config: toChartConfig(series),
    }),
    [
      cardId,
      headingTag,
      series,
      data,
      categoryKey,
      categoryLabel,
      categoryDescription,
      categoryOrder,
      formatValue,
      formatCategory,
    ],
  );

  return (
    <ChartCardProvider value={value}>
      <SurfaceBoundary>
        <section aria-labelledby={titlesItself(children) ? `${cardId}-title` : undefined}>
          {children}
        </section>
      </SurfaceBoundary>
    </ChartCardProvider>
  );
}

/**
 * The slot set, attached to both levels of the shell.
 *
 * Exported so `ChartCard` composes the identical object instead of repeating the list —
 * a second `Object.assign` with the same six entries is exactly the sibling clone that
 * ADR-584 exists to catch.
 */
export const CHART_SHELL_SLOTS = {
  Header: ChartCardHeader,
  Figure: ChartCardFigure,
  Tooltip: ChartCardTooltip,
  Summary: ChartCardSummary,
  SummaryItem: ChartCardSummaryItem,
  Editor: ChartCardEditor,
} as const;

/**
 * The chart shell for when the enclosing section already owns the frame and the title.
 *
 * Same declaration and same slots as `ChartCard`; it simply does not draw a card.
 */
export const ChartPlot = Object.assign(ChartPlotRoot, CHART_SHELL_SLOTS);
