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

/**
 * «Two elevations at one position» is ONE rule here (ADR-650 v35), whether the two statements are survey shots or
 * breaklines — so its Δz bands are declared once and both checks read them.
 */
const COINCIDENT_Z_MEDIUM_MM = 100;
const COINCIDENT_Z_HIGH_MM = 1000;

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
  DUPLICATE_Z_INCOMPATIBLE_MM: COINCIDENT_Z_MEDIUM_MM,
  /** ΔZ ≥ 1.00 m between coincident points ⇒ `high`. */
  DUPLICATE_Z_HIGH_MM: COINCIDENT_Z_HIGH_MM,

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

  // ── Boundary elevation coverage (ADR-725) ───────────────────────────────────
  /**
   * Below 2% of the plot area, an uncovered sliver is the float/clipping noise of the
   * triangle∩boundary intersection itself — not missing ground. Above it, there is genuinely
   * no surface over part of the parcel, and the earthworks table silently counts zero there.
   */
  COVERAGE_GAP_MIN_FRACTION: 0.02,
  /** A fifth of the plot with no ground at all ⇒ `high`: the volume table is wrong, not optimistic. */
  COVERAGE_GAP_HIGH_FRACTION: 0.2,
  /**
   * A triangle is a BRIDGE — it spans a hole in the survey rather than describing measured
   * ground — when its longest edge exceeds `k ×` the MEDIAN edge length of the same surface.
   *
   * Self-calibrating on purpose, and this is the whole point: ESRI's «Delineate TIN Data Area»
   * (the industry answer to exactly this question) derives its Maximum Edge Length from the
   * average node spacing of the data — «provide a value larger than the average spacing» — and
   * refuses to name an absolute metre value, because a survey shot every 2 m and one shot every
   * 40 m are both valid, merely at different scales. An absolute threshold here would flag every
   * rural survey and stay blind on every dense urban one.
   *
   * MEDIAN, not mean — the same reason `ELEVATION_BUST_MAD_MULTIPLIER` above uses median+MAD: a
   * handful of huge bridges must not be allowed to raise their own threshold.
   *
   * `3`: Delaunay already maximises the minimum interior angle, so on an evenly-shot survey the
   * edge lengths cluster tightly around the median. 3× stays quiet through that natural spread
   * and fires only when a triangle genuinely JUMPS across a gap.
   */
  BRIDGING_EDGE_MEDIAN_MULTIPLIER: 3,
  /**
   * Below a quarter, the bridged area is the perimeter ring every survey has — the triangles
   * that reach from the last shot inside to the first shot outside. Flagging that would fire on
   * every correctly surveyed small plot, and a QA rule that cries wolf stops being read.
   */
  INTERPOLATED_MIN_FRACTION: 0.25,
  /** More than half the plot resting on interpolation ⇒ `high`: the volume is mostly guesswork. */
  INTERPOLATED_HIGH_FRACTION: 0.5,

  // ── Breakline elevation conflicts (ADR-920 Β4.8 Τ.3) ────────────────────────
  /**
   * The builder already dropped float-noise agreement (`elevationsAgree`) — what reaches QA is a REAL second elevation,
   * and the overruled breakline has really been bent to the kept one. So nothing here is silent (unlike Carlson's
   * «Highlight Crossing Breaklines» tolerance filter, which hides what is under it): the Δz only TRIAGES.
   *
   * The bands are the duplicate points' bands, on purpose — «two elevations at one position» is ONE rule in this
   * system (`surveyFactsOf`, ADR-650 v35), and a 30 cm contradiction must not be `medium` as two shots yet `low` as
   * two breaklines. Below `MEDIUM` ⇒ `low` (a glance), from `MEDIUM` ⇒ `medium`, from `HIGH` ⇒ `high`.
   */
  BREAKLINE_CONFLICT_MEDIUM_DZ_MM: COINCIDENT_Z_MEDIUM_MM,
  BREAKLINE_CONFLICT_HIGH_DZ_MM: COINCIDENT_Z_HIGH_MM,
  /**
   * ADR-920 Β3.6 — the resolve preview warns when a rule would change a line's GRADE next to the meeting point by more
   * than this (rise / run): 0.25 = 1:4 ≈ 14°, the steepest a mown embankment is usually built. A Δz that is nothing
   * over 20 m can be a cliff over 30 cm, and neither Civil 3D nor 12d shows that before Resolve. A warning, never a
   * block — a kerb or a wall breakline legitimately kinks.
   */
  BREAKLINE_RESOLUTION_GRADE_WARN: 0.25,

  // ── Report-wide cap ─────────────────────────────────────────────────────────
  /**
   * Max flags PER KIND kept in the report (most-severe first); the rest are counted into
   * `droppedByCap` and surfaced, never silently dropped. Keeps a pathologically rough
   * surface from producing thousands of markers.
   */
  MAX_FLAGS_PER_KIND: 50,
} as const;
