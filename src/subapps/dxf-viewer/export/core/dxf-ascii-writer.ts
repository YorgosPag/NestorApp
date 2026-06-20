/**
 * ============================================================================
 * DXF ASCII WRITER — client-side DXF generator (SSoT, zero-dep)
 * ============================================================================
 *
 * Serializes native-DXF entities (after BIM→primitive decomposition) into a
 * DXF document — entirely in the browser, no backend.
 *
 * ── Two compatibility modes (caller picks per target CAD) ──
 *   • 'polyline' (default, AutoCAD/standard): polylines & BIM footprints stay
 *     single `POLYLINE` objects; arcs stay native `ARC`. Clean, editable.
 *   • 'lines' (Τέκτονας/FESPA): every polyline / rectangle / BIM footprint is
 *     EXPLODED into `LINE` segments and arcs are tessellated to `LINE`s, because
 *     Tekton's minimal parser reads only LINE/TEXT/CIRCLE and ignores POLYLINE.
 *
 * Both modes emit the same minimal, widely-readable envelope (bare `ENTITIES`,
 * coords-first, per-entity ACI colour code 62, coordinate scaling to the chosen
 * output unit). Neither mode breaks the other — same data, different geometry
 * granularity.
 *
 * ADR-505 §A.
 */

import type { Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { hexToAci } from '../../ui/text-toolbar/controls/aci-palette';
import type { DxfLineMode } from '../types';

/** Minimal layer shape needed for name + ByLayer colour resolution. */
export interface DxfWriteLayer {
  readonly name: string;
  readonly color?: string;
  readonly colorAci?: number;
  readonly colorTrueColor?: number | null;
}

export interface DxfWriteOptions {
  /** id-keyed layer map (SceneModel.layersById). */
  readonly layersById?: Record<string, DxfWriteLayer>;
  /** Multiply every coordinate by this factor (scene-unit → output unit). */
  readonly scale?: number;
  /** Multiply mm-based extrusion thickness by this (mm → output unit). */
  readonly mmScale?: number;
  /** Geometry mode — 'polyline' (AutoCAD, default) or 'lines' (Tekton). */
  readonly lineMode?: DxfLineMode;
}

const DEFAULT_LAYER = '0';
const DEFAULT_ACI = 7; // white/black (ByLayer-ish fallback)
const DEFAULT_TEXT_HEIGHT = 0.18; // output units — used if entity has no height.
const ARC_SEGMENT_DEG = 12;

/** Produce a DXF string for the given (flattened) entities. */
export function writeDxfAscii(
  entities: readonly Entity[],
  options: DxfWriteOptions = {},
): string {
  const s = options.scale ?? 1;
  const mmScale = options.mmScale ?? s;
  const explode = options.lineMode === 'lines';
  const out: string[] = [];
  const pair = (code: number, value: string | number): void => {
    out.push(String(code), typeof value === 'number' ? num(value) : value);
  };
  const layerObj = (e: Entity): DxfWriteLayer | undefined => options.layersById?.[e.layerId];

  pair(0, 'SECTION');
  pair(2, 'ENTITIES');
  for (const e of entities) {
    const layer = layerObj(e);
    writeEntity(e, layer?.name ?? DEFAULT_LAYER, resolveAci(e, layer), s, mmScale, explode, pair);
  }
  pair(0, 'ENDSEC');
  pair(0, 'EOF');
  return out.join('\n') + '\n';
}

// ─── Colour resolution (entity → ACI, code 62) ────────────────────────────────

/**
 * Resolve an entity's display colour to an ACI index, mirroring the renderer's
 * cascade (colorTrueColor > colorAci > concrete hex > ByLayer → layer colour).
 */
function resolveAci(e: Entity, layer: DxfWriteLayer | undefined): number {
  if (e.colorMode !== 'ByLayer') {
    if (e.colorTrueColor != null) return hexToAci(intToHex(e.colorTrueColor));
    if (e.colorAci != null && e.colorAci > 0) return e.colorAci;
    if (e.color) return hexToAci(e.color);
  }
  if (layer) {
    if (layer.colorTrueColor != null) return hexToAci(intToHex(layer.colorTrueColor));
    if (layer.colorAci != null && layer.colorAci > 0) return layer.colorAci;
    if (layer.color) return hexToAci(layer.color);
  }
  return DEFAULT_ACI;
}

// ─── Per-entity emitters ──────────────────────────────────────────────────────

type Pair = (code: number, value: string | number) => void;

function writeEntity(
  e: Entity, layer: string, aci: number, s: number, mmScale: number, explode: boolean, pair: Pair,
): void {
  switch (e.type) {
    case 'line':
      emitLine(e.start, e.end, layer, aci, s, pair);
      break;
    case 'circle':
      emitCircle(e.center, e.radius, layer, aci, s, pair);
      break;
    case 'arc':
      if (explode) emitPath(arcPoints(e.center, e.radius, e.startAngle, e.endAngle), false, layer, aci, s, true, pair);
      else emitArc(e.center, e.radius, e.startAngle, e.endAngle, layer, aci, s, pair);
      break;
    case 'text':
    case 'mtext':
      emitText(e.position, e.text ?? '', e.height ?? e.fontSize, layer, aci, s, pair);
      break;
    case 'rectangle':
    case 'rect':
      emitPath(rectVertices(e.x, e.y, e.width, e.height), true, layer, aci, s, explode, pair);
      break;
    case 'polyline':
    case 'lwpolyline': {
      // Pseudo-3D extrusion (AutoCAD polyline mode only — Tekton stays 2D).
      // Thickness is in mm → scale with mmScale, NOT the coordinate scale.
      const thicknessMm = (e as { dxfThicknessMm?: number }).dxfThicknessMm ?? 0;
      const thickness = explode ? 0 : thicknessMm * mmScale;
      emitPath(e.vertices, e.closed ?? false, layer, aci, s, explode, pair, thickness);
      break;
    }
    // point/spline/hatch/dimension/leader/xline/ray → skipped.
    default:
      break;
  }
}

/** A LINE — coordinates first, layer, colour (ACI), no Z. */
function emitLine(a: Point2D, b: Point2D, layer: string, aci: number, s: number, pair: Pair): void {
  pair(0, 'LINE');
  pair(10, a.x * s); pair(20, a.y * s);
  pair(11, b.x * s); pair(21, b.y * s);
  pair(8, layer);
  pair(62, aci);
}

function emitCircle(c: Point2D, r: number, layer: string, aci: number, s: number, pair: Pair): void {
  pair(0, 'CIRCLE');
  pair(10, c.x * s); pair(20, c.y * s);
  pair(40, r * s);
  pair(8, layer);
  pair(62, aci);
}

function emitArc(
  c: Point2D, r: number, startDeg: number, endDeg: number, layer: string, aci: number, s: number, pair: Pair,
): void {
  pair(0, 'ARC');
  pair(10, c.x * s); pair(20, c.y * s);
  pair(40, r * s);
  pair(50, startDeg); pair(51, endDeg);
  pair(8, layer);
  pair(62, aci);
}

function emitText(
  p: Point2D, text: string, height: number | undefined, layer: string, aci: number, s: number, pair: Pair,
): void {
  pair(0, 'TEXT');
  pair(10, p.x * s); pair(20, p.y * s);
  pair(40, height != null ? height * s : DEFAULT_TEXT_HEIGHT);
  pair(1, sanitizeText(text));
  pair(50, 0);          // rotation
  pair(41, 1);          // width factor
  pair(7, 'STANDARD');  // text style
  pair(8, layer);
  pair(62, aci);
}

/**
 * Emit a vertex path — as a single `POLYLINE` (AutoCAD) or, when `explode`,
 * as individual `LINE` segments (Tekton has no POLYLINE).
 */
function emitPath(
  vertices: readonly Point2D[], closed: boolean, layer: string, aci: number, s: number, explode: boolean, pair: Pair,
  thickness = 0,
): void {
  if (vertices.length < 2) return;
  if (explode) {
    for (let i = 0; i < vertices.length - 1; i += 1) {
      emitLine(vertices[i], vertices[i + 1], layer, aci, s, pair);
    }
    if (closed && vertices.length > 2) {
      emitLine(vertices[vertices.length - 1], vertices[0], layer, aci, s, pair);
    }
    return;
  }
  // Old-style POLYLINE (R12-native, universally readable). With `thickness`,
  // AutoCAD extrudes the closed polyline along +Z → pseudo-3D prism.
  pair(0, 'POLYLINE'); pair(8, layer); pair(62, aci);
  pair(66, 1);                       // vertices-follow flag
  pair(70, closed ? 1 : 0);          // 1 = closed
  if (thickness) pair(39, thickness); // extrusion height (group 39)
  for (const v of vertices) {
    pair(0, 'VERTEX'); pair(8, layer);
    pair(10, v.x * s); pair(20, v.y * s);
  }
  pair(0, 'SEQEND'); pair(8, layer);
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function rectVertices(x: number, y: number, w: number, h: number): Point2D[] {
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}

/** Tessellate an arc (degrees, CCW start→end) into a polyline of points. */
function arcPoints(c: Point2D, r: number, startDeg: number, endDeg: number): Point2D[] {
  let sweep = endDeg - startDeg;
  while (sweep <= 0) sweep += 360;
  const steps = Math.max(2, Math.ceil(sweep / ARC_SEGMENT_DEG));
  const pts: Point2D[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = ((startDeg + (sweep * i) / steps) * Math.PI) / 180;
    pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return pts;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/** DXF number: fixed 6-decimals, trimmed, never exponential. */
function num(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(6).replace(/\.?0+$/, '') || '0';
}

function intToHex(rgb: number): string {
  return `#${(rgb & 0xffffff).toString(16).padStart(6, '0')}`;
}

function sanitizeText(text: string): string {
  return text.replace(/[\r\n]+/g, ' ');
}
