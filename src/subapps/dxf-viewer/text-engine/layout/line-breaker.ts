/**
 * ADR-344 Phase 3 — UAX #14 simplified line-breaker.
 *
 * Breaks a flat sequence of TextRuns into TextLines that fit within a
 * maximum width. Break opportunities: spaces, hyphens, and explicit `\n`.
 * A single token that exceeds maxWidth always starts its own line.
 *
 * UAX #14 simplification: no emoji, no bidi, no Indic — sufficient for
 * architectural text (ASCII + Greek, per ADR-344 §Phase 3 notes).
 *
 * @module text-engine/layout/line-breaker
 */

import type { Font } from 'opentype.js';
import type { TextRun } from '../types/text-ast.types';
import { measureText } from '../fonts/glyph-renderer';

// ── Output type ───────────────────────────────────────────────────────────────

/** A fully laid-out line, ready for the text renderer. */
export interface TextLine {
  /** Runs that make up this line, in display order. */
  readonly runs: readonly TextRun[];
  /** Total advance width in drawing units. */
  readonly width: number;
  /** Maximum ascent among all runs (above baseline). */
  readonly ascent: number;
  /** Maximum descent among all runs (below baseline). */
  readonly descent: number;
}

// ── Internal accumulator ──────────────────────────────────────────────────────

interface Accum {
  runs: TextRun[];
  width: number;
  ascent: number;
  descent: number;
}

function freshAccum(): Accum {
  return { runs: [], width: 0, ascent: 0, descent: 0 };
}

function accumToLine(a: Accum): TextLine {
  return { runs: a.runs, width: a.width, ascent: a.ascent, descent: a.descent };
}

// ── Tokenisation ──────────────────────────────────────────────────────────────

/**
 * Split text into word-level tokens.
 * Spaces and hyphens end a token (break opportunity after them).
 * A `\n` is emitted as its own sentinel token.
 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let buf = '';
  for (const ch of text) {
    if (ch === '\n') {
      if (buf) { tokens.push(buf); buf = ''; }
      tokens.push('\n');
    } else if (ch === ' ' || ch === '-') {
      buf += ch;
      tokens.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) tokens.push(buf);
  return tokens;
}

function isWhitespaceOnly(token: string): boolean {
  return token.length > 0 && /^\s+$/.test(token);
}

// ── Metrics helper ────────────────────────────────────────────────────────────

function tokenMetrics(
  font: Font,
  token: string,
  height: number,
): { width: number; ascent: number; descent: number } {
  const m = measureText(font, token, height > 0 ? height : 1);
  return { width: m.width, ascent: m.ascent, descent: m.descent };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Break runs into lines fitting within maxWidth.
 *
 * Always returns at least one line (empty if no runs supplied).
 * Trailing-space tokens are never promoted to start a new line.
 */
export function breakLines(
  runs: readonly TextRun[],
  maxWidth: number,
  font: Font,
): TextLine[] {
  const lines: TextLine[] = [];
  let accum = freshAccum();

  const commitLine = () => {
    if (accum.runs.length > 0) {
      lines.push(accumToLine(accum));
      accum = freshAccum();
    }
  };

  for (const run of runs) {
    for (const token of tokenize(run.text)) {
      if (token === '\n') {
        commitLine();
        continue;
      }
      const m = tokenMetrics(font, token, run.style.height);
      const wouldOverflow = accum.width + m.width > maxWidth;
      if (wouldOverflow && accum.runs.length > 0 && !isWhitespaceOnly(token)) {
        commitLine();
      }
      accum.runs.push({ text: token, style: run.style });
      accum.width += m.width;
      if (m.ascent > accum.ascent) accum.ascent = m.ascent;
      if (m.descent > accum.descent) accum.descent = m.descent;
    }
  }

  commitLine();
  return lines.length > 0 ? lines : [accumToLine(freshAccum())];
}
