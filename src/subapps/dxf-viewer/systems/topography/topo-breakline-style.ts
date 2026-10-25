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
 * Pure — zero React/DOM/store. Read by the 2D overlay now and the 3D layer (Β2).
 *
 * @module systems/topography/topo-breakline-style
 */

import type { BreaklineElevationSource } from './topo-types';
import {
  AUTO_BREAKLINE_CORNER_DOT_PX,
  AUTO_BREAKLINE_STROKE_PX,
} from './auto-breaklines/auto-breakline-review-style';

/** Dash pattern (CSS px, SVG `stroke-dasharray`) per provenance. `null` = solid. */
const DASH_BY_SOURCE: Readonly<Record<BreaklineElevationSource, string | null>> = {
  elevation: null,
  proximity: '8 4',
  surface: '2 4',
};

export const TOPO_BREAKLINE_STROKE_PX = {
  stroke: AUTO_BREAKLINE_STROKE_PX.approved,
  casing: AUTO_BREAKLINE_STROKE_PX.focused,
} as const;

/** Vertex disc diameter (CSS px) — where the z is defined. Same disc as a candidate's corners. */
export const TOPO_BREAKLINE_VERTEX_DOT_PX = AUTO_BREAKLINE_CORNER_DOT_PX;

/** The dash of a breakline, given its (possibly unknown) elevation provenance. */
export function breaklineDash(source: BreaklineElevationSource | undefined): string | null {
  return source ? DASH_BY_SOURCE[source] : null;
}
