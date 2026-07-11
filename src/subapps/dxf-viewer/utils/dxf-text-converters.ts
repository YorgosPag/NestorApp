/**
 * dxf-text-converters — TEXT / MTEXT entity converters (extracted from
 * `dxf-entity-converters.ts` for file-size SRP, N.7.1). Mirrors the sibling
 * converter split (dimension / hatch / xline-ray): each DXF entity family owns
 * one focused module and `dxf-entity-converters.ts` re-exports the public fns.
 *
 * SSoT: the shared TEXT/MTEXT machinery (transform parse, scene-entity builder,
 * flat→TextNode builder, ADR-344 alignment maps) lives here ONCE; the two public
 * converters differ only in `idPrefix` and the `textNode` attachment.
 */

import type { AnySceneEntity } from '../types/scene';
import {
  decodeGreekText,
  mapHorizontalAlignment,
  mapMTextAlignment,
  extractEntityColor,
} from './dxf-converter-helpers';
import { dwarn } from '../debug';
import type { DxfTextNode, TextJustification, TextParagraph, TextRun } from '../text-engine/types';
import { DXF_COLOR_BY_LAYER } from '../text-engine/types';

// ── Text node builder (ADR-344 SSOT unification) ──────────────────────────────

const ALIGNMENT_TO_ATTACHMENT: Record<'left' | 'center' | 'right', TextJustification> = {
  left: 'BL', center: 'BC', right: 'BR',
};

const MTEXT_ATTACHMENT_MAP: Record<number, TextJustification> = {
  1: 'TL', 2: 'TC', 3: 'TR',
  4: 'ML', 5: 'MC', 6: 'MR',
  7: 'BL', 8: 'BC', 9: 'BR',
};

/**
 * INVERSE of `MTEXT_ATTACHMENT_MAP` — 9-point attachment → DXF MTEXT code 71 (1-9).
 * SSoT companion for the export writer (`emitMText`) so it never invents a second
 * attachment table. Derived once from the forward map; default 1 (TL) for safety.
 */
const ATTACHMENT_TO_MTEXT_CODE: Record<TextJustification, number> = Object.fromEntries(
  Object.entries(MTEXT_ATTACHMENT_MAP).map(([code, att]) => [att, Number(code)]),
) as Record<TextJustification, number>;

export function attachmentToMTextCode(attachment: TextJustification | undefined): number {
  return attachment ? ATTACHMENT_TO_MTEXT_CODE[attachment] ?? 1 : 1;
}

/**
 * Attachment row → DXF TEXT vertical-alignment code 73 (0=baseline, 1=bottom,
 * 2=middle, 3=top). Companion to the H-just inverse (`alignmentToHJust`) for the
 * export writer: top row (T*) → 3, middle (M*) → 2, bottom (B*) → 0 (baseline,
 * the DXF default). Keeps left-baseline TEXT byte-identical (returns 0).
 */
export function attachmentToVJust(attachment: TextJustification | undefined): 0 | 1 | 2 | 3 {
  switch (attachment?.[0]) {
    case 'T':
      return 3;
    case 'M':
      return 2;
    default:
      return 0;
  }
}

function buildTextNodeFromFlat(
  text: string,
  height: number,
  rotation: number,
  alignment: 'left' | 'center' | 'right',
  attachment?: TextJustification,
): DxfTextNode {
  const run: TextRun = {
    text,
    style: {
      fontFamily: '',
      bold: false,
      italic: false,
      underline: false,
      overline: false,
      strikethrough: false,
      height,
      widthFactor: 1,
      obliqueAngle: 0,
      tracking: 1,
      color: DXF_COLOR_BY_LAYER,
    },
  };
  const para: TextParagraph = {
    runs: [run],
    indent: 0,
    leftMargin: 0,
    rightMargin: 0,
    tabs: [],
    justification: alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0,
    lineSpacingMode: 'multiple',
    lineSpacingFactor: 1,
  };
  return {
    paragraphs: [para],
    attachment: attachment ?? ALIGNMENT_TO_ATTACHMENT[alignment],
    lineSpacing: { mode: 'multiple', factor: 1 },
    rotation,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  };
}

/**
 * Parse the shared position (10/20), height (40) and rotation (50) for TEXT/MTEXT.
 * Single SSoT for the common transform parse (jscpd twin removal, ADR-583).
 */
function parseTextTransform(data: Record<string, string>): {
  x: number; y: number; height: number; rotation: number;
} {
  return {
    x: parseFloat(data['10']),
    y: parseFloat(data['20']),
    height: parseFloat(data['40']) || 1,
    rotation: parseFloat(data['50']) || 0,
  };
}

/**
 * Build the shared `text` scene entity for the TEXT/MTEXT converters.
 * Single SSoT for the returned node shape (jscpd twin removal, ADR-583) — the two
 * converters differ only in `idPrefix` and the `textNode` attachment.
 */
function buildTextSceneEntity(params: {
  idPrefix: 'text' | 'mtext';
  index: number;
  layer: string;
  x: number;
  y: number;
  text: string;
  height: number;
  rotation: number;
  alignment: 'left' | 'center' | 'right';
  textNode: DxfTextNode;
  color?: string;
}): AnySceneEntity {
  const { idPrefix, index, layer, x, y, text, height, rotation, alignment, textNode, color } = params;
  return {
    id: `${idPrefix}_${index}`,
    type: 'text',
    layerId: layer,
    visible: true,
    position: { x, y },
    text: text.trim(),
    fontSize: height,
    height,
    rotation,
    alignment,
    textNode,
    ...(color && { color })
  };
}

// ============================================================================
// 🏢 ENTERPRISE: TEXT CONVERTERS
// ============================================================================

/**
 * Convert TEXT entity with full CAD property extraction
 * DXF Codes: 10,20 = Position; 1 = Content; 40 = Height; 50 = Rotation; 72 = H-justification
 *
 * 🏢 ADR-344 Phase 11.D TODO (out of scope this commit):
 * When the parser is upgraded to preserve XDATA pairs (AcDbAnnotativeData,
 * group codes 1001/1070/1071) the conversion should call
 * `parseAnnotativeXData(pairs, scaleResolver)` from
 * `text-engine/parser/xdata-annotative-codec.ts` and populate
 * `isAnnotative` / `annotationScales` on the returned TextEntity.
 * Current parser flattens DXF into Record<string,string> which is lossy for
 * XDATA — full wire-up requires upstream parser refactor (separate task).
 */
export function convertText(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const { x, y, height, rotation } = parseTextTransform(data);
  let text = data['1'] || '';
  const horizontalJustification = parseInt(data['72']) || 0;
  const alignment = mapHorizontalAlignment(horizontalJustification);

  if (isNaN(x) || isNaN(y) || text.trim() === '') {
    dwarn('EntityConverter', `⚠️ Skipping TEXT ${index}: missing position or text`, { x, y, text });
    return null;
  }

  text = decodeGreekText(text);
  const color = extractEntityColor(data);

  return buildTextSceneEntity({
    idPrefix: 'text', index, layer, x, y, text, height, rotation, alignment,
    textNode: buildTextNodeFromFlat(text.trim(), height, rotation, alignment),
    color,
  });
}

/**
 * Convert MTEXT/MULTILINETEXT entity
 * DXF Codes: 10,20 = Position; 1/3 = Content; 40 = Height; 50 = Rotation; 71 = Attachment
 *
 * 🏢 ADR-344 Phase 11.D TODO: same XDATA wire-up note as convertText() above.
 */
export function convertMText(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const { x, y, height, rotation } = parseTextTransform(data);
  let text = data['1'] || data['3'] || '';
  const attachmentPoint = parseInt(data['71']) || 1;
  const alignment = mapMTextAlignment(attachmentPoint);

  if (isNaN(x) || isNaN(y) || text.trim() === '') {
    dwarn('EntityConverter', `⚠️ Skipping MTEXT ${index}: missing position or text`, { x, y, text });
    return null;
  }

  text = decodeGreekText(text);
  const color = extractEntityColor(data);

  return buildTextSceneEntity({
    idPrefix: 'mtext', index, layer, x, y, text, height, rotation, alignment,
    textNode: buildTextNodeFromFlat(
      text.trim(), height, rotation, alignment,
      MTEXT_ATTACHMENT_MAP[attachmentPoint],
    ),
    color,
  });
}
