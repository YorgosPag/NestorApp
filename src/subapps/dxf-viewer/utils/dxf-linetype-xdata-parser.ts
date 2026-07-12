/**
 * DXF LTYPE Nestor-XDATA element decoders — ADR-642 Φ3-B (embedded symbols) + Φ5-B (compound layers).
 *
 * The `NESTOR_APP_LTYPE` XDATA our own DXF export attaches to an LTYPE record carries, as flat
 * `1000 key=value` strings, two disjoint descriptor namespaces:
 *   • symbol slots  (`slot`/`glyph`/`role`/…)         → `finalizeSymbols`  (Φ3-B)
 *   • compound layers (`clayer`/`coff`/`cel.*`/…)      → `finalizeCompound` (Φ5-B)
 * so a record carrying BOTH parses cleanly with either decoder. Both are the entry points the main
 * table parser (`dxf-linetype-table-parser`) calls at record flush; everything else here is private.
 *
 * Split out from `dxf-linetype-table-parser` for file-size SRP (N.7.1). Draft types + `finiteOr` /
 * `DEFAULT_EMBEDDED_TEXT_STYLE` come from `dxf-linetype-parser-shared` (no circular import: main and
 * this module both depend only on the shared module, never on each other).
 */

import type {
  PatternElement,
  SymbolElement,
  SymbolRole,
  StrokeLayer,
} from '../config/complex-linetype-types';
import { LINETYPE_SYMBOL_XDATA_APP } from './dxf-layer-table-writer';
import { DEFAULT_LINETYPE_SYMBOL_ID } from '../config/linetype-symbol-catalog';
import { resolveWellKnownLinetypeSymbol } from '../config/linetype-shape-import-map';
import {
  DEFAULT_EMBEDDED_TEXT_STYLE,
  finiteOr,
  type MutableLinetypeDraft,
  type MutableSymbolDraft,
  type XDataPair,
} from './dxf-linetype-parser-shared';

const SYMBOL_ROLES: ReadonlySet<string> = new Set<string>([
  'side', 'innerCorner', 'outerCorner', 'start', 'end',
]);

/** Coerce an XDATA role string to a valid `SymbolRole` (unknown → `side`). */
function normalizeSymbolRole(v: string): SymbolRole {
  return (SYMBOL_ROLES.has(v) ? v : 'side') as SymbolRole;
}

/**
 * ADR-642 Φ3-B — resolve embedded symbols into the ordered element list, in priority order:
 *   Tier 1 — Nestor `NESTOR_APP_LTYPE` XDATA descriptors (our own export → lossless glyph/role/place).
 *   Tier 2 — a foreign shape slot whose linetype NAME is a recognised `acad.lin` standard → mapped glyph.
 *   Tier 3 — an unrecognised foreign shape → left as its geometry slot (graceful skip, documented).
 * Sets `hasEmbedded` when ≥1 symbol lands, so `buildComplexIfEmbedded` builds the `complex` def.
 */
export function finalizeSymbols(current: Partial<MutableLinetypeDraft>): void {
  const elements = current.elements;
  if (!elements) return;

  // Tier 1 — Nestor XDATA (authoritative; overrides a co-located foreign shape slot).
  const covered = new Set<number>();
  for (const parsed of parseSymbolXData(current.xdataBuf)) {
    if (parsed.slot < 0 || parsed.slot >= elements.length) continue;
    elements[parsed.slot] = parsed.element;
    covered.add(parsed.slot);
    current.hasEmbedded = true;
  }

  // Tier 2/3 — foreign shape slots not carried by our XDATA. Resolve ONCE by linetype name.
  const wellKnown = current.foreignShapeSlots?.length
    ? resolveWellKnownLinetypeSymbol(current.name)
    : null;
  if (!wellKnown) return; // Tier 3 — unknown shape(s): keep the geometry slot(s), no symbol
  for (const slot of current.foreignShapeSlots ?? []) {
    if (covered.has(slot) || slot < 0 || slot >= elements.length) continue;
    elements[slot] = {
      kind: 'symbol',
      glyphId: wellKnown.glyphId,
      role: wellKnown.role,
      scale: 1,
      rotationDeg: 0,
      offsetXMm: 0,
      offsetYMm: 0,
    };
    current.hasEmbedded = true;
  }
}

/** One decoded XDATA symbol: which `49` slot it occupies + the reconstructed element. */
interface ParsedSymbol {
  readonly slot: number;
  readonly element: SymbolElement;
}

/** The symbol-descriptor fields both XDATA decoders carry (`slot=` symbols and `cel.kind=symbol`). */
interface SymbolFields {
  glyph?: string;
  role?: SymbolRole;
  scale?: number;
  rot?: number;
  offx?: number;
  offy?: number;
}

/** Build a `SymbolElement` from decoded XDATA fields — the SSoT for both the symbol-slot (Φ3-B) and
 *  compound (Φ5-B) decoders (unknown glyph → default catalog glyph, unknown role → `side`). */
function buildSymbolElement(d: SymbolFields): SymbolElement {
  return {
    kind: 'symbol',
    glyphId: d.glyph || DEFAULT_LINETYPE_SYMBOL_ID,
    role: d.role ?? 'side',
    scale: finiteOr(d.scale, 1),
    rotationDeg: finiteOr(d.rot, 0),
    offsetXMm: finiteOr(d.offx, 0),
    offsetYMm: finiteOr(d.offy, 0),
  };
}

/**
 * Iterate a `NESTOR_APP_LTYPE` XDATA buffer, yielding each `1000` entry's `key=value` split (the value
 * is split on its FIRST `=`, so a value bearing `=` survives intact). The streaming extraction loop
 * both LTYPE XDATA decoders (symbols Φ3-B, compound Φ5-B) share — the SSoT for reading our XDATA.
 */
function forEachNestorXData(buf: XDataPair[], fn: (key: string, val: string) => void): void {
  for (const p of buf) {
    if (p.app !== LINETYPE_SYMBOL_XDATA_APP || p.code !== '1000') continue;
    const eq = p.value.indexOf('=');
    fn(eq < 0 ? p.value : p.value.slice(0, eq), eq < 0 ? '' : p.value.slice(eq + 1));
  }
}

/**
 * Decode a `NESTOR_APP_LTYPE` XDATA buffer into ordered symbol descriptors. Encoding = flat
 * `key=value` `1000` strings (the LAYER XDATA idiom); a `slot=` key opens each symbol, the rest
 * (`glyph`/`role`/`scale`/`rot`/`offx`/`offy`) fill it. Ignores pairs from any other app id.
 */
function parseSymbolXData(buf: XDataPair[] | undefined): ParsedSymbol[] {
  if (!buf || buf.length === 0) return [];
  const out: ParsedSymbol[] = [];
  let cur: MutableSymbolDraft | null = null;

  const flush = (): void => {
    if (cur && Number.isFinite(cur.slot)) {
      out.push({ slot: cur.slot, element: buildSymbolElement(cur) });
    }
    cur = null;
  };

  forEachNestorXData(buf, (key, val) => {
    if (key === 'slot') {
      flush();
      cur = { slot: Number.parseInt(val, 10), role: 'side' };
      return;
    }
    if (!cur) return;
    if (key === 'glyph') cur.glyph = val;
    else if (key === 'role') cur.role = normalizeSymbolRole(val);
    else if (key === 'scale') cur.scale = Number.parseFloat(val);
    else if (key === 'rot') cur.rot = Number.parseFloat(val);
    else if (key === 'offx') cur.offx = Number.parseFloat(val);
    else if (key === 'offy') cur.offy = Number.parseFloat(val);
  });
  flush();
  return out;
}

/**
 * ADR-642 Φ5-B — rebuild a COMPOUND linetype's parallel layers from `NESTOR_APP_LTYPE` XDATA. The base
 * layer (`layers[0]`) is already built from the `49`/text/symbol slots; this recovers its perpendicular
 * offset/width and reconstructs `layers[1..]` (offset/width + full element list), so a Nestor round-trip
 * restores every stroke of a road/railway. Sets nothing directly on `elements` (base is untouched);
 * stores the extras/base-metrics on the draft, so `buildComplexIfEmbedded` promotes the entry to
 * `complex` even when it carries no embedded text/symbol (a purely-geometric double line still compounds).
 */
export function finalizeCompound(current: Partial<MutableLinetypeDraft>): void {
  const parsed = parseCompoundXData(current.xdataBuf);
  if (!parsed) return;
  if (parsed.baseOffsetMm != null) current.baseLayerOffsetMm = parsed.baseOffsetMm;
  if (parsed.baseWidthMm != null) current.baseLayerWidthMm = parsed.baseWidthMm;
  if (parsed.extraLayers.length > 0) current.compoundExtraLayers = parsed.extraLayers;
}

/** In-progress compound layer decoded from a `clayer=` XDATA block. */
interface MutableCompoundLayer {
  index: number;
  offsetMm?: number;
  widthMm?: number;
  elements: PatternElement[];
}

/** In-progress extra-layer element decoded from a `cel.kind=` XDATA block. */
interface MutableCompoundElement {
  kind: string;
  len?: number;
  glyph?: string;
  role?: SymbolRole;
  scale?: number;
  rot?: number;
  offx?: number;
  offy?: number;
  val?: string;
  style?: string;
  follow?: boolean;
}

/** Recovered compound: the base layer's offset/width (its elements ride in the `49`s) + `layers[1..]`. */
interface CompoundParse {
  baseOffsetMm?: number;
  baseWidthMm?: number;
  extraLayers: StrokeLayer[];
}

/**
 * Decode a `NESTOR_APP_LTYPE` XDATA buffer's compound descriptors (Φ5-B). Encoding = flat `1000`
 * `key=value` strings in a disjoint namespace from the symbol descriptors (`clayer`/`coff`/`cw`/`cel.*`
 * vs `slot`/`glyph`/…), so a record carrying BOTH symbol and compound XDATA parses cleanly with either
 * decoder. `clayer=<idx>` opens a layer; `cel.kind=<…>` opens one of its elements. Returns `null` when
 * the buffer carries no compound block (the common non-compound case → no allocation).
 */
function parseCompoundXData(buf: XDataPair[] | undefined): CompoundParse | null {
  if (!buf || buf.length === 0) return null;
  const layers: MutableCompoundLayer[] = [];
  let curLayer: MutableCompoundLayer | null = null;
  let curEl: MutableCompoundElement | null = null;

  const flushEl = (): void => {
    if (curLayer && curEl) {
      const built = buildCompoundElement(curEl);
      if (built) curLayer.elements.push(built);
    }
    curEl = null;
  };
  const flushLayer = (): void => {
    flushEl();
    if (curLayer) layers.push(curLayer);
    curLayer = null;
  };

  forEachNestorXData(buf, (key, val) => {
    if (key === 'clayer') {
      flushLayer();
      curLayer = { index: Number.parseInt(val, 10), elements: [] };
    } else if (key === 'coff') {
      if (curLayer) curLayer.offsetMm = Number.parseFloat(val);
    } else if (key === 'cw') {
      if (curLayer) curLayer.widthMm = Number.parseFloat(val);
    } else if (key === 'cel.kind') {
      flushEl();
      if (curLayer) curEl = { kind: val };
    } else if (curEl) {
      fillCompoundElement(curEl, key, val);
    }
  });
  flushLayer();

  if (layers.length === 0) return null;
  // Base descriptor (index ≤ 0) supplies only offset/width; index ≥ 1 become the extra StrokeLayers.
  layers.sort((a, b) => a.index - b.index);
  const result: CompoundParse = { extraLayers: [] };
  for (const l of layers) {
    if (l.index <= 0) {
      if (Number.isFinite(l.offsetMm)) result.baseOffsetMm = l.offsetMm;
      if (Number.isFinite(l.widthMm)) result.baseWidthMm = l.widthMm;
      continue;
    }
    result.extraLayers.push(
      Object.freeze({
        elements: Object.freeze([...l.elements]),
        ...(Number.isFinite(l.offsetMm) ? { offsetMm: l.offsetMm } : {}),
        ...(Number.isFinite(l.widthMm) ? { widthMm: l.widthMm } : {}),
      }) as StrokeLayer,
    );
  }
  return result;
}

/** Fill one in-progress compound element from a `cel.*` XDATA key (unknown keys ignored). */
function fillCompoundElement(el: MutableCompoundElement, key: string, val: string): void {
  switch (key) {
    case 'cel.len': el.len = Number.parseFloat(val); break;
    case 'cel.glyph': el.glyph = val; break;
    case 'cel.role': el.role = normalizeSymbolRole(val); break;
    case 'cel.scale': el.scale = Number.parseFloat(val); break;
    case 'cel.rot': el.rot = Number.parseFloat(val); break;
    case 'cel.offx': el.offx = Number.parseFloat(val); break;
    case 'cel.offy': el.offy = Number.parseFloat(val); break;
    case 'cel.val': el.val = val; break;
    case 'cel.style': el.style = val; break;
    case 'cel.follow': el.follow = val === '1'; break;
    default: break;
  }
}

/** Build a `PatternElement` from a decoded compound element (unknown `kind` → null, skipped). */
function buildCompoundElement(el: MutableCompoundElement): PatternElement | null {
  switch (el.kind) {
    case 'dash': return { kind: 'dash', lengthMm: finiteOr(el.len, 0) };
    case 'gap': return { kind: 'gap', lengthMm: finiteOr(el.len, 0) };
    case 'dot': return { kind: 'dot' };
    case 'symbol': return buildSymbolElement(el);
    case 'text':
      return {
        kind: 'text',
        value: el.val ?? '',
        styleId: el.style || DEFAULT_EMBEDDED_TEXT_STYLE,
        scale: finiteOr(el.scale, 1),
        rotationDeg: finiteOr(el.rot, 0),
        offsetXMm: finiteOr(el.offx, 0),
        offsetYMm: finiteOr(el.offy, 0),
        followPath: el.follow ?? true,
      };
    default: return null;
  }
}
