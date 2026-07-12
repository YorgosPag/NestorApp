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

import type { Entity, HatchEntity, PolylineEntity, SceneLayer } from '../../types/entities';
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
// ADR-362 Round 26 — anonymous dimension BLOCKS emitter lives in its own module
// (file-size SRP, N.7.1). Builds one `*Dn` block per dimension from the on-screen
// geometry SSoT so dimensions display reliably even in non-regenerating readers.
import { buildDimensionLookup, writeDimensionBlock } from './dxf-ascii-dimension-block-writer';
// ADR-507 Φ1a/Φ5 — HATCH emission split out (N.7.1 file-size SSoT). The `Pair` sink type lives with
// the HATCH writer; the writer threads it through every emitter (`emitHatch` + `emitLine` injection
// now happen inside the per-entity dispatcher `writeEntity`, see below).
import type { Pair } from './dxf-ascii-hatch-writer';
// ADR-505 §A / ADR-636 — colour→ACI + STYLE-table collection helpers live in a sibling module
// (file-size SRP split, N.7.1). Same derivations, extracted verbatim to keep the writer ≤500 lines.
import { resolveAci, collectTextStyles } from './dxf-ascii-writer-helpers';
// ADR-505 §A — low-level DXF primitive emitters live in a sibling module (file-size SRP split,
// N.7.1); the per-entity dispatcher (`writeEntity`) that drives them was split out too (see below).
// The writer itself only needs `num` (its raw `$HANDSEED`/coordinate formatter).
import { num } from './dxf-ascii-primitive-emitters';
// ADR-505 §A — per-entity → native DXF emitter switchboard (`writeEntity`), split out for file-size
// SRP (N.7.1) alongside the hatch/text/mline/insert writers. Drives the primitive emitters above.
import { writeEntity } from './dxf-ascii-entity-dispatch';
import { DxfDocumentVersion, parseDocumentVersion } from '../../text-engine/types/text-toolbar.types';
import type { DxfLineMode } from '../types';
// ADR-636 Φ2.4 (D.4) — native MLINE entity + MLINESTYLE (OBJECTS section) round-trip, reversing
// the ADR-635 Φ C.7 import (which exploded an MLINE into N element polylines + a `dxfMlineSource`
// provenance marker). Split into its own module (file-size SRP, mirror of tables/hatch/text writers).
import {
  buildMlineStyleRegistry, collectMlineGroupIds, emitMline, emitMlineStyleBlocks,
} from './dxf-ascii-mline-writer';
// ADR-643 Φ5b — image-fill hatch «πιστή» εξαγωγή: tiled IMAGE entities + IMAGEDEF (OBJECTS
// section, μοιρασμένη με τα MLINESTYLE). Το `dxfImageExport` marker το προ-υπολογίζει ο client
// pre-pass (`image-fill-export.ts`)· εδώ γίνεται pure σειριοποίηση. Solid-downgrade (default) ΔΕΝ
// περνά από εδώ — ο pre-pass το μετατρέπει σε κανονικό solid hatch πριν τον writer.
import { buildImageDefRegistry, emitImageTiles, emitImageDefBlocks } from './dxf-ascii-image-writer';
// ADR-640 M2 — INSERT reference + named BLOCK definition round-trip (block instances). The heavy
// logic (INSERT emit, dedup-by-name BLOCK section) lives in its own module (file-size SRP, N.7.1);
// members are serialized back through THIS writer's `writeEntity` via the injected `emitBlockMember`.
import { writeBlockDefinitions, emitBlockBegin, emitBlockEnd } from './dxf-ascii-insert-writer';
import type { BlockEntity } from '../../types/entities';
// ADR-644 (#5) — ONE handle allocator (R2018: every entity/table/record needs a unique `5`/`105`
// handle + `$HANDSEED`). The writer wraps the `pair` sink to lazily inject a handle after each
// entity's `0 <TYPE>`; tables/records allocate explicitly (they also need owner 330 + subclass).
import { createHandleAllocator, type HandleAllocator } from './dxf-ascii-handle-allocator';

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

// ADR-644 (#5) — `0 <value>` markers that are NOT handle-bearing objects: section/table
// structure only. Everything else (LINE/CIRCLE/HATCH/TEXT/DIMENSION/INSERT/MLINE/VERTEX/SEQEND/
// BLOCK/ENDBLK/DICTIONARY/MLINESTYLE/…) is an object that needs a `5` handle in R2018.
const HANDLE_EXCLUDE: ReadonlySet<string> = new Set(['SECTION', 'ENDSEC', 'TABLE', 'ENDTAB', 'EOF']);

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
  const rawPush = (code: number, value: string | number): void => {
    out.push(String(code), typeof value === 'number' ? num(value) : value);
  };

  // ADR-644 (#5) — professional R2018 structural compliance (handles/$HANDSEED/APPID/subclass) is
  // emitted on the SAME path as the HEADER, and ONLY for the AutoCAD (non-explode) dialect. Bare
  // `writeDxfAscii(entities)` (unit tests / legacy in-process) and Tekton (`explode`) keep their
  // historic handle-less, byte-identical envelope — zero regression.
  const wantHeader = !!(
    options.acadVer || options.insunits != null || options.codepage ||
    options.extMin || options.extMax || options.measurement != null ||
    options.ltscale != null || options.lunits != null ||
    options.pdmode != null || options.pdsize != null
  );
  // ADR-644 — R2018 structural compliance (handles/subclass/tables/defaults) applies to R2000+ only;
  // R12 (AC1009) is the handle-less, subclass-less legacy format, so it stays bare even professionally.
  const emitHandles = wantHeader && !explode && version !== DxfDocumentVersion.R12;
  const alloc = createHandleAllocator();
  const handleAlloc: HandleAllocator | undefined = emitHandles ? alloc : undefined;
  // ADR-644 (#9f) — the *Model_Space / *Paper_Space BLOCK_RECORD handles, pre-allocated so the
  // BLOCK_RECORD table (owner of the two records), the BLOCKS section (their matching BLOCK
  // definitions — R2018 requires them) and every model-space entity's owner (330) all reference the
  // SAME handle. Without the *Model_Space BLOCK definition AutoCAD desyncs → «Invalid Block Name».
  const modelSpaceHandle = emitHandles ? alloc.next() : undefined;
  const paperSpaceHandle = emitHandles ? alloc.next() : undefined;

  // ADR-644 (#5) — lazy handle injection: after any `0 <TYPE>` that is not a structural marker,
  // the NEXT pair triggers a `5 <handle>` — UNLESS the record already carries its own handle (`5`
  // for entities/objects, `105` for DIMSTYLE), in which case it was allocated from the SAME `alloc`.
  let pendingHandle = false;
  const pair: Pair = emitHandles
    ? (code, value) => {
        if (pendingHandle) {
          pendingHandle = false;
          if (code !== 5 && code !== 105) rawPush(5, alloc.next());
        }
        rawPush(code, value);
        if (code === 0 && typeof value === 'string' && !HANDLE_EXCLUDE.has(value)) {
          pendingHandle = true;
        }
      }
    : rawPush;
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
  // ADR-644 (#5) — index of the `$HANDSEED` value slot in `out`, backfilled after all emission
  // (the seed must be ≥ every handle, known only at the end). -1 when handles are off.
  let seedIdx = -1;
  if (wantHeader) {
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
    // ADR-644 (#9b) — $PSTYLEMODE = 1 (color-dependent / CTB plot styles, the AutoCAD default). In
    // this mode a layer's plot style follows its colour, so the layer PlotStyleName handle (390) may
    // be the null handle. Declaring it is the companion to emitting `390` on every LAYER record —
    // without BOTH, AutoCAD aborts the LAYER table («Did not receive PlotStyleName»).
    if (emitHandles) { pair(9, '$PSTYLEMODE'); pair(290, 1); }
    // ADR-644 (#5) — $HANDSEED (next-unused handle). Value backfilled after all handles are handed
    // out; pushed raw (code 5, but not an object handle → must bypass the lazy-injection sink).
    if (emitHandles) {
      rawPush(9, '$HANDSEED');
      rawPush(5, '0');
      seedIdx = out.length - 1;
    }
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

  const dimEntities = entities.filter((e) => e.type === 'dimension');
  const blockEntities = entities.filter((e): e is BlockEntity => e.type === 'block');
  const hasDimBlocks = dimStyles.length > 0 && dimEntities.length > 0;
  // ADR-644 (#9g) — AutoCAD requires a BLOCK_RECORD entry for EVERY block in the BLOCKS section (it
  // does NOT auto-create them at DXFIN, unlike ezdxf → «Invalid Block Name»). Pre-allocate a record
  // handle per block name (named INSERT blocks + resolvable `*Dn` dimension blocks) so the
  // BLOCK_RECORD record ⇄ the BLOCK definition owner (330) reference the SAME handle.
  const blockRecordHandles = new Map<string, string>();
  if (emitHandles) {
    for (const name of new Set(blockEntities.map((b) => b.name))) blockRecordHandles.set(name, alloc.next());
    if (hasDimBlocks) {
      dimEntities.forEach((e, i) => {
        if (dimStyleById[(e as unknown as DimensionEntity).styleId]) blockRecordHandles.set(`*D${i}`, alloc.next());
      });
    }
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
    allocator: handleAlloc,
    modelSpaceHandle,
    paperSpaceHandle,
    blockRecordHandles,
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
  // ADR-644 (#9f) — professional R2018 ALWAYS emits a BLOCKS section: it MUST define *Model_Space +
  // *Paper_Space (declared in the BLOCK_RECORD table) or AutoCAD desyncs reading the entities that
  // follow. Legacy/Tekton stays block-section-less unless a real block exists.
  if (emitHandles || hasDimBlocks || blockEntities.length > 0) {
    pair(0, 'SECTION');
    pair(2, 'BLOCKS');
    if (emitHandles && modelSpaceHandle && paperSpaceHandle) {
      emitSpaceBlock(pair, '*Model_Space', modelSpaceHandle);
      emitSpaceBlock(pair, '*Paper_Space', paperSpaceHandle);
    }
    if (hasDimBlocks) {
      const lookup = buildDimensionLookup(dimEntities);
      dimEntities.forEach((e, i) => {
        const dim = e as unknown as DimensionEntity;
        const style = dimStyleById[dim.styleId];
        if (!style) return; // unresolved style → skip block (DIMENSION entity still regen-fallbacks)
        // ADR-644 (#9g) — owner (330) = the pre-allocated `*Dn` BLOCK_RECORD handle (record ⇄ def match).
        writeDimensionBlock(pair, dim, style, `*D${i}`, layerObj(e)?.name ?? DEFAULT_LAYER, s, lookup, emitHandles, blockRecordHandles.get(`*D${i}`));
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
          pair, () => memberDimBlock++, dimStyleNameById, version, emitHandles);
      };
      // ADR-644 (#9g) — each BLOCK definition's owner (330) = its pre-allocated BLOCK_RECORD handle.
      writeBlockDefinitions(pair, blockEntities, (b) => layerObj(b)?.name ?? DEFAULT_LAYER, emitBlockMember, emitHandles, blockRecordHandles);
    }
    pair(0, 'ENDSEC');
  }

  // ADR-636 Φ2.4 (D.4) — native MLINE round-trip: reconstruct one MLINE + its MLINESTYLE from
  // the `dxfMlineSource` marker the import stamped on the first element polyline of each group.
  // AutoCAD path only; `explode` (Tekton) keeps the exploded N POLYLINEs (zero regression).
  const mlineStyles = buildMlineStyleRegistry(explode ? [] : entities, handleAlloc);
  const mlineGroupIds = explode ? new Set<string>() : collectMlineGroupIds(entities);
  // ADR-643 Φ5b — IMAGEDEF registry (AutoCAD path only· Tekton `explode` → minimal parser, no images).
  // Built here (after mline) so its handles come from the SAME `$HANDSEED` pool, before the ENTITIES loop.
  const imageDefs = buildImageDefRegistry(explode ? [] : entities, handleAlloc);

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
    // ADR-643 Φ5b — image-mode hatch → tiled IMAGE entities (πραγματική διάσταση tile) που δείχνουν
    // στο κοινό IMAGEDEF· ΑΝΤΙ για το native HATCH. Solid-downgrade δεν έχει marker → κανονικός writeEntity.
    if (!explode && e.type === 'hatch') {
      const marker = (e as HatchEntity).dxfImageExport;
      if (marker) { emitImageTiles(pair, marker, imageDefs.handleFor(marker.filename), layerName, resolveAci(e, layer), s); continue; }
    }
    writeEntity(e, layerName, resolveAci(e, layer), s, mmScale, explode, pair, () => dimBlockIndex++, dimStyleNameById, version, emitHandles, modelSpaceHandle);
  }
  pair(0, 'ENDSEC');
  // ADR-636 Φ2.4 (D.4) / ADR-643 Φ5b — ONE OBJECTS section (LAST in DXF order) holding BOTH the
  // ACAD_MLINESTYLE dictionary/styles AND the ACAD_IMAGE_DICT/IMAGEDEFs. Skipped when neither present.
  const hasObjects = !mlineStyles.isEmpty || !imageDefs.isEmpty;
  if (hasObjects) {
    pair(0, 'SECTION');
    pair(2, 'OBJECTS');
    emitMlineStyleBlocks(pair, mlineStyles);
    emitImageDefBlocks(pair, imageDefs);
    pair(0, 'ENDSEC');
  }
  pair(0, 'EOF');
  // ADR-644 (#5) — backfill $HANDSEED now that every handle has been handed out (≥ all of them).
  if (seedIdx >= 0) out[seedIdx] = alloc.seedHex();
  return out.join('\n') + '\n';
}

// ─── Per-entity emitters ──────────────────────────────────────────────────────

/**
 * ADR-644 (#9f) — emit a `*Model_Space` / `*Paper_Space` BLOCK definition (empty, on layer `0`).
 * R2018 requires these two in the BLOCKS section to match their BLOCK_RECORD entries. `recordHandle`
 * is the owner (330) — the same handle the BLOCK_RECORD record carries. The `5` block handle is
 * injected by the sink right after the `0 BLOCK`/`0 ENDBLK`.
 */
function emitSpaceBlock(pair: Pair, name: string, recordHandle: string): void {
  // ADR-644 (#9f/#9g) — reuse the shared BLOCK begin/end SSoT (empty block, layer `0`, flag 0).
  emitBlockBegin(pair, name, 0, '0', recordHandle, true);
  emitBlockEnd(pair, '0', recordHandle, true);
}

// ADR-505 §A — primitive emitters (emitLine/emitCircle/emitArc/emitPoint/emit3DFace/emitPath),
// arcPoints + num moved to `dxf-ascii-primitive-emitters.ts` (file-size SRP split, N.7.1).
