/**
 * ADR-344 Phase 5.A — Selection-to-MixedValue selectors.
 *
 * computeMixedValues collapses an array of DxfTextNode into TextToolbarValues
 * where each field is either the shared value across the selection or `null`
 * (MixedValue) when entities disagree. Mirrors Figma's mixed-state pattern.
 *
 * Pure function, no React. The toolbar wires it via useMemo / Zustand
 * subscriptions in higher-level hooks.
 */

import type { DxfTextNode, TextRunStyle, TextRun, TextStack } from '../../text-engine/types';
import {
  type TextToolbarValues,
  DEFAULT_TOOLBAR_VALUES,
} from './useTextToolbarStore';

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
  selection: ReadonlyArray<{ readonly node: DxfTextNode; readonly layerId: string }>,
): TextToolbarValues {
  if (selection.length === 0) return { ...DEFAULT_TOOLBAR_VALUES };

  const first = selection[0]!;
  const firstStyle = representativeStyle(first.node);
  const firstParagraph = first.node.paragraphs[0];

  let fontFamily: TextToolbarValues['fontFamily'] = firstStyle?.fontFamily ?? null;
  let fontHeight: TextToolbarValues['fontHeight'] = firstStyle?.height ?? null;
  let bold: TextToolbarValues['bold'] = firstStyle?.bold ?? null;
  let italic: TextToolbarValues['italic'] = firstStyle?.italic ?? null;
  let underline: TextToolbarValues['underline'] = firstStyle?.underline ?? null;
  let overline: TextToolbarValues['overline'] = firstStyle?.overline ?? null;
  let strikethrough: TextToolbarValues['strikethrough'] = firstStyle?.strikethrough ?? null;
  let color: TextToolbarValues['color'] = firstStyle?.color ?? null;
  let widthFactor: TextToolbarValues['widthFactor'] = firstStyle?.widthFactor ?? null;
  let obliqueAngle: TextToolbarValues['obliqueAngle'] = firstStyle?.obliqueAngle ?? null;
  let tracking: TextToolbarValues['tracking'] = firstStyle?.tracking ?? null;
  let justification: TextToolbarValues['justification'] = first.node.attachment;
  let lineSpacingMode: TextToolbarValues['lineSpacingMode'] = first.node.lineSpacing.mode;
  let lineSpacingFactor: TextToolbarValues['lineSpacingFactor'] = first.node.lineSpacing.factor;
  let rotation: TextToolbarValues['rotation'] = first.node.rotation;
  let layerId: TextToolbarValues['layerId'] = first.layerId;
  let currentScale: TextToolbarValues['currentScale'] = first.node.currentScale;

  void firstParagraph;

  for (let i = 1; i < selection.length; i++) {
    const entry = selection[i]!;
    const style = representativeStyle(entry.node);
    if (fontFamily !== null && style?.fontFamily !== fontFamily) fontFamily = null;
    if (fontHeight !== null && style?.height !== fontHeight) fontHeight = null;
    if (bold !== null && style?.bold !== bold) bold = null;
    if (italic !== null && style?.italic !== italic) italic = null;
    if (underline !== null && style?.underline !== underline) underline = null;
    if (overline !== null && style?.overline !== overline) overline = null;
    if (strikethrough !== null && style?.strikethrough !== strikethrough) strikethrough = null;
    if (color !== null && (!style || !isEqual(style.color, color))) color = null;
    if (widthFactor !== null && style?.widthFactor !== widthFactor) widthFactor = null;
    if (obliqueAngle !== null && style?.obliqueAngle !== obliqueAngle) obliqueAngle = null;
    if (tracking !== null && style?.tracking !== tracking) tracking = null;
    if (justification !== null && entry.node.attachment !== justification) justification = null;
    if (lineSpacingMode !== null && entry.node.lineSpacing.mode !== lineSpacingMode) lineSpacingMode = null;
    if (lineSpacingFactor !== null && entry.node.lineSpacing.factor !== lineSpacingFactor) lineSpacingFactor = null;
    if (rotation !== null && entry.node.rotation !== rotation) rotation = null;
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
