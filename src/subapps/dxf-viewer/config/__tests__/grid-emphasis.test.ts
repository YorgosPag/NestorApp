/**
 * 🪜 GRID EMPHASIS — regression anchors (ADR-681 §5.7).
 *
 * The cascade promotes a level's ROLE as zoom changes: the spacing drawn as
 * "minor" at one zoom is drawn as "major" one wheel click later, at the SAME
 * screen position. `grid-adaptive.ts` makes the line COUNT continuous across
 * that step; these anchors pin the other half — that the surviving level does
 * not visibly change weight when it swaps role.
 *
 * The defect: independent sliders allowed `minorGridWeight = 0.5` with
 * `majorGridWeight = 2`. At every cascade step four fifths of the visible
 * lines went hairline → bold in one frame. The density jump was fixed; the
 * same ×4 factor had simply relocated into emphasis.
 *
 * @see ../grid-emphasis.ts
 */
import { GRID_MAJOR_EMPHASIS_RATIO, deriveMajorGridWeight } from '../grid-emphasis';

/**
 * Above this, a minor→major role swap reads as an event rather than a
 * hierarchy. C4D ships 1.43; the shipped defect was 4.0.
 */
const PERCEPTUAL_LIMIT = 1.6;

describe('deriveMajorGridWeight', () => {
  it('keeps the emphasis ratio inside the perceptual limit for every weight', () => {
    // THE anchor. Under the old independent sliders this ratio reached 4.0
    // and nothing in the codebase objected.
    for (const minorWeight of [0.1, 0.25, 0.5, 1, 1.5, 2, 3, 5]) {
      const ratio = deriveMajorGridWeight(minorWeight) / minorWeight;
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThanOrEqual(PERCEPTUAL_LIMIT);
    }
  });

  it('still makes the major distinguishable — this is a drafting grid, not a backdrop', () => {
    // The converse guard: collapsing the ratio to 1 would satisfy the test
    // above while destroying the major level's job as a measuring reference
    // (the reason we do NOT copy C4D's near-invisible values verbatim).
    expect(GRID_MAJOR_EMPHASIS_RATIO).toBeGreaterThanOrEqual(1.4);
    expect(deriveMajorGridWeight(1)).toBeGreaterThan(1);
  });

  it('scales linearly with the minor weight', () => {
    // Proves the minor weight is genuinely wired, so the ratio bound above
    // passes for the right reason rather than because the input is ignored.
    expect(deriveMajorGridWeight(2)).toBeCloseTo(deriveMajorGridWeight(1) * 2, 9);
    expect(deriveMajorGridWeight(0.5)).toBeCloseTo(deriveMajorGridWeight(1) * 0.5, 9);
  });

  it('never returns a non-positive or non-finite weight', () => {
    // A 0 or NaN line width erases the grid silently.
    for (const bad of [0, -1, NaN, Infinity, -Infinity]) {
      const out = deriveMajorGridWeight(bad);
      expect(Number.isFinite(out)).toBe(true);
      expect(out).toBeGreaterThan(0);
    }
  });
});
