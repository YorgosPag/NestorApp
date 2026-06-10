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
import { buildConductorTicks, GROUND_DOT_R } from '../mep-systems/mep-wire-conductor-ticks';
import { DEFAULT_CONDUCTORS, type ConductorBreakdown } from '../types/mep-system-types';
import type { WireWaypointHover } from '../mep-systems/mep-wire-waypoint-ui-store';
// SSoT grip language: a selected wire shows the SAME grips as every other selected
// entity (wall/DXF) — routed through the ONE grip facade (UnifiedGripRenderer), so
// size / colour / cold-warm-hot temperature / DPI all resolve in a single place. No
// hand-rolled grip sizes or colours here (CLAUDE.md "no magic numbers").
import { createGripRenderer, type GripRenderConfig } from '../../rendering/grips';

/**
 * ADR-408 Φ7 — default wire colour when the per-view `colorBySystem` toggle is
 * OFF. Mirrors the 3D `elem-mep-wire` fallback material (`0xb45309`) so the 2D
 * overlay and the 3D conduit agree on the un-systematised colour.
 */
export const DEFAULT_WIRE_COLOR = '#b45309';

const WIRE_LINE_WIDTH = 1.5;
const WIRE_HIGHLIGHT_WIDTH = 3; // hovered circuit core stroke (px)
const WIRE_HALO_WIDTH = 8; // hovered circuit translucent glow under the core (px)
const WIRE_HALO_ALPHA = 0.3;
const HOME_RUN_ARROW_LEN = 11; // px — arrowhead size in screen space (zoom-independent)
const HOME_RUN_ARROW_HALF_RAD = 0.42; // half-angle of the arrowhead wings (rad)
const CONDUCTOR_TICK_WIDTH = 1; // px — home-run conductor slash stroke width

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
  color: string,
): void {
  const pts = buildWirePolyline(path);
  if (pts.length < 2) return;
  const screen = pts.map((p) => CoordinateTransforms.worldToScreen({ x: p.x, y: p.y }, transform, viewport));
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
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
  drawConductorTicks(ctx, screen[0]!, screen[1]!, path.conductors ?? DEFAULT_CONDUCTORS);
}

/**
 * Stroke the home-run conductor tick marks (Revit "#wires"): the geometry comes
 * from the SSoT {@link buildConductorTicks} — long slash per hot, short per
 * neutral, short + dot per ground — so this only strokes the returned segments.
 */
function drawConductorTicks(
  ctx: CanvasRenderingContext2D,
  tip: Point2D,
  from: Point2D,
  conductors: ConductorBreakdown,
): void {
  const ticks = buildConductorTicks(tip, from, conductors);
  if (ticks.length === 0) return;
  ctx.save();
  ctx.lineWidth = CONDUCTOR_TICK_WIDTH;
  for (const tick of ticks) {
    ctx.beginPath();
    ctx.moveTo(tick.a.x, tick.a.y);
    ctx.lineTo(tick.b.x, tick.b.y);
    ctx.stroke();
    if (tick.kind === 'ground') {
      ctx.beginPath();
      ctx.arc(tick.b.x, tick.b.y, GROUND_DOT_R, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
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
 *
 * ADR-408 Φ7 — `colorBySystem` (default `true`) gates the per-view colour-by-system
 * master toggle: OFF ⇒ every wire strokes in {@link DEFAULT_WIRE_COLOR} instead of
 * its System's colour (matching the 3D conduit fallback).
 */
export function drawCircuitWires(
  ctx: CanvasRenderingContext2D,
  paths: readonly CircuitWirePath[],
  transform: ViewTransform,
  viewport: Viewport,
  highlightSystemId?: string | null,
  colorBySystem = true,
): void {
  ctx.save();
  ctx.lineWidth = WIRE_LINE_WIDTH;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  for (const path of paths) {
    const color = colorBySystem ? path.colorHex : DEFAULT_WIRE_COLOR;
    drawOneWire(ctx, path, transform, viewport, path.systemId === highlightSystemId, color);
  }
  ctx.restore();
}

// ─── Waypoint handles (ADR-408 Φ7 FU#3 — editable «Wire Vertex») ────────────────

const HANDLE_STROKE_PX = 1.5;
const INSERT_GHOST_RADIUS_PX = 5; // hollow "+" preview where a vertex would be born

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
 * Draw the grips of the **active** (selected) circuit (Revit shows wire grips only on
 * the selected wire): a dot at every host endpoint (panel + each device connection —
 * visible even on a fresh circuit with no waypoints) AND at every inserted vertex,
 * plus the hover affordance — a highlight ring on the hovered vertex (`'node'`) or an
 * insert "+" ghost on a hovered segment (`'insert'`). Screen-space, style-agnostic.
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
  ctx.setLineDash([]);
  // One grip facade for the whole app: the SAME UnifiedGripRenderer the walls/DXF
  // entities use resolves the square shape, GRIP_COLD_COLOR, the size (UI_SIZE_DEFAULTS
  // + temperature multipliers) and DPI — so a selected wire's grips are byte-identical
  // to a selected wall's. We only feed it the grip positions + temperature.
  const grips = createGripRenderer(ctx, (p) => CoordinateTransforms.worldToScreen(p, transform, viewport));

  // The wire's vertices: host endpoints (panel + each device, deduped by host key so a
  // shared daisy-chain join draws one grip) + any inserted bend vertices. Visible the
  // instant the circuit is selected, before any bend exists.
  const endpoints = new Map<string, Point2D>();
  for (const seg of segments) {
    endpoints.set(seg.keyA, { x: seg.a.x, y: seg.a.y });
    endpoints.set(seg.keyB, { x: seg.b.x, y: seg.b.y });
  }
  const configs: GripRenderConfig[] = [];
  for (const p of endpoints.values()) configs.push({ position: p, type: 'vertex', temperature: 'cold' });
  for (const seg of segments) {
    const wps = getOrientedWaypoints(waypoints, seg.keyA, seg.keyB);
    for (const wp of wps) configs.push({ position: { x: wp.x, y: wp.y }, type: 'vertex', temperature: 'cold' });
  }
  grips.renderGripSetBatched(configs);

  if (hover) {
    // Hovered vertex → the SSoT warm grip (AutoCAD hover feedback) overlaid on top; a
    // hovered segment → the "+" insert ghost (distinct add-vertex affordance, not a
    // grip — kept circuit-coloured so it reads as "add here", not "selected vertex").
    if (hover.kind === 'node') {
      grips.renderGrip({ position: { x: hover.x, y: hover.y }, type: 'vertex' }, undefined, 'warm');
    } else {
      const s = CoordinateTransforms.worldToScreen({ x: hover.x, y: hover.y }, transform, viewport);
      drawInsertGhost(ctx, s, color);
    }
  }
  ctx.restore();
}
