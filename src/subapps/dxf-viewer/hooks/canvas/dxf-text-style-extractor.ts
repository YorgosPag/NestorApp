/**
 * 🏢 ENTERPRISE: DXF Text Style Extractor (pure, module-level)
 *
 * @description Pure helpers that derive canvas-renderable text style + height from a
 * SceneModel text entity's `textNode`. Extracted from {@link convertEntity}
 * (dxf-scene-entity-converter.ts) to keep that file ≤500 LOC (Google SRP).
 *
 * ADR-344 Phase 6.E — textNode-aware style/height resolution.
 */

import type { DxfTextStyle } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfColor, DxfTextNode, TextRun } from '../../text-engine/types';
import { TEXT_SIZE_LIMITS } from '../../config/text-rendering-config';

/** Entity shape required by the text-style helpers (narrow subset of SceneEntity). */
type TextStyledEntity = { textNode?: DxfTextNode; height?: number; fontSize?: number };

/**
 * ADR-344 Phase 6.E — Extract canvas-renderable style from the first run of textNode.
 * Returns undefined when textNode is absent or yields no style fields.
 */
export function extractFirstRunStyle(entity: TextStyledEntity): DxfTextStyle | undefined {
  if (!entity.textNode) return undefined;
  const result: DxfTextStyle = {};

  // Node-level: attachment → textAlign (H) + textBaseline (V).
  const attachment = entity.textNode.attachment;
  if (attachment) {
    const row = attachment[0]; // 'TL'[0]='T', 'ML'[0]='M', 'BL'[0]='B'
    const col = attachment[1]; // 'TL'[1]='L', 'TC'[1]='C', 'TR'[1]='R'
    if (col === 'C') result.textAlign = 'center';
    else if (col === 'R') result.textAlign = 'right';
    // 'L' = default 'left', omit
    if (row === 'M') result.textBaseline = 'middle';
    else if (row === 'B') result.textBaseline = 'bottom';
    // 'T' = default 'top', omit
  }

  // Run-level: first run style (bold / italic / underline / font / color).
  const para = entity.textNode.paragraphs?.[0];
  const run = para?.runs?.[0];
  if (run && !('top' in run)) {
    const s = (run as TextRun).style;
    if (s) {
      if (s.bold !== undefined) result.bold = s.bold;
      if (s.italic !== undefined) result.italic = s.italic;
      if (s.underline !== undefined) result.underline = s.underline;
      if (s.overline !== undefined) result.overline = s.overline;
      if (s.strikethrough !== undefined) result.strikethrough = s.strikethrough;
      if (s.fontFamily) result.fontFamily = s.fontFamily;
      if (s.color) {
        const c = s.color as DxfColor;
        if (c.kind === 'TrueColor') {
          result.runColor = `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
        }
        // ByLayer / ByBlock → inherit entity color, omit runColor
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * ADR-344 Phase 6.E — Resolve text height: prefer first run's textNode height,
 * fall back to flat entity.height / entity.fontSize / default.
 */
export function resolveTextHeight(entity: TextStyledEntity): number {
  const run = entity.textNode?.paragraphs?.[0]?.runs?.[0];
  if (run && !('top' in run)) {
    const h = (run as TextRun).style?.height;
    if (h !== undefined && h > 0) return h;
  }
  return entity.height || entity.fontSize || TEXT_SIZE_LIMITS.DEFAULT_FONT_SIZE;
}
