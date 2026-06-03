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
} from '../mep-systems/mep-wire-routing';

const WIRE_LINE_WIDTH = 1.5;
const HOME_RUN_ARROW_LEN = 11; // px — arrowhead size in screen space (zoom-independent)
const HOME_RUN_ARROW_HALF_RAD = 0.42; // half-angle of the arrowhead wings (rad)

/** Stroke a single circuit's polyline + its home-run arrowhead. */
function drawOneWire(
  ctx: CanvasRenderingContext2D,
  path: CircuitWirePath,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  const pts = buildWirePolyline(path);
  if (pts.length < 2) return;
  const screen = pts.map((p) => CoordinateTransforms.worldToScreen({ x: p.x, y: p.y }, transform, viewport));
  ctx.strokeStyle = path.colorHex;
  ctx.fillStyle = path.colorHex;
  ctx.beginPath();
  ctx.moveTo(screen[0]!.x, screen[0]!.y);
  for (let i = 1; i < screen.length; i++) ctx.lineTo(screen[i]!.x, screen[i]!.y);
  ctx.stroke();
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
): void {
  ctx.save();
  ctx.lineWidth = WIRE_LINE_WIDTH;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  for (const path of paths) drawOneWire(ctx, path, transform, viewport);
  ctx.restore();
}
