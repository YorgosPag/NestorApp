/**
 * =============================================================================
 * AGENTIC REPLY UTILS — Post-processing for AI Agent Responses
 * =============================================================================
 *
 * Utilities for cleaning, formatting, and extracting structured data from
 * raw AI text replies. Extracted from agentic-loop.ts (Google file size standard).
 *
 * @module services/ai-pipeline/agentic-reply-utils
 * @see ADR-171 (Autonomous AI Agent)
 */

import { safeJsonParse } from '@/lib/json-utils';
import { isNonEmptyString } from '@/lib/type-guards';

/**
 * Extract [SUGGESTIONS] block from AI answer and strip filler phrases.
 *
 * Handles two cases:
 *   1. With closing tag: [SUGGESTIONS]...[/SUGGESTIONS]
 *   2. Without closing tag: [SUGGESTIONS]... (to end of string)
 */
export function extractSuggestions(rawAnswer: string): { cleanAnswer: string; suggestions: string[] } {
  const regexClosed = /\[SUGGESTIONS\]\n?([\s\S]*?)\[\/SUGGESTIONS\]/;
  const regexOpen = /\[SUGGESTIONS\]\n?([\s\S]*)$/;

  const match = rawAnswer.match(regexClosed) ?? rawAnswer.match(regexOpen);

  let cleanAnswer: string;
  let suggestions: string[] = [];

  if (match) {
    cleanAnswer = rawAnswer.replace(match[0], '').trim();
    suggestions = match[1]
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length <= 40)
      .slice(0, 3);
  } else {
    cleanAnswer = rawAnswer;
  }

  cleanAnswer = stripGenericClosingPhrases(cleanAnswer);

  return { cleanAnswer, suggestions };
}

/** Remove filler phrases like "Αν χρειάζεσαι...", "Μη διστάσεις...", "Ενημέρωσέ με" */
export function stripGenericClosingPhrases(text: string): string {
  // Strip technical tool/ID footers that should never reach the user
  const technicalPatterns = [
    /\n*\(Tools used:.*\)/gi,
    /\n*\[Tools used:.*\]/gi,
    /\n*Tools used:.*$/gim,
    /\n*Document IDs?:.*$/gim,
    /\n*\(IDs?:.*\)/gi,
  ];
  let cleaned = text;
  for (const pattern of technicalPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  const fillerPatterns = [
    /\n*Αν χρειάζεσαι[^\n]*/gi,
    /\n*Εάν χρειάζεσαι[^\n]*/gi,
    /\n*Μη διστάσεις[^\n]*/gi,
    /\n*Μην διστάσεις[^\n]*/gi,
    /\n*Ενημέρωσέ με[^\n]*/gi,
    /\n*Αν θέλεις περισσότερ[^\n]*/gi,
    /\n*Εάν θέλεις περισσότερ[^\n]*/gi,
    /\n*Είμαι εδώ για[^\n]*/gi,
    /\n*Πώς μπορώ να σε εξυπηρετήσω[^\n]*/gi,
    /\n*Θα μπορούσες να ελέγξεις[^\n]*/gi,
  ];

  for (const pattern of fillerPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

/**
 * Clean AI text reply — strip JSON wrapping if present
 */
export function cleanAITextReply(rawText: string): string {
  const trimmed = rawText.trim();

  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;

  if (candidate.startsWith('{')) {
    const parsed = safeJsonParse<Record<string, unknown>>(candidate, null as unknown as Record<string, unknown>);
    if (parsed !== null) {
      const textValue = parsed.response ?? parsed.message ?? parsed.error ?? parsed.text;
      if (isNonEmptyString(textValue)) {
        return textValue;
      }
    }
  }

  return trimmed;
}

/**
 * Prepend attachment metadata to user message so the AI knows
 * which files were sent and their fileRecordIds.
 */
// ============================================================================
// DOCUMENT PREVIEW ENRICHMENT (ADR-264)
// ============================================================================

export interface DocumentPreviewData {
  fileRecordId: string;
  filename: string;
  summary: string;
  documentType: string;
  suggestedActions: string[];
  confidence: number;
}

/**
 * Prepend document analysis results to the user message so the AI
 * can describe the document and offer actions without calling tools.
 */
export function enrichWithDocumentPreview(
  message: string,
  previews: ReadonlyArray<DocumentPreviewData>
): string {
  if (previews.length === 0) return message;

  const blocks = previews.map(p => {
    const actions = p.suggestedActions.length > 0
      ? `Προτεινόμενες ενέργειες: ${p.suggestedActions.join(', ')}`
      : '';
    const confidenceNote = p.confidence < 0.5
      ? '(Χαμηλή εμπιστοσύνη αναγνώρισης)'
      : '';

    return [
      `[Ανάλυση Εγγράφου: ${p.filename}]`,
      `Τύπος: ${p.documentType}`,
      `Περίληψη: ${p.summary}`,
      actions,
      confidenceNote,
    ].filter(Boolean).join('\n');
  });

  return `${blocks.join('\n\n')}\n\n${message}`;
}

// ============================================================================
// ATTACHMENT METADATA ENRICHMENT
// ============================================================================

export function enrichWithAttachments(
  message: string,
  attachments?: ReadonlyArray<{ fileRecordId: string; filename: string; contentType: string }>
): string {
  if (!attachments || attachments.length === 0) return message;

  const desc = attachments.map(a => {
    const type = a.contentType.startsWith('image/') ? 'Φωτογραφία' : 'Έγγραφο';
    return `[Συνημμένο ${type}: ${a.filename}, fileRecordId: ${a.fileRecordId}]`;
  }).join('\n');

  return `${desc}\n\n${message.trim() || '(χωρίς κείμενο)'}`;
}
