/**
 * ADR-344 — Shared utilities for DxfTextNode plain-text extraction.
 * SSoT for the paragraph→run→text reduction used by bounds, hit-testing, and scene conversion.
 */

import type { DxfTextNode, TextRun } from '../text-engine/types';

/**
 * Reduce a DxfTextNode to a plain string by flattening paragraphs→runs.
 * TextStack items (subscript/superscript, identified by `'top' in run`) are skipped.
 * Paragraphs are joined with newlines to preserve multiline structure.
 */
export function extractFlatText(textNode: DxfTextNode): string {
  return textNode.paragraphs
    .map(p => (p.runs ?? [])
      .filter(r => !('top' in r))
      .map(r => (r as TextRun).text)
      .join(''))
    .join('\n');
}

/**
 * Extract plain text from a textNode-capable entity.
 * Falls back to the legacy flat `text` field when `textNode` is absent.
 */
export function resolveEntityText(entity: { textNode?: DxfTextNode; text?: string }): string {
  return entity.textNode ? extractFlatText(entity.textNode) : (entity.text ?? '');
}
