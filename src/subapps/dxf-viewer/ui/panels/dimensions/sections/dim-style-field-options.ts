/**
 * ADR-562 Φ5 — Shared option data for the DIMSTYLE per-part Style Manager controls.
 *
 * SSoT (N.0.2): the ACI color set + lineweight set + font list live ONCE and are
 * consumed by every per-part field in `dim-style-fields.tsx` (Lines/Text/Symbols
 * sections). No copy-paste across sections.
 *
 * - Colors: ByLayer (ACI 256) + the 7 standard ACI colours — the IDENTICAL set the
 *   Φ4 contextual tab exposes (`COLOR_OPTIONS`), so the Style Manager and the
 *   selected-dimension tab offer the same choices for the same feature.
 * - Lineweights: derived from `LINEWEIGHT_CONCRETE_MM_VALUES` (ISO catalog SSoT) +
 *   the ByLayer sentinel — values are real `LineweightMm` (no cast, ratchet-safe).
 * - Fonts: the same static 5-font preset list as the Φ4 tab (`FONT_OPTIONS`).
 *
 * TODO(post-Φ4-commit): once the Φ4 contextual tab is committed, migrate its private
 * inline `COLOR_OPTIONS` / `FONT_OPTIONS` to import from here (single source).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-562-dimension-per-part-styling.md §Φ5
 */

import type { LineweightMm } from '../../../../types/entities';
import {
  LINEWEIGHT_CONCRETE_MM_VALUES,
  LINEWEIGHT_SPECIAL,
} from '../../../../config/lineweight-iso-catalog';

/** ACI 256 = ByLayer sentinel (matches `dim-color-resolver` + Φ4 tab COLOR_OPTIONS). */
export const ACI_BYLAYER = 256;

export interface DimColorOption {
  /** AutoCAD Color Index (256 = ByLayer). */
  readonly aci: number;
  /** i18n key suffix under `panels.dimensions.editor.colorOptions.*`. */
  readonly labelKey: string;
}

/** ByLayer + the 7 standard ACI colours — identical set to the Φ4 contextual tab. */
export const DIM_COLOR_OPTIONS: readonly DimColorOption[] = [
  { aci: ACI_BYLAYER, labelKey: 'byLayer' },
  { aci: 1, labelKey: 'red' },
  { aci: 2, labelKey: 'yellow' },
  { aci: 3, labelKey: 'green' },
  { aci: 4, labelKey: 'cyan' },
  { aci: 5, labelKey: 'blue' },
  { aci: 6, labelKey: 'magenta' },
  { aci: 7, labelKey: 'white' },
];

/**
 * ByLayer + the concrete ISO lineweights (mm). Values are already `LineweightMm`
 * (BYLAYER sentinel + concrete subtype) so consumers never cast — the change
 * handler looks the picked value up in this list, keeping the ratchet clean.
 */
export const DIM_LINEWEIGHT_OPTIONS: readonly LineweightMm[] = [
  LINEWEIGHT_SPECIAL.BYLAYER,
  ...LINEWEIGHT_CONCRETE_MM_VALUES,
];

/** Font-family presets (literal names — identical to the Φ4 tab `FONT_OPTIONS`). */
export const DIM_FONT_OPTIONS: readonly string[] = [
  'Arial',
  'Roboto',
  'Helvetica',
  'Times New Roman',
  'Courier New',
];
