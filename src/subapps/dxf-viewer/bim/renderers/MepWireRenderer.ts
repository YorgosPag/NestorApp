/**
 * MepWireRenderer — ADR-408 Φ7. Pure 2D draw of derived home-run circuit wires.
 *
 * Takes the routed `CircuitWirePath[]` (SSoT `mep-wire-routing.ts`) and strokes
 * each circuit as a daisy-chain polyline in its system colour, with a small
 * **home-run arrowhead** at the panel end (Revit's home-run tick). Event-time,
 * no store/subscription — instantiated by the `HomeRunWiresOverlay` micro-leaf
 * inside its draw `useEffect` (mirror of `EnvelopeRenderer`), ADR-040 compliant.
 *
 * @see ../mep-systems/mep-wire-routing.ts
 * @see ../../components/dxf-layout/HomeRunWiresOverlay.tsx
 */

import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import {
  buildWirePolyline,
  type CircuitWirePath,
  type CircuitHostSegment,
} from '../mep-systems/mep-wire-routing';
import { getOrientedWaypoints, type WireWaypointMap } from '../mep-systems/mep-wire-waypoints';
import type { WireWaypointHover } from '../mep-systems/mep-wire-waypoint-ui-store';

const WIRE_LINE_WIDTH = 1.5;
const WIRE_HIGHLIGHT_WIDTH = 3; // hovered circuit core stroke (px)
const WIRE_HALO_WIDTH = 8; // hovered circuit translucent glow under the core (px)
const WIRE_HALO_ALPHA = 0.3;
const HOME_RUN_ARROW_LEN = 11; // px — arrowhead size in screen space (zoom-independent)
const HOME_RUN_ARROW_HALF_RAD = 0.42; // half-angle of the arrowhead wings (rad)

/** Stroke the polyline through `screen` (assumes ≥2 points). */
function strokePolyline(ctx: CanvasRenderingContext2D, screen: readonly Point2D[]): void {
  ctx.beginPath();
  ctx.moveTo(screen[0]!.x, screen[0]!.y);
  for (let i = 1; i < screen.length; i++) ctx.lineTo(screen[i]!.x, screen[i]!.y);
  ctx.stroke();
}

/**
 * Stroke a single circuit's polyline + its home-run arrowhead. When `highlight`
 * is set (cursor hovering this circuit, mirror of the 2D DXF entity hover) the run
 * is drawn with a translucent halo under a thicker core, so the whole wire lights
 * up — not just the node handles.
 */
function drawOneWire(
  ctx: CanvasRenderingContext2D,
  path: CircuitWirePath,
  transform: ViewTransform,
  viewport: Viewport,
  highlight: boolean,
): void {
  const pts = buildWirePolyline(path);
  if (pts.length < 2) return;
  const screen = pts.map((p) => CoordinateTransforms.worldToScreen({ x: p.x, y: p.y }, transform, viewport));
  ctx.strokeStyle = path.colorHex;
  ctx.fillStyle = path.colorHex;
  if (highlight) {
    ctx.save();
    ctx.globalAlpha = WIRE_HALO_ALPHA;
    ctx.lineWidth = WIRE_HALO_WIDTH;
    strokePolyline(ctx, screen);
    ctx.restore();
    ctx.lineWidth = WIRE_HIGHLIGHT_WIDTH;
  }
  strokePolyline(ctx, screen);
  if (highlight) ctx.lineWidth = WIRE_LINE_WIDTH;
  drawHomeRunArrow(ctx, screen[0]!, screen[1]!);
}

/**
 * Filled arrowhead at the panel end (`tip`), pointing back toward the panel from
 * the first fixture (`from`). The home-run marker that reads "this run returns to
 * the panel" — Revit's home-run arrow.
 */
function drawHomeRunArrow(ctx: CanvasRenderingContext2D, tip: Point2D, from: Point2D): void {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const wing1 = angle + Math.PI - HOME_RUN_ARROW_HALF_RAD;
  const wing2 = angle + Math.PI + HOME_RUN_ARROW_HALF_RAD;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x + HOME_RUN_ARROW_LEN * Math.cos(wing1), tip.y + HOME_RUN_ARROW_LEN * Math.sin(wing1));
  ctx.lineTo(tip.x + HOME_RUN_ARROW_LEN * Math.cos(wing2), tip.y + HOME_RUN_ARROW_LEN * Math.sin(wing2));
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw every circuit wire path onto the overlay canvas. Each path carries its own
 * `style` (Revit "Wiring Type"), read inside {@link buildWirePolyline} — the
 * renderer stays style-agnostic.
 */
export function drawCircuitWires(
  ctx: CanvasRenderingContext2D,
  paths: readonly CircuitWirePath[],
  transform: ViewTransform,
  viewport: Viewport,
  highlightSystemId?: string | null,
): void {
  ctx.save();
  ctx.lineWidth = WIRE_LINE_WIDTH;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  for (const path of paths) drawOneWire(ctx, path, transform, viewport, path.systemId === highlightSystemId);
  ctx.restore();
}

// ─── Waypoint handles (ADR-408 Φ7 FU#3 — editable «Wire Vertex») ────────────────

const HANDLE_RADIUS_PX = 4; // screen-space node dot radius (zoom-independent)
const HANDLE_HOVER_RADIUS_PX = 6; // highlighted node ring
const HANDLE_STROKE_PX = 1.5;
const INSERT_GHOST_RADIUS_PX = 5; // hollow "+" preview where a vertex would be born

/** A filled white-cored dot in the circuit colour — a draggable waypoint handle. */
function drawNodeHandle(ctx: CanvasRenderingContext2D, p: Point2D, color: string, radius: number): void {
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = HANDLE_STROKE_PX;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Hollow ring + "+" ghost marking where a new vertex would be inserted on hover. */
function drawInsertGhost(ctx: CanvasRenderingContext2D, p: Point2D, color: string): void {
  ctx.beginPath();
  ctx.arc(p.x, p.y, INSERT_GHOST_RADIUS_PX, 0, Math.PI * 2);
  ctx.lineWidth = HANDLE_STROKE_PX;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x - INSERT_GHOST_RADIUS_PX + 1, p.y);
  ctx.lineTo(p.x + INSERT_GHOST_RADIUS_PX - 1, p.y);
  ctx.moveTo(p.x, p.y - INSERT_GHOST_RADIUS_PX + 1);
  ctx.lineTo(p.x, p.y + INSERT_GHOST_RADIUS_PX - 1);
  ctx.stroke();
}

/**
 * Draw the editable waypoint handles of the **active** circuit (Revit shows wire
 * grips only on the selected wire): a dot at every existing vertex, plus the hover
 * affordance — a highlight ring on the hovered vertex (`'node'`) or an insert "+"
 * ghost on a hovered segment (`'insert'`). Screen-space, style-agnostic.
 */
export function drawWaypointHandles(
  ctx: CanvasRenderingContext2D,
  segments: readonly CircuitHostSegment[],
  waypoints: WireWaypointMap | undefined,
  color: string,
  hover: WireWaypointHover | null,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  for (const seg of segments) {
    const wps = getOrientedWaypoints(waypoints, seg.keyA, seg.keyB);
    for (const wp of wps) {
      const s = CoordinateTransforms.worldToScreen({ x: wp.x, y: wp.y }, transform, viewport);
      drawNodeHandle(ctx, s, color, HANDLE_RADIUS_PX);
    }
  }
  if (hover) {
    const s = CoordinateTransforms.worldToScreen({ x: hover.x, y: hover.y }, transform, viewport);
    if (hover.kind === 'node') drawNodeHandle(ctx, s, color, HANDLE_HOVER_RADIUS_PX);
    else drawInsertGhost(ctx, s, color);
  }
  ctx.restore();
}
