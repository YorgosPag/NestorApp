/**
 * ADR-344 Phase 7.D — Plain-text ↔ DxfTextNode bridge for the MVP editor.
 *
 * The Phase 7.D editor uses a `<textarea>` for content authoring (full
 * TipTap integration lands with the Phase 4 collab merge). This module
 * converts between the textarea string and `DxfTextNode`:
 *
 *   - `astToPlainText`  — flatten every paragraph/run/stack to text,
 *                         join paragraphs with `\n`.
 *   - `plainTextToAst`  — split lines, each line becomes one paragraph
 *                         with a single run carrying `DEFAULT_RUN_STYLE`
 *                         and inheriting the template's root attributes.
 *
 * Trade-off (documented in the editor warning chip): editing a Duplicate
 * of a styled built-in template flattens per-run style. The textarea
 * cannot represent bold/italic/colour today; the Phase 4 TipTap editor
 * will preserve them.
 */
import type {
  DxfTextNode,
  TextParagraph,
  TextRun,
  TextRunStyle,
  TextStack,
} from '@/subapps/dxf-viewer/text-engine/types/text-ast.types';

const DEFAULT_RUN_STYLE: TextRunStyle = {
  fontFamily: 'Arial',
  bold: false,
  italic: false,
  underline: false,
  overline: false,
  strikethrough: false,
  height: 12,
  widthFactor: 1,
  obliqueAngle: 0,
  tracking: 1,
  color: { kind: 'ByLayer' },
};

const DEFAULT_PARAGRAPH_ATTRIBUTES: Omit<TextParagraph, 'runs'> = {
  indent: 0,
  leftMargin: 0,
  rightMargin: 0,
  tabs: [],
  justification: 0,
  lineSpacingMode: 'multiple',
  lineSpacingFactor: 1,
};

const EMPTY_AST: DxfTextNode = {
  paragraphs: [],
  attachment: 'TL',
  lineSpacing: { mode: 'multiple', factor: 1 },
  rotation: 0,
  isAnnotative: false,
  annotationScales: [],
  currentScale: '',
};

function runOrStackText(item: TextRun | TextStack): string {
  if ('text' in item) return item.text;
  if (item.type === 'horizontal') return `${item.top}/${item.bottom}`;
  if (item.type === 'diagonal') return `${item.top}\\${item.bottom}`;
  return `${item.top}^${item.bottom}`;
}

export function astToPlainText(node: DxfTextNode): string {
  return node.paragraphs.map((p) => p.runs.map(runOrStackText).join('')).join('\n');
}

export function plainTextToAst(text: string, base?: DxfTextNode): DxfTextNode {
  const seed = base ?? EMPTY_AST;
  const lines = text.split(/\r?\n/);
  const paragraphs: TextParagraph[] = lines.map((line) => ({
    ...DEFAULT_PARAGRAPH_ATTRIBUTES,
    runs: [{ text: line, style: { ...DEFAULT_RUN_STYLE } } satisfies TextRun],
  }));
  return {
    ...seed,
    paragraphs,
  };
}

export const EDITOR_AST_FALLBACK: DxfTextNode = EMPTY_AST;
