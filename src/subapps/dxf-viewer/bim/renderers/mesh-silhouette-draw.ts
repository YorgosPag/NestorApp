/**
 * mesh-silhouette-draw — shared 2D plan-view draw helper for mesh-based BIM
 * entities (ADR-411). Used by `FurnitureRenderer` and `MepFixtureRenderer` to
 * paint the per-asset top-view silhouette (outline + fill) plus the interior
 * feature edges ("top view" detail lines), perfectly aligned via one plan→world
 * mapper.
 *
 * Entity-agnostic: the caller passes the cached silhouette/edges (from
 * `bimMeshCache`), the entity's plan transform, a palette and its draw context.
 * Returns `true` when a silhouette was drawn (so the caller skips its parametric
 * fallback symbol), `false` when no silhouette is cached yet.
 *
 * ADR-040: pure drawing — no store subscriptions. The caller (a micro-leaf
 * renderer) owns the `ctx` + `worldToScreen` at draw time.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 */

import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import type { SilPoint, SilSegment } from '../mesh-library/mesh-silhouette';

const M_TO_MM = 1000;

/** Plan transform of the placed entity (insertion point + rotation + units). */
export interface MeshSilhouetteTransform {
  readonly position: { readonly x: number; readonly y: number };
  readonly rotationDeg: number;
  readonly sceneUnits: SceneUnits;
}

/** Colours for the silhouette outline / fill / interior detail lines. */
export interface MeshSilhouettePalette {
  readonly stroke: string;
  readonly fill: string;
  readonly edge: string;
}

export interface DrawMeshSilhouetteArgs {
  readonly ctx: CanvasRenderingContext2D;
  readonly worldToScreen: (p: { x: number; y: number }) => { x: number; y: number };
  readonly silhouette: readonly SilPoint[] | null;
  readonly edges: readonly SilSegment[] | null;
  readonly transform: MeshSilhouetteTransform;
  readonly palette: MeshSilhouettePalette;
  /** Base outline line width (px); interior edges use this − 1 (min 1). */
  readonly lineWidth: number;
}

/**
 * Plan-meters (relative to placement origin) → WORLD canvas-unit mapper for the
 * entity's position + rotation. Shared by the silhouette outline and the interior
 * edges so they stay perfectly aligned.
 */
function makePlanToWorld(
  t: MeshSilhouetteTransform,
): (mx: number, my: number) => { x: number; y: number } {
  const s = mmToSceneUnits(t.sceneUnits) * M_TO_MM; // plan-meters → scene units
  const rad = (t.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return (mx: number, my: number) => {
    const lx = mx * s, ly = my * s;
    return {
      x: t.position.x + (lx * cos - ly * sin),
      y: t.position.y + (lx * sin + ly * cos),
    };
  };
}

/**
 * Draw the mesh silhouette (fill + outline) and interior top-view edges.
 * Returns `true` if a silhouette was drawn, `false` if none was cached.
 */
export function drawMeshSilhouette(args: DrawMeshSilhouetteArgs): boolean {
  const { ctx, worldToScreen, silhouette, edges, transform, palette, lineWidth } = args;
  if (!silhouette || silhouette.length < 3) return false;

  const toWorld = makePlanToWorld(transform);
  const outline = silhouette.map((p) => toWorld(p.x, p.y));

  // Fill + outline.
  ctx.fillStyle = palette.fill;
  tracePolygon(ctx, worldToScreen, outline);
  ctx.fill();
  ctx.strokeStyle = palette.stroke;
  ctx.lineWidth = lineWidth;
  tracePolygon(ctx, worldToScreen, outline);
  ctx.stroke();

  // Interior top-view feature edges (seat/back/legs / reflector detail).
  if (edges && edges.length > 0) {
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = Math.max(1, lineWidth - 1);
    ctx.beginPath();
    for (const seg of edges) {
      const a = worldToScreen(toWorld(seg.x1, seg.y1));
      const b = worldToScreen(toWorld(seg.x2, seg.y2));
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }
  return true;
}

function tracePolygon(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (p: { x: number; y: number }) => { x: number; y: number },
  pts: ReadonlyArray<{ x: number; y: number }>,
): void {
  if (pts.length < 3) return;
  ctx.beginPath();
  const first = worldToScreen(pts[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const s = worldToScreen(pts[i]);
    ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();
}
