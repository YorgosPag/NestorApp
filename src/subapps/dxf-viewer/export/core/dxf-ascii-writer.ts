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

import type { Entity, HatchEntity } from '../../types/entities';
import type { DimensionEntity, DimStyle } from '../../types/dimension';
import type { Point2D } from '../../rendering/types/Types';
// rotated-rectangle entity-level SSoT (corner1/corner2 ή x/y/w/h + rotation, pivot=corner1). Re-export
// ώστε ο TEK exporter (`dxf-to-tek.ts`) να κρατά το ίδιο import path (μηδέν διπλότυπο formula).
import { rectangleEntityVertices } from '../../rendering/entities/shared/geometry-utils';
export { rectangleEntityVertices };
// ADR-362 Round 24/25 — native DIMENSION + DIMSTYLE emission reuse the dimension
// group-code SSoT (utils/dxf-dimension-writer + dxf-dimstyle-writer) so the
// in-process writers + production export stay in lockstep. Before Round 24,
// dimensions were silently dropped at the entity switch.
import { emitDimensionEntity } from '../../utils/dxf-dimension-writer';
import { emitDimStyle } from '../../utils/dxf-dimstyle-writer';
// ADR-362 Round 26 — anonymous dimension BLOCKS: the real drawn geometry of each
// dimension (ext lines + dim line/arc + arrowheads + text) is built from the SAME
// on-screen SSoT (`buildDimensionBlockPrimitives` → `buildDimensionGeometry`) and
// emitted as a `*Dn` block so dimensions display reliably even in readers that
// don't regenerate dimension geometry.
import {
  buildDimensionBlockPrimitives,
  type DimBlockPrimitive,
} from '../../systems/dimensions/dim-block-primitives';
import type { DimensionLookup } from '../../systems/dimensions/dim-geometry-builder';
import { hexToAci } from '../../ui/text-toolbar/controls/aci-palette';
// 🏢 Color-Conversion SSoT (ADR-573): int(0xRRGGBB)→hex via canonical `dxf-true-color`.
import { trueColorToHex } from '../../utils/dxf-true-color';
// ADR-507 Φ1a/Φ5 — HATCH emission split out (N.7.1 file-size SSoT). `Pair`/`EmitLine`
// types live with the HATCH writer; `emitLine` (below) stays the ONE definition and
// is injected into `emitHatch` for the exploded (Τέκτονας) path.
import { emitHatch, type Pair } from './dxf-ascii-hatch-writer';
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
  /**
   * ADR-362 Round 25 — the DIMSTYLE definitions the exported dimensions reference
   * (resolved from the dim-style registry by the export adapter). When non-empty a
   * `TABLES → DIMSTYLE` section is prepended and DIMENSION code 3 uses the real
   * style name; otherwise the envelope stays bare (no TABLES) as before.
   */
  readonly dimStyles?: ReadonlyArray<DimStyle>;
  /**
   * ADR-636 Στάδιο 1 — DXF HEADER. When `acadVer`/`insunits`/`codepage` are supplied the
   * writer prepends a minimal `HEADER` section: `$ACADVER` (a Unicode-capable version so the
   * UTF-8 text — incl. Greek — opens correctly in AutoCAD 2007+ instead of being read as ANSI
   * and garbled), `$INSUNITS` (declares the file's units → ends re-import unit-guessing) and
   * `$DWGCODEPAGE`. Omitted → the historic bare, header-less envelope (Tekton/legacy) — zero
   * regression. Coordinates are still written in the caller's output unit via `scale`.
   */
  readonly acadVer?: string;
  readonly insunits?: number;
  readonly codepage?: string;
}

const DEFAULT_LAYER = '0';
const DEFAULT_ACI = 7; // white/black (ByLayer-ish fallback)
const ACI_BYLAYER = 256; // dimension-block geometry follows the dim's layer colour
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

  // ADR-636 Στάδιο 1 — HEADER section MUST come first (DXF orders HEADER → TABLES → BLOCKS →
  // ENTITIES). Gated on the caller supplying version/units so bare `writeDxfAscii(entities)`
  // calls (Tekton/legacy) keep the historic header-less envelope. `$ACADVER` declares a
  // Unicode-capable release → AutoCAD reads the UTF-8 text as UTF-8 (no ANSI garbling);
  // `$INSUNITS` declares the units so a re-import stops guessing; `$DWGCODEPAGE` is the
  // conventional companion.
  if (options.acadVer || options.insunits != null || options.codepage) {
    pair(0, 'SECTION');
    pair(2, 'HEADER');
    if (options.acadVer) { pair(9, '$ACADVER'); pair(1, options.acadVer); }
    if (options.insunits != null) { pair(9, '$INSUNITS'); pair(70, options.insunits); }
    if (options.codepage) { pair(9, '$DWGCODEPAGE'); pair(3, options.codepage); }
    pair(0, 'ENDSEC');
  }

  // ADR-362 Round 25 — DIMSTYLE table (only when the export carries dimensions whose
  // styles were resolved). `styleId → name` lets DIMENSION code 3 reference the real
  // style; sizes scale via DIMSCALE × `s` (see emitDimStyle).
  const dimStyles = options.dimStyles ?? [];
  const dimStyleNameById: Record<string, string> = {};
  const dimStyleById: Record<string, DimStyle> = {};
  for (const st of dimStyles) {
    dimStyleNameById[st.id] = st.name;
    dimStyleById[st.id] = st;
  }
  if (dimStyles.length > 0) {
    pair(0, 'SECTION');
    pair(2, 'TABLES');
    pair(0, 'TABLE');
    pair(2, 'DIMSTYLE');
    pair(70, dimStyles.length);
    for (const st of dimStyles) emitDimStyle(pair, st, s);
    pair(0, 'ENDTAB');
    pair(0, 'ENDSEC');
  }

  // ADR-362 Round 26 — BLOCKS section (after TABLES, before ENTITIES). One anonymous
  // `*Di` block per dimension, carrying its real drawn geometry. The block index `i`
  // = position in the dimension stream, which matches the sequential `*Di` the entity
  // writer stamps below (SSoT index map — both iterate `entities` in order). Gated on
  // resolved styles: without a DIMSTYLE we can't build geometry (Round 24/25 fallback).
  const dimEntities = entities.filter((e) => e.type === 'dimension');
  if (dimStyles.length > 0 && dimEntities.length > 0) {
    const lookup = buildDimensionLookup(dimEntities);
    pair(0, 'SECTION');
    pair(2, 'BLOCKS');
    dimEntities.forEach((e, i) => {
      const dim = e as unknown as DimensionEntity;
      const style = dimStyleById[dim.styleId];
      if (!style) return; // unresolved style → skip block (DIMENSION entity still regen-fallbacks)
      writeDimensionBlock(pair, dim, style, `*D${i}`, layerObj(e)?.name ?? DEFAULT_LAYER, s, lookup);
    });
    pair(0, 'ENDSEC');
  }

  pair(0, 'SECTION');
  pair(2, 'ENTITIES');
  // Anonymous dimension blocks need sequential names (*D0, *D1, …) across the file.
  let dimBlockIndex = 0;
  for (const e of entities) {
    const layer = layerObj(e);
    writeEntity(e, layer?.name ?? DEFAULT_LAYER, resolveAci(e, layer), s, mmScale, explode, pair, () => dimBlockIndex++, dimStyleNameById);
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
    if (e.colorTrueColor != null) return hexToAci(trueColorToHex(e.colorTrueColor));
    if (e.colorAci != null && e.colorAci > 0) return e.colorAci;
    if (e.color) return hexToAci(e.color);
  }
  if (layer) {
    if (layer.colorTrueColor != null) return hexToAci(trueColorToHex(layer.colorTrueColor));
    if (layer.colorAci != null && layer.colorAci > 0) return layer.colorAci;
    if (layer.color) return hexToAci(layer.color);
  }
  return DEFAULT_ACI;
}

// ─── Per-entity emitters ──────────────────────────────────────────────────────

function writeEntity(
  e: Entity, layer: string, aci: number, s: number, mmScale: number, explode: boolean, pair: Pair,
  nextDimBlock: () => number, dimStyleNameById: Record<string, string>,
): void {
  switch (e.type) {
    case 'line': {
      // ADR-505 (rebar 3D export) — προαιρετικό Z ανά άκρο (mm → output unit με mmScale,
      // ΟΧΙ coord scale· ίδια σύμβαση με το extrusion thickness). Absent → 2Δ (body αμετάβλητο).
      const za = (e as { dxfStartZMm?: number }).dxfStartZMm;
      const zb = (e as { dxfEndZMm?: number }).dxfEndZMm;
      emitLine(e.start, e.end, layer, aci, s, pair,
        za != null ? za * mmScale : undefined,
        zb != null ? zb * mmScale : undefined);
      break;
    }
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
      // SSoT `rectangleEntityVertices`: χειρίζεται ΚΑΙ corner1/corner2 (drawn rects — x/y/w/h undefined)
      // ΚΑΙ x/y/w/h, ΚΑΙ το `rotation` (pivot=corner1). Πριν: raw rectVertices(e.x,...) → NaN για drawn +
      // αγνοούσε rotation.
      emitPath(rectangleEntityVertices(e), true, layer, aci, s, explode, pair);
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
    case 'hatch': {
      // ADR-505 §C (SOLID fill / poché) — «βαμμένη επιφάνεια» = προ-υπολογισμένα 3D
      // faces (πλευρές + καπάκια, βλ. solid-fill-geometry) → ένα `3DFACE` ανά face.
      // x/y με coordinate scale· z (mm) με mmScale (ίδια σύμβαση με rebar/thickness).
      const faces = (e as {
        dxfFaces?: ReadonlyArray<ReadonlyArray<{ x: number; y: number; zMm: number }>>;
      }).dxfFaces;
      if (faces) {
        for (const f of faces) emit3DFace(f, layer, aci, s, mmScale, pair);
        break;
      }
      // ADR-507 Φ1a — χωρίς προ-υπολογισμένα 3D faces → πραγματική γραμμοσκίαση:
      // polyline mode → native `HATCH` entity (boundary loops + pattern meta)·
      // lines mode (Τέκτονας) → exploded LINEs (boundary + user-defined γραμμές).
      emitHatch(e as HatchEntity, layer, aci, s, explode, pair, emitLine);
      break;
    }
    case 'dimension': {
      // ADR-362 Round 24 — native DIMENSION entity (all 11 variants) via the
      // group-code SSoT. `pair` is the scale-aware sink; coordinates are scaled
      // inside `emitDimensionEntity` (same `s` as every other entity). styleName =
      // the dim's styleId (AutoCAD falls back to STANDARD when no DIMSTYLE table is
      // present — a DIMSTYLE/BLOCKS section is the next increment). Layer/colour are
      // emitted by the dimension header itself (code 8); ACI is left to the style.
      const dim = e as unknown as DimensionEntity;
      // Round 25 — real DIMSTYLE name (from the resolved table) when available,
      // else the raw styleId / Standard fallback (Round 24 behaviour).
      const styleName = dimStyleNameById[dim.styleId] ?? dim.styleId ?? 'Standard';
      emitDimensionEntity(pair, { entity: dim, styleName, layerName: layer }, nextDimBlock(), s);
      break;
    }
    // point/spline/leader/xline/ray → skipped.
    default:
      break;
  }
}

/** A `3DFACE` — up to 4 corners (triangle → 4th = 3rd). x/y × `s`, z (mm) × mmScale. */
function emit3DFace(
  face: ReadonlyArray<{ x: number; y: number; zMm: number }>,
  layer: string, aci: number, s: number, mmScale: number, pair: Pair,
): void {
  if (face.length < 3) return;
  const c = [face[0], face[1], face[2], face[3] ?? face[2]]; // tri → 4η κορυφή = 3η
  pair(0, '3DFACE');
  for (let i = 0; i < 4; i += 1) {
    pair(10 + i, c[i].x * s);
    pair(20 + i, c[i].y * s);
    pair(30 + i, c[i].zMm * mmScale);
  }
  pair(8, layer);
  pair(62, aci);
}

/** A LINE — coordinates first, layer, colour (ACI). Optional Z per endpoint (3Δ rebar). */
function emitLine(
  a: Point2D, b: Point2D, layer: string, aci: number, s: number, pair: Pair, za?: number, zb?: number,
): void {
  pair(0, 'LINE');
  pair(10, a.x * s); pair(20, a.y * s);
  if (za !== undefined) pair(30, za);
  pair(11, b.x * s); pair(21, b.y * s);
  if (zb !== undefined) pair(31, zb);
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
  rotationDeg = 0, centered = false,
): void {
  pair(0, 'TEXT');
  pair(10, p.x * s); pair(20, p.y * s);
  pair(40, height != null ? height * s : DEFAULT_TEXT_HEIGHT);
  pair(1, sanitizeText(text));
  pair(50, rotationDeg); // rotation (CCW degrees) — dimension block text uses textRotation
  pair(41, 1);          // width factor
  pair(7, 'STANDARD');  // text style
  if (centered) {
    // Centre the text on `p`: horizontal=centre (72/1) + vertical=middle (73/2) with
    // the alignment point repeated in 11/21 (DXF requires it once 72/73 are set).
    pair(72, 1);
    pair(11, p.x * s); pair(21, p.y * s);
    pair(73, 2);
  }
  pair(8, layer);
  pair(62, aci);
}

// ─── Dimension anonymous block (ADR-362 Round 26) ─────────────────────────────

/** Build a `DimensionLookup` over the export's dimensions (baseline/continued chains). */
function buildDimensionLookup(dimEntities: readonly Entity[]): DimensionLookup {
  const byId = new Map<string, DimensionEntity>();
  for (const e of dimEntities) byId.set(e.id, e as unknown as DimensionEntity);
  return (id: string) => byId.get(id);
}

/**
 * Emit one anonymous `BLOCK *Di … ENDBLK` containing the dimension's real drawn
 * geometry. Geometry comes entirely from `buildDimensionBlockPrimitives` (the
 * on-screen SSoT); we only serialize the world-space primitives through the
 * existing entity emitters. On a build failure (partial def points / missing
 * chain parent) we skip the block silently — the DIMENSION entity remains.
 */
function writeDimensionBlock(
  pair: Pair, entity: DimensionEntity, style: DimStyle, blockName: string, layer: string, s: number,
  lookup: DimensionLookup,
): void {
  let primitives: DimBlockPrimitive[];
  try {
    primitives = buildDimensionBlockPrimitives(entity, style, lookup);
  } catch {
    return; // degenerate / unresolved chain → no block (regen-capable readers still show the DIMENSION)
  }

  pair(0, 'BLOCK');
  pair(8, layer);
  pair(2, blockName);
  pair(70, 1);                 // anonymous block flag (bit 1)
  pair(10, 0); pair(20, 0); pair(30, 0); // base point at origin
  pair(3, blockName);          // block name (repeated per DXF BLOCK spec)

  for (const prim of primitives) {
    switch (prim.kind) {
      case 'line':
        emitLine(prim.a, prim.b, layer, ACI_BYLAYER, s, pair);
        break;
      case 'arc':
        emitArc(prim.center, prim.radius, prim.startDeg, prim.endDeg, layer, ACI_BYLAYER, s, pair);
        break;
      case 'circle':
        emitCircle(prim.center, prim.radius, layer, ACI_BYLAYER, s, pair);
        break;
      case 'fill':
        // Solid arrowhead → 3DFACE (z=0). Reuses the ADR-505 §C solid-fill primitive.
        emit3DFace(prim.points.map((pt) => ({ x: pt.x, y: pt.y, zMm: 0 })), layer, ACI_BYLAYER, s, s, pair);
        break;
      case 'text':
        emitText(prim.position, prim.text, prim.heightWorld, layer, ACI_BYLAYER, s, pair, prim.rotationDeg, true);
        break;
    }
  }

  pair(0, 'ENDBLK');
  pair(8, layer);
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

function sanitizeText(text: string): string {
  return text.replace(/[\r\n]+/g, ' ');
}
