/**
 * ADR-344 Phase 1 — MTEXT token list → DxfTextNode AST parser.
 *
 * Processes the flat token list from mtext-tokenizer.ts into a structured
 * DxfTextNode using a style stack for nested {...} group scopes.
 *
 * parseMtext() — for MTEXT entities (inline formatting codes).
 * parseText()  — for simple TEXT entities (plain content, no inline codes).
 */

import type { DxfColor } from '../types/text-toolbar.types';
import type {
  DxfTextNode,
  TextParagraph,
  TextRun,
  TextRunStyle,
  TextStack,
  LineSpacingMode,
  TextJustification,
} from '../types/text-ast.types';
import type { MtextToken } from './mtext-tokenizer';

// ── Parser-internal state ─────────────────────────────────────────────────────

interface ParagraphStyle {
  indent: number;
  leftMargin: number;
  rightMargin: number;
  tabs: number[];
  justification: 0 | 1 | 2 | 3;
  lineSpacingMode: LineSpacingMode;
  lineSpacingFactor: number;
}

interface ParserState {
  styleStack: TextRunStyle[];
  currentText: string;
  runs: Array<TextRun | TextStack>;
  paragraphs: TextParagraph[];
  currentParagraphStyle: ParagraphStyle;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a flat MTEXT token list into a DxfTextNode AST.
 * @param tokens — output of tokenizeMtext()
 * @param baseStyle — optional overrides for the default run style
 */
export function parseMtext(
  tokens: readonly MtextToken[],
  baseStyle?: Partial<TextRunStyle>,
): DxfTextNode {
  const state: ParserState = {
    styleStack: [buildDefaultStyle(baseStyle)],
    currentText: '',
    runs: [],
    paragraphs: [],
    currentParagraphStyle: buildDefaultParagraphStyle(),
  };
  for (const token of tokens) {
    processToken(token, state);
  }
  flushRun(state);
  flushParagraph(state);
  if (state.paragraphs.length === 0) {
    state.paragraphs.push(buildEmptyParagraph(state.currentParagraphStyle));
  }
  return buildNode(state.paragraphs, 'TL');
}

/**
 * Wrap a plain TEXT entity string as a single-paragraph DxfTextNode.
 * No inline-code parsing — raw content is used verbatim.
 */
export function parseText(content: string, baseStyle?: Partial<TextRunStyle>): DxfTextNode {
  const style = buildDefaultStyle(baseStyle);
  const run: TextRun = { text: content, style };
  const paragraph: TextParagraph = {
    runs: content.length > 0 ? [run] : [],
    indent: 0,
    leftMargin: 0,
    rightMargin: 0,
    tabs: [],
    justification: 0,
    lineSpacingMode: 'multiple',
    lineSpacingFactor: 1.0,
  };
  return buildNode([paragraph], 'BL');
}

// ── Token processing ──────────────────────────────────────────────────────────

function processToken(token: MtextToken, state: ParserState): void {
  const style = state.styleStack[state.styleStack.length - 1];
  switch (token.kind) {
    case 'text': state.currentText += token.value; break;
    case 'groupOpen':
      flushRun(state);
      state.styleStack.push(cloneStyle(style));
      break;
    case 'groupClose':
      flushRun(state);
      if (state.styleStack.length > 1) state.styleStack.pop();
      break;
    case 'paragraphBreak':
      flushRun(state);
      flushParagraph(state);
      break;
    case 'lineBreak': state.currentText += '\n'; break;
    case 'nonBreakSpace': state.currentText += ' '; break;
    case 'diameter': state.currentText += 'Ø'; break;
    case 'degree': state.currentText += '°'; break;
    case 'plusMinus': state.currentText += '±'; break;
    case 'unicode': state.currentText += String.fromCodePoint(token.codePoint); break;
    case 'stack': flushRun(state); pushStackToken(token, style, state.runs); break;
    case 'paragraph': applyParagraphCode(token, state); break;
    default: flushRun(state); applyStyleToken(token, style); break;
  }
}

function applyStyleToken(token: MtextToken, style: TextRunStyle): void {
  switch (token.kind) {
    case 'font':
      style.fontFamily = token.family;
      style.bold = token.bold;
      style.italic = token.italic;
      break;
    case 'height':
      style.height = token.relative ? style.height * token.value : token.value;
      break;
    case 'width':
      style.widthFactor = token.relative ? style.widthFactor * token.value : token.value;
      break;
    case 'tracking': style.tracking = token.value; break;
    case 'oblique': style.obliqueAngle = token.degrees; break;
    case 'colorAci': style.color = { kind: 'ACI', index: token.index }; break;
    case 'colorTrue':
      style.color = { kind: 'TrueColor', r: token.r, g: token.g, b: token.b };
      break;
    case 'underlineOn': style.underline = true; break;
    case 'underlineOff': style.underline = false; break;
    case 'overlineOn': style.overline = true; break;
    case 'overlineOff': style.overline = false; break;
    case 'strikeOn': style.strikethrough = true; break;
    case 'strikeOff': style.strikethrough = false; break;
    default: break;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function flushRun(state: ParserState): void {
  if (!state.currentText) return;
  const style = state.styleStack[state.styleStack.length - 1];
  state.runs.push({ text: state.currentText, style: cloneStyle(style) });
  state.currentText = '';
}

function flushParagraph(state: ParserState): void {
  const { indent, leftMargin, rightMargin, tabs, justification, lineSpacingMode, lineSpacingFactor } =
    state.currentParagraphStyle;
  state.paragraphs.push({
    runs: state.runs,
    indent,
    leftMargin,
    rightMargin,
    tabs: [...tabs],
    justification,
    lineSpacingMode,
    lineSpacingFactor,
  });
  state.runs = [];
}

function pushStackToken(
  token: Extract<MtextToken, { kind: 'stack' }>,
  style: TextRunStyle,
  runs: Array<TextRun | TextStack>,
): void {
  runs.push({
    top: token.top,
    bottom: token.bottom,
    type: token.type,
    style: { fontFamily: style.fontFamily, height: style.height, color: style.color },
  });
}

function applyParagraphCode(
  token: Extract<MtextToken, { kind: 'paragraph' }>,
  state: ParserState,
): void {
  flushRun(state);
  flushParagraph(state);
  const j = token.justification;
  const justification: 0 | 1 | 2 | 3 = j === 1 ? 1 : j === 2 ? 2 : j === 3 ? 3 : 0;
  state.currentParagraphStyle = {
    ...state.currentParagraphStyle,
    indent: token.indent,
    leftMargin: token.left,
    rightMargin: token.right,
    tabs: token.tabs,
    justification,
  };
}

function buildDefaultStyle(overrides?: Partial<TextRunStyle>): TextRunStyle {
  const base: TextRunStyle = {
    fontFamily: 'Standard',
    bold: false,
    italic: false,
    underline: false,
    overline: false,
    strikethrough: false,
    height: 2.5,
    widthFactor: 1.0,
    obliqueAngle: 0,
    tracking: 1.0,
    color: { kind: 'ByLayer' } as DxfColor,
  };
  return overrides ? { ...base, ...overrides } : base;
}

function cloneStyle(style: TextRunStyle): TextRunStyle {
  return { ...style };
}

function buildDefaultParagraphStyle(): ParagraphStyle {
  return {
    indent: 0,
    leftMargin: 0,
    rightMargin: 0,
    tabs: [],
    justification: 0,
    lineSpacingMode: 'multiple',
    lineSpacingFactor: 1.0,
  };
}

function buildEmptyParagraph(ps: ParagraphStyle): TextParagraph {
  return {
    runs: [],
    indent: ps.indent,
    leftMargin: ps.leftMargin,
    rightMargin: ps.rightMargin,
    tabs: [...ps.tabs],
    justification: ps.justification,
    lineSpacingMode: ps.lineSpacingMode,
    lineSpacingFactor: ps.lineSpacingFactor,
  };
}

function buildNode(paragraphs: TextParagraph[], attachment: TextJustification): DxfTextNode {
  return {
    paragraphs,
    attachment,
    lineSpacing: { mode: 'multiple', factor: 1.0 },
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  };
}
