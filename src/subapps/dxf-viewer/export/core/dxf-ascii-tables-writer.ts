/**
 * ============================================================================
 * DXF TABLES SECTION WRITER — VPORT + APPID + LTYPE + LAYER + STYLE + DIMSTYLE
 * ============================================================================
 *
 * Emits the single `SECTION/TABLES … ENDSEC` block for the client-side DXF
 * writer (`dxf-ascii-writer`), split out for file-size SRP (N.7.1) alongside the
 * HATCH split (`dxf-ascii-hatch-writer`).
 *
 * Table order follows the DXF spec: VPORT → APPID (ADR-644 #3) → LTYPE → LAYER
 * (ADR-636 Στάδιο 2 Φ2.1, reusing the `writeLayerTable` SSoT body emitter) → STYLE
 * (ADR-636 Φ2.4 D.5) → DIMSTYLE (ADR-362 Round 25). Emits nothing when every input
 * is empty, so a bare `writeDxfAscii(entities)` keeps its historic table-less envelope.
 *
 * ADR-644 (#9) — when an `allocator` is supplied (professional AutoCAD path) every
 * table header + record carries its R2018 handle (`5`, or `105` for DIMSTYLE), owner
 * (`330`) and subclass markers (`100 AcDbSymbolTable` / `100 AcDb…TableRecord`). Without
 * it (bare/Tekton/round-trip) the historic minimal, handle-less records are emitted
 * verbatim (byte-identical) — zero regression.
 */

import type { DimStyle } from '../../types/dimension';
import type { SceneLayer } from '../../types/entities';
import type { LinetypeDef } from '../../config/linetype-iso-catalog';
import type { DxfStyleTableEntry } from '../../text-engine/types/text-ast.types';
import { emitDimStyle } from '../../utils/dxf-dimstyle-writer';
// ADR-644 (#9d) — the built-in default DimStyle supplies the numeric body of the mandatory
// «Standard» DIMSTYLE record (renamed) AutoCAD R2018 requires in the DIMSTYLE table.
import { NESTOR_DEFAULT_TEMPLATE } from '../../systems/dimensions/dim-style-templates';
import { emitLayerTableBody, LINETYPE_SYMBOL_XDATA_APP, LAYER_XDATA_APPS } from '../../utils/dxf-layer-table-writer';
import type { Pair } from './dxf-ascii-hatch-writer';
import type { HandleAllocator } from './dxf-ascii-handle-allocator';

/**
 * ADR-636 (2026-07-12) — the `*Active` viewport view, so AutoCAD opens ZOOMED on the drawing
 * instead of a default (0,0) view that leaves the model off-screen (repro: «μαύρη οθόνη στο
 * άνοιγμα»). `center`/`height` are in OUTPUT units (already ×scale, mirror of $EXTMIN/$EXTMAX);
 * `aspect` = viewport width/height. Derived from the drawing extents by the writer.
 */
export interface VportView {
  readonly center: { x: number; y: number };
  readonly height: number;
  readonly aspect: number;
}

export interface EmitTablesOptions {
  /**
   * ADR-636 — `*Active` VPORT (view center + height) → AutoCAD restores this on open, so the file
   * opens framed on the model. Emitted FIRST (correct DXF table order: VPORT → LTYPE → LAYER …).
   */
  readonly viewport?: VportView;
  /** Full layer defs → LTYPE + LAYER table (ADR-636 Στάδιο 2 Φ2.1). */
  readonly tableLayers?: ReadonlyArray<SceneLayer>;
  /** Non-ISO linetypes referenced by the layers → LTYPE entries. */
  readonly customLinetypes?: ReadonlyArray<LinetypeDef>;
  /** Text styles referenced by TEXT/MTEXT (group 7) → STYLE table (ADR-636 Φ2.4 D.5). */
  readonly textStyles?: ReadonlyArray<DxfStyleTableEntry>;
  /** Resolved dimension styles → DIMSTYLE table (ADR-362 Round 25). */
  readonly dimStyles: ReadonlyArray<DimStyle>;
  /** Coordinate scale — DIMSTYLE sizes scale via DIMSCALE × `s`. */
  readonly s: number;
  /** ADR-644 (#5/#9) — the ONE handle allocator (professional path). Absent → handle-less legacy. */
  readonly allocator?: HandleAllocator;
  /** ADR-644 (#9f) — pre-allocated *Model_Space / *Paper_Space BLOCK_RECORD handles (professional). */
  readonly modelSpaceHandle?: string;
  readonly paperSpaceHandle?: string;
  /** ADR-644 (#9g) — `blockName → pre-allocated BLOCK_RECORD handle` for every named/dim block. */
  readonly blockRecordHandles?: ReadonlyMap<string, string>;
}

/**
 * ADR-644 (#3) — the AutoCAD application ids the export references. `ACAD` is the built-in owner
 * of standard XDATA; the `Nestor*` + `AcCmTransparency` ids are exactly the app names the layer
 * XDATA writer (`emitLayerXData`) attaches, plus `NESTOR_APP_LTYPE` (ADR-642 Φ3-B) which the LTYPE
 * writer (`emitSymbolXData`) attaches for embedded symbols (SSoT mirror — keep in lockstep). Every
 * referenced `1001 <app>` MUST have a matching APPID record or AutoCAD aborts the table («Premature
 * end of object»). Static because the Nestor app names are fixed; emitting an unused one is harmless.
 */
export const EXPORT_APPID_NAMES: ReadonlyArray<string> = Object.freeze([
  'ACAD',
  ...Object.values(LAYER_XDATA_APPS),
  LINETYPE_SYMBOL_XDATA_APP,
]);

/**
 * ADR-644 (#9) — emit a `0 TABLE / 2 <NAME>` header with its R2018 handle (`5`), root owner
 * (`330 0`) and `100 AcDbSymbolTable` subclass, then the `70 <count>`. Returns the table's handle
 * (each record's owner `330`). Without an allocator → the historic minimal header (no handle),
 * return `undefined`. `extraSubclass` (DIMSTYLE's `AcDbDimStyleTable`) is appended after `70`.
 */
function emitTableHeader(
  pair: Pair, name: string, count: number, allocator?: HandleAllocator, extraSubclass?: string,
): string | undefined {
  pair(0, 'TABLE');
  pair(2, name);
  let tableHandle: string | undefined;
  if (allocator) {
    tableHandle = allocator.next();
    pair(5, tableHandle);
    pair(330, '0');
    pair(100, 'AcDbSymbolTable');
  }
  pair(70, count);
  if (allocator && extraSubclass) pair(100, extraSubclass);
  return tableHandle;
}

/**
 * ADR-644 (#9) — emit a table record's R2018 handle + owner + subclass markers, immediately after
 * its `0 <RECORD>`. `handleCode` is `5` for all tables except DIMSTYLE (`105`). No-op without an
 * allocator, so the legacy record stays byte-identical.
 */
function emitRecordHandle(
  pair: Pair, ownerHandle: string | undefined, recordClass: string,
  allocator?: HandleAllocator, handleCode = 5,
): void {
  if (!allocator) return;
  pair(handleCode, allocator.next());
  pair(330, ownerHandle ?? '0');
  pair(100, 'AcDbSymbolTableRecord');
  pair(100, recordClass);
}

/**
 * Emit one `STYLE` table entry — the EXACT inverse of the import `groupCodesToEntry`
 * (`style-table-reader.ts`): 2 name / 70 flags / 40 fixed-height / 41 width-factor /
 * 50 oblique / 71 gen-flags / 3 font-file / 4 big-font. `height 0` = variable, so each
 * TEXT/MTEXT keeps its own group-40 height. Round-trips ADR-635 Φ C.5 (name → font file
 * → stripped family). ADR-644 (#9) — R2018 handle + subclass when an allocator is supplied.
 */
function emitTextStyle(
  pair: Pair, st: DxfStyleTableEntry, ownerHandle?: string, allocator?: HandleAllocator,
): void {
  pair(0, 'STYLE');
  emitRecordHandle(pair, ownerHandle, 'AcDbTextStyleTableRecord', allocator);
  pair(2, st.name);
  pair(70, st.flags);
  pair(40, st.height);
  pair(41, st.widthFactor);
  pair(50, st.obliqueAngle);
  pair(71, st.textGenerationFlags);
  pair(3, st.fontFile);
  pair(4, st.bigFontFile);
}

/**
 * Emit the `VPORT` table with a single `*Active` viewport whose view is centered on the drawing
 * (`center`/`height` in output units) with a plan view direction. AutoCAD restores this as the
 * open view → the file frames the model instead of showing an off-screen (0,0) default. Codes:
 * 12/22 view center, 40 view height, 41 aspect, 16/26/36 plan view direction (0,0,1). ADR-636.
 */
function emitVport(pair: Pair, v: VportView, allocator?: HandleAllocator): void {
  const tableHandle = emitTableHeader(pair, 'VPORT', 1, allocator);
  pair(0, 'VPORT');
  emitRecordHandle(pair, tableHandle, 'AcDbViewportTableRecord', allocator);
  pair(2, '*Active');
  pair(70, 0);
  pair(10, 0); pair(20, 0);            // lower-left corner of viewport (fraction)
  pair(11, 1); pair(21, 1);            // upper-right corner of viewport (fraction)
  pair(12, v.center.x); pair(22, v.center.y); // view center point (DCS)
  pair(13, 0); pair(23, 0);            // snap base point
  pair(14, 10); pair(24, 10);          // snap spacing
  pair(15, 10); pair(25, 10);          // grid spacing
  pair(16, 0); pair(26, 0); pair(36, 1); // view direction (0,0,1) → plan
  pair(17, 0); pair(27, 0); pair(37, 0); // view target point
  pair(40, v.height);                  // view height (model units)
  pair(41, v.aspect);                  // viewport aspect ratio
  pair(42, 50);                        // lens length
  pair(43, 0); pair(44, 0);            // front / back clip planes
  pair(50, 0);                         // snap rotation angle
  pair(51, 0);                         // view twist angle
  pair(71, 0); pair(72, 1000); pair(73, 1); pair(74, 3);
  pair(75, 0); pair(76, 1); pair(77, 0); pair(78, 0);
  pair(0, 'ENDTAB');
}

/**
 * ADR-644 (#3) — emit the `APPID` table declaring every application id the export's XDATA
 * references (`EXPORT_APPID_NAMES`). Professional path only (needs handles); the layer XDATA that
 * references these ids is likewise professional-only. Without it AutoCAD rejects the LAYER table.
 */
function emitAppidTable(pair: Pair, allocator: HandleAllocator): void {
  const tableHandle = emitTableHeader(pair, 'APPID', EXPORT_APPID_NAMES.length, allocator);
  for (const name of EXPORT_APPID_NAMES) {
    pair(0, 'APPID');
    emitRecordHandle(pair, tableHandle, 'AcDbRegAppTableRecord', allocator);
    pair(2, name);
    pair(70, 0);
  }
  pair(0, 'ENDTAB');
}

/** ADR-644 (#9d) — the mandatory default text style AutoCAD R2018 requires in the STYLE table. */
const STANDARD_STYLE: DxfStyleTableEntry = {
  name: 'Standard', fontFile: 'txt', bigFontFile: '', height: 0,
  widthFactor: 1, obliqueAngle: 0, flags: 0, textGenerationFlags: 0,
};

/** ADR-644 (#9d) — «Standard» DIMSTYLE (the built-in default body, renamed) — mandatory R2018 entry. */
const STANDARD_DIMSTYLE: DimStyle = { ...NESTOR_DEFAULT_TEMPLATE, name: 'Standard' };

/**
 * Emit a STYLE table (records + subclass when professional). ADR-644 (#9d) — prepend the mandatory
 * «Standard» default (professional path) when the scene's styles don't already include it.
 */
function emitStyleTable(pair: Pair, textStyles: ReadonlyArray<DxfStyleTableEntry>, allocator?: HandleAllocator): void {
  const needsStd = !!allocator && !textStyles.some((st) => st.name === 'Standard');
  const styles = needsStd ? [STANDARD_STYLE, ...textStyles] : textStyles;
  const tableHandle = emitTableHeader(pair, 'STYLE', styles.length, allocator);
  for (const st of styles) emitTextStyle(pair, st, tableHandle, allocator);
  pair(0, 'ENDTAB');
}

/**
 * Emit a DIMSTYLE table (header +`AcDbDimStyleTable`, records use group 105). ADR-644 (#9d) — prepend
 * the mandatory «Standard» default (professional path) when the dimensions don't already reference it.
 */
function emitDimStyleTable(pair: Pair, dimStyles: ReadonlyArray<DimStyle>, s: number, allocator?: HandleAllocator): void {
  const needsStd = !!allocator && !dimStyles.some((st) => st.name === 'Standard');
  const styles = needsStd ? [STANDARD_DIMSTYLE, ...dimStyles] : dimStyles;
  const tableHandle = emitTableHeader(pair, 'DIMSTYLE', styles.length, allocator, 'AcDbDimStyleTable');
  for (const st of styles) emitDimStyle(pair, st, s, tableHandle, allocator);
  pair(0, 'ENDTAB');
}

/** ADR-644 (#9c) — an EMPTY-but-present mandatory symbol table (VIEW / UCS): header + `70 0` + ENDTAB. */
function emitEmptyTable(pair: Pair, name: string, allocator: HandleAllocator): void {
  emitTableHeader(pair, name, 0, allocator);
  pair(0, 'ENDTAB');
}

/**
 * ADR-644 (#9c/#9f) — the mandatory `BLOCK_RECORD` table with the two well-known records
 * `*Model_Space` + `*Paper_Space`. Their handles are PRE-ALLOCATED by the writer (not `emitRecordHandle`)
 * so the matching BLOCK definitions in the BLOCKS section + every model-space entity's owner (330)
 * point to the SAME handle — R2018 consistency (without it AutoCAD desyncs → «Invalid Block Name»).
 * AutoCAD DXFIN auto-creates records for the `*Dn`/named blocks in the BLOCKS section.
 */
/** Emit one BLOCK_RECORD record with a PRE-ALLOCATED handle (matches its BLOCK definition owner). */
function emitBlockRecord(pair: Pair, name: string, handle: string, tableHandle: string | undefined): void {
  pair(0, 'BLOCK_RECORD');
  pair(5, handle);
  pair(330, tableHandle ?? '0');
  pair(100, 'AcDbSymbolTableRecord');
  pair(100, 'AcDbBlockTableRecord');
  pair(2, name);
  pair(70, 0);
}

function emitBlockRecordTable(
  pair: Pair, allocator: HandleAllocator, modelSpaceHandle: string, paperSpaceHandle: string,
  blockRecordHandles: ReadonlyMap<string, string>,
): void {
  // ADR-644 (#9g) — a record for EVERY block: the two well-known spaces + one per named/dimension
  // block in the BLOCKS section (AutoCAD requires the record to exist or «Invalid Block Name»).
  const tableHandle = emitTableHeader(pair, 'BLOCK_RECORD', 2 + blockRecordHandles.size, allocator);
  emitBlockRecord(pair, '*Model_Space', modelSpaceHandle, tableHandle);
  emitBlockRecord(pair, '*Paper_Space', paperSpaceHandle, tableHandle);
  for (const [name, handle] of blockRecordHandles) emitBlockRecord(pair, name, handle, tableHandle);
  pair(0, 'ENDTAB');
}

/**
 * Emit the single `SECTION/TABLES … ENDSEC` block.
 *
 * ADR-644 (#9c) — professional (allocator present): ALL 9 mandatory R2018 symbol tables are emitted
 * (even when empty), in AutoCAD's canonical order — VPORT → LTYPE → LAYER → STYLE → VIEW → UCS →
 * APPID → DIMSTYLE → BLOCK_RECORD — or DXFIN aborts («Missing SymbolTable:VIEW»). Legacy (no
 * allocator): the historic content-gated subset (bare/Tekton/round-trip), byte-identical.
 * Both `out` (for the layer body) and `pair` (for the rest) write to the same array.
 */
export function emitTablesSection(out: string[], pair: Pair, opts: EmitTablesOptions): void {
  const layers = opts.tableLayers ?? [];
  const textStyles = opts.textStyles ?? [];
  const { dimStyles, viewport, allocator } = opts;
  const customLinetypes = opts.customLinetypes ?? [];

  if (allocator) {
    pair(0, 'SECTION');
    pair(2, 'TABLES');
    if (viewport) emitVport(pair, viewport, allocator);
    else emitEmptyTable(pair, 'VPORT', allocator);
    emitLayerTableBody(out, { layers, customLinetypes, allocator }); // LTYPE + LAYER
    emitStyleTable(pair, textStyles, allocator);
    emitEmptyTable(pair, 'VIEW', allocator);
    emitEmptyTable(pair, 'UCS', allocator);
    emitAppidTable(pair, allocator);
    emitDimStyleTable(pair, dimStyles, opts.s, allocator);
    emitBlockRecordTable(pair, allocator, opts.modelSpaceHandle ?? '0', opts.paperSpaceHandle ?? '0', opts.blockRecordHandles ?? new Map());
    pair(0, 'ENDSEC');
    return;
  }

  // ── Legacy (non-professional): content-gated subset, byte-identical to pre-644 output ──
  if (!viewport && layers.length === 0 && textStyles.length === 0 && dimStyles.length === 0) return;
  pair(0, 'SECTION');
  pair(2, 'TABLES');
  if (viewport) emitVport(pair, viewport, allocator);
  if (layers.length > 0) emitLayerTableBody(out, { layers, customLinetypes, allocator });
  if (textStyles.length > 0) emitStyleTable(pair, textStyles, allocator);
  if (dimStyles.length > 0) emitDimStyleTable(pair, dimStyles, opts.s, allocator);
  pair(0, 'ENDSEC');
}
