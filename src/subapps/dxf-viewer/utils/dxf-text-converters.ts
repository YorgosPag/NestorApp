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
import type { StyleFontMap } from './dxf-parser-types';
import {
  decodeGreekText,
  mapHorizontalAlignment,
  mapMTextAlignment,
  extractEntityColor,
} from './dxf-converter-helpers';
import { dwarn } from '../debug';
import type { DxfTextNode, TextJustification, TextParagraph, TextRun } from '../text-engine/types';
import { DXF_COLOR_BY_LAYER } from '../text-engine/types';
// ADR-635 Φ4 — rich MTEXT import: reuse the ADR-344 parser SSoT (tokenizer → AST),
// never a second parser. `extractFlatText` (ADR-344 SSoT) reduces the AST to the plain
// `.text` string the render/hit-test/snap pipeline reads first.
import { parseMtext, tokenizeMtext } from '../text-engine/parser';
import { extractFlatText } from './text-node-utils';

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

/**
 * ADR-635 Φ C.5 — resolve a TEXT/MTEXT entity's text-style name (DXF group 7) to a font
 * family via the pre-parsed STYLE map. Gate: no group 7, or a style name absent from the map
 * (unknown style), → '' so the render font-resolver keeps its default (unchanged behaviour;
 * native/Tekton/bare text carries no group 7). AutoCAD parity: group 7 = text style name →
 * STYLE table entry → font file (romans → Liberation Sans via `resolveEntityFont`).
 */
function resolveStyleFont(data: Record<string, string>, styleFonts?: StyleFontMap): string {
  const styleName = data['7'];
  if (!styleName || !styleFonts) return '';
  return styleFonts[styleName] ?? '';
}

function buildTextNodeFromFlat(
  text: string,
  height: number,
  rotation: number,
  alignment: 'left' | 'center' | 'right',
  attachment?: TextJustification,
  fontFamily = '',
): DxfTextNode {
  const run: TextRun = {
    text,
    style: {
      fontFamily,
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
  idPrefix: 'text' | 'mtext' | 'attrib' | 'attdef';
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
  index: number,
  styleFonts?: StyleFontMap,
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
  // ADR-635 Φ C.5 — text-style name (group 7) → STYLE font family; '' when absent/unknown.
  const fontFamily = resolveStyleFont(data, styleFonts);

  return buildTextSceneEntity({
    idPrefix: 'text', index, layer, x, y, text, height, rotation, alignment,
    textNode: buildTextNodeFromFlat(text.trim(), height, rotation, alignment, undefined, fontFamily),
    color,
  });
}

/**
 * Convert MTEXT/MULTILINETEXT entity
 * DXF Codes: 10,20 = Position; 1/3 = Content; 40 = Height; 50 = Rotation; 71 = Attachment
 *
 * 🏢 ADR-635 Φ4 — RICH import: the raw group-1/3 content string carries AutoCAD inline
 * codes (`\P` paragraph breaks, `\H`/`\C`/`\f`/`\S` formatting, `%%c`/`%%d`/`%%p`,
 * `\U+XXXX`). Instead of dropping the whole raw string into ONE run (basic path — which
 * showed the codes verbatim and double-escaped `\P`→`\\P` on re-export, the ADR-636 Φ2.3
 * known limitation), feed the FULL ADR-344 parser SSoT (`tokenizeMtext` → `parseMtext`)
 * so `textNode` becomes a real multi-paragraph/run AST. Then the render/hit-test/snap
 * pipeline breaks lines correctly and applies the first-run style, AND `serializeDxfTextNode`
 * round-trips the `\P` cleanly (runs no longer hold raw codes → no double-escape).
 *
 * 🏢 ADR-344 Phase 11.D TODO: same XDATA wire-up note as convertText() above.
 */
export function convertMText(
  data: Record<string, string>,
  layer: string,
  index: number,
  styleFonts?: StyleFontMap,
): AnySceneEntity | null {
  const { x, y, height, rotation } = parseTextTransform(data);
  const rawContent = data['1'] || data['3'] || '';
  const attachmentPoint = parseInt(data['71']) || 1;
  const alignment = mapMTextAlignment(attachmentPoint);

  if (isNaN(x) || isNaN(y) || rawContent.trim() === '') {
    dwarn('EntityConverter', `⚠️ Skipping MTEXT ${index}: missing position or text`, { x, y, text: rawContent });
    return null;
  }

  // Greek decode FIRST — legacy `\uXXXX` (lowercase) escapes that the tokenizer's `\U+`
  // (uppercase) path does not cover; the MTEXT inline codes are untouched by the decode.
  const decoded = decodeGreekText(rawContent);
  // `height` (code 40) seeds the base run style (default char height for runs w/o `\H`).
  // ADR-635 Φ C.5 — the text-style font (group 7 → STYLE) seeds the base run family so runs
  // without an inline `\f`/`\F` override render with the drawing's real font (AutoCAD parity).
  // Gated: no group 7 / unknown style → the parser keeps its 'Standard' default (unchanged).
  const fontFamily = resolveStyleFont(data, styleFonts);
  const parsed = parseMtext(tokenizeMtext(decoded), {
    height,
    ...(fontFamily && { fontFamily }),
  });
  // `parseMtext` hard-codes attachment 'TL' / rotation 0 (it sees only inline codes) — set
  // the real values from the entity (code 71 attachment + code 50 rotation).
  const textNode: DxfTextNode = {
    ...parsed,
    attachment: MTEXT_ATTACHMENT_MAP[attachmentPoint] ?? 'TL',
    rotation,
  };
  // Flat `.text` = PLAIN text (paragraph breaks → `\n`), NOT the raw inline-code string:
  // the render/hit-test/snap SSoTs read `e.text ?? extractFlatText(textNode)` — flat wins,
  // so a raw `.text` would show `\P`/codes verbatim despite a correct AST.
  const plainText = extractFlatText(textNode);
  const color = extractEntityColor(data);

  return buildTextSceneEntity({
    idPrefix: 'mtext', index, layer, x, y, text: plainText, height, rotation, alignment,
    textNode,
    color,
  });
}

// ============================================================================
// 🏢 ENTERPRISE: ATTRIBUTE CONVERTERS (ADR-635 Φάση B Batch 2)
// ============================================================================

/**
 * Shared ATTRIB/ATTDEF → `type:'text'` conversion. AutoCAD renders both the block
 * attribute VALUE (ATTRIB, code 1) and — in the block editor — the attribute
 * DEFINITION's default value (ATTDEF, code 1) as ordinary single-line text, so we
 * reuse the exact TEXT machinery (`buildTextNodeFromFlat`, no MTEXT inline-code parse:
 * attribute values carry no `\P`/`\H` codes). The two public converters differ only in
 * `idPrefix`/`label`.
 *
 * DXF codes — 1=value (VISIBLE, same as TEXT), 2=tag, 3=prompt (ATTDEF, NOT rendered),
 * 10/20=position, 40=height, 50=rotation, 72=H-justification, 70 bit 1=invisible.
 *
 * ⚠️ ATTDEF templates that live INSIDE a BLOCK are skipped per-INSERT by the
 * `dxf-block-expander.ts` guard (otherwise every INSERT would stamp the stale default);
 * this converter handles only the standalone / model-space case.
 */
function convertAttributeEntity(
  data: Record<string, string>,
  layer: string,
  index: number,
  idPrefix: 'attrib' | 'attdef',
  label: 'ATTRIB' | 'ATTDEF',
): AnySceneEntity | null {
  const { x, y, height, rotation } = parseTextTransform(data);
  let text = data['1'] || '';
  const alignment = mapHorizontalAlignment(parseInt(data['72']) || 0);
  const invisible = ((parseInt(data['70']) || 0) & 1) === 1;

  if (isNaN(x) || isNaN(y) || text.trim() === '') {
    dwarn('EntityConverter', `⚠️ Skipping ${label} ${index}: missing position or text`, { x, y, text });
    return null;
  }

  text = decodeGreekText(text);
  const color = extractEntityColor(data);
  const tag = data['2'];

  const base = buildTextSceneEntity({
    idPrefix, index, layer, x, y, text, height, rotation, alignment,
    textNode: buildTextNodeFromFlat(text.trim(), height, rotation, alignment),
    color,
  });

  // 70 bit 1 = invisible attribute (still imported, hidden until unhidden — AutoCAD parity).
  // Tag (code 2) preserved on the entity so export can round-trip ATTRIB→TEXT losslessly-ish.
  return {
    ...base,
    visible: !invisible,
    ...(tag ? { attributeTag: tag } : {}),
  };
}

/**
 * Convert ATTRIB (block attribute value instance) → `type:'text'`.
 * ATTRIB entities follow their INSERT in the ENTITIES stream with absolute WCS coords,
 * so a standalone conversion places them exactly where AutoCAD shows them.
 */
export function convertAttrib(
  data: Record<string, string>,
  layer: string,
  index: number,
): AnySceneEntity | null {
  return convertAttributeEntity(data, layer, index, 'attrib', 'ATTRIB');
}

/**
 * Convert ATTDEF (attribute definition template) → `type:'text'` using its default
 * value (code 1). Block-nested ATTDEFs are skipped by the block-expander guard; this
 * covers the rare standalone/model-space ATTDEF.
 */
export function convertAttdef(
  data: Record<string, string>,
  layer: string,
  index: number,
): AnySceneEntity | null {
  return convertAttributeEntity(data, layer, index, 'attdef', 'ATTDEF');
}
