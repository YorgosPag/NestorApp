/**
 * =============================================================================
 * SHOWCASE CORE — Download filename stems (pure)
 * =============================================================================
 *
 * Own module, free of `next/server`, so the sanitiser is reachable by tests
 * (the PDF route factory that uses it is not — see
 * `unified-showcase-payload.ts` for the same reasoning).
 *
 * @module services/showcase-core/showcase-filename
 * @enterprise ADR-698 — Public Showcase Token Surface SSoT
 */

/**
 * Sanitise an entity name into a download filename stem.
 *
 * Byte-identical to the expression the building and project PDF routes both
 * inlined: strip everything that is not word/space/hyphen, trim, then collapse
 * whitespace runs to single hyphens.
 *
 * ⚠️ Non-Latin names sanitise to the empty string (`'Κτίριο Άλφα'` → `''`), at
 * which point the caller falls back to its surface slug. That is the behaviour
 * both routes shipped and it is **preserved, not fixed** — the property surface
 * solves it differently (NFKD normalisation) and reconciling the two would
 * change the `Content-Disposition` filename real users already receive. See
 * ADR-698 §4 and §8.
 */
export function sanitizeShowcaseFilenameStem(name: string): string {
  return name
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
