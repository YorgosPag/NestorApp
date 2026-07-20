/**
 * 🪜 GRID EMPHASIS — SSoT for how strongly the major grid level reads against
 * the minor one.
 *
 * ## Why this is derived and not two independent settings
 *
 * The adaptive cascade (ADR-681 §5) promotes a level's ROLE as zoom changes:
 * the spacing that is "minor" at one zoom becomes "major" one wheel click
 * later, at the identical screen position. The cross-fade makes the LINE COUNT
 * continuous across that step, but the surviving level still switches style —
 * so the *ratio* between major and minor emphasis is exactly what decides
 * whether the step reads as an event.
 *
 * With `minorGridWeight = 0.5` and `majorGridWeight = 2` (a combination the
 * old independent sliders allowed, and the one Giorgio was running on
 * 2026-07-20) that ratio is **4×**: at every cascade step four fifths of the
 * visible lines jumped from hairline to bold in a single frame. The density
 * jump had been fixed; the same factor had simply moved into emphasis.
 *
 * This is the fourth instance of the ADR-681 root cause — two coupled
 * quantities exposed as independent knobs, drifting apart — so it gets the
 * same medicine: one knob, the other derived.
 *
 * ## Why 1.5 and not C4D's exact numbers
 *
 * MAXON/Cinema 4D solves this by keeping the two levels nearly
 * indistinguishable: `GRID3D_MINOR_LINE_PX = 0.7` vs
 * `GRID3D_MAJOR_LINE_PX = 1.0` — a ratio of **1.43** — with the colours only
 * ~10/255 apart and the major actually DARKER than the minor
 * (`cinema4d-grid-config.ts`). That works because a 3D viewport grid is a
 * backdrop whose job is to recede.
 *
 * Our grid is a 2D drafting instrument: the user counts major squares to
 * measure, so the major must stay legible as a reference. We therefore adopt
 * C4D's PRINCIPLE (a ratio small enough that a role swap is not an event)
 * without copying its VALUES (which would make the major nearly invisible).
 * 1.5 sits just above C4D's 1.43 — enough to read as a hierarchy in a floor
 * plan, far below the 4× that made the step visible.
 *
 * ⚠️ Note the honest asymmetry with the cross-fade window: that one is derived
 * because continuity is *provable* (see `grid-adaptive.ts`). This ratio is a
 * perceptual constant — there is no theorem behind 1.5. It lives here, alone,
 * so that changing the house style is one edit rather than a hunt.
 *
 * @module config/grid-emphasis
 */

/**
 * Major line weight as a multiple of the minor line weight.
 * C4D ships 1.0 / 0.7 = 1.43; we round to 1.5 for 2D drafting legibility.
 */
export const GRID_MAJOR_EMPHASIS_RATIO = 1.5;

/**
 * Derive the major grid line weight from the minor one.
 *
 * The renderer calls this instead of reading a separate `majorGridWeight`
 * setting, which is why the two can no longer drift apart.
 */
export function deriveMajorGridWeight(minorWeight: number): number {
  // A non-positive or non-finite minor weight would erase the grid entirely;
  // fall back to the hairline the canvas would draw anyway.
  const safeMinor = Number.isFinite(minorWeight) && minorWeight > 0 ? minorWeight : 1;
  return safeMinor * GRID_MAJOR_EMPHASIS_RATIO;
}
