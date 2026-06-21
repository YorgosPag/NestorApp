/**
 * ghost-status-outline — SSoT that resolves the footprint polygon used to draw the 🔴 status
 * ghost (`drawStatusGhostPolygon`) for ANY BIM preview entity, regardless of its geometry shape:
 *   - columns / beams expose a ready `geometry.outline.vertices` polygon;
 *   - walls expose `geometry.outerEdge` + `geometry.innerEdge` (two `Polyline3D` faces, `.points`)
 *     → the footprint loop = outer face forward + inner face reversed.
 *
 * Why this exists: the red-overlap render path read `geometry.outline.vertices` only, so the wall
 * ghost — which has no `outline.vertices` — never drew red even when overlap was detected
 * (ADR-508 bug). One resolver now feeds every status-ghost path. Pure, plan-space (x,y).
 *
 * @see ./ghost-status-polygon-draw.ts — consumer (the red schematic drawer)
 */

interface PlanVertex {
  readonly x: number;
  readonly y: number;
}

interface StatusGhostGeometryLike {
  readonly outline?: { readonly vertices?: readonly PlanVertex[] };
  readonly outerEdge?: { readonly points?: readonly PlanVertex[] };
  readonly innerEdge?: { readonly points?: readonly PlanVertex[] };
}

/**
 * Footprint polygon (≥3 plan vertices) for the status ghost, or `null` when the entity carries
 * no usable outline. Columns/beams → `outline.vertices`; walls → outer + reversed inner loop.
 */
export function resolveStatusGhostOutline(entity: unknown): readonly PlanVertex[] | null {
  const geometry = (entity as { geometry?: StatusGhostGeometryLike })?.geometry;
  if (!geometry) return null;

  const direct = geometry.outline?.vertices;
  if (direct && direct.length >= 3) return direct;

  const outer = geometry.outerEdge?.points;
  const inner = geometry.innerEdge?.points;
  if (outer && inner && outer.length >= 2 && inner.length >= 2) {
    const loop: PlanVertex[] = [
      ...outer.map((v) => ({ x: v.x, y: v.y })),
      ...[...inner].reverse().map((v) => ({ x: v.x, y: v.y })),
    ];
    return loop.length >= 3 ? loop : null;
  }
  return null;
}
