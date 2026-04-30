/**
 * @fileoverview Multi-signal duplicate detection for incoming quotes.
 * Pure function — no side effects, safe to call in any context.
 * @adr ADR-328 §5.AA.1
 */

import type { Quote } from '../types/quote';
import { fuzzyEqualGreek } from '@/lib/string/fuzzy-greek';

export type DuplicateConfidence = 'high' | 'medium' | 'low' | 'none';
export type DuplicateSignal = 'email' | 'taxId' | 'name';

export interface DuplicateDetectionResult {
  confidence: DuplicateConfidence;
  matchedQuote: Quote | null;
  signals: DuplicateSignal[];
}

function extractEmail(q: Quote): string | null {
  const emails = q.extractedData?.vendorEmails?.value;
  return emails?.[0]?.toLowerCase() ?? null;
}

function extractTaxId(q: Quote): string | null {
  return q.extractedData?.vendorVat?.value ?? null;
}

function extractName(q: Quote): string {
  return q.extractedData?.vendorName?.value ?? '';
}

/**
 * Detect if newQuote is a revision of any existing active quote.
 *
 * Confidence levels (§5.AA.1):
 *   high   — email + taxId both match
 *   medium — email OR taxId matches
 *   low    — only fuzzy name match (Levenshtein ≤ 2)
 *
 * Tie-breaking (§5.AA.5): highest-confidence wins; ties go to most recent submittedAt.
 */
export function detectDuplicate(
  newQuote: Quote,
  existingActive: Quote[],
): DuplicateDetectionResult {
  const newEmail = extractEmail(newQuote);
  const newTaxId = extractTaxId(newQuote);
  const newName = extractName(newQuote);

  let best: DuplicateDetectionResult = { confidence: 'none', matchedQuote: null, signals: [] };
  let bestScore = 0;
  let bestTs = 0;

  for (const existing of existingActive) {
    const signals: DuplicateSignal[] = [];
    const emailMatch = !!newEmail && newEmail === extractEmail(existing);
    const taxIdMatch = !!newTaxId && newTaxId === extractTaxId(existing);
    const nameMatch = !!newName && fuzzyEqualGreek(newName, extractName(existing));

    if (emailMatch) signals.push('email');
    if (taxIdMatch) signals.push('taxId');
    if (nameMatch) signals.push('name');

    let confidence: DuplicateConfidence = 'none';
    let score = 0;
    if (emailMatch && taxIdMatch) { confidence = 'high'; score = 3; }
    else if (emailMatch || taxIdMatch) { confidence = 'medium'; score = 2; }
    else if (nameMatch) { confidence = 'low'; score = 1; }
    if (score === 0) continue;

    const ts = (existing.submittedAt as { seconds: number } | null)?.seconds ?? 0;
    if (score > bestScore || (score === bestScore && ts > bestTs)) {
      bestScore = score;
      bestTs = ts;
      best = { confidence, matchedQuote: existing, signals };
    }
  }

  return best;
}
