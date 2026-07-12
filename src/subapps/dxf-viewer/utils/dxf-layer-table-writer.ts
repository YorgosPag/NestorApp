/**
 * DXF LAYER + LTYPE Table Writer — ADR-358 §5.x Phase 3B (G15 round-trip).
 *
 * Emits a minimal `TABLES` section (LTYPE first, then LAYER) suitable for the
 * round-trip integrity test in `__tests__/dxf-roundtrip-layers.test.ts`. This is
 * NOT a full DXF writer — production DXF export still flows through the ezdxf
 * Python microservice (see `types/dxf-export.types.ts`). The writer's purpose
 * is to guarantee that the in-app data model can survive a tokenised DXF round
 * trip at the layer-table level (lossless save → load).
 *
 * Mirror of the parsers:
 *   - LTYPE entries → `parseLinetypeTable()` recovers them.
 *   - LAYER entries → `parseLayerTable()` recovers them.
 *
 * Scaffold fields (Q15 bimCategory + Q16 vpOverrides) are emitted via Nestor
 * XDATA AppIds and resurrected by the parser, satisfying the §G15 round-trip
 * spec without unlocking active product-code use (ratchet still BLOCKs).
 */

import {
  encodeDxfCode370,
} from '../config/lineweight-iso-catalog';
import {
  isIsoBaselineLinetype,
  type LinetypeDef,
} from '../config/linetype-iso-catalog';
import { isSimpleExpressible } from '../config/complex-linetype-adapters';
import type { ComplexLinetypeDef, PatternElement, SymbolElement } from '../config/complex-linetype-types';
import type { SceneLayer } from '../types/entities';
import type { HandleAllocator } from '../export/core/dxf-ascii-handle-allocator';
import { clamp255 } from './scalar-math';

export interface WriteLayerTableInput {
  readonly layers: ReadonlyArray<SceneLayer>;
  /** Custom (non-ISO) linetypes referenced by any layer — emitted in LTYPE table. */
  readonly customLinetypes: ReadonlyArray<LinetypeDef>;
  /**
   * ADR-644 (#9) — the ONE handle allocator (professional AutoCAD path). When present, every table
   * header + LTYPE/LAYER record carries its R2018 handle (`5`), owner (`330`) and subclass markers,
   * and each simple `49` dash is followed by `74 0`. Absent (round-trip `writeLayerTable`) → the
   * historic minimal, handle-less table is emitted verbatim (byte-identical) — zero regression.
   */
  readonly allocator?: HandleAllocator;
}

/**
 * ADR-644 (#9) — emit a `0 TABLE / 2 <NAME>` header with its R2018 handle, root owner (`330 0`)
 * and `100 AcDbSymbolTable` subclass, then `70 <count>`. Returns the table handle (record owner).
 * No allocator → the historic minimal header. Uses raw `emit()` (this writer is `pair`-sink-free).
 */
function emitTableHeaderRaw(
  out: string[], name: string, count: number, allocator?: HandleAllocator,
): string | undefined {
  emit(out, '0', 'TABLE');
  emit(out, '2', name);
  let handle: string | undefined;
  if (allocator) {
    handle = allocator.next();
    emit(out, '5', handle);
    emit(out, '330', '0');
    emit(out, '100', 'AcDbSymbolTable');
  }
  emit(out, '70', String(count));
  return handle;
}

/** ADR-644 (#9) — emit a table record's R2018 handle + owner + subclass markers (raw `emit`). No-op
 *  without an allocator, so the legacy record stays byte-identical. */
function emitRecordHandleRaw(
  out: string[], owner: string | undefined, recordClass: string, allocator?: HandleAllocator,
): void {
  if (!allocator) return;
  emit(out, '5', allocator.next());
  emit(out, '330', owner ?? '0');
  emit(out, '100', 'AcDbSymbolTableRecord');
  emit(out, '100', recordClass);
}

/**
 * Emit a tokenised DXF `TABLES` section containing the LTYPE table followed by
 * the LAYER table. Wrapped in `SECTION` / `ENDSEC` markers so the output can be
 * fed directly to `parseLinetypeTable()` + `parseLayerTable()`.
 *
 * Output shape: alternating code/value lines (line `2i` = code, `2i+1` = value).
 */
export function writeLayerTable(input: WriteLayerTableInput): string[] {
  const out: string[] = [];

  emit(out, '0', 'SECTION');
  emit(out, '2', 'TABLES');

  emitLayerTableBody(out, input);

  emit(out, '0', 'ENDSEC');
  return out;
}

/**
 * Emit the LTYPE + LAYER `TABLE` blocks **without** the surrounding
 * `SECTION/TABLES … ENDSEC` wrapper — so a caller that already owns a single
 * `TABLES` section (the production writer `dxf-ascii-writer`, which also emits a
 * `DIMSTYLE` table) can inline LTYPE + LAYER into that **one** section, in the
 * correct DXF table order (LTYPE → LAYER → DIMSTYLE). ADR-636 Στάδιο 2 Φ2.1.
 *
 * `writeLayerTable` above stays the wrapped SSoT (byte-identical output) for the
 * round-trip parsers/tests.
 */
export function emitLayerTableBody(out: string[], input: WriteLayerTableInput): void {
  emitLtypeTable(out, input.customLinetypes, input.allocator);
  emitLayerTable(out, input.layers, input.allocator);
}

/**
 * ADR-644 (#9d) — the LTYPE default entries AutoCAD R2018 REQUIRES (or DXFIN aborts: «Missing
 * Default entry ByLayer in SymbolTable:LTYPE»). Emitted FIRST, professional path only. `ByLayer`/
 * `ByBlock` are the special reserved linetypes; `Continuous` is the solid baseline. All solid
 * (empty pattern) → the normal loop emits them as `73 0 / 40 0`.
 */
const LTYPE_DEFAULTS: ReadonlyArray<LinetypeDef> = [
  { name: 'ByBlock', description: '', pattern: [], origin: 'iso-baseline' },
  { name: 'ByLayer', description: '', pattern: [], origin: 'iso-baseline' },
  { name: 'Continuous', description: 'Solid line', pattern: [], origin: 'iso-baseline' },
];

function emitLtypeTable(
  out: string[], linetypes: ReadonlyArray<LinetypeDef>, allocator?: HandleAllocator,
): void {
  // ADR-644 (#9d) — prepend the mandatory ByBlock/ByLayer/Continuous default entries (professional
  // path). The adapter already excludes these names from `linetypes` → no duplicates.
  const all = allocator ? [...LTYPE_DEFAULTS, ...linetypes] : linetypes;
  const tableHandle = emitTableHeaderRaw(out, 'LTYPE', all.length, allocator);

  // ADR-642 Φ2-B — deterministic synthetic STYLE handle per embedded-text styleId (reserved block
  // `0xA0`, below the allocator's `0x100` base → no collision with the global handles; the round-trip
  // reader reconstructs it deterministically, so it is NOT drawn from the allocator).
  const styleHandles = buildEmbeddedTextStyleHandles(all);

  for (const lt of all) {
    // ADR-644 (#4) — DEFINE every referenced linetype (incl. ISO baseline). AutoCAD does NOT
    // auto-create linetypes from a DXF: an entity/layer referencing a name absent from the LTYPE
    // table aborts the load («Bad linetype name …»). The adapter is the SSoT that decides WHICH
    // names to include (layers + entities + ISO); this writer emits whatever it is given.
    emit(out, '0', 'LTYPE');
    emitRecordHandleRaw(out, tableHandle, 'AcDbLinetypeTableRecord', allocator);
    emit(out, '2', lt.name);
    emit(out, '70', '0');
    emit(out, '3', lt.description);
    emit(out, '72', '65');
    // ADR-642 Φ2-B — a complex linetype that can't collapse to a plain dash array (embedded
    // `──GAS──` text) emits its ordered elements incl. the `[TEXT,...]` descriptors; the simple
    // types keep the unchanged geometry-only `49` emission (zero regression).
    if (lt.complex && !isSimpleExpressible(lt.complex)) {
      emitComplexLtype(out, lt.complex, styleHandles);
    } else {
      emit(out, '73', String(lt.pattern.length));
      emit(out, '40', String(totalPatternLength(lt.pattern)));
      for (const dash of lt.pattern) {
        emit(out, '49', toDxfNumber(dash));
        // ADR-644 (#9) — R2018 requires a `74` (complex-element type; 0 = plain dash) after each
        // `49`. Professional path only (gated on the allocator) → round-trip output byte-identical.
        if (allocator) emit(out, '74', '0');
      }
    }
  }

  emit(out, '0', 'ENDTAB');
}

/** First synthetic STYLE handle (hex) — distinct from the MLINESTYLE base (0x2A/0x2b). */
const EMBEDDED_STYLE_HANDLE_BASE = 0xa0;

/**
 * ADR-642 Φ2-B — deterministic `styleId → synthetic DXF handle` map for embedded-text linetypes,
 * in first-seen order. PURE (same input ⇒ same handles) so the round-trip reader can reconstruct
 * the inverse `handle → styleId` map without a full STYLE table (production export = ezdxf).
 */
export function buildEmbeddedTextStyleHandles(
  linetypes: ReadonlyArray<LinetypeDef>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const lt of linetypes) {
    if (!lt.complex || isSimpleExpressible(lt.complex)) continue;
    for (const layer of lt.complex.layers) {
      for (const el of layer.elements) {
        if (el.kind === 'text' && !map.has(el.styleId)) {
          map.set(el.styleId, (EMBEDDED_STYLE_HANDLE_BASE + map.size).toString(16).toUpperCase());
        }
      }
    }
  }
  return map;
}

/** Emit a complex LTYPE entry's ordered elements (geometry `49` + embedded `[TEXT,...]` blocks). */
function emitComplexLtype(
  out: string[],
  complex: ComplexLinetypeDef,
  styleHandles: Map<string, string>,
): void {
  // Single-layer linetype (compound layers are Φ5). ADR-642 Φ3-B — symbols ride as a
  // universally-valid zero-length `49 0.0` slot (via `elementDashValue`, so the geometry opens in
  // ANY reader with no dangling `.shx` shape ref) + a Nestor XDATA descriptor (`emitSymbolXData`).
  const elements = complex.layers[0]?.elements ?? [];
  emit(out, '73', String(elements.length));
  emit(out, '40', String(totalElementLength(elements)));
  for (const el of elements) {
    if (el.kind === 'text') {
      emit(out, '49', '0.0'); // zero-length slot (AutoCAD-faithful — surrounding gaps give room)
      // 74 bit 2 = text; bit 1 = absolute rotation (set when the text does NOT follow the line).
      emit(out, '74', String(0x2 | (el.followPath ? 0 : 0x1)));
      emit(out, '75', '0');
      emit(out, '340', styleHandles.get(el.styleId) ?? '0');
      emit(out, '46', toDxfNumber(el.scale));
      emit(out, '50', toDxfNumber(el.rotationDeg));
      emit(out, '44', toDxfNumber(el.offsetXMm));
      emit(out, '45', toDxfNumber(el.offsetYMm));
      emit(out, '9', el.value);
    } else {
      // dash / gap / dot / symbol → single `49` slot (symbol = 0.0, its descriptor rides in XDATA).
      emit(out, '49', toDxfNumber(elementDashValue(el)));
    }
  }
  emitSymbolXData(out, elements);
  emitCompoundXData(out, complex); // ADR-642 Φ5-B — preserve compound layers[1..] (+ base offset/width)
}

/**
 * ADR-642 Φ3-B — Nestor XDATA app id owning the embedded-symbol descriptors on an LTYPE record.
 * SSoT: the reader (`dxf-linetype-table-parser`) and the APPID declaration
 * (`EXPORT_APPID_NAMES`, `dxf-ascii-tables-writer`) both reference THIS constant — keep in lockstep
 * (mirror the `Nestor*` layer XDATA apps). A dedicated namespace (Revit/ArchiCAD-style) so it never
 * collides with genuine `ACAD` XDATA.
 */
export const LINETYPE_SYMBOL_XDATA_APP = 'NESTOR_APP_LTYPE';

/**
 * ADR-642 Φ3-B — emit a `1001 NESTOR_APP_LTYPE` block preserving every embedded symbol's descriptor
 * (glyph/role/scale/rotation/offset) keyed by its `49`-slot index, so a round-trip restores the
 * exact `SymbolElement`. The geometry itself degraded to a universally-valid `49 0.0` slot; this
 * XDATA is what makes symbols LOSSLESS inside the Nestor ecosystem (mirror `emitLayerXData`). Scalars
 * are string-encoded `key=value` (the layer XDATA idiom; `parseFloat` round-trips). No symbols → no-op.
 */
function emitSymbolXData(out: string[], elements: ReadonlyArray<PatternElement>): void {
  let emittedHead = false;
  elements.forEach((el, slot) => {
    if (el.kind !== 'symbol') return;
    if (!emittedHead) {
      emit(out, '1001', LINETYPE_SYMBOL_XDATA_APP);
      emittedHead = true;
    }
    const sym: SymbolElement = el;
    emit(out, '1000', `slot=${slot}`);
    emit(out, '1000', `glyph=${sym.glyphId}`);
    emit(out, '1000', `role=${sym.role}`);
    emit(out, '1000', `scale=${toDxfNumber(sym.scale)}`);
    emit(out, '1000', `rot=${toDxfNumber(sym.rotationDeg)}`);
    emit(out, '1000', `offx=${toDxfNumber(sym.offsetXMm)}`);
    emit(out, '1000', `offy=${toDxfNumber(sym.offsetYMm)}`);
  });
}

/**
 * ADR-642 Φ5-B — emit a `1001 NESTOR_APP_LTYPE` block preserving a COMPOUND linetype's parallel layers
 * (#9, road/railway) losslessly. The BASE layer (`layers[0]`) already rides in the `49`/text/symbol
 * geometry above — that is what a foreign reader sees, so a compound gracefully degrades to a single
 * stroke. THIS XDATA carries every layer's perpendicular `offsetMm`/`widthMm` plus the FULL element
 * list of `layers[1..]`, so a Nestor round-trip rebuilds all the strokes. Encoding = the flat per-field
 * `1000` idiom of `emitSymbolXData` (255-char safe, escape-free, disjoint key namespace from the symbol
 * descriptors): `clayer=<idx>` opens a layer, `coff`/`cw` set its offset/width, and each `cel.kind=<…>`
 * opens one element with its own fields. `layers[0]` emits a block ONLY to preserve a non-zero
 * offset/width (its elements are the `49` slots — never re-emitted). Non-compound single-layer → no-op.
 */
function emitCompoundXData(out: string[], complex: ComplexLinetypeDef): void {
  const layers = complex.layers;
  const baseLayer = layers[0];
  if (layers.length <= 1 && !baseLayer?.offsetMm && baseLayer?.widthMm == null) return;
  let emittedHead = false;
  layers.forEach((layer, idx) => {
    const isBase = idx === 0;
    // Base layer: emit a descriptor ONLY when it carries a non-zero offset/width (its elements live
    // in the `49` slots). A centred base (offset 0, no width) needs nothing preserved here.
    if (isBase && !layer.offsetMm && layer.widthMm == null) return;
    if (!emittedHead) {
      emit(out, '1001', LINETYPE_SYMBOL_XDATA_APP);
      emittedHead = true;
    }
    emit(out, '1000', `clayer=${idx}`);
    if (layer.offsetMm) emit(out, '1000', `coff=${toDxfNumber(layer.offsetMm)}`);
    if (layer.widthMm != null) emit(out, '1000', `cw=${toDxfNumber(layer.widthMm)}`);
    if (isBase) return; // base elements already emitted as `49`/text/symbol slots — no re-emission
    for (const el of layer.elements) emitCompoundElement(out, el);
  });
}

/**
 * ADR-642 Φ5-B — one extra-layer `PatternElement` → its flat `cel.*` XDATA lines. `cel.kind` opens the
 * element; the rest carry its typed fields (each on its own `1000` string → text values never collide
 * with a delimiter and stay 255-char safe). Mirror of `emitSymbolXData`'s per-field scalar encoding.
 */
function emitCompoundElement(out: string[], el: PatternElement): void {
  emit(out, '1000', `cel.kind=${el.kind}`);
  if (el.kind === 'dash' || el.kind === 'gap') {
    emit(out, '1000', `cel.len=${toDxfNumber(el.lengthMm)}`);
  } else if (el.kind === 'symbol') {
    emit(out, '1000', `cel.glyph=${el.glyphId}`);
    emit(out, '1000', `cel.role=${el.role}`);
    emitCompoundPlacement(out, el);
  } else if (el.kind === 'text') {
    emit(out, '1000', `cel.val=${el.value}`);
    emit(out, '1000', `cel.style=${el.styleId}`);
    emitCompoundPlacement(out, el);
    emit(out, '1000', `cel.follow=${el.followPath ? '1' : '0'}`);
  }
  // dot → kind only (no fields)
}

/** The shared S/R/X/Y placement fields both a symbol and a text sub-layer element carry (`cel.*`). */
function emitCompoundPlacement(
  out: string[],
  el: { scale: number; rotationDeg: number; offsetXMm: number; offsetYMm: number },
): void {
  emit(out, '1000', `cel.scale=${toDxfNumber(el.scale)}`);
  emit(out, '1000', `cel.rot=${toDxfNumber(el.rotationDeg)}`);
  emit(out, '1000', `cel.offx=${toDxfNumber(el.offsetXMm)}`);
  emit(out, '1000', `cel.offy=${toDxfNumber(el.offsetYMm)}`);
}

/** `PatternElement` → its signed `49` value (dash=+len, gap=−len, dot/symbol=0). */
function elementDashValue(el: PatternElement): number {
  if (el.kind === 'dash') return el.lengthMm;
  if (el.kind === 'gap') return -el.lengthMm;
  return 0; // dot / other → zero-length
}

/** Total pattern length (mm) of an ordered element list — text/dot slots are zero. */
function totalElementLength(elements: ReadonlyArray<PatternElement>): number {
  let total = 0;
  for (const el of elements) {
    if (el.kind === 'dash' || el.kind === 'gap') total += Math.abs(el.lengthMm);
  }
  return total;
}

/**
 * ADR-644 (#9d) — emit the mandatory default layer `0` (AutoCAD R2018 requires it). Minimal record:
 * white (ACI 7), Continuous, default lineweight, plottable, null plot style. Raw `emit` (no `pair`
 * sink); handle/subclass/390 mirror a normal record.
 */
function emitDefaultLayer0(out: string[], tableHandle: string | undefined, allocator: HandleAllocator): void {
  emit(out, '0', 'LAYER');
  emitRecordHandleRaw(out, tableHandle, 'AcDbLayerTableRecord', allocator);
  emit(out, '2', '0');
  emit(out, '70', '0');
  emit(out, '62', '7');
  emit(out, '6', 'Continuous');
  emit(out, '370', String(encodeDxfCode370(-3)));
  emit(out, '290', '1');
  emit(out, '390', '0');
}

function emitLayerTable(
  out: string[], layers: ReadonlyArray<SceneLayer>, allocator?: HandleAllocator,
): void {
  // ADR-644 (#9d) — layer `0` is mandatory; synthesize it when the scene lacks one (professional path).
  const needsLayer0 = allocator != null && !layers.some((l) => l.name === '0');
  const tableHandle = emitTableHeaderRaw(out, 'LAYER', layers.length + (needsLayer0 ? 1 : 0), allocator);
  if (needsLayer0 && allocator) emitDefaultLayer0(out, tableHandle, allocator);

  for (const layer of layers) {
    emit(out, '0', 'LAYER');
    emitRecordHandleRaw(out, tableHandle, 'AcDbLayerTableRecord', allocator);
    emit(out, '2', layer.name);

    const flag = (layer.frozen ? 1 : 0) | (layer.locked ? 4 : 0);
    emit(out, '70', String(flag));

    const aci = layer.colorAci ?? 7;
    const signedAci = layer.visible ? Math.abs(aci) : -Math.abs(aci);
    emit(out, '62', String(signedAci));

    emit(out, '6', layer.linetype ?? 'Continuous');
    emit(out, '370', String(encodeDxfCode370(layer.lineweight ?? -3)));
    emit(out, '290', layer.plottable === false ? '0' : '1');
    // ADR-644 (#9b) — R2018 REQUIRES a PlotStyleName hard-pointer (390) on every LAYER record, or
    // AutoCAD aborts the LAYER table («Did not receive PlotStyleName on line N»). In color-dependent
    // plot-style mode ($PSTYLEMODE=1, set in the HEADER) the plot style follows the colour, so the
    // null handle `0` is valid. Gated on the allocator → round-trip `writeLayerTable` byte-identical.
    if (allocator) emit(out, '390', '0');

    if (layer.colorTrueColor != null) {
      emit(out, '420', String(layer.colorTrueColor & 0xffffff));
    }

    emitLayerXData(out, layer);
  }

  emit(out, '0', 'ENDTAB');
}

/**
 * ADR-358 / ADR-644 (#3) — SSoT for the Nestor XDATA app ids the LAYER writer attaches. `emitLayerXData`
 * (below) emits under these ids, and `EXPORT_APPID_NAMES` (`dxf-ascii-tables-writer`) declares a matching
 * APPID for each — importing THIS keeps the two in lockstep (a missing APPID aborts the table in AutoCAD).
 * `AcCmTransparency` is AutoCAD's own transparency app (not Nestor-namespaced) but is attached here, so it
 * needs its APPID too. Mirror of `LINETYPE_SYMBOL_XDATA_APP` for the LTYPE side.
 */
export const LAYER_XDATA_APPS = Object.freeze({
  layerId: 'NestorLayerId',
  transparency: 'AcCmTransparency',
  aec: 'NestorAec',
  meta: 'NestorLayerMeta',
  bimCategory: 'NestorBimCategory',
  vpOverride: 'NestorVpOverride',
} as const);

function emitLayerXData(out: string[], layer: SceneLayer): void {
  // NestorLayerId — stable enterprise-id (`lyr_<ULID>`) round-trip (ADR-358 Phase 9C v2.13).
  // Preserves layer identity across save/load — undo/redo refs, Firestore audit, xref bindings survive.
  emit(out, '1001', LAYER_XDATA_APPS.layerId);
  emit(out, '1000', `id=${layer.id}`);

  // AcCmTransparency — only emit when non-zero (DXF convention: omit = opaque).
  if ((layer.transparency ?? 0) > 0) {
    const alpha = clamp255(Math.round((1 - layer.transparency! / 90) * 255));
    const encoded = 0x02000000 | alpha; // bit 25 = fixed transparency present
    emit(out, '1001', LAYER_XDATA_APPS.transparency);
    emit(out, '1071', String(encoded));
  }

  // NestorAec — category + tags
  if ((layer.category && layer.category !== 'general') || (layer.tags && layer.tags.length > 0)) {
    emit(out, '1001', LAYER_XDATA_APPS.aec);
    if (layer.category) {
      emit(out, '1000', `category=${layer.category}`);
    }
    for (const tag of layer.tags ?? []) {
      emit(out, '1000', `tag=${tag}`);
    }
  }

  // NestorLayerMeta — description
  if (layer.description) {
    emit(out, '1001', LAYER_XDATA_APPS.meta);
    emit(out, '1000', `description=${layer.description}`);
  }

  // NestorBimCategory — Q15 scaffold round-trip
  if (layer.bimCategory) {
    emit(out, '1001', LAYER_XDATA_APPS.bimCategory);
    emit(out, '1000', `category=${layer.bimCategory}`);
  }

  // NestorVpOverride — Q16 scaffold round-trip (JSON-encoded)
  if (layer.vpOverrides && Object.keys(layer.vpOverrides).length > 0) {
    emit(out, '1001', LAYER_XDATA_APPS.vpOverride);
    emit(out, '1000', `vpOverrides=${JSON.stringify(layer.vpOverrides)}`);
  }
}

function emit(out: string[], code: string, value: string): void {
  out.push(code);
  out.push(value);
}

function totalPatternLength(pattern: ReadonlyArray<number>): number {
  let total = 0;
  for (const v of pattern) total += Math.abs(v);
  return total;
}

function toDxfNumber(n: number): string {
  // Match parser tolerance (parseFloat). Use enough precision for round-trip
  // without introducing exponential notation for typical mm values.
  if (Number.isInteger(n)) return n.toFixed(1);
  return String(n);
}
