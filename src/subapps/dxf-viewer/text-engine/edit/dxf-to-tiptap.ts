/**
 * ADR-344 Phase 4 — DxfTextNode → TipTap JSON serializer.
 *
 * Lossless conversion: every field of the source AST round-trips through
 * tipTapToDxfText.
 *
 * Encoding decisions:
 *  - Soft newlines (`\n` within a TextRun.text) are emitted as `hard_break`
 *    nodes flanked by `text` nodes with the same mark set.
 *  - TextRunStyle fields with default values (widthFactor=1, obliqueAngle=0,
 *    tracking=1) are omitted from the marks list to keep JSON minimal.
 *  - `dxfColor` is always emitted (no default) — the renderer needs an
 *    explicit colour for every run.
 *
 * @module text-engine/edit/dxf-to-tiptap
 */

import type {
  DxfTextNode,
  TextParagraph,
  TextRun,
  TextStack,
  TextRunStyle,
} from '../types/text-ast.types';
import type {
  TipTapDoc,
  TipTapParagraph,
  TipTapInline,
  TipTapStackNode,
  TipTapMark,
  DocAttrs,
} from './tiptap-json.types';

// ── Style → marks ─────────────────────────────────────────────────────────────

function styleToMarks(style: TextRunStyle): TipTapMark[] {
  const marks: TipTapMark[] = [];
  if (style.bold)          marks.push({ type: 'bold' });
  if (style.italic)        marks.push({ type: 'italic' });
  if (style.underline)     marks.push({ type: 'underline' });
  if (style.strikethrough) marks.push({ type: 'strike' });
  if (style.overline)      marks.push({ type: 'overline' });
  if (style.fontFamily)    marks.push({ type: 'fontFamily',   attrs: { family: style.fontFamily } });
  if (style.height > 0)    marks.push({ type: 'fontHeight',   attrs: { height: style.height } });
  if (style.widthFactor !== 1)  marks.push({ type: 'widthFactor',  attrs: { factor: style.widthFactor } });
  if (style.obliqueAngle !== 0) marks.push({ type: 'obliqueAngle', attrs: { angle: style.obliqueAngle } });
  if (style.tracking !== 1)     marks.push({ type: 'tracking',     attrs: { tracking: style.tracking } });
  marks.push({ type: 'dxfColor', attrs: { color: style.color } });
  return marks;
}

// ── Run / stack → inlines ─────────────────────────────────────────────────────

function runToInlines(run: TextRun): TipTapInline[] {
  const marks = styleToMarks(run.style);
  const segments = run.text.split('\n');
  const inlines: TipTapInline[] = [];
  segments.forEach((seg, i) => {
    if (seg.length > 0) {
      inlines.push({ type: 'text', text: seg, marks });
    }
    if (i < segments.length - 1) {
      inlines.push({ type: 'hard_break' });
    }
  });
  return inlines;
}

function stackToInline(stack: TextStack): TipTapStackNode {
  return {
    type: 'stack',
    attrs: {
      top: stack.top,
      bottom: stack.bottom,
      stackType: stack.type,
      fontFamily: stack.style.fontFamily,
      height: stack.style.height,
      color: stack.style.color,
    },
  };
}

// ── Paragraph & document ──────────────────────────────────────────────────────

function paragraphToTipTap(para: TextParagraph): TipTapParagraph {
  const content: TipTapInline[] = [];
  for (const item of para.runs) {
    if ('text' in item) {
      content.push(...runToInlines(item));
    } else {
      content.push(stackToInline(item));
    }
  }
  return {
    type: 'paragraph',
    attrs: {
      indent: para.indent,
      leftMargin: para.leftMargin,
      rightMargin: para.rightMargin,
      tabs: para.tabs,
      justification: para.justification,
      lineSpacingMode: para.lineSpacingMode,
      lineSpacingFactor: para.lineSpacingFactor,
    },
    content,
  };
}

function nodeToDocAttrs(node: DxfTextNode): DocAttrs {
  return {
    attachment: node.attachment,
    lineSpacing: node.lineSpacing,
    rotation: node.rotation,
    isAnnotative: node.isAnnotative,
    annotationScales: node.annotationScales,
    currentScale: node.currentScale,
    bgMask: node.bgMask ?? null,
    columns: node.columns ?? null,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Convert a DxfTextNode AST into a TipTap (ProseMirror) JSON document.
 *
 * The returned object is plain JSON-serialisable (no class instances, no
 * functions) so it can be sent over the wire or stored in IndexedDB.
 */
export function dxfTextToTipTap(node: DxfTextNode): TipTapDoc {
  return {
    type: 'doc',
    attrs: nodeToDocAttrs(node),
    content: node.paragraphs.map(paragraphToTipTap),
  };
}
