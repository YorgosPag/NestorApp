/**
 * ADR-650 M5α — QA thresholds. NOT legal tolerances (those live in `greek-survey-rules.ts`,
 * fed by law); these are BLUNDER-DETECTION heuristics — the tunable knobs Civil 3D «Surface
 * → Statistics/Simplify» and Trimble Business Center «blunder detection» expose to the
 * surveyor. Defaults are deliberately conservative (flag the obvious, stay quiet on natural
 * roughness), documented per value so the engineer can reason about every number.
 *
 * All distances are canonical mm (ADR-462). No inline `/1000` — presentation conversion is
 * the panel's job via the units SSoT.
 *
 * Config file (data, no logic) — exempt from the 500-line rule.
 */

export const TOPO_QA_CONFIG = {
  // ── Elevation busts (surface-node outliers) ─────────────────────────────────
  /**
   * A node is a bust when its residual (|Z − median of TIN-neighbour Z|) exceeds
   * `median + MAD_MULTIPLIER · MAD` of ALL residuals. 3.5·MAD ≈ the classic robust
   * outlier fence (Iglewicz–Hoaglin modified z-score ≈ 3.5), MAD-based so a few real
   * busts do not inflate the threshold the way a standard deviation would.
   */
  ELEVATION_BUST_MAD_MULTIPLIER: 3.5,
  /** Noise floor: never flag a residual below 0.20 m — that is survey scatter, not a typo. */
  ELEVATION_BUST_MIN_RESIDUAL_MM: 200,
  /** Residual ≥ 2.00 m ⇒ `high` (a metre-scale bust is almost always a keyed-in typo). */
  ELEVATION_BUST_HIGH_RESIDUAL_MM: 2000,

  // ── Duplicate / coincident points ───────────────────────────────────────────
  /** Two points closer than 5 cm planimetrically are «the same spot» — candidates. */
  DUPLICATE_XY_TOLERANCE_MM: 50,
  /** …flagged only when their Z disagrees by more than 10 cm (a real contradiction). */
  DUPLICATE_Z_INCOMPATIBLE_MM: 100,
  /** ΔZ ≥ 1.00 m between coincident points ⇒ `high`. */
  DUPLICATE_Z_HIGH_MM: 1000,

  // ── Closed-ring validity (boundary / closed breaklines) ─────────────────────
  /** A ring with planimetric area below 1 m² is degenerate (a pick slip, not a plot). */
  RING_MIN_AREA_MM2: 1_000_000,

  // ── Missing breaklines (unconstrained steep edges) ──────────────────────────
  /**
   * Dihedral angle between the two triangles sharing a TIN edge. Above 35° the surface
   * folds sharply; if no breakline pins that edge, the TIN may be smoothing across a real
   * ridge/ditch (ADR-650 §5). Below this is ordinary terrain relief — stay quiet.
   */
  MISSING_BREAKLINE_ANGLE_DEG: 35,
  /** ≥ 60° fold with no constraint ⇒ `high` (a cliff the surface is almost certainly wrong about). */
  MISSING_BREAKLINE_HIGH_ANGLE_DEG: 60,

  // ── Report-wide cap ─────────────────────────────────────────────────────────
  /**
   * Max flags PER KIND kept in the report (most-severe first); the rest are counted into
   * `droppedByCap` and surfaced, never silently dropped. Keeps a pathologically rough
   * surface from producing thousands of markers.
   */
  MAX_FLAGS_PER_KIND: 50,
} as const;
