/**
 * @fileoverview Tests for Matching Scoring Engine
 * @description Google Presubmit pattern — pure function tests, zero `any`
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-31
 * @compliance CLAUDE.md Enterprise Standards
 */

import {
  normalizeGreek,
  tokenize,
  levenshtein,
  scoreAmount,
  scoreDescription,
  scoreCurrency,
  scoreDate,
  calculateMatchScore,
  classifyTier,
  ScoringTransactionInput,
  ScoringCandidateInput,
} from '../matching-scoring';
import { DEFAULT_MATCHING_CONFIG, MatchingConfig } from '../../../types/matching-config';
import { MatchTier } from '../../../types/bank';

// ============================================================================
// A. normalizeGreek
// ============================================================================

describe('normalizeGreek', () => {
  it('strips Greek accents (tonos)', () => {
    expect(normalizeGreek('Ελληνικά')).toBe('ελληνικα');
  });

  it('strips multiple Greek accents in one string', () => {
    expect(normalizeGreek('Ένας Κόσμος Γεμάτος Ήχους')).toBe(
      'ενας κοσμος γεματος ηχους'
    );
  });

  it('converts mixed case to lowercase', () => {
    expect(normalizeGreek('HELLO World')).toBe('hello world');
  });

  it('returns already-normalized text unchanged', () => {
    expect(normalizeGreek('test string')).toBe('test string');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeGreek('  spaced  ')).toBe('spaced');
  });

  it('handles empty string', () => {
    expect(normalizeGreek('')).toBe('');
  });
});

// ============================================================================
// B. tokenize
// ============================================================================

describe('tokenize', () => {
  it('splits simple words', () => {
    expect(tokenize('hello world')).toEqual(['hello', 'world']);
  });

  it('splits Greek text with punctuation', () => {
    const result = tokenize('Τιμολόγιο, πληρωμή: 2026');
    expect(result).toContain('τιμολογιο');
    expect(result).toContain('πληρωμη');
    expect(result).toContain('2026');
  });

  it('filters out tokens shorter than 2 characters', () => {
    expect(tokenize('I am a big cat')).toEqual(['am', 'big', 'cat']);
  });

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('splits on hyphens, slashes, and brackets', () => {
    const result = tokenize('inv-2026/001 (paid)');
    expect(result).toEqual(['inv', '2026', '001', 'paid']);
  });
});

// ============================================================================
// C. levenshtein
// ============================================================================

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });

  it('returns length of other when one string is empty', () => {
    expect(levenshtein('', 'hello')).toBe(5);
    expect(levenshtein('hello', '')).toBe(5);
  });

  it('returns 0 for two empty strings', () => {
    expect(levenshtein('', '')).toBe(0);
  });

  it('returns 1 for a single substitution', () => {
    expect(levenshtein('cat', 'bat')).toBe(1);
  });

  it('returns 1 for a single insertion', () => {
    expect(levenshtein('cat', 'cats')).toBe(1);
  });

  it('returns 1 for a single deletion', () => {
    expect(levenshtein('cats', 'cat')).toBe(1);
  });

  it('returns Infinity when either string exceeds maxLen', () => {
    const longString = 'a'.repeat(51);
    expect(levenshtein(longString, 'short')).toBe(Infinity);
    expect(levenshtein('short', longString)).toBe(Infinity);
  });

  it('respects custom maxLen', () => {
    expect(levenshtein('abcde', 'abcdf', 4)).toBe(Infinity);
    expect(levenshtein('abcde', 'abcdf', 5)).toBe(1);
  });

  it('handles multi-character edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

// ============================================================================
// D. scoreAmount
// ============================================================================

describe('scoreAmount', () => {
  const tolerance = DEFAULT_MATCHING_CONFIG.amountTolerancePercent; // 5

  it('returns 100 when both amounts are zero', () => {
    const result = scoreAmount(0, 0, tolerance);
    expect(result.score).toBe(100);
    expect(result.reason).toBe('Μηδενικό ποσό');
  });

  it('returns 0 when candidate is 0 but txn is not', () => {
    const result = scoreAmount(100, 0, tolerance);
    expect(result.score).toBe(0);
  });

  it('returns 100 for exact match', () => {
    const result = scoreAmount(500, 500, tolerance);
    expect(result.score).toBe(100);
    expect(result.reason).toBe('Ακριβές ποσό');
  });

  it('returns ~95 for 0.5% difference', () => {
    // 0.5% of 1000 = 5 → candidate 1000, txn 1005
    const result = scoreAmount(1005, 1000, tolerance);
    expect(result.score).toBe(95);
  });

  it('returns 90 for exactly 1% difference', () => {
    // 1% of 1000 = 10
    const result = scoreAmount(1010, 1000, tolerance);
    expect(result.score).toBe(90);
  });

  it('returns score in 50-90 range for 3% difference', () => {
    // 3% of 1000 = 30
    const result = scoreAmount(1030, 1000, tolerance);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThanOrEqual(90);
  });

  it('returns 0 for difference beyond tolerance', () => {
    // 6% of 1000 = 60 (tolerance = 5%)
    const result = scoreAmount(1060, 1000, tolerance);
    expect(result.score).toBe(0);
  });

  it('handles negative difference (txn < candidate)', () => {
    const result = scoreAmount(990, 1000, tolerance);
    expect(result.score).toBe(90); // 1% diff
  });
});

// ============================================================================
// E. scoreDescription
// ============================================================================

describe('scoreDescription', () => {
  it('gives up to 60 points for full token overlap', () => {
    const result = scoreDescription(
      'Πληρωμή τιμολογίου',
      null,
      null,
      'Πληρωμή τιμολογίου',
      null,
      null
    );
    expect(result.score).toBe(60);
  });

  it('gives 25 extra points for counterparty name substring match', () => {
    const result = scoreDescription(
      'Πληρωμή',
      'ΠΑΓΩΝΗΣ ΑΕ',
      null,
      'Πληρωμή',
      'ΠΑΓΩΝΗΣ ΑΕ',
      null
    );
    // 60 (tokens) + 25 (name) = 85
    expect(result.score).toBe(85);
  });

  it('gives 20 points for levenshtein <=2 counterparty match', () => {
    const result = scoreDescription(
      'Πληρωμή',
      'ΠΑΓΩΝΗΣ',
      null,
      'Πληρωμή',
      'ΠΑΓΟΝΗΣ', // 1 edit away
      null
    );
    // 60 (tokens) + 20 (similar name) = 80
    expect(result.score).toBe(80);
  });

  it('gives 15 extra points for payment ref match', () => {
    const result = scoreDescription(
      'Πληρωμή',
      null,
      'INV-2026-001',
      'Πληρωμή',
      null,
      'INV-2026-001'
    );
    // 60 (tokens) + 15 (ref) = 75
    expect(result.score).toBe(75);
  });

  it('gives 10 points when payment ref appears in candidate description', () => {
    const result = scoreDescription(
      'Κατάθεση',
      null,
      'REF123',
      'Κατάθεση REF123 πελάτη',
      null,
      null // no candidateRef → falls to ref-in-desc check
    );
    // tokens overlap + 10 (ref in desc)
    expect(result.score).toBeGreaterThanOrEqual(10);
  });

  it('returns 0 when there is no overlap at all', () => {
    const result = scoreDescription(
      'alpha beta gamma',
      null,
      null,
      'delta epsilon zeta',
      null,
      null
    );
    expect(result.score).toBe(0);
  });

  it('handles all null counterparty and ref — only token score', () => {
    const result = scoreDescription(
      'Τιμολόγιο αγοράς',
      null,
      null,
      'Τιμολόγιο αγοράς υλικών',
      null,
      null
    );
    // Partial token overlap only
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(60);
  });

  it('caps total score at 100', () => {
    // Full token overlap (60) + name match (25) + ref match (15) = 100
    const result = scoreDescription(
      'Πληρωμή τιμολογίου',
      'ΠΑΓΩΝΗΣ ΑΕ',
      'INV-001',
      'Πληρωμή τιμολογίου',
      'ΠΑΓΩΝΗΣ ΑΕ',
      'INV-001'
    );
    expect(result.score).toBe(100);
  });

  it('does not add counterparty points when names are too short for levenshtein and no substring match', () => {
    const result = scoreDescription(
      'test',
      'AB',  // length < 3
      null,
      'test',
      'XY',  // length < 3
      null
    );
    // Token overlap only, no name bonus (short strings skip levenshtein)
    expect(result.score).toBe(60);
  });
});

// ============================================================================
// F. scoreCurrency
// ============================================================================

describe('scoreCurrency', () => {
  it('returns 100 for same currency', () => {
    const result = scoreCurrency('EUR', 'EUR');
    expect(result.score).toBe(100);
    expect(result.reason).toBe('');
  });

  it('returns 100 for same currency case-insensitive', () => {
    const result = scoreCurrency('eur', 'EUR');
    expect(result.score).toBe(100);
  });

  it('returns 0 for different currencies', () => {
    const result = scoreCurrency('EUR', 'USD');
    expect(result.score).toBe(0);
    expect(result.reason).toBe('Διαφορετικό νόμισμα');
  });

  it('handles mixed case different currencies', () => {
    const result = scoreCurrency('Eur', 'Usd');
    expect(result.score).toBe(0);
  });
});

// ============================================================================
// G. scoreDate
// ============================================================================

describe('scoreDate', () => {
  const proximity = DEFAULT_MATCHING_CONFIG.dateProximityDays; // 7

  it('returns 100 for same day', () => {
    const result = scoreDate('2026-03-15', '2026-03-15', proximity);
    expect(result.score).toBe(100);
    expect(result.reason).toBe('Ίδια ημερομηνία');
  });

  it('returns 90 for ±1 day', () => {
    const result = scoreDate('2026-03-15', '2026-03-16', proximity);
    expect(result.score).toBe(90);
    expect(result.reason).toBe('±1 ημέρα');
  });

  it('returns 90 for -1 day', () => {
    const result = scoreDate('2026-03-16', '2026-03-15', proximity);
    expect(result.score).toBe(90);
  });

  it('returns 70 for ±3 days', () => {
    const result = scoreDate('2026-03-15', '2026-03-18', proximity);
    expect(result.score).toBe(70);
  });

  it('returns 70 for ±2 days', () => {
    const result = scoreDate('2026-03-15', '2026-03-17', proximity);
    expect(result.score).toBe(70);
  });

  it('returns score between 30-70 for ±5 days within proximity', () => {
    const result = scoreDate('2026-03-15', '2026-03-20', proximity);
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.score).toBeLessThanOrEqual(70);
  });

  it('returns 0 for days beyond proximity', () => {
    const result = scoreDate('2026-03-15', '2026-03-25', proximity);
    expect(result.score).toBe(0);
  });

  it('returns 0 for exactly at proximity + 1', () => {
    // proximity = 7, diff = 8
    const result = scoreDate('2026-03-15', '2026-03-23', proximity);
    expect(result.score).toBe(0);
  });

  it('returns score at proximity boundary', () => {
    // diff = 7 (exactly at proximity)
    const result = scoreDate('2026-03-15', '2026-03-22', proximity);
    expect(result.score).toBe(30); // bottom of range
  });
});

// ============================================================================
// H. calculateMatchScore
// ============================================================================

describe('calculateMatchScore', () => {
  const config: MatchingConfig = DEFAULT_MATCHING_CONFIG;

  const baseTransaction: ScoringTransactionInput = {
    amount: 1000,
    currency: 'EUR',
    bankDescription: 'Πληρωμή τιμολογίου ΠΑΓΩΝΗΣ',
    counterparty: 'ΠΑΓΩΝΗΣ ΑΕ',
    paymentReference: 'INV-2026-001',
    transactionDate: '2026-03-15',
  };

  const perfectCandidate: ScoringCandidateInput = {
    amount: 1000,
    currency: 'EUR',
    description: 'Πληρωμή τιμολογίου ΠΑΓΩΝΗΣ',
    date: '2026-03-15',
    counterpartyName: 'ΠΑΓΩΝΗΣ ΑΕ',
    reference: 'INV-2026-001',
  };

  it('returns high score for perfect match', () => {
    const result = calculateMatchScore(baseTransaction, perfectCandidate, config);
    expect(result.totalScore).toBeGreaterThanOrEqual(95);
    expect(result.tier).toBe('auto_match');
    expect(result.breakdown.amountScore).toBe(100);
    expect(result.breakdown.currencyScore).toBe(100);
    expect(result.breakdown.dateScore).toBe(100);
  });

  it('returns weighted score when only amount matches', () => {
    const candidate: ScoringCandidateInput = {
      amount: 1000,
      currency: 'USD',
      description: 'Unrelated description xyz',
      date: '2026-01-01', // far away
      counterpartyName: null,
      reference: null,
    };
    const result = calculateMatchScore(baseTransaction, candidate, config);
    // amount: 100*0.35=35, desc: ~0, currency: 0, date: 0 → ~35
    expect(result.totalScore).toBeLessThanOrEqual(45);
    expect(result.tier).toBe('no_match');
  });

  it('returns low score when nothing matches', () => {
    const candidate: ScoringCandidateInput = {
      amount: 99999,
      currency: 'USD',
      description: 'Completely different xyz abc',
      date: '2020-01-01',
      counterpartyName: 'Unknown Corp',
      reference: 'REF-999',
    };
    const result = calculateMatchScore(baseTransaction, candidate, config);
    expect(result.totalScore).toBeLessThanOrEqual(20);
    expect(result.tier).toBe('no_match');
  });

  it('populates breakdown with individual scores', () => {
    const result = calculateMatchScore(baseTransaction, perfectCandidate, config);
    expect(result.breakdown).toHaveProperty('amountScore');
    expect(result.breakdown).toHaveProperty('descriptionScore');
    expect(result.breakdown).toHaveProperty('currencyScore');
    expect(result.breakdown).toHaveProperty('dateScore');
  });

  it('includes non-empty reasons array', () => {
    const result = calculateMatchScore(baseTransaction, perfectCandidate, config);
    expect(result.reasons.length).toBeGreaterThan(0);
    // Reasons should be strings
    result.reasons.forEach((reason) => {
      expect(typeof reason).toBe('string');
    });
  });

  it('applies custom config weights correctly', () => {
    const customConfig: MatchingConfig = {
      ...config,
      weights: { amount: 1.0, description: 0.0, currency: 0.0, date: 0.0 },
    };
    const result = calculateMatchScore(baseTransaction, perfectCandidate, customConfig);
    // Only amount contributes: 100 * 1.0 = 100
    expect(result.totalScore).toBe(100);
  });
});

// ============================================================================
// I. classifyTier
// ============================================================================

describe('classifyTier', () => {
  const thresholds = DEFAULT_MATCHING_CONFIG.thresholds;

  it('returns auto_match for score 100', () => {
    expect(classifyTier(100, thresholds)).toBe('auto_match' as MatchTier);
  });

  it('returns auto_match for score exactly at threshold (95)', () => {
    expect(classifyTier(95, thresholds)).toBe('auto_match' as MatchTier);
  });

  it('returns suggested for score 90', () => {
    expect(classifyTier(90, thresholds)).toBe('suggested' as MatchTier);
  });

  it('returns suggested for score exactly at threshold (85)', () => {
    expect(classifyTier(85, thresholds)).toBe('suggested' as MatchTier);
  });

  it('returns manual_review for score 75', () => {
    expect(classifyTier(75, thresholds)).toBe('manual_review' as MatchTier);
  });

  it('returns manual_review for score exactly at threshold (70)', () => {
    expect(classifyTier(70, thresholds)).toBe('manual_review' as MatchTier);
  });

  it('returns no_match for score 60', () => {
    expect(classifyTier(60, thresholds)).toBe('no_match' as MatchTier);
  });

  it('returns no_match for score 0', () => {
    expect(classifyTier(0, thresholds)).toBe('no_match' as MatchTier);
  });

  it('returns auto_match for score 94 with custom lower threshold', () => {
    const custom = { ...thresholds, autoMatchThreshold: 90 };
    expect(classifyTier(94, custom)).toBe('auto_match' as MatchTier);
  });

  it('returns no_match for score 69 (just below manual threshold)', () => {
    expect(classifyTier(69, thresholds)).toBe('no_match' as MatchTier);
  });
});
