'use client';

/**
 * The axis frame every financial chart in this folder draws around its marks.
 *
 * ## Why this is a function returning an array, and not a component
 *
 * recharts does not render the children of its charts directly: it looks them up with
 * `findChildByType`, which matches on `type.displayName`, and only unwraps fragments
 * on the way (`node_modules/recharts/lib/util/ReactUtils.js`). A `<ChartFrame />` of
 * ours would therefore be pushed in as one unrecognised child and the axes would
 * silently never appear — the chart renders, nothing errors (ADR-710 §6.1).
 *
 * `React.Children` does flatten a nested array, so returning elements as an array and
 * spreading them into the chart puts them in as direct children, which is what
 * recharts can see.
 *
 * ## Why it lives here and not in the shell
 *
 * ADR-710 keeps `ChartCard` free of chart-composition knowledge: what a plot draws is
 * the caller's business. This is the *financial* preset — a category axis and a
 * money-valued axis, compact ticks, no axis lines — shared by the charts of this
 * domain, not a property of the shell.
 *
 * @enterprise ADR-710 — Chart card shell
 */

import type { ReactElement } from 'react';
import { CartesianGrid, XAxis, YAxis } from 'recharts';

import { ChartCard } from '@/components/ui/chart-card';
import { formatCurrencyCompact } from '@/lib/intl-utils';

export interface FinancialAxisFrameOptions {
  /** Field naming the category, i.e. what the category axis is keyed on. */
  readonly categoryKey: string;
  /** Renders a value-axis tick. Defaults to compact currency. */
  readonly formatValueTick?: (value: number) => string;
  /** Reserved width of the value axis, in px. */
  readonly valueAxisWidth?: number;
  /** `'vertical'` puts the categories on the y axis, as a tornado chart does. */
  readonly layout?: 'horizontal' | 'vertical';
}

const DEFAULT_VALUE_AXIS_WIDTH = 80;

/**
 * Grid, both axes and the card's hover layer, as direct children of a recharts chart.
 *
 * @example
 * <BarChart data={data}>
 *   {financialAxisFrame({ categoryKey: 'month' })}
 *   <Bar dataKey="amount" … />
 * </BarChart>
 */
export function financialAxisFrame({
  categoryKey,
  formatValueTick = formatCurrencyCompact,
  valueAxisWidth = DEFAULT_VALUE_AXIS_WIDTH,
  layout = 'horizontal',
}: FinancialAxisFrameOptions): ReactElement[] {
  const categoryAxis =
    layout === 'vertical' ? (
      <YAxis
        key="category"
        type="category"
        dataKey={categoryKey}
        width={110}
        tickLine={false}
        axisLine={false}
      />
    ) : (
      <XAxis key="category" dataKey={categoryKey} tickLine={false} axisLine={false} />
    );

  const valueAxis =
    layout === 'vertical' ? (
      <XAxis
        key="value"
        type="number"
        tickFormatter={formatValueTick}
        tickLine={false}
        axisLine={false}
      />
    ) : (
      <YAxis
        key="value"
        tickFormatter={formatValueTick}
        width={valueAxisWidth}
        tickLine={false}
        axisLine={false}
      />
    );

  return [
    <CartesianGrid key="grid" strokeDasharray="3 3" opacity={0.3} />,
    categoryAxis,
    valueAxis,
    <ChartCard.Tooltip key="tooltip" />,
  ];
}
