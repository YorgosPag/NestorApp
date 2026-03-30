/**
 * @fileoverview Matching Scoring Engine — Weighted Scoring Algorithm
 * @description Pure functions for SAP/Midday-style weighted scoring
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-30
 * @version 2.0.0
 * @see DECISIONS-PHASE-2.md Q1 — Weighted Scoring Rewrite
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { MatchingConfig } from '../../types/matching-config';
import type { MatchTier } from '../../types/bank';

// ============================================================================
// SCORING INPUT / OUTPUT TYPES
// ============================================================================

/** Normalized transaction data for scoring */
export interface ScoringTransactionInput {
  readonly amount: number;
  readonly currency: string;
  readonly bankDescription: string;
  readonly counterparty: string | null;
  readonly paymentReference: string | null;
  readonly transactionDate: string;
}

/** Normalized candidate entity data for scoring */
export interface ScoringCandidateInput {
  readonly amount: number;
  readonly currency: string;
  readonly description: string;
  readonly date: string;
  readonly counterpartyName: string | null;
  readonly reference: string | null;
}

/** Breakdown of individual factor scores */
export interface ScoreBreakdown {
  readonly amountScore: number;
  readonly descriptionScore: number;
  readonly currencyScore: number;
  readonly dateScore: number;
}

/** Complete scoring result */
export interface ScoringResult {
  readonly totalScore: number;
  readonly breakdown: ScoreBreakdown;
  readonly reasons: string[];
  readonly tier: MatchTier;
}

// ============================================================================
// GREEK TEXT NORMALIZATION
// ============================================================================

/** Strip Greek accents and normalize for comparison */
export function normalizeGreek(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Tokenize text into normalized words (min 2 chars) */
export function tokenize(text: string): string[] {
  return normalizeGreek(text)
    .split(/[\s\-_/.,;:!?()[\]{}|'"]+/)
    .filter((token) => token.length >= 2);
}

// ============================================================================
// LEVENSHTEIN DISTANCE
// ============================================================================

/**
 * Levenshtein edit distance between two strings
 *
 * Returns Infinity if either string exceeds maxLen (performance safeguard).
 * Iterative DP implementation — O(n*m) time, O(min(n,m)) space.
 */
export function levenshtein(a: string, b: string, maxLen = 50): number {
  if (a.length > maxLen || b.length > maxLen) return Infinity;
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Use shorter string as the "column" for space optimization
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;

  const prevRow = new Array<number>(short.length + 1);
  for (let j = 0; j <= short.length; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= long.length; i++) {
    let prev = i;
    for (let j = 1; j <= short.length; j++) {
      const cost = long[i - 1] === short[j - 1] ? 0 : 1;
      const current = Math.min(
        (prevRow[j] ?? 0) + 1,        // deletion
        prev + 1,                       // insertion
        (prevRow[j - 1] ?? 0) + cost   // substitution
      );
      prevRow[j - 1] = prev;
      prev = current;
    }
    prevRow[short.length] = prev;
  }

  return prevRow[short.length] ?? Infinity;
}

// ============================================================================
// INDIVIDUAL FACTOR SCORERS
// ============================================================================

/**
 * Amount score (raw 0-100)
 *
 * - Exact match: 100
 * - ±1%: 90-100 (linear)
 * - ±1% to ±tolerance%: 50-90 (linear)
 * - Beyond tolerance: 0
 */
export function scoreAmount(
  txnAmount: number,
  candidateAmount: number,
  tolerancePercent: number
): { score: number; reason: string } {
  if (candidateAmount === 0 && txnAmount === 0) {
    return { score: 100, reason: 'Μηδενικό ποσό' };
  }
  if (candidateAmount === 0) {
    return { score: 0, reason: '' };
  }

  const diff = Math.abs(txnAmount - candidateAmount);
  const percentDiff = (diff / candidateAmount) * 100;

  if (diff === 0) {
    return { score: 100, reason: 'Ακριβές ποσό' };
  }

  if (percentDiff <= 1) {
    const score = Math.round(90 + (1 - percentDiff) * 10);
    return { score, reason: `Σχεδόν ακριβές ποσό (${percentDiff.toFixed(1)}%)` };
  }

  if (percentDiff <= tolerancePercent) {
    const score = Math.round(
      50 + ((tolerancePercent - percentDiff) / (tolerancePercent - 1)) * 40
    );
    return { score, reason: `Κοντινό ποσό (±${percentDiff.toFixed(1)}%)` };
  }

  return { score: 0, reason: '' };
}

/**
 * Description score (raw 0-100)
 *
 * Components:
 * - Token overlap: up to 60 points
 * - Counterparty name match: up to 25 points
 * - Payment reference match: up to 15 points
 */
export function scoreDescription(
  txnDescription: string,
  txnCounterparty: string | null,
  txnPaymentRef: string | null,
  candidateDesc: string,
  candidateName: string | null,
  candidateRef: string | null
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Token overlap
  const txnTokens = tokenize(txnDescription);
  const candidateTokens = tokenize(candidateDesc);

  if (txnTokens.length > 0 && candidateTokens.length > 0) {
    const candidateSet = new Set(candidateTokens);
    const matched = txnTokens.filter((t) => candidateSet.has(t)).length;
    const maxTokens = Math.max(txnTokens.length, candidateTokens.length);
    const overlapRatio = matched / maxTokens;
    const overlapScore = Math.round(overlapRatio * 60);

    if (overlapScore > 0) {
      score += overlapScore;
      reasons.push(`Λέξεις-κλειδιά (${matched}/${maxTokens})`);
    }
  }

  // Counterparty name matching
  if (txnCounterparty && candidateName) {
    const normCounterparty = normalizeGreek(txnCounterparty);
    const normName = normalizeGreek(candidateName);

    if (normCounterparty.includes(normName) || normName.includes(normCounterparty)) {
      score += 25;
      reasons.push('Αντιστοίχιση ονόματος');
    } else if (normCounterparty.length >= 3 && normName.length >= 3) {
      const dist = levenshtein(normCounterparty, normName);
      if (dist <= 2) {
        score += 20;
        reasons.push('Παρόμοιο όνομα');
      }
    }
  }

  // Payment reference matching
  if (txnPaymentRef && candidateRef) {
    const normRef = normalizeGreek(txnPaymentRef);
    const normCandRef = normalizeGreek(candidateRef);
    if (normRef.includes(normCandRef) || normCandRef.includes(normRef)) {
      score += 15;
      reasons.push('Αντιστοίχιση αιτιολογίας');
    }
  } else if (txnPaymentRef && candidateDesc) {
    const normRef = normalizeGreek(txnPaymentRef);
    const normDesc = normalizeGreek(candidateDesc);
    if (normDesc.includes(normRef)) {
      score += 10;
      reasons.push('Αιτιολογία στην περιγραφή');
    }
  }

  return {
    score: Math.min(score, 100),
    reason: reasons.join(', ') || '',
  };
}

/**
 * Currency score (raw 0-100)
 *
 * Same currency: 100, different: 0
 */
export function scoreCurrency(
  txnCurrency: string,
  candidateCurrency: string
): { score: number; reason: string } {
  const same = txnCurrency.toUpperCase() === candidateCurrency.toUpperCase();
  return {
    score: same ? 100 : 0,
    reason: same ? '' : 'Διαφορετικό νόμισμα',
  };
}

/**
 * Date score (raw 0-100)
 *
 * - Same day: 100
 * - ±1 day: 90
 * - ±3 days: 70
 * - ±3 to ±proximity days: linear 70→30
 * - Beyond proximity: 0
 */
export function scoreDate(
  txnDate: string,
  candidateDate: string,
  proximityDays: number
): { score: number; reason: string } {
  const daysDiff = Math.abs(dateDiffDays(txnDate, candidateDate));

  if (daysDiff === 0) {
    return { score: 100, reason: 'Ίδια ημερομηνία' };
  }

  if (daysDiff <= 1) {
    return { score: 90, reason: '±1 ημέρα' };
  }

  if (daysDiff <= 3) {
    return { score: 70, reason: `${daysDiff} ημέρες διαφορά` };
  }

  if (daysDiff <= proximityDays) {
    const score = Math.round(
      30 + ((proximityDays - daysDiff) / (proximityDays - 3)) * 40
    );
    return { score, reason: `${daysDiff} ημέρες διαφορά` };
  }

  return { score: 0, reason: '' };
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate weighted match score between a transaction and a candidate
 *
 * Formula: totalScore = Σ(rawScore × weight)
 * Tier: based on thresholds from config
 */
export function calculateMatchScore(
  transaction: ScoringTransactionInput,
  candidate: ScoringCandidateInput,
  config: MatchingConfig
): ScoringResult {
  const { weights, thresholds } = config;

  const amountResult = scoreAmount(
    transaction.amount,
    candidate.amount,
    config.amountTolerancePercent
  );
  const descResult = scoreDescription(
    transaction.bankDescription,
    transaction.counterparty,
    transaction.paymentReference,
    candidate.description,
    candidate.counterpartyName,
    candidate.reference
  );
  const currencyResult = scoreCurrency(transaction.currency, candidate.currency);
  const dateResult = scoreDate(
    transaction.transactionDate,
    candidate.date,
    config.dateProximityDays
  );

  const totalScore = Math.round(
    amountResult.score * weights.amount +
    descResult.score * weights.description +
    currencyResult.score * weights.currency +
    dateResult.score * weights.date
  );

  const reasons = [
    amountResult.reason,
    descResult.reason,
    currencyResult.reason,
    dateResult.reason,
  ].filter(Boolean);

  const tier = classifyTier(totalScore, thresholds);

  return {
    totalScore,
    breakdown: {
      amountScore: amountResult.score,
      descriptionScore: descResult.score,
      currencyScore: currencyResult.score,
      dateScore: dateResult.score,
    },
    reasons,
    tier,
  };
}

// ============================================================================
// TIER CLASSIFICATION
// ============================================================================

/** Classify confidence score into a tier */
export function classifyTier(
  score: number,
  thresholds: MatchingConfig['thresholds']
): MatchTier {
  if (score >= thresholds.autoMatchThreshold) return 'auto_match';
  if (score >= thresholds.suggestThreshold) return 'suggested';
  if (score >= thresholds.manualThreshold) return 'manual_review';
  return 'no_match';
}

// ============================================================================
// UTILITY
// ============================================================================

/** Difference in days between two ISO date strings */
function dateDiffDays(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}
