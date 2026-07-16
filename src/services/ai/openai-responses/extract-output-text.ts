/**
 * =============================================================================
 * OPENAI RESPONSES API — OUTPUT TEXT EXTRACTION (SSoT)
 * =============================================================================
 *
 * Canonical home of `extractOutputText`. Previously re-implemented four times
 * (vision-helpers, accounting document analyzer, procurement quote analyzer,
 * ai-analysis provider) with identical semantics.
 *
 * This module is **client-safe**: pure JSON traversal, no secrets, no I/O,
 * never throws.
 *
 * @module services/ai/openai-responses/extract-output-text
 * @see ADR-294 — SSoT Ratchet (module `openai-provider`)
 * @see ADR-373 §D5 — AI Auto-Fill Architecture
 */

import { isRecord, isNonEmptyTrimmedString } from '@/lib/type-guards';

/**
 * Extract the first plain-text output from an OpenAI Responses-API payload.
 *
 * Handles both the `output_text` shortcut and the structured
 * `output[].content[]` variant. Whitespace-only text counts as absent.
 *
 * @returns The trimmed text, or `null` if no usable text is present.
 */
export function extractOutputText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const outputText = payload.output_text;
  if (isNonEmptyTrimmedString(outputText)) {
    return outputText.trim();
  }

  const output = payload.output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!isRecord(item)) continue;
    if (item.type !== 'message') continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;

    for (const entry of content) {
      if (!isRecord(entry)) continue;
      if (entry.type !== 'output_text') continue;
      const text = entry.text;
      if (isNonEmptyTrimmedString(text)) {
        return text.trim();
      }
    }
  }

  return null;
}
