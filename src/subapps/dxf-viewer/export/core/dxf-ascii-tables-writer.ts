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
 * the `writeLayerTable` SSoT body emitter) → DIMSTYLE (ADR-362 Round 25). Emits
 * nothing when both inputs are empty, so a bare `writeDxfAscii(entities)` keeps
 * its historic table-less envelope (Tekton/legacy).
 */

import type { DimStyle } from '../../types/dimension';
import type { SceneLayer } from '../../types/entities';
import type { LinetypeDef } from '../../config/linetype-iso-catalog';
import { emitDimStyle } from '../../utils/dxf-dimstyle-writer';
import { emitLayerTableBody } from '../../utils/dxf-layer-table-writer';
import type { Pair } from './dxf-ascii-hatch-writer';

export interface EmitTablesOptions {
  /** Full layer defs → LTYPE + LAYER table (ADR-636 Στάδιο 2 Φ2.1). */
  readonly tableLayers?: ReadonlyArray<SceneLayer>;
  /** Non-ISO linetypes referenced by the layers → LTYPE entries. */
  readonly customLinetypes?: ReadonlyArray<LinetypeDef>;
  /** Resolved dimension styles → DIMSTYLE table (ADR-362 Round 25). */
  readonly dimStyles: ReadonlyArray<DimStyle>;
  /** Coordinate scale — DIMSTYLE sizes scale via DIMSCALE × `s`. */
  readonly s: number;
}

/**
 * Emit the single `SECTION/TABLES … ENDSEC` block: LTYPE + LAYER first (reusing the
 * `writeLayerTable` SSoT body emitter) then DIMSTYLE — the correct DXF table order.
 * Both `out` (for the layer body) and `pair` (for DIMSTYLE) write to the same array.
 */
export function emitTablesSection(out: string[], pair: Pair, opts: EmitTablesOptions): void {
  const layers = opts.tableLayers ?? [];
  const { dimStyles } = opts;
  if (layers.length === 0 && dimStyles.length === 0) return;

  pair(0, 'SECTION');
  pair(2, 'TABLES');
  if (layers.length > 0) {
    emitLayerTableBody(out, { layers, customLinetypes: opts.customLinetypes ?? [] });
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
