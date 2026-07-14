/**
 * ADR-650 M8β/Γ — auto-breakline extraction thresholds. The knobs Civil 3D exposes behind
 * «Extract feature lines from surface» / CloudCompare behind ridge-valley extraction: what
 * counts as a break, and how much of a break is worth showing the engineer.
 *
 * Deliberately conservative — a candidate the engineer has to delete costs more trust than
 * one he has to draw by hand. Distances are canonical mm (ADR-462); no presentation maths here.
 *
 * Config file (data, no logic) — exempt from the 500-line rule.
 */

import { TOPO_QA_CONFIG } from '../qa/topo-qa-config';

export const AUTO_BREAKLINE_CONFIG = {
  /**
   * A TIN edge is a break candidate at the SAME fold the QA «καμπανάκι» already calls suspicious
   * (`MISSING_BREAKLINE_ANGLE_DEG`, 35°) — deliberately derived, not re-typed: the two features
   * must never disagree about what «a sharp fold» is. Raise it there, both follow.
   */
  MIN_FOLD_ANGLE_DEG: TOPO_QA_CONFIG.MISSING_BREAKLINE_ANGLE_DEG,

  /**
   * A chain shorter than 3 edges is not a feature line — it is triangulation noise: two or
   * three neighbouring triangles that happen to tilt against each other. Real breaks (a road
   * edge, a ditch) run for dozens of edges across the survey.
   */
  MIN_CHAIN_EDGES: 3,

  /**
   * …and never propose anything under 5 m long. Below that scale a «ridge» is far more likely
   * a rock, a bush hit or a single mis-shot than a linear feature worth constraining the TIN with.
   */
  MIN_CHAIN_LENGTH_MM: 5_000,

  /**
   * Max candidates offered in one pass (longest first); the rest are counted and surfaced,
   * never silently dropped. A pathologically rough surface must not produce a list nobody
   * can review — mirrors `TOPO_QA_CONFIG.MAX_FLAGS_PER_KIND` in spirit.
   */
  MAX_CANDIDATES: 50,
} as const;
