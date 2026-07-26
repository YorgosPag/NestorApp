'use client';

/**
 * @module chart-card/series
 * @enterprise ADR-710 — Series description is the single declaration a chart makes.
 *
 * A `ChartSeries[]` is declared ONCE by each chart and is consumed by four readers:
 *   1. `toChartConfig()`  → `<ChartContainer config>` → `ChartStyle` emits `--color-<key>`
 *   2. `<ChartCardFigure>` legend
 *   3. `<ChartCardDataTable>` — the text equivalent of the plot
 *   4. the chart's own marks, via `seriesColorVar(key)`
 *
 * That is what keeps the shell free of per-chart branching: the shell never asks
 * *which* chart is calling, only *what* the data is.
 *
 * ## Why marks must not carry literal colors
 *
 * Every migrated chart previously hardcoded hexes (`#3b82f6`, `#ef4444`, …) behind an
 * `eslint-disable design-system/no-hardcoded-colors`, so dark mode rendered the light
 * ramp. The tokens `--chart-1..5` already exist per theme in `globals.css`; a chart that
 * names a series gets its color from the fixed order below and never picks one.
 *
 * ## Measured palette state (ADR-710 §4 — `dataviz/scripts/validate_palette.js`)
 *
 * | mode  | surface   | result |
 * |-------|-----------|--------|
 * | light | `#e7f1fe` | PASS, 2 WARN — `--chart-3`↔`--chart-2` CVD ΔE 6.2 (deutan); `--chart-2` 2.02:1 and `--chart-3` 2.44:1 vs surface (< 3:1) |
 * | dark  | `#1d283a` | **FAIL** — all 5 steps above the L 0.77 ceiling; `--chart-3`↔`--chart-2` CVD ΔE 5.4 (deutan), under the 6.0 floor |
 *
 * A CVD ΔE in the 6–8 band is legal ONLY with secondary encoding, and a sub-3:1 mark
 * obligates visible labels or a table view. The shell therefore does not treat these as
 * advisory: `ChartCardFigure` always renders a legend and always renders a reachable
 * data table, and `CHART_STACK_SPACER` puts a surface-colored gap between touching
 * fills. The relief is structural, so no chart can opt out of it.
 *
 * Repairing the dark `--chart-*` steps themselves is a `globals.css` change that
 * repaints every chart in the app and is deliberately NOT part of this module.
 */

import type { ChartConfig } from '@/components/ui/chart';

// =============================================================================
// PALETTE
// =============================================================================

/**
 * Categorical hues in fixed order — assigned by position, never cycled.
 * A 9th series is not a generated hue: fold it into an "other" bucket or facet
 * the chart. Five is the ceiling because `globals.css` defines five steps.
 */
export const CHART_SERIES_PALETTE = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
] as const;

export const CHART_SERIES_LIMIT = CHART_SERIES_PALETTE.length;

/**
 * Polarity colors for value-signed marks (over/under budget, gain/loss).
 * These are status tokens and are deliberately NOT part of the categorical ramp —
 * a diverging encoding must never collide with "series 4".
 */
export const CHART_POLARITY_COLORS = {
  good: 'hsl(var(--status-success))',
  bad: 'hsl(var(--status-error))',
  neutral: 'hsl(var(--muted-foreground))',
} as const;

/**
 * Ordered health steps for a quantity that drains toward zero — an interest reserve
 * depleting over the life of a loan, a cash runway, a remaining contingency.
 *
 * It is neither of the two above and must not be confused with them. The categorical
 * palette encodes *identity* (which series), `CHART_POLARITY_COLORS` encodes the *sign*
 * of one value, and this encodes *how far along a drain has gone* — an ordinal position
 * on a single axis. Using `--chart-1..3` for it would read as three unrelated series;
 * using the polarity pair would drop the middle step, which is the only one that says
 * "not yet a problem, but stop adding draws".
 */
export const CHART_STATUS_RAMP = {
  healthy: 'hsl(var(--status-success))',
  caution: 'hsl(var(--status-warning))',
  critical: 'hsl(var(--status-error))',
} as const;

/**
 * Surface-colored separator applied to touching fills (stacked segments, adjacent
 * bars). Spread onto a recharts mark. This is the secondary encoding that makes the
 * measured 6.2 ΔE adjacent pair readable under deuteranopia.
 */
export const CHART_STACK_SPACER = {
  stroke: 'hsl(var(--card))',
  strokeWidth: 2,
} as const;

/**
 * Rounded data-end for a column anchored to the baseline: [tl, tr, br, bl].
 * A mutable tuple because that is what recharts' `radius` prop accepts.
 */
export const CHART_BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

// =============================================================================
// TYPES
// =============================================================================

/**
 * One plotted series, as the shell reads it once the datum type has been erased at
 * the React context boundary.
 */
export interface ChartSeriesDescriptor {
  /** Field on the datum holding this series' value. */
  readonly key: string;
  /** Translated, human-facing name. Never a raw identifier. */
  readonly label: string;
  /**
   * Translated sentence explaining what the series measures, for readers who know the
   * chart but not the term ("forward rate", "P75"). Shown on the data table's column
   * header. Part of the description because a term means the same thing wherever the
   * card names it — it is not a per-slot decoration.
   */
  readonly description?: string;
  /**
   * Override the positional color. Reserve for polarity/status encodings;
   * leave unset for categorical series so ordering stays canonical.
   */
  readonly color?: string;
}

/**
 * One plotted series, as a chart declares it.
 *
 * `key` is narrowed to a real key of the datum, so a renamed field breaks the series
 * declaration instead of silently producing an empty column in the data table and a
 * flat line in the plot.
 */
export interface ChartSeries<TDatum extends object> extends ChartSeriesDescriptor {
  readonly key: Extract<keyof TDatum, string>;
}

// =============================================================================
// DERIVATIONS
// =============================================================================

/**
 * Positional color for a series, or an explicit override.
 * Beyond `CHART_SERIES_LIMIT` the palette does not wrap — it returns the neutral
 * token, which reads as "unassigned" on screen instead of duplicating hue 1.
 */
export function chartSeriesColor(series: ChartSeriesDescriptor, index: number): string {
  if (series.color) return series.color;
  return CHART_SERIES_PALETTE[index] ?? CHART_POLARITY_COLORS.neutral;
}

/**
 * The CSS variable a mark should be filled with. `ChartStyle` emits `--color-<key>`
 * scoped to the enclosing `[data-chart]`, so this resolves per theme with no JS.
 */
export function seriesColorVar(key: string): string {
  return `var(--color-${key})`;
}

/** Series description → the `ChartConfig` that `ChartContainer` themes from. */
export function toChartConfig(series: readonly ChartSeriesDescriptor[]): ChartConfig {
  const config: ChartConfig = {};
  series.forEach((entry, index) => {
    config[entry.key] = { label: entry.label, color: chartSeriesColor(entry, index) };
  });
  return config;
}

/**
 * How a value reads, independent of where it is shown. A mark resolves it to a fill,
 * a summary figure resolves it to ink — same word, so the two cannot disagree.
 */
export type ChartTone = 'neutral' | 'good' | 'bad';

/**
 * Which way a measure is signed.
 *
 * It describes the measure, not the caller: a budget variance where spending more
 * than planned is bad is `'lower-is-better'`.
 */
export type ChartPolarity = 'higher-is-better' | 'lower-is-better';

/** Tone of a signed value. Zero is neutral — never green. */
export function chartPolarityTone(value: number, polarity: ChartPolarity): ChartTone {
  if (value === 0) return 'neutral';
  const isGood = polarity === 'higher-is-better' ? value > 0 : value < 0;
  return isGood ? 'good' : 'bad';
}

/** Diverging fill for a signed mark. */
export function chartPolarityColor(value: number, polarity: ChartPolarity): string {
  return CHART_POLARITY_COLORS[chartPolarityTone(value, polarity)];
}
