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
import { chartSeriesColor } from './chart-card-series';
import { useChartCard } from './chart-card-context';
import { ChartCardDataTable } from './ChartCardDataTable';

/** Plot heights. Named steps, not free numbers, so cards line up across screens. */
const FIGURE_HEIGHT = {
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

/**
 * Series identity as text beside a swatch — so identity is never carried by color
 * alone, which is what the measured CVD separation (ΔE 6.2 deutan) requires.
 */
function ChartCardLegend() {
  const { series } = useChartCard();

  if (series.length < 2) return null;

  return (
    <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
      {series.map((entry, index) => (
        <li key={entry.key} className="flex items-center gap-1.5 text-muted-foreground">
          {/* A per-series color cannot be a utility class; this is the same
              dynamic-color escape the existing ChartLegendContent uses. */}
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-[2px]"
            style={layoutUtilities.dxf.colors.backgroundColor(
              chartSeriesColor(entry, index),
            )}
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}
