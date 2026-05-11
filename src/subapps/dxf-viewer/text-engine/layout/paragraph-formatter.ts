/**
 * ADR-344 Phase 3 — Paragraph formatter.
 *
 * Takes a parsed TextParagraph and breaks it into TextLines with accurate
 * vertical metrics. Applies first-line indent, left/right margins, and
 * node-level line-spacing defaults (overridden at paragraph level when set).
 *
 * TextStack items in para.runs are filtered out here; the stacking-renderer
 * handles their geometry independently.
 *
 * @module text-engine/layout/paragraph-formatter
 */

import type { Font } from 'opentype.js';
import type { TextParagraph, TextRun, TextStack, LineSpacingMode } from '../types/text-ast.types';
import { breakLines, type TextLine } from './line-breaker';

// ── Public types ──────────────────────────────────────────────────────────────

/** Node-level options passed down to every paragraph. */
export interface ParagraphOptions {
  /** Maximum text-block width in drawing units (from MTEXT group code 41). */
  readonly maxWidth: number;
  /** Additional outer indent (drawing units) — combined with para's own indent. */
  readonly indent: number;
  /** Default tab stops (drawing units). Para-level tabs take precedence. */
  readonly tabs: readonly number[];
  /** Node-level line-spacing mode (paragraph may override). */
  readonly lineSpacing: LineSpacingMode;
  /** Node-level line-spacing factor (paragraph may override). */
  readonly lineSpacingFactor: number;
  /** Font used to measure glyph advances. */
  readonly font: Font;
}

/** A fully formatted paragraph ready for the renderer. */
export interface FormattedParagraph {
  /** Lines produced by word-wrapping. */
  readonly lines: TextLine[];
  /** Total vertical extent in drawing units (all lines + spacing). */
  readonly totalHeight: number;
  /** Y-distance from paragraph top to first line baseline (drawing units). */
  readonly baseline: number;
  /** First-line horizontal indent in drawing units (renderer applies this). */
  readonly indentWidth: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function isTextRun(item: TextRun | TextStack): item is TextRun {
  return 'text' in item;
}

function extractTextRuns(runs: ReadonlyArray<TextRun | TextStack>): TextRun[] {
  return runs.filter(isTextRun);
}

function resolveSpacing(
  para: TextParagraph,
  options: ParagraphOptions,
): { mode: LineSpacingMode; factor: number } {
  const factor =
    para.lineSpacingFactor > 0
      ? para.lineSpacingFactor
      : options.lineSpacingFactor > 0
      ? options.lineSpacingFactor
      : 1.0;
  return { mode: para.lineSpacingMode, factor };
}

function lineHeightFor(line: TextLine, mode: LineSpacingMode, factor: number): number {
  const natural = line.ascent + line.descent;
  switch (mode) {
    case 'multiple': return natural * factor;
    case 'exact': return factor;
    case 'at-least': return Math.max(natural, factor);
  }
}

function computeTotalHeight(lines: TextLine[], mode: LineSpacingMode, factor: number): number {
  if (lines.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const isLast = i === lines.length - 1;
    total += isLast ? line.ascent + line.descent : lineHeightFor(line, mode, factor);
  }
  return total;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Format one paragraph into lines.
 *
 * Left/right margins and outer indent narrow the effective maxWidth.
 * First-line indent is stored on the result (not applied here) so the
 * renderer can offset the first line's x-position.
 */
export function formatParagraph(para: TextParagraph, options: ParagraphOptions): FormattedParagraph {
  const effective = options.maxWidth - para.leftMargin - para.rightMargin - options.indent;
  const maxWidth = Math.max(effective, 1);

  const textRuns = extractTextRuns(para.runs);
  const lines = breakLines(textRuns, maxWidth, options.font);

  const { mode, factor } = resolveSpacing(para, options);
  const totalHeight = computeTotalHeight(lines, mode, factor);
  const baseline = lines.length > 0 ? (lines[0]?.ascent ?? 0) : 0;

  return {
    lines,
    totalHeight,
    baseline,
    indentWidth: para.indent,
  };
}
