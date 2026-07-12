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
  StrokeLayer,
} from '../config/complex-linetype-types';
// ADR-642 — the in-progress draft shapes + `finiteOr` / `DEFAULT_EMBEDDED_TEXT_STYLE` are shared with
// the Nestor-XDATA decoders via a dependency-free module (no circular import; file-size SRP, N.7.1).
import {
  DEFAULT_EMBEDDED_TEXT_STYLE,
  finiteOr,
  type MutableLinetypeDraft,
} from './dxf-linetype-parser-shared';
// ADR-642 Φ3-B/Φ5-B — the embedded-symbol + compound-layer XDATA decoders live in their own module
// (file-size SRP, N.7.1); the table loop calls these two entry points at each record flush.
import { finalizeSymbols, finalizeCompound } from './dxf-linetype-xdata-parser';

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
    finalizeCompound(draft); // ADR-642 Φ5-B — rebuild compound layers[1..] (+ base offset/width) from XDATA
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

/**
 * Build the `complex` def when the entry carried ≥1 embedded text/symbol element (Φ2/Φ3-B) OR is a
 * compound (Φ5-B: extra parallel layers / a non-zero base offset/width), else undefined. The base
 * layer is `draft.elements` (the `49`/text/symbol slots); Φ5-B appends its recovered offset/width and
 * the reconstructed `layers[1..]` so a round-trip restores every parallel stroke.
 */
function buildComplexIfEmbedded(draft: Partial<MutableLinetypeDraft>): ComplexLinetypeDef | undefined {
  const hasCompound =
    (draft.compoundExtraLayers?.length ?? 0) > 0 ||
    draft.baseLayerOffsetMm != null ||
    draft.baseLayerWidthMm != null;
  if ((!draft.hasEmbedded && !hasCompound) || !draft.name || !draft.elements?.length) return undefined;
  const baseLayer: StrokeLayer = Object.freeze({
    elements: Object.freeze([...draft.elements]),
    ...(draft.baseLayerOffsetMm ? { offsetMm: draft.baseLayerOffsetMm } : {}),
    ...(draft.baseLayerWidthMm != null ? { widthMm: draft.baseLayerWidthMm } : {}),
  }) as StrokeLayer;
  return Object.freeze({
    name: draft.name,
    description: draft.description ?? '',
    layers: Object.freeze([baseLayer, ...(draft.compoundExtraLayers ?? [])]),
    origin: 'dxf-import' as const,
  }) as ComplexLinetypeDef;
}
