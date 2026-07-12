/**
 * DXF LTYPE parser — shared draft types + tiny coercion helpers (ADR-358 / ADR-642).
 *
 * Extracted so the main table parser (`dxf-linetype-table-parser`) and the Nestor-XDATA element
 * decoders (`dxf-linetype-xdata-parser`) share ONE definition of the in-progress draft shapes and
 * `finiteOr` / `DEFAULT_EMBEDDED_TEXT_STYLE` — WITHOUT a circular import. Both modules import from
 * HERE; this module imports neither of them (only the pure `complex-linetype-types` value types).
 */

import type { PatternElement, SymbolRole, StrokeLayer } from '../config/complex-linetype-types';

/** Default text style when a `340` handle cannot be resolved (unknown/handle-less file). */
export const DEFAULT_EMBEDDED_TEXT_STYLE = 'Standard';

/** Finite number → itself, else `fallback`. The SSoT coercion for every parsed XDATA/text scalar. */
export function finiteOr(v: number | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** In-progress embedded-text descriptor (codes 340/46/50/44/45/9 after a text `74`). */
export interface TextDraft {
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

export interface MutableLinetypeDraft {
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
  /** ADR-642 Φ5-B — the base layer's perpendicular offset (mm), recovered from compound XDATA. */
  baseLayerOffsetMm?: number;
  /** ADR-642 Φ5-B — the base layer's width (mm), recovered from compound XDATA. */
  baseLayerWidthMm?: number;
  /** ADR-642 Φ5-B — reconstructed `layers[1..]` (offset/width + full elements) from compound XDATA. */
  compoundExtraLayers?: StrokeLayer[];
}

/** One accumulated XDATA scalar (mirror the LAYER parser's `XDataPair`). */
export interface XDataPair {
  readonly app: string;
  readonly code: string;
  readonly value: string;
}

/** In-progress symbol descriptor decoded from a `NESTOR_APP_LTYPE` XDATA block. */
export interface MutableSymbolDraft {
  slot: number;
  role: SymbolRole;
  glyph?: string;
  scale?: number;
  rot?: number;
  offx?: number;
  offy?: number;
}
