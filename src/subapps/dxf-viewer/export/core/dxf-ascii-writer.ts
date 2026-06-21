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
import type { Point2D } from '../../rendering/types/Types';
import { hexToAci } from '../../ui/text-toolbar/controls/aci-palette';
import { buildHatchEntitySegments } from '../../bim/geometry/shared/hatch-pattern-geometry';
import { getHatchPattern, resolveEffectiveHatchScale } from '../../data/hatch-pattern-catalog';
import { isSolidHatch, islandStyleToDxf75 } from '../../bim/hatch/hatch-properties';
import { degToRad } from '../../rendering/entities/shared/geometry-angle-utils';
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
      emitHatch(e as HatchEntity, layer, aci, s, explode, pair);
      break;
    }
    // point/spline/dimension/leader/xline/ray → skipped.
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

// ─── HATCH (ADR-507 Φ1a) ──────────────────────────────────────────────────────
// solid-check + island↔code75 = SSoT `bim/hatch/hatch-properties` (κοινό με
// renderer + reader, N.12 — μηδέν τοπικό διπλότυπο).

/**
 * Γράψε μια γραμμοσκίαση. polyline-mode → native `HATCH` (boundary loops + pattern
 * meta)· lines-mode → exploded `LINE`s (boundary outlines + user-defined γραμμές
 * μέσω του `buildHatchLines` SSoT — ίδια γεωμετρία με τον canvas renderer).
 */
function emitHatch(
  e: HatchEntity, layer: string, aci: number, s: number, explode: boolean, pair: Pair,
): void {
  const paths = (e.boundaryPaths ?? []).filter((p) => p.length >= 2);
  if (!paths.length) return; // κενά όρια → τίποτα (κρατά «bare hatch → skip» συμβατό)
  const solid = isSolidHatch(e);

  if (explode) {
    // Τέκτονας: boundary outlines ως LINEs.
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i += 1) emitLine(path[i], path[i + 1], layer, aci, s, pair);
      if (path.length > 2) emitLine(path[path.length - 1], path[0], layer, aci, s, pair);
    }
    // user-defined / predefined: οι γραμμές μοτίβου ως LINEs (FULL SSoT με canvas).
    if (!solid) {
      const segs = buildHatchEntitySegments(e);
      for (const seg of segs) emitLine(seg.start, seg.end, layer, aci, s, pair);
    }
    return;
  }

  // Native HATCH (AutoCAD R2000+ minimal, polyline boundaries).
  pair(0, 'HATCH');
  pair(8, layer);
  pair(62, aci);
  pair(100, 'AcDbHatch');
  pair(10, 0); pair(20, 0); pair(30, 0);          // elevation point
  pair(210, 0); pair(220, 0); pair(230, 1);       // extrusion normal
  pair(2, solid ? 'SOLID' : (e.patternName ?? 'USER'));
  pair(70, solid ? 1 : 0);                        // solid fill flag
  pair(71, e.associative ? 1 : 0);                // associativity
  pair(91, paths.length);                         // number of boundary paths
  for (let pi = 0; pi < paths.length; pi += 1) {
    const path = paths[pi];
    // boundary path type flag: polyline(2) + external(1) στο πρώτο / outermost(16) στα νησιά.
    const flag = 2 | (pi === 0 ? 1 : 16);
    pair(92, flag);
    pair(72, 0);                                  // has bulge = όχι
    pair(73, 1);                                  // is closed
    pair(93, path.length);                        // number of vertices
    for (const v of path) { pair(10, v.x * s); pair(20, v.y * s); }
    pair(97, 0);                                  // number of source boundary objects
  }
  pair(75, islandStyleToDxf75(e.islandStyle));    // hatch style
  // pattern type: 0=user-defined, 1=predefined. Non-solid χωρίς ρητό fillType →
  // user-defined (οι default γραμμές μοτίβου είναι user-defined).
  const predefined = !solid && e.fillType === 'predefined';
  const userDefined = !solid && !predefined;
  pair(76, userDefined ? 0 : 1);                  // 0=user-defined, 1=predefined
  if (predefined) {
    emitPredefinedPattern(e, pair);
  } else if (!solid) {
    const angle = e.lineAngle ?? e.patternAngle ?? 0;
    const spacing = e.lineSpacing ?? e.patternScale ?? 1;
    pair(52, angle);                              // pattern angle
    pair(41, spacing);                            // pattern scale / spacing
    pair(77, e.doubleCrossHatch ? 1 : 0);         // double flag
    pair(78, 1);                                  // number of pattern definition lines
    // ΕΝΑ ορισμός γραμμής μοτίβου → έγκυρο user-defined hatch στο AutoCAD.
    const r = degToRad(angle);
    pair(53, angle);                              // line angle
    pair(43, 0); pair(44, 0);                     // base point
    pair(45, -Math.sin(r) * spacing);             // offset x (κάθετο)
    pair(46, Math.cos(r) * spacing);              // offset y (κάθετο)
    pair(79, 0);                                  // dash items
  }
  pair(47, 0);                                    // pixel size
  const seeds = e.seedPoints ?? [];
  pair(98, seeds.length);                         // number of seed points
  for (const sp of seeds) { pair(10, sp.x * s); pair(20, sp.y * s); }
}

/**
 * Γράφει τα group codes ενός predefined PAT μοτίβου στο native HATCH: 52/41 (γωνία/
 * κλίμακα), 78 (πλήθος γραμμών), και ανά `PatternLine` τα 53/43/44/45/46/79/49
 * (ADR-507 §2.3). Οι τιμές κλιμακώνονται κατά `patternScale` ώστε το εξαγόμενο DXF
 * να ταιριάζει με την οθόνη. Άγνωστο pattern → fallback σε μία γραμμή (valid hatch).
 */
function emitPredefinedPattern(e: HatchEntity, pair: Pair): void {
  const angle = e.patternAngle ?? 0;
  // effective scale (suggested ανά μοτίβο × user) — ίδιο με τον canvas (WYSIWYG).
  const scale = resolveEffectiveHatchScale(e.patternName, e.patternScale);
  pair(52, angle);                                // pattern angle
  pair(41, scale);                                // pattern scale
  pair(77, 0);                                    // double flag (n/a για predefined)
  const pattern = getHatchPattern(e.patternName);
  const lines = pattern?.lines ?? [];
  if (lines.length === 0) {
    // fallback: μία διαγώνια ώστε το hatch να παραμένει έγκυρο.
    pair(78, 1);
    pair(53, angle); pair(43, 0); pair(44, 0);
    pair(45, 0); pair(46, scale || 1); pair(79, 0);
    return;
  }
  pair(78, lines.length);                         // number of pattern definition lines
  for (const pl of lines) {
    pair(53, pl.angle + angle);                   // line angle
    pair(43, pl.origin[0] * scale);               // base point X
    pair(44, pl.origin[1] * scale);               // base point Y
    pair(45, pl.delta[0] * scale);                // offset (delta) X
    pair(46, pl.delta[1] * scale);                // offset (delta) Y
    pair(79, pl.dashes.length);                   // number of dash lengths
    for (const d of pl.dashes) pair(49, d * scale); // dash length
  }
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
