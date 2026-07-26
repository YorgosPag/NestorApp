'use client';

/**
 * @module chart-card/ChartCardFigure
 * @enterprise ADR-710 — The plot slot.
 *
 * Owns everything that surrounds a plot and nothing about what the plot draws: the
 * `<figure>`/`<figcaption>` pairing, the sized box `ResponsiveContainer` measures
 * against, the `ChartContainer` that emits the `--color-<key>` variables, the legend,
 * the empty state, and the data table.
 *
 * The caller passes its recharts composition as children. That is the whole extent of
 * per-chart variation — there is no `type` prop and therefore no branch that has to
 * grow when a chart type is added.
 *
 * ## Two rules that are enforced here rather than left to callers
 *
 * - **Legend for ≥ 2 series, never for 1.** A lone series is named by the card title;
 *   a legend box for it is noise. This is decided from the series description, not
 *   from who is rendering.
 * - **The data table is not optional.** See `chart-card-series.ts` §measured palette.
 */

import type { ReactElement } from 'react';
import { ChartContainer } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { layoutUtilities } from '@/styles/design-tokens';
import { chartCategoryColor, chartSeriesColor } from './chart-card-series';
import { readChartField, useChartCard } from './chart-card-context';
import { ChartCardDataTable } from './ChartCardDataTable';

/**
 * Plot heights. Named steps, not free numbers, so cards line up across screens.
 *
 * `sm` was added when `reports/` migrated: its 34 charts carried five arbitrary pixel
 * heights (250/280/300/320/350) that no grid agreed on. They map onto three steps —
 * which is the point of naming them.
 */
const FIGURE_HEIGHT = {
  sm: 'h-56',
  md: 'h-64',
  lg: 'h-72',
} as const;

export type ChartCardFigureSize = keyof typeof FIGURE_HEIGHT;

export interface ChartCardFigureProps {
  /** The recharts composition — a single chart element. */
  readonly children: ReactElement;
  /** Sentence describing what the plot shows. Rendered visibly under the plot. */
  readonly caption?: string;
  /** Message shown in place of the plot when there is nothing to draw. */
  readonly emptyMessage: string;
  /** Plot height step. */
  readonly size?: ChartCardFigureSize;
}

export function ChartCardFigure({
  children,
  caption,
  emptyMessage,
  size = 'md',
}: ChartCardFigureProps) {
  const { cardId, config, data } = useChartCard();

  if (data.length === 0) {
    return (
      <figure>
        <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      </figure>
    );
  }

  return (
    <figure>
      <ChartContainer
        id={cardId}
        config={config}
        className={cn('aspect-auto w-full', FIGURE_HEIGHT[size])}
      >
        {children}
      </ChartContainer>
      <ChartCardLegend />
      {caption ? (
        <figcaption className="mt-2 text-sm text-muted-foreground">{caption}</figcaption>
      ) : null}
      <ChartCardDataTable caption={caption} />
    </figure>
  );
}

/** One identity the plot draws, as the legend needs it. */
interface LegendEntry {
  readonly id: string;
  readonly label: string;
  readonly color: string;
}

/**
 * The identities this plot distinguishes by color.
 *
 * Two kinds of chart answer "what does a color mean here?" differently — a cartesian
 * chart means a series, a pie means a category — and the card already knows which,
 * because a categorical plot declares `categoryOrder`. Resolving it to one list here
 * is what lets a single `<ul>` render both: a second legend body with the same markup
 * would be exactly the sibling clone ADR-584 exists to catch (N.18).
 */
function useLegendEntries(): LegendEntry[] {
  const { series, data, categoryKey, categoryOrder, formatCategory } = useChartCard();

  if (!categoryOrder) {
    return series.map((entry, index) => ({
      id: entry.key,
      label: entry.label,
      color: chartSeriesColor(entry, index),
    }));
  }

  // Walk the DECLARED order and keep what the data holds — not the other way round.
  // Reading order off the rows would reintroduce rank-based color through the back
  // door: a filtered-out category would shift every swatch below it.
  const present = new Set(
    data.map((datum) => String(readChartField(datum, categoryKey) ?? '')),
  );

  return categoryOrder
    .filter((category) => present.has(category))
    .map((category) => ({
      id: category,
      label: formatCategory(category),
      color: chartCategoryColor(categoryOrder, category),
    }));
}

/**
 * Identity as text beside a swatch — so identity is never carried by color alone,
 * which is what the measured CVD separation (ΔE 6.2 deutan) requires.
 *
 * Below two identities there is nothing to tell apart and the title already names what
 * is drawn, so the box is noise rather than relief.
 */
function ChartCardLegend() {
  const entries = useLegendEntries();

  if (entries.length < 2) return null;

  return (
    <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center gap-1.5 text-muted-foreground">
          {/* A per-identity color cannot be a utility class; this is the same
              dynamic-color escape the existing ChartLegendContent uses. */}
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-[2px]"
            style={layoutUtilities.dxf.colors.backgroundColor(entry.color)}
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}
