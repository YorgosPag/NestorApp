/**
 * ADR-344 Phase 1 — DxfTextNode → MTEXT inline-code string serializer.
 *
 * serializeDxfTextNode() is the main entry point.
 *
 * Version-gated behaviour (Q14):
 *   R12 (AC1009) — MTEXT did not exist. Downgrades to plain text, sets
 *     entityType = 'TEXT', and emits a warning in the result.
 *   R2000+ — Full MTEXT inline codes.
 *   R2004+ — True-color (\c) codes enabled; older versions fall back to ACI 7.
 */

import type { DxfColor } from '../types/text-toolbar.types';
import {
  DxfDocumentVersion,
  versionSupportsMtext,
  versionSupportsTrueColor,
  encodeTrueColorInt,
} from '../types/text-toolbar.types';
import type {
  DxfTextNode,
  TextParagraph,
  TextRun,
  TextRunStyle,
  TextStack,
} from '../types/text-ast.types';

// ── Public types ──────────────────────────────────────────────────────────────

export interface MtextSerializerOptions {
  readonly version: DxfDocumentVersion;
  /** Emit a warning when rich formatting must be stripped for R12 export. */
  readonly warnOnDowngrade?: boolean;
}

export interface MtextSerializerResult {
  /** The DXF entity content string (group codes 1 / 3 concatenated). */
  readonly content: string;
  /** Non-empty when formatting was stripped due to version downgrade. */
  readonly warnings: readonly string[];
  /** Which DXF entity type should wrap this content. */
  readonly entityType: 'TEXT' | 'MTEXT';
}

// ── Public API ────────────────────────────────────────────────────────────────

export function serializeDxfTextNode(
  node: DxfTextNode,
  options: MtextSerializerOptions,
): MtextSerializerResult {
  if (!versionSupportsMtext(options.version)) {
    return serializeAsText(node, options);
  }
  return serializeAsMtext(node, options);
}

// ── Downgrade path (R12) ──────────────────────────────────────────────────────

function serializeAsText(node: DxfTextNode, options: MtextSerializerOptions): MtextSerializerResult {
  const warnings: string[] = [];
  if (options.warnOnDowngrade !== false) {
    warnings.push(
      `Formatting lost — target version ${options.version} does not support MTEXT. ` +
        'Entity exported as plain TEXT without inline formatting.',
    );
  }
  const content = node.paragraphs
    .flatMap((p) => p.runs)
    .filter((r): r is TextRun => 'text' in r)
    .map((r) => r.text)
    .join(' ');
  return { content, warnings, entityType: 'TEXT' };
}

// ── Full MTEXT path (R2000+) ──────────────────────────────────────────────────

function serializeAsMtext(node: DxfTextNode, options: MtextSerializerOptions): MtextSerializerResult {
  const baseStyle = buildBaseStyle();
  const parts: string[] = [];
  for (let pi = 0; pi < node.paragraphs.length; pi++) {
    if (pi > 0) parts.push('\\P');
    parts.push(serializeParagraph(node.paragraphs[pi], baseStyle, options));
  }
  return { content: parts.join(''), warnings: [], entityType: 'MTEXT' };
}

function serializeParagraph(
  para: TextParagraph,
  baseStyle: TextRunStyle,
  options: MtextSerializerOptions,
): string {
  const parts: string[] = [];
  const paraCode = buildParagraphCode(para);
  if (paraCode) parts.push(paraCode);
  let currentStyle: TextRunStyle = { ...baseStyle };
  for (const run of para.runs) {
    if (isTextStack(run)) {
      parts.push(serializeStack(run));
      continue;
    }
    const diff = serializeStyleDiff(run.style, currentStyle, options);
    if (diff) parts.push(diff);
    parts.push(escapeText(run.text));
    currentStyle = { ...run.style };
  }
  return parts.join('');
}

// ── Style diff emitter ────────────────────────────────────────────────────────

function serializeStyleDiff(
  curr: TextRunStyle,
  prev: TextRunStyle,
  options: MtextSerializerOptions,
): string {
  const parts: string[] = [];
  const fontChanged =
    curr.fontFamily !== prev.fontFamily ||
    curr.bold !== prev.bold ||
    curr.italic !== prev.italic;
  if (fontChanged) {
    parts.push(`\\f${curr.fontFamily}|b${curr.bold ? 1 : 0}|i${curr.italic ? 1 : 0}|c0|p34;`);
  }
  if (curr.height !== prev.height) parts.push(`\\H${curr.height};`);
  if (curr.widthFactor !== prev.widthFactor) parts.push(`\\W${curr.widthFactor};`);
  if (curr.tracking !== prev.tracking) parts.push(`\\T${curr.tracking};`);
  if (curr.obliqueAngle !== prev.obliqueAngle) parts.push(`\\Q${curr.obliqueAngle};`);
  if (colorDiffers(curr.color, prev.color)) {
    parts.push(serializeColor(curr.color, options.version));
  }
  if (curr.underline !== prev.underline) parts.push(curr.underline ? '\\L' : '\\l');
  if (curr.overline !== prev.overline) parts.push(curr.overline ? '\\O' : '\\o');
  if (curr.strikethrough !== prev.strikethrough) parts.push(curr.strikethrough ? '\\K' : '\\k');
  return parts.join('');
}

function serializeColor(color: DxfColor, version: DxfDocumentVersion): string {
  switch (color.kind) {
    case 'ByLayer': return '\\C256;';
    case 'ByBlock': return '\\C0;';
    case 'ACI': return `\\C${color.index};`;
    case 'TrueColor':
      if (versionSupportsTrueColor(version)) {
        return `\\c${encodeTrueColorInt(color)};`;
      }
      return '\\C7;';
  }
}

// ── Paragraph formatting code ─────────────────────────────────────────────────

function buildParagraphCode(para: TextParagraph): string {
  const hasNonDefault =
    para.indent !== 0 ||
    para.leftMargin !== 0 ||
    para.rightMargin !== 0 ||
    para.tabs.length > 0 ||
    para.justification !== 0;
  if (!hasNonDefault) return '';
  const parts: string[] = [];
  if (para.indent !== 0) parts.push(`i${para.indent}`);
  if (para.leftMargin !== 0) parts.push(`l${para.leftMargin}`);
  if (para.rightMargin !== 0) parts.push(`r${para.rightMargin}`);
  if (para.justification !== 0) parts.push(`q${para.justification}`);
  para.tabs.forEach((t) => parts.push(`t${t}`));
  return `\\p${parts.join(',')};`;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function colorDiffers(a: DxfColor, b: DxfColor): boolean {
  if (a.kind !== b.kind) return true;
  if (a.kind === 'ACI' && b.kind === 'ACI') return a.index !== b.index;
  if (a.kind === 'TrueColor' && b.kind === 'TrueColor') {
    return a.r !== b.r || a.g !== b.g || a.b !== b.b;
  }
  return false;
}

function isTextStack(run: TextRun | TextStack): run is TextStack {
  return 'top' in run && 'bottom' in run && 'type' in run;
}

function serializeStack(stack: TextStack): string {
  const sep = stack.type === 'tolerance' ? '^' : stack.type === 'diagonal' ? '/' : '#';
  return `\\S${stack.top}${sep}${stack.bottom};`;
}

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

function buildBaseStyle(): TextRunStyle {
  return {
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
}
