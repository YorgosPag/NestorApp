/**
 * ADR-344 Phase 6.A — Match engine for Find/Replace on DxfTextNode.
 *
 * Pure functions that scan every run of every paragraph and either
 * report matches (search) or produce a new AST with replacements
 * applied (replace). Match modes: case-sensitive, whole-word, regex.
 */

import type { DxfTextNode, TextParagraph, TextRun, TextStack } from '../../../text-engine/types';

export interface MatchOptions {
  readonly caseSensitive: boolean;
  readonly wholeWord: boolean;
  readonly regex: boolean;
}

export interface MatchLocation {
  readonly paragraphIndex: number;
  readonly runIndex: number;
  /** Match start position inside `run.text`. */
  readonly start: number;
  /** Match end position (exclusive). */
  readonly end: number;
}

function isStack(item: TextRun | TextStack): item is TextStack {
  return (item as TextStack).top !== undefined;
}

function buildRegex(pattern: string, opts: MatchOptions): RegExp {
  const flags = opts.caseSensitive ? 'g' : 'gi';
  if (opts.regex) return new RegExp(pattern, flags);
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wrapped = opts.wholeWord ? `\\b${escaped}\\b` : escaped;
  return new RegExp(wrapped, flags);
}

export function findMatches(
  node: DxfTextNode,
  pattern: string,
  opts: MatchOptions,
): MatchLocation[] {
  if (!pattern) return [];
  const re = buildRegex(pattern, opts);
  const matches: MatchLocation[] = [];
  node.paragraphs.forEach((para, pIdx) => {
    para.runs.forEach((item, rIdx) => {
      if (isStack(item)) return;
      const run = item as TextRun;
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(run.text)) !== null) {
        matches.push({
          paragraphIndex: pIdx,
          runIndex: rIdx,
          start: m.index,
          end: m.index + m[0].length,
        });
        if (m[0].length === 0) re.lastIndex += 1; // avoid infinite loop on empty match
      }
    });
  });
  return matches;
}

/**
 * Replace ALL occurrences of `pattern` with `replacement` across the
 * entire node. Returns a fresh DxfTextNode; the input is not mutated.
 */
export function replaceAll(
  node: DxfTextNode,
  pattern: string,
  replacement: string,
  opts: MatchOptions,
): { node: DxfTextNode; count: number } {
  if (!pattern) return { node, count: 0 };
  const re = buildRegex(pattern, opts);
  let count = 0;
  const paragraphs: TextParagraph[] = node.paragraphs.map((para) => ({
    ...para,
    runs: para.runs.map((item) => {
      if (isStack(item)) return item;
      const run = item as TextRun;
      const next = run.text.replace(re, () => {
        count += 1;
        return replacement;
      });
      return next === run.text ? run : { ...run, text: next };
    }),
  }));
  if (count === 0) return { node, count: 0 };
  return { node: { ...node, paragraphs }, count };
}

/**
 * Replace a single match identified by its location. The pattern is
 * re-evaluated at `location` to find the exact substring length —
 * the caller may have stale positions if the AST mutated meanwhile.
 */
export function replaceAt(
  node: DxfTextNode,
  location: MatchLocation,
  replacement: string,
): { node: DxfTextNode; replaced: boolean } {
  const para = node.paragraphs[location.paragraphIndex];
  if (!para) return { node, replaced: false };
  const item = para.runs[location.runIndex];
  if (!item || isStack(item)) return { node, replaced: false };
  const run = item as TextRun;
  if (location.start < 0 || location.end > run.text.length || location.start >= location.end) {
    return { node, replaced: false };
  }
  const nextText = run.text.slice(0, location.start) + replacement + run.text.slice(location.end);
  const nextRuns = para.runs.map((it, i) => (i === location.runIndex ? { ...run, text: nextText } : it));
  const nextParas = node.paragraphs.map((p, i) =>
    i === location.paragraphIndex ? { ...p, runs: nextRuns } : p,
  );
  return { node: { ...node, paragraphs: nextParas }, replaced: true };
}
