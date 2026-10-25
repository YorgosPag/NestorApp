/**
 * ADR-920 Β4.8 Β1 — the ONE road from a breakline's WORLD vertices to screen pixels.
 *
 * WORLD (ΕΓΣΑ mm) → `projectWorldPoints` (DISPLAY, ADR-650 §M10f) → `worldRingToScreen` (pixels) → SVG path.
 * Committed breaklines and automatic candidates both come through here, so neither can skip the projection
 * again — the candidate overlay used to, and drew 4·10⁵ mm away in every geo-referenced project.
 *
 * Pure — zero React/DOM/store; the projector is an argument.
 */
import type { Point2D, ViewTransform, Viewport } from '../../../rendering/types/Types';
import type { WorldToDisplayProjector } from '../../../systems/geo-referencing/geo-transform';
import { projectWorldPoints } from '../../../systems/topography/topo-display-frame';
import { screenPointsToSvgPath, worldRingToScreen } from '../preview-zone/world-ring-path';

export interface BreaklineScreenPath {
  /** SVG path data (`M…L…`, `Z` when closed). */
  readonly d: string;
  /** The vertices in screen pixels — where the vertex discs sit. */
  readonly vertices: readonly Point2D[];
}

export function breaklineScreenPath(
  worldVertices: readonly Point2D[],
  closed: boolean,
  projector: WorldToDisplayProjector | null,
  transform: ViewTransform,
  viewport: Viewport,
): BreaklineScreenPath {
  const vertices = worldRingToScreen(projectWorldPoints(worldVertices, projector), transform, viewport);
  return { d: screenPointsToSvgPath(vertices, closed), vertices };
}
