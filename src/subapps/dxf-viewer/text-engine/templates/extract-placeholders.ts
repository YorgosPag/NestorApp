/**
 * ADR-344 Phase 7.A — Placeholder extraction.
 *
 * Scans a DxfTextNode AST and returns the sorted, unique set of
 * placeholder paths it contains. Placeholders follow the form
 * `{{namespace.key}}` (dot-separated path inside double curly braces).
 *
 * The Phase 7.C resolver performs the actual substitution; this module
 * only collects the placeholder paths so:
 *   - the management UI can show "what data this template needs"
 *   - the build-time test in `__tests__/defaults.test.ts` can verify
 *     each built-in template's declared `placeholders` matches its `content`
 *
 * The regex tolerates inner whitespace (`{{ project.name }}`) and rejects
 * malformed forms (nested braces, missing close).
 */

import type { DxfTextNode, TextParagraph, TextRun, TextStack } from '../types/text-ast.types';

/** Matches `{{namespace.key}}` with optional surrounding whitespace. */
const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)\s*\}\}/g;

/** Returns all placeholder paths found in a string, in source order (may contain duplicates). */
export function extractPlaceholdersFromString(text: string): string[] {
  const out: string[] = [];
  // global regex needs lastIndex reset between calls
  PLACEHOLDER_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
    out.push(match[1]);
  }
  return out;
}

function extractFromRun(run: TextRun | TextStack): string[] {
  if ('text' in run) {
    return extractPlaceholdersFromString(run.text);
  }
  // TextStack: scan top + bottom
  return [...extractPlaceholdersFromString(run.top), ...extractPlaceholdersFromString(run.bottom)];
}

function extractFromParagraph(para: TextParagraph): string[] {
  const all: string[] = [];
  for (const run of para.runs) all.push(...extractFromRun(run));
  return all;
}

/**
 * Scan a DxfTextNode and return sorted, unique placeholder paths.
 * Returns an empty array when the node contains no placeholders.
 */
export function extractPlaceholders(node: DxfTextNode): string[] {
  const seen = new Set<string>();
  for (const para of node.paragraphs) {
    for (const path of extractFromParagraph(para)) {
      seen.add(path);
    }
  }
  return Array.from(seen).sort();
}
