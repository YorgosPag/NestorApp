/**
 * auto-breakline-review-style — the ONE stroke vocabulary of a breakline candidate under review.
 *
 * The colours of the review («πράσινη = θα μπει, γκρι = θα αγνοηθεί, άλως = αυτήν κοιτάω») have had
 * a single source since M8β/Γ: `UI_COLORS`. Their WIDTHS did not — the 2D preview overlay carried
 * them as a private `STROKE_WIDTH` const, and the 3D view had no widths at all because it could not
 * express them. Now that it can (ADR-650 M8β/Γ v2, fat lines), «the same review, seen from two
 * views» is a promise about thickness too, and a promise that lives in two files is a promise that
 * drifts on the first tweak.
 *
 * Widths are CSS px — screen sizes in BOTH views, at any zoom and any camera distance. That is the
 * point of a review marker: an emphasis that shrank as the engineer pulled back would disappear at
 * exactly the framing where he is trying to find it.
 *
 * @module systems/topography/auto-breaklines/auto-breakline-review-style
 * @enterprise ADR-650 — Topography
 */

/**
 * Stroke widths (CSS px) per review state.
 *
 * `halo` is drawn UNDER `focused` in the selection colour — the cartographic casing that makes a
 * line legible over an unknown background (a busy plan in 2D, shaded relief in 3D). The 2× ratio
 * leaves ~2.5 px of glow on each side: enough to read as «lit», not enough to erase what it crosses.
 */
export const AUTO_BREAKLINE_STROKE_PX = {
  rejected: 2,
  approved: 3,
  focused: 5,
  halo: 10,
} as const;

/** Casing transparency — enough to glow, not so much that it paints over what is underneath. */
export const AUTO_BREAKLINE_HALO_OPACITY = 0.55;

/**
 * Diameter (CSS px) of a corner marker on the focused candidate.
 *
 * 8, where the v1 square dot was 7: a disc of diameter d covers ~78 % of the square of side d, so
 * an unchanged number would have read as a size REDUCTION the moment the dots became round.
 */
export const AUTO_BREAKLINE_CORNER_DOT_PX = 8;
