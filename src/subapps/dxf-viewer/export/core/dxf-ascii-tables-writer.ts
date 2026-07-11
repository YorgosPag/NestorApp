/**
 * ============================================================================
 * DXF TABLES SECTION WRITER — LTYPE + LAYER + DIMSTYLE (SSoT split)
 * ============================================================================
 *
 * Emits the single `SECTION/TABLES … ENDSEC` block for the client-side DXF
 * writer (`dxf-ascii-writer`), split out for file-size SRP (N.7.1) alongside the
 * HATCH split (`dxf-ascii-hatch-writer`).
 *
 * Table order follows the DXF spec: LTYPE → LAYER (ADR-636 Στάδιο 2 Φ2.1, reusing
 * the `writeLayerTable` SSoT body emitter) → STYLE (ADR-636 Φ2.4 D.5) → DIMSTYLE
 * (ADR-362 Round 25). Emits nothing when every input is empty, so a bare
 * `writeDxfAscii(entities)` keeps its historic table-less envelope (Tekton/legacy).
 */

import type { DimStyle } from '../../types/dimension';
import type { SceneLayer } from '../../types/entities';
import type { LinetypeDef } from '../../config/linetype-iso-catalog';
import type { DxfStyleTableEntry } from '../../text-engine/types/text-ast.types';
import { emitDimStyle } from '../../utils/dxf-dimstyle-writer';
import { emitLayerTableBody } from '../../utils/dxf-layer-table-writer';
import type { Pair } from './dxf-ascii-hatch-writer';

export interface EmitTablesOptions {
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
}

/**
 * Emit one `STYLE` table entry — the EXACT inverse of the import `groupCodesToEntry`
 * (`style-table-reader.ts`): 2 name / 70 flags / 40 fixed-height / 41 width-factor /
 * 50 oblique / 71 gen-flags / 3 font-file / 4 big-font. `height 0` = variable, so each
 * TEXT/MTEXT keeps its own group-40 height. Round-trips ADR-635 Φ C.5 (name → font file
 * → stripped family).
 */
function emitTextStyle(pair: Pair, st: DxfStyleTableEntry): void {
  pair(0, 'STYLE');
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
 * Emit the single `SECTION/TABLES … ENDSEC` block: LTYPE + LAYER first (reusing the
 * `writeLayerTable` SSoT body emitter) then DIMSTYLE — the correct DXF table order.
 * Both `out` (for the layer body) and `pair` (for DIMSTYLE) write to the same array.
 */
export function emitTablesSection(out: string[], pair: Pair, opts: EmitTablesOptions): void {
  const layers = opts.tableLayers ?? [];
  const textStyles = opts.textStyles ?? [];
  const { dimStyles } = opts;
  if (layers.length === 0 && textStyles.length === 0 && dimStyles.length === 0) return;

  pair(0, 'SECTION');
  pair(2, 'TABLES');
  if (layers.length > 0) {
    emitLayerTableBody(out, { layers, customLinetypes: opts.customLinetypes ?? [] });
  }
  // ADR-636 Φ2.4 (D.5) — STYLE table (after LAYER, before DIMSTYLE per DXF table order).
  if (textStyles.length > 0) {
    pair(0, 'TABLE');
    pair(2, 'STYLE');
    pair(70, textStyles.length);
    for (const st of textStyles) emitTextStyle(pair, st);
    pair(0, 'ENDTAB');
  }
  if (dimStyles.length > 0) {
    pair(0, 'TABLE');
    pair(2, 'DIMSTYLE');
    pair(70, dimStyles.length);
    for (const st of dimStyles) emitDimStyle(pair, st, opts.s);
    pair(0, 'ENDTAB');
  }
  pair(0, 'ENDSEC');
}
