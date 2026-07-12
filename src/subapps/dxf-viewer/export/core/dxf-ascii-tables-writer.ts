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
 * Emit the `VPORT` table with a single `*Active` viewport whose view is centered on the drawing
 * (`center`/`height` in output units) with a plan view direction. AutoCAD restores this as the
 * open view → the file frames the model instead of showing an off-screen (0,0) default. Codes:
 * 12/22 view center, 40 view height, 41 aspect, 16/26/36 plan view direction (0,0,1). ADR-636.
 */
function emitVport(pair: Pair, v: VportView): void {
  pair(0, 'TABLE');
  pair(2, 'VPORT');
  pair(70, 1);
  pair(0, 'VPORT');
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
 * Emit the single `SECTION/TABLES … ENDSEC` block: VPORT (open view) → LTYPE + LAYER (reusing the
 * `writeLayerTable` SSoT body emitter) → STYLE → DIMSTYLE — the correct DXF table order.
 * Both `out` (for the layer body) and `pair` (for the rest) write to the same array.
 */
export function emitTablesSection(out: string[], pair: Pair, opts: EmitTablesOptions): void {
  const layers = opts.tableLayers ?? [];
  const textStyles = opts.textStyles ?? [];
  const { dimStyles, viewport } = opts;
  if (!viewport && layers.length === 0 && textStyles.length === 0 && dimStyles.length === 0) return;

  pair(0, 'SECTION');
  pair(2, 'TABLES');
  if (viewport) emitVport(pair, viewport);
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
