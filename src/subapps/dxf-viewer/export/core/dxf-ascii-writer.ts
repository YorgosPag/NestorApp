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

import type { Entity, HatchEntity, LeaderEntity, PolylineEntity, SceneLayer } from '../../types/entities';
import type { DimensionEntity, DimStyle } from '../../types/dimension';
import type { Point2D } from '../../rendering/types/Types';
// ADR-636 Στάδιο 2 Φ2.1 — full `TABLES → LAYER` section. The single TABLES section (LTYPE +
// LAYER, reusing the `writeLayerTable` SSoT, then DIMSTYLE) is emitted by the split-out
// `emitTablesSection` (file-size SRP, mirror of the HATCH split).
import { emitTablesSection, type VportView } from './dxf-ascii-tables-writer';
import type { LinetypeDef } from '../../config/linetype-iso-catalog';
// rotated-rectangle entity-level SSoT (corner1/corner2 ή x/y/w/h + rotation, pivot=corner1). Re-export
// ώστε ο TEK exporter (`dxf-to-tek.ts`) να κρατά το ίδιο import path (μηδέν διπλότυπο formula).
import { rectangleEntityVertices } from '../../rendering/entities/shared/geometry-utils';
export { rectangleEntityVertices };
// ADR-362 Round 24/25 — native DIMENSION + DIMSTYLE emission reuse the dimension
// group-code SSoT (utils/dxf-dimension-writer + dxf-dimstyle-writer) so the
// in-process writers + production export stay in lockstep. Before Round 24,
// dimensions were silently dropped at the entity switch.
import { emitDimensionEntity } from '../../utils/dxf-dimension-writer';
// ADR-362 Round 26 — anonymous dimension BLOCKS emitter lives in its own module
// (file-size SRP, N.7.1). Builds one `*Dn` block per dimension from the on-screen
// geometry SSoT so dimensions display reliably even in non-regenerating readers.
import { buildDimensionLookup, writeDimensionBlock } from './dxf-ascii-dimension-block-writer';
// ADR-507 Φ1a/Φ5 — HATCH emission split out (N.7.1 file-size SSoT). `Pair`/`EmitLine`
// types live with the HATCH writer; `emitLine` (below) stays the ONE definition and
// is injected into `emitHatch` for the exploded (Τέκτονας) path.
import { emitHatch, type Pair } from './dxf-ascii-hatch-writer';
// ADR-636 Στάδιο 2 Φ2.3 — TEXT (with 72/73 justification) + real MTEXT (\P line breaks, 71
// attachment) emitters live in their own module (file-size SRP). `alignFromTextEntity` derives
// the H/V codes from the entity via the inverse import maps (zero new alignment table).
import {
  emitText, emitMText, alignFromTextEntity, textStyleName, readTextEntityFamily,
} from './dxf-ascii-text-writer';
// ADR-505 §A / ADR-636 — colour→ACI + STYLE-table collection helpers live in a sibling module
// (file-size SRP split, N.7.1). Same derivations, extracted verbatim to keep the writer ≤500 lines.
import { resolveAci, collectTextStyles } from './dxf-ascii-writer-helpers';
// ADR-505 §A — low-level DXF primitive emitters + geometry/format helpers live in a sibling
// module (file-size SRP split, N.7.1). `emitLine` stays the ONE definition injected into `emitHatch`.
import {
  emit3DFace,
  emitQuadFill,
  emitLine,
  emitCircle,
  emitPoint,
  emitArc,
  emitPath,
  emitLeader,
  emitEntityStyle,
  arcPoints,
  num,
} from './dxf-ascii-primitive-emitters';
import { DxfDocumentVersion, parseDocumentVersion } from '../../text-engine/types/text-toolbar.types';
import type { DxfLineMode } from '../types';
// ADR-636 Φ2.4 (D.4) — native MLINE entity + MLINESTYLE (OBJECTS section) round-trip, reversing
// the ADR-635 Φ C.7 import (which exploded an MLINE into N element polylines + a `dxfMlineSource`
// provenance marker). Split into its own module (file-size SRP, mirror of tables/hatch/text writers).
import {
  buildMlineStyleRegistry, collectMlineGroupIds, emitMline, emitObjectsSection,
} from './dxf-ascii-mline-writer';
// ADR-640 M2 — INSERT reference + named BLOCK definition round-trip (block instances). The heavy
// logic (INSERT emit, dedup-by-name BLOCK section) lives in its own module (file-size SRP, N.7.1);
// members are serialized back through THIS writer's `writeEntity` via the injected `emitBlockMember`.
import { emitInsert, writeBlockDefinitions } from './dxf-ascii-insert-writer';
import type { BlockEntity } from '../../types/entities';

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
  /**
   * ADR-636 Στάδιο 2 Φ2.1 — full `TABLES → LAYER` section. When `tableLayers` is non-empty the
   * writer emits a real LTYPE + LAYER table (colour/on-off/freeze/lock/linetype/lineweight/
   * true-colour + Nestor XDATA, via the `writeLayerTable` SSoT) inside the SAME single `TABLES`
   * section as DIMSTYLE — so AutoCAD keeps the layer definitions instead of auto-creating layers
   * with defaults. `customLinetypes` are the non-ISO linetypes referenced by those layers (ISO
   * baseline is implicit — skipped by the table writer). Omitted → header-less/table-less bare
   * envelope (Tekton/legacy) — the per-entity inline `62` colour is unaffected either way.
   */
  readonly tableLayers?: ReadonlyArray<SceneLayer>;
  readonly customLinetypes?: ReadonlyArray<LinetypeDef>;
  /**
   * ADR-636 Στάδιο 2 Φ2.3 — richer HEADER for pro-grade fidelity. `extMin`/`extMax` are the
   * drawing extents in OUTPUT units (already ×scale) → AutoCAD zoom-extents opens on the model
   * instead of a blank sheet. `$MEASUREMENT` (1=metric), `$LTSCALE`, `$LUNITS` (2=decimal) are
   * the standard AutoCAD defaults. All gated on the same HEADER switch (bare/Tekton unaffected).
   */
  readonly extMin?: Point2D;
  readonly extMax?: Point2D;
  readonly measurement?: number;
  readonly ltscale?: number;
  readonly lunits?: number;
  /**
   * ADR-636 Φ2.4 (D.1) — POINT display sysvars, round-tripping the C.1 import. `$PDMODE`
   * (70, bitmask: figure|+32 circle|+64 square) is unit-agnostic; `$PDSIZE` (40) is pre-scaled
   * to output units by the caller when > 0 (viewport-% values ≤ 0 pass through) — mirror of the
   * extMin/extMax pre-scaling convention. Gated on the same HEADER switch (bare/Tekton unaffected).
   */
  readonly pdmode?: number;
  readonly pdsize?: number;
}

const DEFAULT_LAYER = '0';

/**
 * ADR-636 (2026-07-12) — derive the `*Active` VPORT view (+ $VIEWCTR/$VIEWSIZE) from the drawing
 * extents so AutoCAD opens FRAMED on the model (fixes «μαύρη οθόνη στο άνοιγμα»: no VPORT → default
 * off-screen 0,0 view). A SQUARE view of side 1.1×max(w,h) centered on the bbox contains the whole
 * drawing regardless of the screen aspect (AutoCAD letterboxes) — never black, never clipped.
 * Degenerate/absent extents → `undefined` (writer skips the VPORT, bare envelope unchanged).
 */
function computeVportView(min?: Point2D, max?: Point2D): VportView | undefined {
  if (!min || !max) return undefined;
  const w = Math.abs(max.x - min.x);
  const h = Math.abs(max.y - min.y);
  const side = Math.max(w, h);
  const height = side > 0 ? side * 1.1 : 1;
  return { center: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 }, height, aspect: 1 };
}

// ADR-636 Φ2.4 (D.6) — single-header entities whose STYLE codes (6/48/370) are appended
// AFTER the emitter (valid: the pairs bind to the entity until the next `0`). POLYLINE /
// rectangle carry their STYLE in the emitPath header instead (before VERTEX/SEQEND);
// HATCH / DIMENSION own their style path (DIMSTYLE) — excluded.
const STYLE_APPEND_TYPES: ReadonlySet<Entity['type']> = new Set([
  'line', 'circle', 'arc', 'text', 'mtext', 'point',
]);

// ADR-636 Φ2.4 (D.3) — origin-primitive marker → native DXF entity name (round-trip of the
// `dxf-quad-fill-converter` import). Inverse of the `idPrefix` the import stamps.
const QUAD_ENTITY_NAME: Readonly<Record<'solid' | 'trace' | '3dface', 'SOLID' | 'TRACE' | '3DFACE'>> = {
  solid: 'SOLID', trace: 'TRACE', '3dface': '3DFACE',
};

/** Produce a DXF string for the given (flattened) entities. */
export function writeDxfAscii(
  entities: readonly Entity[],
  options: DxfWriteOptions = {},
): string {
  const s = options.scale ?? 1;
  const mmScale = options.mmScale ?? s;
  const explode = options.lineMode === 'lines';
  // ADR-636 Στάδιο 2 Φ2.3 — MTEXT serialization is version-gated (R12 downgrades to TEXT). Derive
  // the release from `$ACADVER`; default to R2018 (the app's default target) when unspecified.
  const version = parseDocumentVersion(options.acadVer ?? '') ?? DxfDocumentVersion.R2018;
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
  // ADR-636 (2026-07-12) — the `*Active` view derived from the extents; reused by the HEADER
  // ($VIEWCTR/$VIEWSIZE) AND the VPORT table so AutoCAD opens framed on the model.
  const vportView = computeVportView(options.extMin, options.extMax);
  if (
    options.acadVer || options.insunits != null || options.codepage ||
    options.extMin || options.extMax || options.measurement != null ||
    options.ltscale != null || options.lunits != null ||
    options.pdmode != null || options.pdsize != null
  ) {
    pair(0, 'SECTION');
    pair(2, 'HEADER');
    if (options.acadVer) { pair(9, '$ACADVER'); pair(1, options.acadVer); }
    if (options.insunits != null) { pair(9, '$INSUNITS'); pair(70, options.insunits); }
    if (options.codepage) { pair(9, '$DWGCODEPAGE'); pair(3, options.codepage); }
    // ADR-636 Στάδιο 2 Φ2.3 — drawing extents (already in output units) → correct zoom-extents
    // on open; $MEASUREMENT/$LTSCALE/$LUNITS are the AutoCAD-standard metric/decimal defaults.
    if (options.extMin) { pair(9, '$EXTMIN'); pair(10, options.extMin.x); pair(20, options.extMin.y); pair(30, 0); }
    if (options.extMax) { pair(9, '$EXTMAX'); pair(10, options.extMax.x); pair(20, options.extMax.y); pair(30, 0); }
    // ADR-636 (2026-07-12) — current-view sysvars (mirror the VPORT *Active) so readers that honor
    // the HEADER view open framed on the model too. Center in DCS, size = view height.
    if (vportView) {
      pair(9, '$VIEWCTR'); pair(10, vportView.center.x); pair(20, vportView.center.y);
      pair(9, '$VIEWSIZE'); pair(40, vportView.height);
    }
    if (options.ltscale != null) { pair(9, '$LTSCALE'); pair(40, options.ltscale); }
    if (options.lunits != null) { pair(9, '$LUNITS'); pair(70, options.lunits); }
    if (options.measurement != null) { pair(9, '$MEASUREMENT'); pair(70, options.measurement); }
    // ADR-636 Φ2.4 (D.1) — POINT display sysvars (round-trip C.1 import). $PDSIZE pre-scaled by caller.
    if (options.pdmode != null) { pair(9, '$PDMODE'); pair(70, options.pdmode); }
    if (options.pdsize != null) { pair(9, '$PDSIZE'); pair(40, options.pdsize); }
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

  // ADR-636 Στάδιο 2 Φ2.1 — ONE `TABLES` section holding LTYPE + LAYER (when the caller
  // supplies `tableLayers`) then DIMSTYLE (when dimensions carried a resolved style), in DXF
  // table order. Gated: bare `writeDxfAscii(entities)` (no tableLayers, no dimStyles) stays
  // table-less (Tekton/legacy). Placed after HEADER, before BLOCKS/ENTITIES.
  // ADR-636 Φ2.4 (D.5) — synthesize a STYLE table from the fonts the TEXT/MTEXT entities carry
  // (AutoCAD path only; Tekton `explode` keeps the historic STANDARD-only, table-less output).
  const textStyles = explode ? [] : collectTextStyles(entities);
  emitTablesSection(out, pair, {
    viewport: vportView,
    tableLayers: options.tableLayers,
    customLinetypes: options.customLinetypes,
    textStyles,
    dimStyles,
    s,
  });

  // ADR-362 Round 26 — BLOCKS section (after TABLES, before ENTITIES). One anonymous
  // `*Di` block per dimension, carrying its real drawn geometry. The block index `i`
  // = position in the dimension stream, which matches the sequential `*Di` the entity
  // writer stamps below (SSoT index map — both iterate `entities` in order). Gated on
  // resolved styles: without a DIMSTYLE we can't build geometry (Round 24/25 fallback).
  // ADR-640 M2 — the ONE `BLOCKS` section holds anonymous `*Di` dimension blocks AND named
  // block-instance definitions (INSERT references). Opened when either is present (DXF allows a
  // single BLOCKS section, so both share it). Bare `writeDxfAscii(entities)` with neither stays
  // block-section-less (Tekton/legacy) — zero regression.
  const dimEntities = entities.filter((e) => e.type === 'dimension');
  const blockEntities = entities.filter((e): e is BlockEntity => e.type === 'block');
  const hasDimBlocks = dimStyles.length > 0 && dimEntities.length > 0;
  if (hasDimBlocks || blockEntities.length > 0) {
    pair(0, 'SECTION');
    pair(2, 'BLOCKS');
    if (hasDimBlocks) {
      const lookup = buildDimensionLookup(dimEntities);
      dimEntities.forEach((e, i) => {
        const dim = e as unknown as DimensionEntity;
        const style = dimStyleById[dim.styleId];
        if (!style) return; // unresolved style → skip block (DIMENSION entity still regen-fallbacks)
        writeDimensionBlock(pair, dim, style, `*D${i}`, layerObj(e)?.name ?? DEFAULT_LAYER, s, lookup);
      });
    }
    if (blockEntities.length > 0) {
      // ADR-640 M2 — one named BLOCK per distinct name (dedup inside writeBlockDefinitions). Members
      // are BLOCK-LOCAL @ base (0,0) and re-use THIS writer's per-type emitters via `writeEntity`
      // (dependency injection, mirror of `emitHatch(…, emitLine)`) — zero re-implemented geometry.
      let memberDimBlock = 0;
      const emitBlockMember = (m: Entity): void => {
        const layer = layerObj(m);
        writeEntity(m, layer?.name ?? DEFAULT_LAYER, resolveAci(m, layer), s, mmScale, explode,
          pair, () => memberDimBlock++, dimStyleNameById, version);
      };
      writeBlockDefinitions(pair, blockEntities, (b) => layerObj(b)?.name ?? DEFAULT_LAYER, emitBlockMember);
    }
    pair(0, 'ENDSEC');
  }

  // ADR-636 Φ2.4 (D.4) — native MLINE round-trip: reconstruct one MLINE + its MLINESTYLE from
  // the `dxfMlineSource` marker the import stamped on the first element polyline of each group.
  // AutoCAD path only; `explode` (Tekton) keeps the exploded N POLYLINEs (zero regression).
  const mlineStyles = buildMlineStyleRegistry(explode ? [] : entities);
  const mlineGroupIds = explode ? new Set<string>() : collectMlineGroupIds(entities);

  pair(0, 'SECTION');
  pair(2, 'ENTITIES');
  // Anonymous dimension blocks need sequential names (*D0, *D1, …) across the file.
  let dimBlockIndex = 0;
  for (const e of entities) {
    const layer = layerObj(e);
    const layerName = layer?.name ?? DEFAULT_LAYER;
    // ADR-636 Φ2.4 (D.4) — the carrier polyline (`dxfMlineSource`) emits ONE native MLINE; its
    // sibling element polylines (same groupId, no marker) are suppressed — the MLINE re-draws them.
    if (!explode && e.type === 'polyline') {
      const src = (e as PolylineEntity).dxfMlineSource;
      if (src) { emitMline(pair, src, mlineStyles.handleFor(src), layerName, s); continue; }
      if (e.groupId && mlineGroupIds.has(e.groupId)) continue;
    }
    writeEntity(e, layerName, resolveAci(e, layer), s, mmScale, explode, pair, () => dimBlockIndex++, dimStyleNameById, version);
  }
  pair(0, 'ENDSEC');
  // ADR-636 Φ2.4 (D.4) — OBJECTS section (ACAD_MLINESTYLE dictionary + MLINESTYLE objects) comes
  // LAST in DXF order (after ENTITIES, before EOF). Skipped when no MLINE was exported (isEmpty).
  emitObjectsSection(pair, mlineStyles);
  pair(0, 'EOF');
  return out.join('\n') + '\n';
}

// ─── Per-entity emitters ──────────────────────────────────────────────────────

function writeEntity(
  e: Entity, layer: string, aci: number, s: number, mmScale: number, explode: boolean, pair: Pair,
  nextDimBlock: () => number, dimStyleNameById: Record<string, string>, version: DxfDocumentVersion,
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
      // ADR-636 Φ2.3 — single-line TEXT with H/V justification (72/73/11/21) on the AutoCAD path.
      // Tekton (`explode`) keeps the bare, alignment-less, unrotated TEXT (byte-identical legacy).
      emitText(
        e.position, e.text ?? '', e.height ?? e.fontSize, layer, aci, s, pair,
        explode ? 0 : (e.rotation ?? 0), explode ? undefined : alignFromTextEntity(e),
        // ADR-636 Φ2.4 (D.5) — real group 7 (AutoCAD path); Tekton `explode` → emitText default STANDARD.
        explode ? undefined : textStyleName(readTextEntityFamily(e)),
      );
      break;
    case 'mtext':
      // ADR-636 Φ2.3 — real MTEXT (\P line breaks, 71 attachment) on the AutoCAD path; Tekton's
      // minimal parser reads only TEXT, so `explode` keeps the historic single-line TEXT fallback.
      if (explode) emitText(e.position, e.text ?? '', e.height ?? e.fontSize, layer, aci, s, pair);
      else emitMText(e, layer, aci, s, pair, version);
      break;
    case 'rectangle':
    case 'rect':
      // SSoT `rectangleEntityVertices`: χειρίζεται ΚΑΙ corner1/corner2 (drawn rects — x/y/w/h undefined)
      // ΚΑΙ x/y/w/h, ΚΑΙ το `rotation` (pivot=corner1). Πριν: raw rectVertices(e.x,...) → NaN για drawn +
      // αγνοούσε rotation.
      // ADR-636 Φ2.4 (D.6) — STYLE codes (6/48/370) travel in the POLYLINE header (AutoCAD mode
      // only; Tekton `explode` stays bare). Reverse of the import extractors.
      emitPath(rectangleEntityVertices(e), true, layer, aci, s, explode, pair, 0, explode ? undefined : e);
      break;
    case 'polyline':
    case 'lwpolyline': {
      // Pseudo-3D extrusion (AutoCAD polyline mode only — Tekton stays 2D).
      // Thickness is in mm → scale with mmScale, NOT the coordinate scale.
      const thicknessMm = (e as { dxfThicknessMm?: number }).dxfThicknessMm ?? 0;
      const thickness = explode ? 0 : thicknessMm * mmScale;
      // ADR-636 Φ2.4 (D.6) — STYLE codes in the POLYLINE header (AutoCAD mode only).
      emitPath(e.vertices, e.closed ?? false, layer, aci, s, explode, pair, thickness, explode ? undefined : e);
      break;
    }
    case 'hatch': {
      // ADR-636 Φ2.4 (D.3) — imported SOLID/TRACE/3DFACE round-trip to their NATIVE entity (not a
      // downgraded HATCH), preserving the source primitive identity (Revit/AutoCAD fidelity). The
      // `emitQuadFill` un-bowties the draw-order boundary back to the DXF corner slots (inverse of
      // `parseQuadVertices`). AutoCAD path only — Tekton `explode` keeps the exploded-LINE fallback
      // (its minimal parser doesn't read SOLID). Genuine HATCH (no `dxfSourceType`) is unaffected.
      const src = (e as HatchEntity).dxfSourceType;
      const quad = (e as HatchEntity).boundaryPaths?.[0];
      if (!explode && src && quad && (quad.length === 3 || quad.length === 4)) {
        emitQuadFill(QUAD_ENTITY_NAME[src], quad, layer, aci, s, pair);
        break;
      }
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
    case 'point':
      // ADR-636 Φ2.4 (D.1) — POINT round-trips the C.1 import. The glyph ($PDMODE/$PDSIZE) is a
      // drawing-wide HEADER sysvar (emitted once above), not a per-POINT field — the entity is
      // just its position (10/20/30) + layer + colour, mirroring emitCircle.
      emitPoint(e.position, layer, aci, s, pair);
      break;
    case 'leader': {
      // ADR-636 Φ2.4 (D.2) — native LEADER round-trips the ADR-635 Batch 2-B import. Ordered
      // 10/20 vertices (arrow tip = vertices[0]) + 71 arrowhead flag; the import re-reads them via
      // `convertLeader`. Annotation (340) / arrow size (DIMASZ) are not file-round-trippable → not
      // emitted. STYLE codes (6/48/370) are excluded — `convertLeader` reads only 62 (no round-trip
      // value), so 'leader' is deliberately NOT in STYLE_APPEND_TYPES.
      const lead = e as unknown as LeaderEntity;
      emitLeader(lead.vertices, lead.arrowHead?.type !== 'none', layer, aci, s, pair);
      break;
    }
    case 'block': {
      // ADR-640 M2 — a first-class block instance → native INSERT reference (name + placement
      // transform). The named BLOCK definition (its local members) is emitted once in the BLOCKS
      // section above, deduplicated by `block.name` (many instances share one definition).
      emitInsert(pair, e as BlockEntity, layer, aci, s);
      break;
    }
    // spline/xline/ray + group/array (container flatten TBD) → skipped.
    default:
      break;
  }
  // ADR-636 Φ2.4 (D.6) — append the common STYLE codes (6 linetype / 48 CELTSCALE / 370
  // lineweight) for single-header entities, in AutoCAD mode only (Tekton `explode` output
  // stays byte-identical, its minimal parser ignores these codes anyway). POLYLINE-based
  // entities already carried their STYLE in the emitPath header above.
  if (!explode && STYLE_APPEND_TYPES.has(e.type)) emitEntityStyle(pair, e);
}

// ADR-505 §A — primitive emitters (emitLine/emitCircle/emitArc/emitPoint/emit3DFace/emitPath),
// arcPoints + num moved to `dxf-ascii-primitive-emitters.ts` (file-size SRP split, N.7.1).
