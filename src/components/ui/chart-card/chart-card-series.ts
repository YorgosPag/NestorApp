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
 * ramp. The tokens `--chart-1..8` exist per theme in `globals.css`; a chart that
 * names a series gets its color from the fixed order below and never picks one.
 *
 * ## Measured palette state (ADR-710 §10 — `dataviz/scripts/validate_palette.js`)
 *
 * | mode  | surface   | result |
 * |-------|-----------|--------|
 * | light | `#e7f1fe` | **PASS** — CVD ΔE 10.9 · normal-vision ΔE 22.5 · every mark ≥ 3:1 |
 * | dark  | `#1d283a` | **PASS** — CVD ΔE 10.3 · normal-vision ΔE 20.4 · every mark ≥ 3:1 |
 *
 * This block previously recorded a light-mode WARN and a dark-mode **FAIL** (all five
 * steps above the L 0.77 ceiling, CVD ΔE 5.4). Both were repaired at the token layer:
 * the palette is now eight hues derived by snapping Nestor's own hue families to
 * passing steps, and the reports shell's separate Okabe-Ito palette was folded into
 * it — see `globals.css`. Nothing in this module changed to make that true.
 *
 * The relief machinery below is kept even though no mark now falls under 3:1: the
 * shell always renders a legend, always renders a reachable data table, and
 * `CHART_STACK_SPACER` puts a surface-colored gap between touching fills. Identity is
 * therefore never carried by hue alone — which is what lets a colour-blind reader,
 * a greyscale printout, and `forced-colors` mode all still work.
 *
 * The palette is gated: `npm run validate:chart-palette` re-derives these numbers from
 * `globals.css`, and CHECK 3.32 runs it on every commit that touches the tokens.
 */

import type { ChartConfig } from '@/components/ui/chart';

// =============================================================================
// PALETTE
// =============================================================================

/**
 * Categorical hues in fixed order — assigned by position, never cycled.
 *
 * The ORDER is the colour-blind-safety mechanism, not a cosmetic preference: the
 * gates measure *adjacent* pairs, so slot 2 was chosen to sit far from slot 1, slot 3
 * far from slot 2, and so on. Reordering these to "look nicer" silently voids the
 * guarantee while every test still passes.
 *
 * A 9th series is not a generated hue: fold it into an "other" bucket or facet the
 * chart. Eight is the ceiling because eight is where categorical colour stops working
 * for humans — for CVD readers and everyone else alike — not because `globals.css`
 * ran out of steps.
 */
export const CHART_SERIES_PALETTE = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
  'hsl(var(--chart-7))',
  'hsl(var(--chart-8))',
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

/**
 * Positional color for one **category** — a pie slice, a donut segment, a bar colored
 * by what it names rather than by which series it belongs to.
 *
 * ## Why this is not `chartSeriesColor` with a different argument
 *
 * A cartesian chart plots N series over shared categories, so identity lives on the
 * *series* and there are as many colors as series. A pie plots ONE series (the
 * quantity) split across N categories, so identity lives on the *category*. Same
 * palette, same fixed order, different axis — which is why the shell models both and
 * a chart declares which one it means by passing `categoryOrder` or not.
 *
 * ## The index comes from `order`, never from the data array
 *
 * This is the whole point of the function and the reason it takes the order instead of
 * an index. **Color follows the entity, never its rank.** `buildEnergyClassItems` and
 * its siblings filter zero-count categories out of the data; had color come from the
 * row's position, an energy class dropping to zero would repaint every class below it,
 * and a reader comparing two quarters would see the same hue mean two different
 * things. A declared order is stable under filtering, sorting and re-fetching.
 *
 * A category absent from `order` reads as the neutral token — visibly "unassigned"
 * rather than silently colliding with slot 1, matching `chartSeriesColor` beyond the
 * palette limit.
 *
 * @param order Canonical category sequence — the domain's own vocabulary
 *              (`['A+','A','B',…]`), declared once by the chart.
 * @param category The category being drawn.
 */
export function chartCategoryColor(
  order: readonly string[],
  category: string,
): string {
  const index = order.indexOf(category);
  if (index < 0) return CHART_POLARITY_COLORS.neutral;
  return CHART_SERIES_PALETTE[index] ?? CHART_POLARITY_COLORS.neutral;
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
