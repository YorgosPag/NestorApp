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
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';
import { fillRingsEvenOdd } from './bim-polygon-render';
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
 * Draw the projected top-view feature edges (crease/boundary lines) — the interior detail + crisp
 * outline. Shared by {@link drawMeshSilhouette} (over the raster fill) and {@link drawMeshFill} (over
 * the faithful triangle fill), so the edge-draw lives in ONE place (N.18, no parallel twin).
 */
function drawFeatureEdges(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (p: { x: number; y: number }) => { x: number; y: number },
  toWorld: (mx: number, my: number) => { x: number; y: number },
  edges: readonly SilSegment[] | null | undefined,
  edgeColor: string,
  lineWidth: number,
): void {
  if (!edges || edges.length === 0) return;
  ctx.strokeStyle = edgeColor;
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

/**
 * Draw the mesh silhouette (fill + outline) and interior top-view edges.
 * Returns `true` if a silhouette was drawn, `false` if none was cached.
 */
export function drawMeshSilhouette(args: DrawMeshSilhouetteArgs): boolean {
  const { ctx, worldToScreen, silhouette, edges, transform, palette, lineWidth } = args;
  if (!silhouette || silhouette.length < 3) return false;

  const toWorld = makePlanToWorld(transform);
  const outline = silhouette.map((p) => toWorld(p.x, p.y));

  // Fill + outline. FULL SSoT (bim-body-fill) — κοινό adaptive layer με όλα τα BIM body fills.
  ctx.fillStyle = adaptFillTintForCanvas(palette.fill);
  tracePolygon(ctx, worldToScreen, outline);
  ctx.fill();
  ctx.strokeStyle = palette.stroke;
  ctx.lineWidth = lineWidth;
  tracePolygon(ctx, worldToScreen, outline);
  ctx.stroke();

  // Interior top-view feature edges (seat/back/legs / reflector detail).
  drawFeatureEdges(ctx, worldToScreen, toWorld, edges, palette.edge, lineWidth);
  return true;
}

export interface DrawMeshFillArgs {
  readonly ctx: CanvasRenderingContext2D;
  readonly worldToScreen: (p: { x: number; y: number }) => { x: number; y: number };
  /** Flat-packed CCW plan triangles `[x1,y1,x2,y2,x3,y3,…]` (from `computeTopFillTriangles`). */
  readonly triangles: Float32Array | null;
  readonly edges: readonly SilSegment[] | null;
  readonly transform: MeshSilhouetteTransform;
  readonly palette: MeshSilhouettePalette;
  readonly lineWidth: number;
}

/**
 * ADR-683 §10.9 — draw the **faithful top-view fill**: the mesh's actual projected triangles as ONE
 * filled path (nonzero winding → exact union footprint, incl. every disjoint region + holes), then
 * the projected feature edges on top for the crisp outline/detail. Shares the exact plan→world mapper
 * with {@link drawMeshSilhouette} (one alignment SSoT). Returns `true` if anything was drawn.
 *
 * Why one path + single fill (not per-triangle fill): a single `ctx.fill()` anti-aliases only the
 * OUTER boundary — internal shared triangle edges tile seamlessly. Per-triangle fills would leave
 * faint AA seams across the whole footprint. All triangles are pre-normalised CCW upstream, so nonzero
 * winding never cancels overlaps into phantom holes.
 */
export function drawMeshFill(args: DrawMeshFillArgs): boolean {
  const { ctx, worldToScreen, triangles, edges, transform, palette, lineWidth } = args;
  if (!triangles || triangles.length < 6) return false;

  const toWorld = makePlanToWorld(transform);
  ctx.fillStyle = adaptFillTintForCanvas(palette.fill);
  ctx.beginPath();
  for (let i = 0; i + 5 < triangles.length; i += 6) {
    const a = worldToScreen(toWorld(triangles[i], triangles[i + 1]));
    const b = worldToScreen(toWorld(triangles[i + 2], triangles[i + 3]));
    const c = worldToScreen(toWorld(triangles[i + 4], triangles[i + 5]));
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.closePath();
  }
  ctx.fill();

  // Projected top-view feature edges (crease/boundary) on top — the crisp outline + interior detail.
  drawFeatureEdges(ctx, worldToScreen, toWorld, edges, palette.edge, lineWidth);
  return true;
}

export interface DrawMeshContourFillArgs {
  readonly ctx: CanvasRenderingContext2D;
  readonly worldToScreen: (p: { x: number; y: number }) => { x: number; y: number };
  /** Flat rings — outer components + holes (from `computeTopFillContours`) — one even-odd fill. */
  readonly contours: readonly (readonly SilPoint[])[] | null;
  readonly edges: readonly SilSegment[] | null;
  readonly transform: MeshSilhouetteTransform;
  readonly palette: MeshSilhouettePalette;
  readonly lineWidth: number;
}

/**
 * ADR-683 §10.9 (revised) — draw the **cached, simplified** top-view fill: a few-point,
 * multi-component + hole-aware footprint filled with the shared even-odd painter
 * ({@link fillRingsEvenOdd}, ADR-684), then the projected feature edges on top for the crisp
 * outline/detail. Big-player practice: the fidelity Giorgio approved (every disjoint region +
 * real holes) at a **fraction** of the per-zoom draw cost of the raw-triangle path
 * ({@link drawMeshFill}). Shares the exact plan→world mapper with the whole mesh-draw family
 * (one alignment SSoT). Returns `true` if anything was drawn.
 */
export function drawMeshContourFill(args: DrawMeshContourFillArgs): boolean {
  const { ctx, worldToScreen, contours, edges, transform, palette, lineWidth } = args;
  if (!contours || contours.length === 0) return false;

  const toWorld = makePlanToWorld(transform);
  const toScreen = (p: { x: number; y: number }): { x: number; y: number } =>
    worldToScreen(toWorld(p.x, p.y));
  ctx.fillStyle = adaptFillTintForCanvas(palette.fill);
  fillRingsEvenOdd(ctx, toScreen, contours);

  // Projected top-view feature edges (crease/boundary) on top — the crisp outline + interior detail.
  drawFeatureEdges(ctx, worldToScreen, toWorld, edges, palette.edge, lineWidth);
  return true;
}

/** One material slot to paint: its (multi-component) contours + its palette (ADR-683 Φ5). */
export interface MeshSlotFill {
  readonly contours: readonly (readonly SilPoint[])[];
  readonly palette: MeshSilhouettePalette;
}

export interface DrawMeshSlotSilhouettesArgs {
  readonly ctx: CanvasRenderingContext2D;
  readonly worldToScreen: (p: { x: number; y: number }) => { x: number; y: number };
  /** Slots pre-ordered lowest→highest so higher parts paint over lower (top-down occlusion). */
  readonly slots: readonly MeshSlotFill[];
  readonly transform: MeshSilhouetteTransform;
  readonly lineWidth: number;
}

/**
 * ADR-683 Φ5 — draw **per-slot material poché**: fill + outline each material region in its own
 * palette, in the given (lowest→highest) order so overlaps read as the top-down view. Shares the
 * exact plan→world mapper + polygon tracer with {@link drawMeshSilhouette} (one alignment SSoT).
 * Returns `true` if anything was drawn.
 */
export function drawMeshSlotSilhouettes(args: DrawMeshSlotSilhouettesArgs): boolean {
  const { ctx, worldToScreen, slots, transform, lineWidth } = args;
  if (slots.length === 0) return false;

  const toWorld = makePlanToWorld(transform);
  let drew = false;
  for (const slot of slots) {
    for (const contour of slot.contours) {
      if (contour.length < 3) continue;
      const outline = contour.map((p) => toWorld(p.x, p.y));
      ctx.fillStyle = adaptFillTintForCanvas(slot.palette.fill);
      tracePolygon(ctx, worldToScreen, outline);
      ctx.fill();
      ctx.strokeStyle = slot.palette.stroke;
      ctx.lineWidth = lineWidth;
      tracePolygon(ctx, worldToScreen, outline);
      ctx.stroke();
      drew = true;
    }
  }
  return drew;
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
