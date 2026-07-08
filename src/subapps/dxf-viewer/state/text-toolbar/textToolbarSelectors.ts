/**
 * ADR-344 Phase 5.A — Selection-to-MixedValue selectors.
 *
 * computeMixedValues collapses an array of DxfTextNode into TextToolbarValues
 * where each field is either the shared value across the selection or `null`
 * (MixedValue) when entities disagree. Mirrors Figma's mixed-state pattern.
 *
 * Pure function, no React. The toolbar wires it via useMemo / Zustand
 * subscriptions in higher-level hooks.
 *
 * ADR-557 read-side flat-SSoT fix — the box-transform fields the RENDERER + the
 * grip commit own as FLAT entity fields (`entity.rotation` / `entity.widthFactor`
 * / `entity.height`, resolved via the render style-extractor SSoT) are read from
 * `entry.flat`, NOT from the AST node/run-style. The commit deliberately never
 * writes `node.rotation` (renderer reads flat — ADR-557 command L10-13) and never
 * updates `run.style.widthFactor`, so the node is a STALE mirror for those fields:
 * reading it made «Πλάτος» snap back to 1 and «Περιστροφή» read 0 on release.
 * The remaining run-level fields (bold / italic / colour / oblique / tracking / …)
 * genuinely live in the AST and are still read from the node.
 */

import type { DxfTextNode, TextRunStyle, TextRun, TextStack } from '../../text-engine/types';
import {
  type TextToolbarValues,
  DEFAULT_TOOLBAR_VALUES,
} from './useTextToolbarStore';

/**
 * ADR-557 — the FLAT entity geometry the renderer + grip commit own as SSoT.
 * Derived once per selected entity in `resolveTextEntities` (via the SAME
 * `resolveTextHeight` / `extractFirstRunStyle` the render pipeline uses), so the
 * toolbar reflects EXACTLY what the canvas shows and the commit persists.
 */
export interface TextFlatGeometry {
  readonly rotation: number;
  readonly widthFactor: number;
  readonly height: number;
  readonly fontFamily: string;
}

/** One selected TEXT/MTEXT: its AST node (run-level style) + flat entity SSoT. */
export interface TextSelectionEntry {
  readonly node: DxfTextNode;
  readonly layerId: string;
  readonly flat: TextFlatGeometry;
}

/** Shallow value-equality for primitives + DxfColor (discriminated union). */
function isEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    const ka = Object.keys(a as Record<string, unknown>);
    const kb = Object.keys(b as Record<string, unknown>);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
      if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function isRun(item: TextRun | TextStack): item is TextRun {
  return (item as TextRun).style !== undefined && 'bold' in (item as TextRun).style;
}

/** Extract the first run's full style — used as the "representative" style. */
function representativeStyle(node: DxfTextNode): TextRunStyle | null {
  const paragraph = node.paragraphs[0];
  if (!paragraph) return null;
  const first = paragraph.runs[0];
  if (!first || !isRun(first)) return null;
  return first.style;
}

/**
 * Compute toolbar values for a selection of text nodes.
 * Empty selection returns DEFAULT_TOOLBAR_VALUES.
 * Any field with disagreement collapses to `null` (MixedValue).
 */
export function computeMixedValues(
  selection: ReadonlyArray<TextSelectionEntry>,
): TextToolbarValues {
  if (selection.length === 0) return { ...DEFAULT_TOOLBAR_VALUES };

  const first = selection[0]!;
  const firstStyle = representativeStyle(first.node);

  // ADR-557 — flat entity SSoT (renderer + commit truth) for the box-transform fields.
  let fontFamily: TextToolbarValues['fontFamily'] = first.flat.fontFamily;
  let fontHeight: TextToolbarValues['fontHeight'] = first.flat.height;
  let widthFactor: TextToolbarValues['widthFactor'] = first.flat.widthFactor;
  let rotation: TextToolbarValues['rotation'] = first.flat.rotation;
  // Run-level style fields (genuinely AST-owned) stay sourced from the node.
  let bold: TextToolbarValues['bold'] = firstStyle?.bold ?? null;
  let italic: TextToolbarValues['italic'] = firstStyle?.italic ?? null;
  let underline: TextToolbarValues['underline'] = firstStyle?.underline ?? null;
  let overline: TextToolbarValues['overline'] = firstStyle?.overline ?? null;
  let strikethrough: TextToolbarValues['strikethrough'] = firstStyle?.strikethrough ?? null;
  let color: TextToolbarValues['color'] = firstStyle?.color ?? null;
  let obliqueAngle: TextToolbarValues['obliqueAngle'] = firstStyle?.obliqueAngle ?? null;
  let tracking: TextToolbarValues['tracking'] = firstStyle?.tracking ?? null;
  let justification: TextToolbarValues['justification'] = first.node.attachment;
  let lineSpacingMode: TextToolbarValues['lineSpacingMode'] = first.node.lineSpacing.mode;
  let lineSpacingFactor: TextToolbarValues['lineSpacingFactor'] = first.node.lineSpacing.factor;
  let layerId: TextToolbarValues['layerId'] = first.layerId;
  let currentScale: TextToolbarValues['currentScale'] = first.node.currentScale;

  for (let i = 1; i < selection.length; i++) {
    const entry = selection[i]!;
    const style = representativeStyle(entry.node);
    // ADR-557 — collapse the flat-SSoT fields against each entity's flat geometry.
    if (fontFamily !== null && entry.flat.fontFamily !== fontFamily) fontFamily = null;
    if (fontHeight !== null && entry.flat.height !== fontHeight) fontHeight = null;
    if (widthFactor !== null && entry.flat.widthFactor !== widthFactor) widthFactor = null;
    if (rotation !== null && entry.flat.rotation !== rotation) rotation = null;
    if (bold !== null && style?.bold !== bold) bold = null;
    if (italic !== null && style?.italic !== italic) italic = null;
    if (underline !== null && style?.underline !== underline) underline = null;
    if (overline !== null && style?.overline !== overline) overline = null;
    if (strikethrough !== null && style?.strikethrough !== strikethrough) strikethrough = null;
    if (color !== null && (!style || !isEqual(style.color, color))) color = null;
    if (obliqueAngle !== null && style?.obliqueAngle !== obliqueAngle) obliqueAngle = null;
    if (tracking !== null && style?.tracking !== tracking) tracking = null;
    if (justification !== null && entry.node.attachment !== justification) justification = null;
    if (lineSpacingMode !== null && entry.node.lineSpacing.mode !== lineSpacingMode) lineSpacingMode = null;
    if (lineSpacingFactor !== null && entry.node.lineSpacing.factor !== lineSpacingFactor) lineSpacingFactor = null;
    if (layerId !== null && entry.layerId !== layerId) layerId = null;
    if (currentScale !== null && entry.node.currentScale !== currentScale) currentScale = null;
  }

  return {
    fontFamily,
    fontHeight,
    bold,
    italic,
    underline,
    overline,
    strikethrough,
    color,
    widthFactor,
    obliqueAngle,
    tracking,
    justification,
    lineSpacingMode,
    lineSpacingFactor,
    rotation,
    layerId,
    currentScale,
  };
}
