'use client';

/**
 * @module reports/core/ReportChart
 * @enterprise ADR-265 — the reports chart · ADR-710 Φάση Γ, Βήμα 2β
 *
 * ## What this file is now
 *
 * A **preset** over the ADR-710 shell, not a shell of its own. It owns exactly one thing
 * the shell deliberately refuses to own: the recharts composition for the five plot forms
 * this domain draws. Everything else — the theming, the legend, the reachable data table,
 * the sized figure, the heading level, the empty state — comes from `ChartPlot`.
 *
 * `ChartPlot` and not `ChartCard`: 33 of the 34 charts here render inside a
 * `<ReportSection>`, which already draws the card and spends the heading. Choosing wrong
 * is not left to judgement — `ChartCard` throws and names this level as the fix.
 *
 * ## Why a `type` switch is legitimate *here* and not in the shell
 *
 * The rule ADR-710 holds the shell to is "the shell never branches on who is calling it".
 * A preset is not the shell. Branching on the plot form inside one preset is the
 * variants-over-props pattern: the five forms are enumerated in one place where a reader
 * can see all of them at once, instead of being reimplemented in 34 files. What left with
 * the rewrite is the *other* kind of branching — the fifteen optional booleans and the
 * hand-picked colour slot, which is where the real duplication lived.
 *
 * ## Three defects the rewrite removed, all of them silent
 *
 * 1. **No axes on any cartesian chart.** The grid, both axes, the tooltip and the legend
 *    used to be passed to recharts wrapped in a `<>…</>` fragment. `React.Children.toArray`
 *    does not flatten fragments, so recharts never found them: 21 of the 34 charts rendered
 *    bars over a blank canvas with no scale, no labels and no tooltip. Measured with a
 *    controlled A/B (`report-shell.test.tsx`): fragment → 0 axes, array → 2. Children are
 *    an **array** here for exactly that reason — arrays *are* flattened.
 * 2. **Colour chosen by hand at the call site.** 30 of the 34 wrote
 *    `'hsl(var(--report-chart-N))'` and picked N themselves; two energy classes landed on
 *    the same slot and became indistinguishable. Marks now read their colour from the
 *    declared series (`--color-<key>`) or the declared category order — nobody picks a slot.
 * 3. **Five arbitrary pixel heights** (250/280/300/320/350) that no grid agreed on, now
 *    three named steps.
 *
 * @see ADR-710 §11 — the two levels of the shell
 * @see ADR-710 §11.6 — why colour follows the declared category and never the row's rank
 */

import { useMemo, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CHART_BAR_RADIUS,
  CHART_STACK_SPACER,
  ChartPlot,
  chartCategoryColor,
  seriesColorVar,
  type ChartCardFigureSize,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { ReportEmptyState } from './ReportEmptyState';
import '@/lib/design-system';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'stacked-bar';

export interface ReportChartProps<TDatum extends object> {
  /** Which plot form draws the declaration below. */
  readonly type: ChartType;
  /** The plotted rows, in plot order. */
  readonly data: readonly TDatum[];
  /**
   * The plotted series, declared once and read by four consumers — theming, legend,
   * data table and the marks. A pie declares **one** series (the quantity); its slices
   * are categories, not series.
   */
  readonly series: readonly ChartSeries<TDatum>[];
  /** Field naming the category of each row — the x axis, or the pie's slice name. */
  readonly categoryKey: Extract<keyof TDatum, string>;
  /** Translated header for the category column of the data table. Never an identifier. */
  readonly categoryLabel: string;
  /**
   * Canonical category sequence — the domain's own vocabulary, declared when the plot
   * colours by category rather than by series. Its **presence** is the declaration; there
   * is no `colorBy` flag, because two fields could disagree about where identity lives.
   */
  readonly categoryOrder?: readonly string[];
  /** Renders a series value as text. Axis ticks, tooltip and table all use it. */
  readonly formatValue: (value: number) => string;
  /** Renders a category as text. Defaults to the value's own string form. */
  readonly formatCategory?: (value: unknown) => string;
  /** Plot height step. Named, so charts line up across a report. */
  readonly size?: ChartCardFigureSize;
  /** Cross-filter hook — receives the row behind the clicked mark. */
  readonly onElementClick?: (datum: TDatum) => void;
}

/** What recharts hands a cartesian click, narrowed to the one field read here. */
interface CartesianClick<TDatum> {
  readonly activePayload?: readonly { readonly payload: TDatum }[];
}

/** What recharts hands a pie click — the sector, carrying the row it was built from. */
interface SliceClick<TDatum> {
  readonly payload?: TDatum;
}

/** Everything a mark builder needs, so the builders stay free of the props object. */
interface MarkInput<TDatum extends object> {
  readonly series: readonly ChartSeries<TDatum>[];
  readonly data: readonly TDatum[];
  readonly categoryKey: Extract<keyof TDatum, string>;
  readonly categoryOrder?: readonly string[];
}

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

/**
 * Per-category fills, or nothing when the plot encodes identity on the series instead.
 *
 * The index comes from the declared order, never from the row's position — a category
 * filtered out of the data must not repaint the ones below it (ADR-710 §11.6).
 */
function categoryCells<TDatum extends object>({
  data,
  categoryKey,
  categoryOrder,
}: MarkInput<TDatum>) {
  if (!categoryOrder) return null;

  return data.map((datum, index) => {
    const category = String(datum[categoryKey] ?? '');
    return (
      <Cell key={`${category}-${index}`} fill={chartCategoryColor(categoryOrder, category)} />
    );
  });
}

/**
 * The scale, the grid and the tooltip, as an array.
 *
 * An array and not a fragment: `React.Children.toArray` flattens arrays and keeps
 * fragments whole, and recharts reads its children through it. A fragment here is how 21
 * charts lost their axes without anything failing.
 */
function cartesianFurniture(
  categoryKey: string,
  formatValue: (value: number) => string,
): ReactElement[] {
  return [
    <CartesianGrid key="grid" strokeDasharray="3 3" vertical={false} />,
    <XAxis key="x" dataKey={categoryKey} tickLine={false} axisLine={false} className="text-xs" />,
    <YAxis
      key="y"
      tickFormatter={formatValue}
      tickLine={false}
      axisLine={false}
      className="text-xs"
    />,
    <ChartPlot.Tooltip key="tooltip" />,
  ];
}

function barMarks<TDatum extends object>(input: MarkInput<TDatum>, stacked: boolean) {
  const cells = categoryCells(input);

  return input.series.map((entry) => (
    <Bar
      key={entry.key}
      dataKey={entry.key}
      fill={seriesColorVar(entry.key)}
      radius={stacked ? undefined : CHART_BAR_RADIUS}
      stackId={stacked ? 'stack' : undefined}
      {...(stacked ? CHART_STACK_SPACER : {})}
      className="cursor-pointer"
    >
      {cells}
    </Bar>
  ));
}

function lineMarks<TDatum extends object>({ series }: MarkInput<TDatum>) {
  return series.map((entry) => (
    <Line
      key={entry.key}
      type="monotone"
      dataKey={entry.key}
      stroke={seriesColorVar(entry.key)}
      strokeWidth={2}
      dot={{ r: 3 }}
      activeDot={{ r: 5 }}
    />
  ));
}

function areaMarks<TDatum extends object>({ series }: MarkInput<TDatum>) {
  return series.map((entry) => (
    <Area
      key={entry.key}
      type="monotone"
      dataKey={entry.key}
      stroke={seriesColorVar(entry.key)}
      fill={seriesColorVar(entry.key)}
      fillOpacity={0.2}
    />
  ));
}

// ---------------------------------------------------------------------------
// Plot forms
// ---------------------------------------------------------------------------

interface PlotInput<TDatum extends object> extends MarkInput<TDatum> {
  readonly type: ChartType;
  readonly formatValue: (value: number) => string;
  readonly onElementClick?: (datum: TDatum) => void;
}

function cartesianPlot<TDatum extends object>(input: PlotInput<TDatum>) {
  const { type, data, categoryKey, formatValue, onElementClick } = input;
  const rows = [...data];
  const furniture = cartesianFurniture(categoryKey, formatValue);

  const onClick = onElementClick
    ? (state: CartesianClick<TDatum>) => {
        const point = state.activePayload?.[0]?.payload;
        if (point) onElementClick(point);
      }
    : undefined;

  if (type === 'line') {
    return (
      <LineChart data={rows} onClick={onClick}>
        {furniture}
        {lineMarks(input)}
      </LineChart>
    );
  }

  if (type === 'area') {
    return (
      <AreaChart data={rows} onClick={onClick}>
        {furniture}
        {areaMarks(input)}
      </AreaChart>
    );
  }

  return (
    <BarChart data={rows} onClick={onClick}>
      {furniture}
      {barMarks(input, type === 'stacked-bar')}
    </BarChart>
  );
}

function piePlot<TDatum extends object>(input: PlotInput<TDatum>) {
  const { series, data, categoryKey, onElementClick } = input;
  const quantity = series[0];
  if (!quantity) return null;

  const onClick = onElementClick
    ? (slice: SliceClick<TDatum>) => {
        if (slice.payload) onElementClick(slice.payload);
      }
    : undefined;

  return (
    <PieChart>
      <ChartPlot.Tooltip />
      <Pie
        data={[...data]}
        dataKey={quantity.key}
        nameKey={categoryKey}
        cx="50%"
        cy="50%"
        outerRadius="80%"
        innerRadius="40%"
        paddingAngle={2}
        onClick={onClick}
        className="cursor-pointer"
      >
        {categoryCells(input)}
      </Pie>
    </PieChart>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportChart<TDatum extends object>({
  type,
  data,
  series,
  categoryKey,
  categoryLabel,
  categoryOrder,
  formatValue,
  formatCategory,
  size = 'md',
  onElementClick,
}: ReportChartProps<TDatum>) {
  const { t } = useTranslation('reports');

  const plot = useMemo(() => {
    const input: PlotInput<TDatum> = {
      type,
      series,
      data,
      categoryKey,
      categoryOrder,
      formatValue,
      onElementClick,
    };
    return type === 'pie' ? piePlot(input) : cartesianPlot(input);
  }, [type, series, data, categoryKey, categoryOrder, formatValue, onElementClick]);

  // The domain's own empty state, with its icon and its sentence — richer than the
  // shell's fallback, and what every one of these sections already shows when a query
  // comes back with nothing.
  if (data.length === 0 || !plot) {
    return <ReportEmptyState type="no-data" />;
  }

  return (
    <ChartPlot
      series={series}
      data={data}
      categoryKey={categoryKey}
      categoryLabel={categoryLabel}
      categoryOrder={categoryOrder}
      formatValue={formatValue}
      formatCategory={formatCategory}
    >
      <ChartPlot.Figure emptyMessage={t('empty.noData.description')} size={size}>
        {plot}
      </ChartPlot.Figure>
    </ChartPlot>
  );
}
