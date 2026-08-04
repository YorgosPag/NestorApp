/**
 * Millesimal apportionment — SSoT for turning real numbers into whole
 * millesimals that still add up.
 *
 * Pure business logic. No React, no UI, no side effects. Sibling of
 * `owner-utils.ts` (percentage *validation*) and `landowner-acquisition.ts`
 * (acquisition stage); this module owns the *arithmetic*.
 *
 * ## Why the core and the policies are separate
 *
 * Two callers ask what looks like the same question and is not:
 *
 * - **The ownership table** (`services/ownership/ownership-calculation-engine`)
 *   asks *"share these 1000‰ out over the properties"*. The total is **given**;
 *   the inputs are square metres or objective values that carry no total of
 *   their own. Normalising to the target is the whole point.
 * - **The landowners tab** (`components/projects/tabs/landowners`) asks *"how
 *   many millesimals does the percentage the user typed come to"*. The total is
 *   **not** given — it is what the user declared. Normalising here would invent
 *   data: a lone landowner holding 33.33% of the plot would be recorded as
 *   owning all 1000‰ of it.
 *
 * So {@link apportionLargestRemainder} is the shared algorithm, and each caller
 * supplies its own target. Merging the two policies into one function would
 * destroy one of the two meanings — which is exactly how the landowners tab
 * came to write 999‰ (see {@link allocateMillesimalsFromPercentages}).
 *
 * @module lib/ownership/millesimal-apportionment
 * @enterprise ADR-235 §4 (Largest Remainder / Hamilton) · ADR-244 · ADR-745 Φ3α
 */

import { TOTAL_SHARES_TARGET } from '@/types/ownership-table';

/**
 * Largest Remainder Method (Hamilton) — split `target` whole units across
 * `values` in proportion to their weight.
 *
 * Guarantees, for non-negative `values` and a non-negative integer `target`:
 * - every returned entry is a whole number;
 * - the entries sum to exactly `target`;
 * - two equal weights never end up more than one unit apart.
 *
 * The last one is the guarantee the total does **not** give you: rounding each
 * row to nearest also lands on `target` once the overshoot is trimmed, while
 * quietly taking 2‰ off one owner. Fairness has to be asserted separately.
 *
 * Ties are broken towards the **lower index**, explicitly rather than by relying
 * on `Array.prototype.sort` stability — these numbers are printed in notarial
 * deeds, so the same input must produce the same deed on every run.
 *
 * Weights that are all zero carry no proportion to follow, so the target is
 * shared out as evenly as whole units allow, earlier rows first.
 */
export function apportionLargestRemainder(
  values: readonly number[],
  target: number,
): number[] {
  if (values.length === 0) return [];

  const totalWeight = values.reduce((sum, v) => sum + v, 0);

  if (totalWeight === 0) {
    const base = Math.floor(target / values.length);
    const leftover = target - base * values.length;
    return values.map((_, i) => base + (i < leftover ? 1 : 0));
  }

  const scaled = values.map(v => (v / totalWeight) * target);
  const allocated = scaled.map(s => Math.floor(s));

  const byRemainder = scaled
    .map((s, index) => ({ index, remainder: s - allocated[index] }))
    .sort((a, b) => (b.remainder - a.remainder) || (a.index - b.index));

  let undistributed = target - allocated.reduce((sum, s) => sum + s, 0);
  for (const entry of byRemainder) {
    if (undistributed <= 0) break;
    allocated[entry.index] += 1;
    undistributed -= 1;
  }

  return allocated;
}

/**
 * Declared ownership percentages → whole millesimals, summing to what was
 * actually declared.
 *
 * 🔴 The defect this exists to close: computing `Math.round(pct / 100 × 1000)`
 * per row, independently, made three siblings holding a third each come to
 * 333 + 333 + 333 = **999‰**. The ownership tables would have shown a mismatch
 * nobody typed.
 *
 * 🔑 And the defect it exists to **avoid**: the target is derived from the sum
 * of the declared percentages, never fixed at {@link TOTAL_SHARES_TARGET}. An
 * incomplete declaration stays incomplete — 50% + 30% comes to 800‰, not 1000‰.
 * The save gate (`isOwnersValid`) lets a single landowner through **without**
 * checking their percentage at all, so a lone 33.33% owner is reachable, and
 * rounding them up to the whole plot would be a far worse error than the 999‰
 * it replaced. Completeness is the user's statement to make, not ours.
 *
 * A landowner who declares nothing gets 0‰ — there is no per-row minimum here,
 * unlike the ownership table, where every participating property must carry at
 * least `MIN_SHARES_PER_ROW`.
 */
export function allocateMillesimalsFromPercentages(
  percentages: readonly number[],
): number[] {
  const rawShares = percentages.map(pct => (pct / 100) * TOTAL_SHARES_TARGET);
  const declaredTotal = Math.round(rawShares.reduce((sum, s) => sum + s, 0));
  return apportionLargestRemainder(rawShares, declaredTotal);
}
