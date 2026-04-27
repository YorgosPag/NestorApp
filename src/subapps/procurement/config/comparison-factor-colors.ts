/**
 * Single Source of Truth for color-coding the 4 comparison factors.
 *
 * The comparison UI surfaces the same 4 factors (price / supplier / terms /
 * delivery) in three different presentations — score bars, flag badges,
 * weight legend — and across two cards (RecommendationCard top of page,
 * ComparisonPanel below). When the colors lived inline in each component,
 * they drifted: bars showed `fuchsia-500` while badges showed `secondary`
 * gray and the weight legend was uniformly muted. ADR-327 changelog
 * 2026-04-27 §RFQ UI fixes documents the user-visible incident.
 *
 * # The mapping
 *
 * Each factor exposes three Tailwind class strings:
 *   - `bar`    — Progress indicator background (`bg-X-600`).
 *   - `badge`  — full Badge override (border + bg + text-white + hover).
 *     Used with the Badge `outline` variant so no other bg-* class fights
 *     for the same Tailwind layer.
 *   - `text`   — colored inline text (legend), with a dark-mode lighter
 *     shade so the legend stays readable against the dark background.
 *
 * `FLAG_TO_FACTOR` translates the reason/flag tokens emitted by
 * `comparison-service` (`cheapest`, `most_reliable`, `best_terms`,
 * `fastest_delivery`) into the factor key the consumer needs. Both
 * `RecommendationCard` (which reads from `recommendation.reason`) and
 * `ComparisonPanel::FlagsRow` (which reads from `entry.flags`) go
 * through this map, so the same flag always paints the same color.
 *
 * # Why a config module instead of a hook / context
 *
 * The values are static Tailwind class strings — there is nothing to
 * memoize, nothing to subscribe to. A const object is the cheapest
 * representation; consumers just import what they need.
 *
 * @module subapps/procurement/config/comparison-factor-colors
 * @see ADR-327 §changelog 2026-04-27
 */

export type ComparisonFactor = 'price' | 'supplier' | 'terms' | 'delivery';

interface FactorPalette {
  /** Progress bar fill (used as `indicatorClassName`). */
  readonly bar: string;
  /** Full Badge override; pair with `<Badge variant="outline">`. */
  readonly badge: string;
  /** Inline text accent (light + dark mode). */
  readonly text: string;
}

export const COMPARISON_FACTOR_COLORS: Readonly<Record<ComparisonFactor, FactorPalette>> = {
  price: {
    bar: 'bg-blue-600',
    badge: 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:text-white',
    text: 'text-blue-600 dark:text-blue-400',
  },
  supplier: {
    bar: 'bg-emerald-600',
    badge: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  terms: {
    bar: 'bg-amber-600',
    badge: 'border-amber-600 bg-amber-600 text-white hover:bg-amber-700 hover:text-white',
    text: 'text-amber-600 dark:text-amber-400',
  },
  delivery: {
    bar: 'bg-pink-600',
    badge: 'border-pink-600 bg-pink-600 text-white hover:bg-pink-700 hover:text-white',
    text: 'text-pink-600 dark:text-pink-400',
  },
};

/**
 * `comparison-service` emits flag/reason tokens with names that don't match
 * the factor keys (`cheapest` is the price-winner flag, `most_reliable` is
 * supplier-score, etc.). This map is the bridge — both Recommendation
 * reasons and Comparison flags resolve through it so the same token always
 * picks the same color.
 *
 * Tokens that don't represent a factor (e.g. `risk_low_score`, `strong_lead`,
 * `narrow_lead`, `balanced_score`) are intentionally absent — callers must
 * handle them separately (typically with `destructive` / `secondary`).
 */
export const FLAG_TO_FACTOR: Readonly<Record<string, ComparisonFactor>> = {
  cheapest: 'price',
  most_reliable: 'supplier',
  best_terms: 'terms',
  fastest_delivery: 'delivery',
};
