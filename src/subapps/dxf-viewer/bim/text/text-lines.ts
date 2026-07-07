/**
 * ADR-557 (multi-line) — THE single source for splitting a TEXT/MTEXT flat string into
 * visual lines and for the per-line vertical stacking metrics. Consumed by ALL text paths
 * so they stay in parity (Giorgio 2026-07-07: Enter → πραγματική αλλαγή γραμμής, όχι «tofu»):
 *   - `rendering/entities/TextRenderer.ts` — paints each line at its own y-offset.
 *   - `bim/text/text-box.ts` — box height = Σ γραμμών, width = max γραμμής (drives grips /
 *     hover / hitTest / 3D anchor / culling / resize via the box SSoT).
 *   - `bim-3d/converters/dxf-text-3d.ts` — stacks the lines in the CanvasTexture.
 *
 * WHY a shared module: the flat `text` carries `\n` between paragraphs (`extractFlatText`
 * joins them), but every downstream consumer fed the WHOLE `\n`-joined string to the glyph
 * shaper — which has no glyph for `\n` → a notdef «□» box, and all paragraphs collapsed onto
 * one baseline. Splitting + stacking must happen with ONE convention everywhere, else the
 * drawn glyphs, the grip box and the 3D mesh diverge (the ADR-557 parity contract).
 *
 * Line spacing reuses the existing SSoT constant `CHARACTER_METRICS.LINE_HEIGHT_RATIO`
 * (= 1.2, «for multi-line text spacing») × the node's `lineSpacing.factor` (default 1.0) —
 * NO new magic number. The line advance (baseline→baseline) is `lineSpacingRatio × height`.
 *
 * Import-time pure: zero React / DOM / THREE / Firestore deps.
 *
 * @module bim/text/text-lines
 */

import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import { CHARACTER_METRICS } from '../../config/text-rendering-config';

/** The attachment ROW (vertical anchor of `position` on the text block). */
export type TextRow = 'T' | 'M' | 'B';

/**
 * Split a flat text string into its visual lines. Handles all newline conventions
 * (`\r\n`, `\r`, `\n`). ALWAYS returns ≥ 1 element (an empty/absent string → `['']`)
 * so consumers can rely on `lines.length` as the line count without a guard.
 */
export function splitTextLines(text: string | undefined | null): string[] {
  if (!text) return [''];
  const lines = text.split(/\r\n|\r|\n/);
  return lines.length > 0 ? lines : [''];
}

/** Number of visual lines in a flat text string (≥ 1). */
export function textLineCount(text: string | undefined | null): number {
  return splitTextLines(text).length;
}

/** Line-spacing FACTOR carried by the node (default 1.0) — read via cast (flat `DxfText` has no field). */
function lineSpacingFactorOf(text: DxfText): number {
  const factor = (text as { textNode?: { lineSpacing?: { factor?: number } } })
    .textNode?.lineSpacing?.factor;
  return typeof factor === 'number' && factor > 0 ? factor : 1;
}

/**
 * Baseline-to-baseline line advance ÷ em height (size-independent). Reuses the centralized
 * `LINE_HEIGHT_RATIO` (1.2) × the node's line-spacing factor. Multiply by the text height
 * (world) or the screen height (px) to get the per-line step.
 */
export function resolveLineSpacingRatio(text: DxfText): number {
  return CHARACTER_METRICS.LINE_HEIGHT_RATIO * lineSpacingFactorOf(text);
}

/** How the extra block height (beyond one line) is distributed relative to `position`, per row. */
export interface MultilineExtents {
  /** Em-ratio the block extends ABOVE the single-line top (raises the box top). */
  readonly topAdd: number;
  /** Em-ratio the block extends BELOW the single-line bottom (lowers the box bottom). */
  readonly bottomAdd: number;
}

/**
 * The extra vertical extent of a multi-line block, split by attachment row so `position`
 * stays the true anchor (AutoCAD / Revit): a T-anchored block grows DOWNWARD, a B-anchored
 * block grows UPWARD, an M-anchored block grows symmetrically. `extra = (lineCount − 1) ×
 * lineSpacingRatio` (em). Single line → both zero (the pre-multi-line box, zero regression).
 *
 * The renderer's first-line offset is `−topAdd × height` (screen y-down): the same rule that
 * places the box top places the first painted line, so render ≡ box for every attachment.
 */
export function resolveMultilineExtents(
  row: TextRow, lineCount: number, lineSpacingRatio: number,
): MultilineExtents {
  const extra = Math.max(0, lineCount - 1) * lineSpacingRatio;
  if (extra <= 0) return { topAdd: 0, bottomAdd: 0 };
  if (row === 'B') return { topAdd: extra, bottomAdd: 0 };
  if (row === 'M') return { topAdd: extra / 2, bottomAdd: extra / 2 };
  return { topAdd: 0, bottomAdd: extra }; // 'T' (renderer default baseline)
}
