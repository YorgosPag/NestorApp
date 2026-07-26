'use client';

/**
 * @module chart-card/context
 * @enterprise ADR-710 — What every slot of a chart card is allowed to know.
 *
 * The root publishes the *data description* once; header, figure, legend, data table
 * and summary all read it from here. No slot receives the description as a prop, so
 * two slots can never disagree about what is plotted.
 */

import { createContext, useContext } from 'react';
import type { ChartConfig } from '@/components/ui/chart';
import type { ChartSeriesDescriptor } from './chart-card-series';

/**
 * The shape a datum is read as inside the shell.
 *
 * Callers keep their own precise interfaces; only the shell widens to `object`,
 * because a React context cannot stay generic across the component boundary.
 * `readChartField` is the single place that narrows it back, so the widening is
 * one documented step rather than an `unknown` spreading through every slot.
 */
export type ChartDatum = object;

export interface ChartCardContextValue {
  /** Stable DOM id of the card — ties `aria-labelledby` to the title. */
  readonly cardId: string;
  /**
   * Heading element the card's own title renders as.
   *
   * Computed at the shell root from how many section shells enclose it, *before* the
   * shell deepens the tree for its children — so the title sits at the level of the
   * region it names. A card on a page is `h3`; the same card inside a `ReportSection`
   * that already spent the `h3` is `h4`. Slots read it rather than hardcoding, which is
   * what keeps the document outline intact (WCAG 1.3.1).
   */
  readonly headingTag: 'h3' | 'h4' | 'h5' | 'h6';
  /** Plotted series, in canonical order. */
  readonly series: readonly ChartSeriesDescriptor[];
  /** Plotted rows, in plot order. */
  readonly data: readonly ChartDatum[];
  /** Field naming the category (x) of each datum. */
  readonly categoryKey: string;
  /** Translated header for the category column of the data table. */
  readonly categoryLabel: string;
  /** Translated explanation of the category, shown on its column header. */
  readonly categoryDescription?: string;
  /** Renders a series value as text — axis ticks, tooltip and table share it. */
  readonly formatValue: (value: number) => string;
  /** Renders a category as text. */
  readonly formatCategory: (value: unknown) => string;
  /** Theming config derived from `series`, handed to `<ChartContainer>`. */
  readonly config: ChartConfig;
}

const ChartCardContext = createContext<ChartCardContextValue | null>(null);

export const ChartCardProvider = ChartCardContext.Provider;

/**
 * Read the enclosing card. Throws rather than degrading: a slot rendered outside a
 * `<ChartCard>` would otherwise render an empty legend and an empty table, which
 * looks like missing data instead of a wiring mistake.
 */
export function useChartCard(): ChartCardContextValue {
  const context = useContext(ChartCardContext);
  if (!context) {
    throw new Error('ChartCard slots must be rendered inside <ChartCard>');
  }
  return context;
}

/**
 * Read one field off a datum.
 *
 * The single narrowing step described on `ChartDatum`. A missing key yields
 * `undefined`, which the table renders as an empty cell — the same thing the plot
 * shows for that point.
 */
export function readChartField(datum: ChartDatum, key: string): unknown {
  return (datum as Record<string, unknown>)[key];
}

/** Read a field that is expected to be numeric; non-numbers read as `0`. */
export function readChartNumber(datum: ChartDatum, key: string): number {
  const value = readChartField(datum, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
