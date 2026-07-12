/**
 * DXF LTYPE Table Parser — ADR-358 §5.2 Phase 3A (G4 pre-pass) + ADR-642 Φ2-B (embedded text).
 *
 * Reads the `TABLES > LTYPE` section of a DXF file and produces `LinetypeDef[]`
 * entries ready for `LinetypeRegistry.registerLinetypes()`. This pre-pass MUST
 * run before the LAYER table parser so that custom linetypes referenced by
 * layers (group code 6) resolve via `resolveLinetype()` instead of falling back
 * to `Continuous` with a warning.
 *
 * DXF LTYPE entry shape (codes consumed):
 *   2   linetype name (AutoCAD case-sensitive identifier)
 *   3   human-readable description (optional)
 *   73  dash element count
 *   40  total pattern length (mm, drawing units)
 *   49  dash element value (positive=dash, negative=gap, 0=dot / embedded slot)
 *
 * ADR-642 Φ2-B — embedded complex elements (`──GAS──`), one block per `49` slot:
 *   74  element type (bit-coded): 2=text, 4=shape; bit 1 = rotation absolute (else follows line)
 *   75  shape number (shape elements — Φ3, skipped here)
 *   340 STYLE record handle → resolved to a font family via `styleHandleToFont`
 *   46  scale (S=)   50 rotation deg (R=)   44 X offset   45 Y offset   9 text string
 * A `74` carrying the text bit upgrades its `49 0.0` slot into a `TextElement`; the
 * whole ordered element list becomes the LinetypeDef's `complex` def (the `pattern`
 * number[] stays as the geometry-only fallback). Shape elements are skipped (Φ3).
 *
 * Codes ignored (preserved by writer when re-emitted): 70 (flags), 72 (alignment).
 *
 * Round-trip strategy: every parsed entry is stamped with `origin: 'dxf-import'`
 * so the LayerStore + writer can distinguish DXF-sourced linetypes from ISO
 * baseline and user-created ones.
 */

import type { LinetypeDef } from '../config/linetype-iso-catalog';
import type {
  ComplexLinetypeDef,
  PatternElement,
  TextElement,
  SymbolElement,
  SymbolRole,
} from '../config/complex-linetype-types';
import { LINETYPE_SYMBOL_XDATA_APP } from './dxf-layer-table-writer';
import { DEFAULT_LINETYPE_SYMBOL_ID } from '../config/linetype-symbol-catalog';
import { resolveWellKnownLinetypeSymbol } from '../config/linetype-shape-import-map';

export interface ParseLinetypeWarning {
  /** Linetype name when known, else `"<unknown>"`. */
  readonly linetype: string;
  /** Human-readable explanation. */
  readonly message: string;
}

export interface ParseLinetypeTableResult {
  readonly linetypes: ReadonlyArray<LinetypeDef>;
  readonly warnings: ReadonlyArray<ParseLinetypeWarning>;
}

/** Default text style when a `340` handle cannot be resolved (unknown/handle-less file). */
const DEFAULT_EMBEDDED_TEXT_STYLE = 'Standard';

/**
 * Parse the LTYPE table out of a tokenised DXF line array.
 * Returns every custom linetype definition found (ISO baseline entries already
 * present in the file are returned too — the registry dedupes by name).
 *
 * @param styleHandleToFont ADR-642 Φ2-B — `{ styleHandle → fontFamily }` (from
 *   `buildStyleHandleFontMap`), to resolve embedded-text `340` STYLE references.
 *   Omit for geometry-only imports; unresolved handles fall back to `Standard`.
 */
export function parseLinetypeTable(
  lines: string[],
  styleHandleToFont?: Record<string, string>,
): ParseLinetypeTableResult {
  const linetypes: LinetypeDef[] = [];
  const warnings: ParseLinetypeWarning[] = [];

  let inTables = false;
  let inLtypeTable = false;
  let inLtypeEntry = false;
  let current: Partial<MutableLinetypeDraft> = {};
  let prevCode = '';
  let prevValue = '';

  const flush = (): void => {
    if (!inLtypeEntry) return;
    finalizeTextDraft(current);
    const draft = current;
    if (!draft.name) {
      warnings.push({
        linetype: '<unknown>',
        message: 'LTYPE entry missing required group code 2 (name) — skipped.',
      });
      current = {};
      return;
    }
    finalizeSymbols(draft); // ADR-642 Φ3-B — Nestor XDATA (Tier 1) / well-known name (Tier 2) / skip (Tier 3)
    const pattern = Object.freeze((draft.pattern ?? []).slice());
    const complex = buildComplexIfEmbedded(draft);
    linetypes.push(
      Object.freeze({
        name: draft.name,
        description: draft.description ?? '',
        pattern,
        origin: 'dxf-import' as const,
        ...(complex ? { complex } : {}),
      }),
    );
    current = {};
  };

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = lines[i].trim();
    const value = lines[i + 1]?.trim() ?? '';

    if (prevCode === '0' && prevValue === 'SECTION' && code === '2' && value === 'TABLES') {
      inTables = true;
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (code === '0' && value === 'ENDSEC' && inTables) {
      if (inLtypeTable) flush();
      break;
    }

    if (!inTables) {
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (prevCode === '0' && prevValue === 'TABLE' && code === '2' && value === 'LTYPE') {
      inLtypeTable = true;
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (code === '0' && value === 'ENDTAB' && inLtypeTable) {
      flush();
      inLtypeTable = false;
      inLtypeEntry = false;
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (!inLtypeTable) {
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (code === '0' && value === 'LTYPE') {
      flush();
      current = { pattern: [], elements: [] };
      inLtypeEntry = true;
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (!inLtypeEntry) {
      prevCode = code;
      prevValue = value;
      continue;
    }

    consumeEntryCode(current, code, value, styleHandleToFont, warnings);

    prevCode = code;
    prevValue = value;
  }

  return {
    linetypes: Object.freeze(linetypes),
    warnings: Object.freeze(warnings),
  };
}

/** Consume one group-code/value pair inside an LTYPE entry (geometry + embedded text). */
function consumeEntryCode(
  current: Partial<MutableLinetypeDraft>,
  code: string,
  value: string,
  styleHandleToFont: Record<string, string> | undefined,
  warnings: ParseLinetypeWarning[],
): void {
  switch (code) {
    case '2':
      current.name = value;
      break;
    case '3':
      current.description = value;
      break;
    case '49': {
      // A new dash slot ends any in-progress embedded-text block (its codes came before).
      finalizeTextDraft(current);
      const n = Number.parseFloat(value);
      if (Number.isFinite(n)) {
        (current.pattern ??= []).push(n);
        (current.elements ??= []).push(geometryElement(n));
      } else {
        warnings.push({
          linetype: current.name ?? '<unknown>',
          message: `LTYPE pattern element (group 49) not a finite number: "${value}".`,
        });
      }
      break;
    }
    case '74': {
      const flags = Number.parseInt(value, 10) || 0;
      if (flags & 0x2) {
        // Text element — upgrade the most recent `49` slot to a TextElement (finalized on
        // the next `49`/entry end). Bit 1 = absolute rotation → text does NOT follow the line.
        current.textDraft = {
          slotIndex: (current.elements?.length ?? 1) - 1,
          followPath: (flags & 0x1) === 0,
          styleHandleToFont,
        };
      } else if (flags & 0x4) {
        // ADR-642 Φ3-B — foreign shape element (`[shape#,file.shx]`, no Nestor XDATA). Record the
        // slot so flush can recover it by well-known linetype NAME (Tier 2) or skip it (Tier 3).
        (current.foreignShapeSlots ??= []).push((current.elements?.length ?? 1) - 1);
      }
      break;
    }
    case '340':
      if (current.textDraft) current.textDraft.styleHandle = value;
      break;
    case '46':
      if (current.textDraft) current.textDraft.scale = Number.parseFloat(value);
      break;
    case '50':
      if (current.textDraft) current.textDraft.rotationDeg = Number.parseFloat(value);
      break;
    case '44':
      if (current.textDraft) current.textDraft.offsetXMm = Number.parseFloat(value);
      break;
    case '45':
      if (current.textDraft) current.textDraft.offsetYMm = Number.parseFloat(value);
      break;
    case '9':
      if (current.textDraft) current.textDraft.value = value;
      break;
    case '1001':
      // ADR-642 Φ3-B — XDATA app marker (mirror the LAYER parser). Everything after it, until the
      // record ends, is XDATA (DXF puts XDATA last) → route the typed scalars into `xdataBuf`.
      current.xdataApp = value;
      break;
    case '1000':
    case '1040':
    case '1070':
    case '1071':
      if (current.xdataApp) {
        (current.xdataBuf ??= []).push({ app: current.xdataApp, code, value });
      }
      break;
    default:
      break;
  }
}

/** `49` value → its geometry `PatternElement` (positive=dash, negative=gap, 0=dot/slot). */
function geometryElement(n: number): PatternElement {
  if (n > 0) return { kind: 'dash', lengthMm: n };
  if (n < 0) return { kind: 'gap', lengthMm: -n };
  return { kind: 'dot' };
}

/** Finalize a pending embedded-text block: replace its `49 0.0` slot with a TextElement. */
function finalizeTextDraft(current: Partial<MutableLinetypeDraft>): void {
  const draft = current.textDraft;
  current.textDraft = undefined;
  if (!draft) return;
  const elements = current.elements;
  if (!elements || draft.slotIndex < 0 || draft.slotIndex >= elements.length) return;
  const handle = draft.styleHandle?.toUpperCase();
  const styleId =
    (handle && draft.styleHandleToFont?.[handle]) || DEFAULT_EMBEDDED_TEXT_STYLE;
  const text: TextElement = {
    kind: 'text',
    value: (draft.value ?? '').trim(),
    styleId,
    scale: finiteOr(draft.scale, 1),
    rotationDeg: finiteOr(draft.rotationDeg, 0),
    offsetXMm: finiteOr(draft.offsetXMm, 0),
    offsetYMm: finiteOr(draft.offsetYMm, 0),
    followPath: draft.followPath,
  };
  elements[draft.slotIndex] = text;
  current.hasEmbedded = true;
}

/** Build the `complex` def when the entry carried ≥1 embedded text OR symbol element, else undefined. */
function buildComplexIfEmbedded(draft: Partial<MutableLinetypeDraft>): ComplexLinetypeDef | undefined {
  if (!draft.hasEmbedded || !draft.name || !draft.elements?.length) return undefined;
  return Object.freeze({
    name: draft.name,
    description: draft.description ?? '',
    layers: Object.freeze([Object.freeze({ elements: Object.freeze([...draft.elements]) })]),
    origin: 'dxf-import' as const,
  }) as ComplexLinetypeDef;
}

function finiteOr(v: number | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** In-progress embedded-text descriptor (codes 340/46/50/44/45/9 after a text `74`). */
interface TextDraft {
  /** Index in `elements` of the `49 0.0` slot this text upgrades. */
  slotIndex: number;
  followPath: boolean;
  styleHandleToFont: Record<string, string> | undefined;
  styleHandle?: string;
  scale?: number;
  rotationDeg?: number;
  offsetXMm?: number;
  offsetYMm?: number;
  value?: string;
}

interface MutableLinetypeDraft {
  name?: string;
  description?: string;
  pattern?: number[];
  /** Ordered pattern elements (geometry + embedded text) → the `complex` def. */
  elements?: PatternElement[];
  /** True once ≥1 embedded text OR symbol element was finalized. */
  hasEmbedded?: boolean;
  /** In-progress embedded-text block, finalized on the next `49`/entry end. */
  textDraft?: TextDraft;
  /** ADR-642 Φ3-B — the current XDATA app id (set by `1001`, until the record ends). */
  xdataApp?: string;
  /** ADR-642 Φ3-B — accumulated XDATA scalars (replayed at flush by `finalizeSymbols`). */
  xdataBuf?: XDataPair[];
  /** ADR-642 Φ3-B — `49`-slot indices carrying a foreign shape (`74 & 0x4`, no Nestor XDATA). */
  foreignShapeSlots?: number[];
}

/** One accumulated XDATA scalar (mirror the LAYER parser's `XDataPair`). */
interface XDataPair {
  readonly app: string;
  readonly code: string;
  readonly value: string;
}

/** In-progress symbol descriptor decoded from a `NESTOR_APP_LTYPE` XDATA block. */
interface MutableSymbolDraft {
  slot: number;
  role: SymbolRole;
  glyph?: string;
  scale?: number;
  rot?: number;
  offx?: number;
  offy?: number;
}

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
function finalizeSymbols(current: Partial<MutableLinetypeDraft>): void {
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
      out.push({
        slot: cur.slot,
        element: {
          kind: 'symbol',
          glyphId: cur.glyph || DEFAULT_LINETYPE_SYMBOL_ID,
          role: cur.role,
          scale: finiteOr(cur.scale, 1),
          rotationDeg: finiteOr(cur.rot, 0),
          offsetXMm: finiteOr(cur.offx, 0),
          offsetYMm: finiteOr(cur.offy, 0),
        },
      });
    }
    cur = null;
  };

  for (const p of buf) {
    if (p.app !== LINETYPE_SYMBOL_XDATA_APP || p.code !== '1000') continue;
    const eq = p.value.indexOf('=');
    const key = eq < 0 ? p.value : p.value.slice(0, eq);
    const val = eq < 0 ? '' : p.value.slice(eq + 1);
    if (key === 'slot') {
      flush();
      cur = { slot: Number.parseInt(val, 10), role: 'side' };
      continue;
    }
    if (!cur) continue;
    if (key === 'glyph') cur.glyph = val;
    else if (key === 'role') cur.role = normalizeSymbolRole(val);
    else if (key === 'scale') cur.scale = Number.parseFloat(val);
    else if (key === 'rot') cur.rot = Number.parseFloat(val);
    else if (key === 'offx') cur.offx = Number.parseFloat(val);
    else if (key === 'offy') cur.offy = Number.parseFloat(val);
  }
  flush();
  return out;
}
