/**
 * topo-breakline-style — the ONE stroke vocabulary of a COMMITTED breakline (ADR-920 Β4.8 Β1).
 *
 * The review vocabulary (`auto-breaklines/auto-breakline-review-style`) answers «will this proposal be
 * written?». This one answers the question the engineer asks of a breakline that already shapes the
 * ground: **«where did its elevation come from?»**. Civil 3D keeps that in Breakline Properties; Carlson
 * only highlights the edges in yellow. Here the LINE PATTERN carries it, so it is readable straight off the
 * plan and never by colour alone (WCAG 1.4.1):
 *
 *   elevation → solid · proximity → dashed (z borrowed from the nearest points) · surface → dotted (read off
 *   the TIN) · unknown (saved before provenance existed) → solid, and the panel says «unknown» — never a
 *   silent guess.
 *
 * Widths are borrowed, not re-declared: a committed breakline weighs exactly what an APPROVED candidate
 * weighed, so «Προσθήκη» changes the colour of the line the engineer was looking at — not its size. The
 * dark casing is one step heavier: the breakline sits ON TOP of the drawing line it was picked from, and
 * without a casing it would vanish into it.
 *
 * ### Patterns are VISIBLE on-screen lengths, never a renderer's dash array (Β2.0)
 * v1 stored SVG `stroke-dasharray` strings (`'8 4'`, `'2 4'`) and drew them with ROUND caps — and a round
 * cap adds half the stroke width to each end of every dash. At 3 px a `2 4` dot became a 5 px dash over a
 * 1 px gap, and `8 4` became 11 over 1: the three provenances were all but indistinguishable on the plan,
 * while every test stayed green because it compared strings. So the vocabulary now states what the eye
 * sees (`dashPx` lit, `gapPx` dark), and each renderer converts it for its own cap geometry
 * ({@link breaklineSvgDasharray} for SVG round caps). One rule binds every renderer: **a dash is never
 * shorter than the line is wide** — a dot is as long as it is wide, which is why `surface` says `dashPx: 0`.
 *
 * Pure — zero React/DOM/store. Read by the 2D overlay and the 3D layer (Β2).
 *
 * @module systems/topography/topo-breakline-style
 */

import type { BreaklineElevationSource } from './topo-types';
import {
  AUTO_BREAKLINE_CORNER_DOT_PX,
  AUTO_BREAKLINE_STROKE_PX,
} from './auto-breaklines/auto-breakline-review-style';

/** A line pattern as the eye sees it, in CSS px: `dashPx` lit, then `gapPx` dark. `dashPx: 0` = dots. */
export interface BreaklineDashPattern {
  readonly dashPx: number;
  readonly gapPx: number;
}

/** Pattern per provenance. `null` = solid. */
const PATTERN_BY_SOURCE: Readonly<Record<BreaklineElevationSource, BreaklineDashPattern | null>> = {
  elevation: null,
  proximity: { dashPx: 8, gapPx: 4 },
  surface: { dashPx: 0, gapPx: 4 },
};

export const TOPO_BREAKLINE_STROKE_PX = {
  stroke: AUTO_BREAKLINE_STROKE_PX.approved,
  casing: AUTO_BREAKLINE_STROKE_PX.focused,
} as const;

/** Vertex disc diameter (CSS px) — where the z is defined. Same disc as a candidate's corners. */
export const TOPO_BREAKLINE_VERTEX_DOT_PX = AUTO_BREAKLINE_CORNER_DOT_PX;

/** Vertex disc outline width (CSS px) — the dark ring that keeps the disc readable on the casing. */
export const TOPO_BREAKLINE_VERTEX_OUTLINE_PX = 1.5;

/** The pattern of a breakline, given its (possibly unknown) elevation provenance. `null` = solid. */
export function breaklineDashPattern(
  source: BreaklineElevationSource | undefined,
): BreaklineDashPattern | null {
  return source ? PATTERN_BY_SOURCE[source] : null;
}

/**
 * The SVG `stroke-dasharray` that DRAWS `pattern` with round caps at `widthPx`, or `null` for solid.
 *
 * A round cap paints `widthPx / 2` past each end of a dash, so the array's dash is the visible dash minus
 * one width and its gap the visible gap plus one width — the period is unchanged. A visible dash shorter
 * than the width cannot exist with round caps; it clamps to a zero-length dash, which the cap turns into a
 * disc exactly `widthPx` across (the dot).
 */
export function breaklineSvgDasharray(
  pattern: BreaklineDashPattern | null,
  widthPx: number,
): string | null {
  if (!pattern) return null;
  const visibleDash = Math.max(pattern.dashPx, widthPx);
  return `${visibleDash - widthPx} ${pattern.gapPx + widthPx}`;
}

/**
 * The pattern as FLAT-ended dashes at `widthPx` (the 3D fat line: a dashed `LineMaterial` draws no caps),
 * or `null` for solid. Flat ends add nothing, so the gap is the visible gap; only the binding rule applies —
 * a dash is never shorter than the line is wide, which makes the `surface` dot a square as wide as the line.
 */
export function breaklineFlatCapDash(
  pattern: BreaklineDashPattern | null,
  widthPx: number,
): BreaklineDashPattern | null {
  return pattern ? { dashPx: Math.max(pattern.dashPx, widthPx), gapPx: pattern.gapPx } : null;
}
