/**
 * ADR-344 Phase 4 — TipTap JSON → DxfTextNode deserializer.
 *
 * Inverse of dxf-to-tiptap. Adjacent text nodes with identical mark sets
 * are merged into a single TextRun; `hard_break` nodes are inlined as
 * `\n` characters in the surrounding run's text.
 *
 * Validation is permissive: unknown mark types are ignored, missing
 * attributes fall back to the documented defaults so partially-formed
 * TipTap JSON (e.g. from older editor sessions) still round-trips safely.
 *
 * @module text-engine/edit/tiptap-to-dxf
 */

import type {
  TipTapDoc,
  TipTapParagraph,
  TipTapStackNode,
  TipTapMark,
  ParagraphAttrs,
  DocAttrs,
} from './tiptap-json.types';
import type {
  DxfTextNode,
  TextParagraph,
  TextRun,
  TextStack,
  TextRunStyle,
} from '../types/text-ast.types';
import type { DxfColor } from '../types/text-toolbar.types';

const DEFAULT_COLOR: DxfColor = { kind: 'ByLayer' };

// TipTap v3 omits `attrs` on the root doc node when no custom attrs are set.
// Same pattern as DEFAULT_PARA_ATTRS — all fields must have safe defaults.
const DEFAULT_DOC_ATTRS: DocAttrs = {
  attachment: 'TL',
  lineSpacing: { mode: 'at-least', factor: 1.0 },
  rotation: 0,
  isAnnotative: false,
  annotationScales: [],
  currentScale: '',
  bgMask: null,
  columns: null,
};

// ── Default factories ─────────────────────────────────────────────────────────

function defaultStyle(): TextRunStyle {
  return {
    fontFamily: '',
    bold: false,
    italic: false,
    underline: false,
    overline: false,
    strikethrough: false,
    height: 0,
    widthFactor: 1,
    obliqueAngle: 0,
    tracking: 1,
    color: DEFAULT_COLOR,
  };
}

// ── Marks → style ─────────────────────────────────────────────────────────────

function applyMark(style: TextRunStyle, mark: TipTapMark): void {
  switch (mark.type) {
    case 'bold':         style.bold = true; break;
    case 'italic':       style.italic = true; break;
    case 'underline':    style.underline = true; break;
    case 'strike':       style.strikethrough = true; break;
    case 'overline':     style.overline = true; break;
    case 'fontFamily':   style.fontFamily = mark.attrs.family; break;
    case 'fontHeight':   style.height = mark.attrs.height; break;
    case 'widthFactor':  style.widthFactor = mark.attrs.factor; break;
    case 'obliqueAngle': style.obliqueAngle = mark.attrs.angle; break;
    case 'tracking':     style.tracking = mark.attrs.tracking; break;
    case 'dxfColor':     style.color = mark.attrs.color; break;
  }
}

function marksToStyle(marks: readonly TipTapMark[] | undefined): TextRunStyle {
  const style = defaultStyle();
  if (marks) for (const m of marks) applyMark(style, m);
  return style;
}

// ── Style equality (run-merge heuristic) ──────────────────────────────────────

function colorsEqual(a: DxfColor, b: DxfColor): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'ACI' && b.kind === 'ACI') return a.index === b.index;
  if (a.kind === 'TrueColor' && b.kind === 'TrueColor') {
    return a.r === b.r && a.g === b.g && a.b === b.b;
  }
  return true;
}

function stylesEqual(a: TextRunStyle, b: TextRunStyle): boolean {
  return (
    a.fontFamily === b.fontFamily
    && a.bold === b.bold && a.italic === b.italic && a.underline === b.underline
    && a.overline === b.overline && a.strikethrough === b.strikethrough
    && a.height === b.height && a.widthFactor === b.widthFactor
    && a.obliqueAngle === b.obliqueAngle && a.tracking === b.tracking
    && colorsEqual(a.color, b.color)
  );
}

// ── Stack node → TextStack ────────────────────────────────────────────────────

function stackNodeToStack(node: TipTapStackNode): TextStack {
  return {
    top: node.attrs.top,
    bottom: node.attrs.bottom,
    type: node.attrs.stackType,
    style: {
      fontFamily: node.attrs.fontFamily,
      height: node.attrs.height,
      color: node.attrs.color,
    },
  };
}

// ── Paragraph builder ─────────────────────────────────────────────────────────

interface RunAccum {
  text: string;
  style: TextRunStyle;
  active: boolean;
}

function flushAccum(accum: RunAccum, runs: Array<TextRun | TextStack>): void {
  if (accum.active) {
    runs.push({ text: accum.text, style: accum.style });
    accum.text = '';
    accum.active = false;
  }
}

const DEFAULT_PARA_ATTRS: ParagraphAttrs = {
  indent: 0,
  leftMargin: 0,
  rightMargin: 0,
  tabs: [],
  justification: 0,
  lineSpacingMode: 'multiple',
  lineSpacingFactor: 1,
};

function paragraphToDxf(para: TipTapParagraph): TextParagraph {
  const runs: Array<TextRun | TextStack> = [];
  const accum: RunAccum = { text: '', style: defaultStyle(), active: false };
  // TipTap v3 omits `attrs` on plain paragraphs (no custom attributes).
  const attrs = para.attrs ?? DEFAULT_PARA_ATTRS;

  for (const item of para.content ?? []) {
    if (item.type === 'text') {
      const style = marksToStyle(item.marks);
      if (accum.active && stylesEqual(style, accum.style)) {
        accum.text += item.text;
      } else {
        flushAccum(accum, runs);
        accum.text = item.text;
        accum.style = style;
        accum.active = true;
      }
    } else if (item.type === 'hard_break') {
      if (accum.active) {
        accum.text += '\n';
      } else {
        accum.text = '\n';
        accum.style = defaultStyle();
        accum.active = true;
      }
    } else if (item.type === 'stack') {
      flushAccum(accum, runs);
      runs.push(stackNodeToStack(item));
    }
  }
  flushAccum(accum, runs);

  return {
    runs,
    indent: attrs.indent,
    leftMargin: attrs.leftMargin,
    rightMargin: attrs.rightMargin,
    tabs: attrs.tabs,
    justification: attrs.justification,
    lineSpacingMode: attrs.lineSpacingMode,
    lineSpacingFactor: attrs.lineSpacingFactor,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Convert a TipTap JSON document back into a DxfTextNode AST.
 *
 * Adjacent text nodes sharing an identical mark set are merged into one
 * TextRun. `hard_break` nodes become `\n` characters in the surrounding
 * run's text (matching the DXF `\N` soft-break convention).
 */
export function tipTapToDxfText(doc: TipTapDoc): DxfTextNode {
  const a = doc.attrs ?? DEFAULT_DOC_ATTRS;
  return {
    paragraphs: doc.content.map(paragraphToDxf),
    attachment: a.attachment,
    lineSpacing: a.lineSpacing,
    rotation: a.rotation,
    isAnnotative: a.isAnnotative,
    annotationScales: a.annotationScales,
    currentScale: a.currentScale,
    ...(a.bgMask ? { bgMask: a.bgMask } : {}),
    ...(a.columns ? { columns: a.columns } : {}),
  };
}
