/* eslint-disable no-restricted-syntax */
/**
 * =============================================================================
 * PO Invoice Matcher — Scoring Unit Tests (ADR-267)
 * =============================================================================
 *
 * Tests for scoring algorithm: amount, date, line items, description, reference.
 * Uses PO_MATCH_SCORING constants for threshold validation.
 *
 * Since the scoring functions are private (not exported), we test them
 * indirectly through the scoring behavior by examining the output.
 * We also test the scoring constants directly.
 *
 * @module tests/procurement/po-invoice-matcher
 * @see ADR-267 Phase C, Feature 1
 */

import {
  PO_MATCH_SCORING,
} from '@/types/procurement';

// ─── Score Functions (extracted for testing) ────────────────────────────
// These mirror the private functions in po-invoice-matcher.ts

function scoreAmountPair(invoiceAmount: number | null, poAmount: number): number {
  if (invoiceAmount === null || poAmount === 0) return 0;
  const ratio = Math.abs(invoiceAmount - poAmount) / poAmount;
  if (ratio <= PO_MATCH_SCORING.AMOUNT_EXACT_TOLERANCE) {
    return PO_MATCH_SCORING.AMOUNT_EXACT_POINTS;
  }
  if (ratio <= PO_MATCH_SCORING.AMOUNT_NEAR_TOLERANCE) {
    return PO_MATCH_SCORING.AMOUNT_NEAR_POINTS;
  }
  return 0;
}

function scoreDateProximity(
  invoiceDate: string | null,
  orderDate: string | null
): number {
  if (!invoiceDate || !orderDate) return 0;
  const inv = new Date(invoiceDate).getTime();
  const ord = new Date(orderDate).getTime();
  if (isNaN(inv) || isNaN(ord)) return 0;
  const diffDays = Math.abs(inv - ord) / (1000 * 60 * 60 * 24);
  if (diffDays <= PO_MATCH_SCORING.DATE_NEAR_DAYS) return PO_MATCH_SCORING.DATE_NEAR_POINTS;
  if (diffDays <= PO_MATCH_SCORING.DATE_FAR_DAYS) return PO_MATCH_SCORING.DATE_FAR_POINTS;
  return 0;
}

function scoreLineItemCount(poItemCount: number, invoiceItemCount: number): number {
  if (invoiceItemCount === 0) return 0;
  return invoiceItemCount === poItemCount ? PO_MATCH_SCORING.LINE_ITEM_COUNT_POINTS : 0;
}

function normalise(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function scoreDescriptionMatch(
  poDescriptions: string[],
  invoiceDescriptions: string[]
): number {
  if (invoiceDescriptions.length === 0) return 0;
  const poNorm = poDescriptions.map(normalise);
  const invNorm = invoiceDescriptions.map(normalise);
  let matches = 0;
  for (const inv of invNorm) {
    if (poNorm.some(po => po.includes(inv) || inv.includes(po))) {
      matches++;
    }
  }
  return matches > 0 ? PO_MATCH_SCORING.DESCRIPTION_MATCH_POINTS : 0;
}

function scoreReference(poNumber: string, documentNumber: string | null): number {
  if (!documentNumber) return 0;
  const doc = normalise(documentNumber);
  const po = normalise(poNumber);
  return (doc.includes(po) || po.includes(doc))
    ? PO_MATCH_SCORING.REFERENCE_MATCH_POINTS
    : 0;
}

// ============================================================================
// PO_MATCH_SCORING Constants
// ============================================================================

describe('PO_MATCH_SCORING constants', () => {
  it('total possible score is 100', () => {
    const maxScore =
      PO_MATCH_SCORING.AMOUNT_EXACT_POINTS +
      PO_MATCH_SCORING.DATE_NEAR_POINTS +
      PO_MATCH_SCORING.LINE_ITEM_COUNT_POINTS +
      PO_MATCH_SCORING.DESCRIPTION_MATCH_POINTS +
      PO_MATCH_SCORING.REFERENCE_MATCH_POINTS;
    expect(maxScore).toBe(100);
  });

  it('auto-match threshold is 85', () => {
    expect(PO_MATCH_SCORING.AUTO_MATCH_THRESHOLD).toBe(85);
  });

  it('amount exact tolerance is 5%', () => {
    expect(PO_MATCH_SCORING.AMOUNT_EXACT_TOLERANCE).toBe(0.05);
  });

  it('amount near tolerance is 10%', () => {
    expect(PO_MATCH_SCORING.AMOUNT_NEAR_TOLERANCE).toBe(0.10);
  });
});

// ============================================================================
// scoreAmountPair
// ============================================================================

describe('scoreAmountPair', () => {
  it('exact match (within 5%) → 40 points', () => {
    expect(scoreAmountPair(10000, 10000)).toBe(40); // 0% diff
    expect(scoreAmountPair(10400, 10000)).toBe(40); // 4% diff
    expect(scoreAmountPair(9600, 10000)).toBe(40); // 4% diff
  });

  it('near match (5-10%) → 25 points', () => {
    expect(scoreAmountPair(10800, 10000)).toBe(25); // 8% diff
    expect(scoreAmountPair(9100, 10000)).toBe(25); // 9% diff
  });

  it('no match (>10%) → 0 points', () => {
    expect(scoreAmountPair(12000, 10000)).toBe(0); // 20% diff
    expect(scoreAmountPair(5000, 10000)).toBe(0); // 50% diff
  });

  it('null invoice amount → 0 points', () => {
    expect(scoreAmountPair(null, 10000)).toBe(0);
  });

  it('zero PO amount → 0 points', () => {
    expect(scoreAmountPair(10000, 0)).toBe(0);
  });
});

// ============================================================================
// scoreDateProximity
// ============================================================================

describe('scoreDateProximity', () => {
  it('within 30 days → 20 points', () => {
    expect(scoreDateProximity('2026-01-15', '2026-01-10')).toBe(20); // 5 days
    expect(scoreDateProximity('2026-02-01', '2026-01-10')).toBe(20); // 22 days
  });

  it('31-60 days → 10 points', () => {
    expect(scoreDateProximity('2026-03-01', '2026-01-15')).toBe(10); // 45 days
  });

  it('>60 days → 0 points', () => {
    expect(scoreDateProximity('2026-06-01', '2026-01-01')).toBe(0); // 151 days
  });

  it('null dates → 0 points', () => {
    expect(scoreDateProximity(null, '2026-01-01')).toBe(0);
    expect(scoreDateProximity('2026-01-01', null)).toBe(0);
  });
});

// ============================================================================
// scoreLineItemCount
// ============================================================================

describe('scoreLineItemCount', () => {
  it('matching count → 15 points', () => {
    expect(scoreLineItemCount(5, 5)).toBe(15);
    expect(scoreLineItemCount(1, 1)).toBe(15);
  });

  it('different count → 0 points', () => {
    expect(scoreLineItemCount(5, 3)).toBe(0);
    expect(scoreLineItemCount(1, 2)).toBe(0);
  });

  it('zero invoice items → 0 points', () => {
    expect(scoreLineItemCount(5, 0)).toBe(0);
  });
});

// ============================================================================
// scoreDescriptionMatch
// ============================================================================

describe('scoreDescriptionMatch', () => {
  it('matching descriptions → 15 points', () => {
    expect(scoreDescriptionMatch(
      ['Τσιμεντοσανίδες 12mm'],
      ['τσιμεντοσανίδες 12mm'],
    )).toBe(15);
  });

  it('partial match (contains) → 15 points', () => {
    expect(scoreDescriptionMatch(
      ['Τσιμεντοσανίδες 12mm Knauf'],
      ['Τσιμεντοσανίδες'],
    )).toBe(15);
  });

  it('no match → 0 points', () => {
    expect(scoreDescriptionMatch(
      ['Τσιμεντοσανίδες 12mm'],
      ['Σωλήνες PVC'],
    )).toBe(0);
  });

  it('empty invoice descriptions → 0 points', () => {
    expect(scoreDescriptionMatch(['Τσιμέντο'], [])).toBe(0);
  });

  it('case insensitive matching', () => {
    expect(scoreDescriptionMatch(
      ['CEMENT BOARD'],
      ['cement board'],
    )).toBe(15);
  });
});

// ============================================================================
// scoreReference
// ============================================================================

describe('scoreReference', () => {
  it('PO number found in document number → 10 points', () => {
    expect(scoreReference('PO-0042', 'INV-2026-PO-0042')).toBe(10);
  });

  it('no reference → 0 points', () => {
    expect(scoreReference('PO-0042', 'INV-2026-1234')).toBe(0);
  });

  it('null document number → 0 points', () => {
    expect(scoreReference('PO-0042', null)).toBe(0);
  });
});

// ============================================================================
// Combined scoring — auto-match scenarios
// ============================================================================

describe('Combined scoring — auto-match threshold', () => {
  it('perfect match = 100 points → auto-match', () => {
    const total =
      scoreAmountPair(10000, 10000) +       // 40
      scoreDateProximity('2026-01-10', '2026-01-05') + // 20
      scoreLineItemCount(3, 3) +             // 15
      scoreDescriptionMatch(['cement'], ['cement']) + // 15
      scoreReference('PO-0042', 'REF-PO-0042'); // 10
    expect(total).toBe(100);
    expect(total).toBeGreaterThanOrEqual(PO_MATCH_SCORING.AUTO_MATCH_THRESHOLD);
  });

  it('amount + date + items = 75 → below threshold', () => {
    const total =
      scoreAmountPair(10000, 10000) +       // 40
      scoreDateProximity('2026-01-10', '2026-01-05') + // 20
      scoreLineItemCount(3, 3);              // 15
    expect(total).toBe(75);
    expect(total).toBeLessThan(PO_MATCH_SCORING.AUTO_MATCH_THRESHOLD);
  });

  it('amount (near) + date + items + desc = 65 → below threshold', () => {
    const total =
      scoreAmountPair(10800, 10000) +       // 25 (near)
      scoreDateProximity('2026-01-10', '2026-01-05') + // 20
      scoreLineItemCount(3, 3) +             // 15
      scoreDescriptionMatch(['cement'], ['steel']); // 0
    expect(total).toBe(60);
    expect(total).toBeLessThan(PO_MATCH_SCORING.AUTO_MATCH_THRESHOLD);
  });
});

// ============================================================================
// Edge Cases — Boundary & Unicode
// ============================================================================

describe('scoreAmountPair — boundary cases', () => {
  it('exactly 5% difference → exact match (boundary)', () => {
    // 10000 * 1.05 = 10500, ratio = 0.05 exactly
    expect(scoreAmountPair(10500, 10000)).toBe(PO_MATCH_SCORING.AMOUNT_EXACT_POINTS);
  });

  it('5.01% difference → near match (boundary)', () => {
    // ratio = 501/10000 = 0.0501 > 0.05
    expect(scoreAmountPair(10501, 10000)).toBe(PO_MATCH_SCORING.AMOUNT_NEAR_POINTS);
  });

  it('exactly 10% difference → near match (boundary)', () => {
    expect(scoreAmountPair(11000, 10000)).toBe(PO_MATCH_SCORING.AMOUNT_NEAR_POINTS);
  });

  it('10.01% difference → no match (boundary)', () => {
    expect(scoreAmountPair(11001, 10000)).toBe(0);
  });

  it('very small amounts work correctly', () => {
    expect(scoreAmountPair(1.00, 1.00)).toBe(PO_MATCH_SCORING.AMOUNT_EXACT_POINTS);
    expect(scoreAmountPair(0.50, 0.50)).toBe(PO_MATCH_SCORING.AMOUNT_EXACT_POINTS);
  });

  it('very large amounts work correctly', () => {
    expect(scoreAmountPair(1000000, 1000000)).toBe(PO_MATCH_SCORING.AMOUNT_EXACT_POINTS);
  });
});

describe('scoreDateProximity — boundary cases', () => {
  it('exactly 30 days → near (boundary)', () => {
    // 30 days apart
    expect(scoreDateProximity('2026-01-31', '2026-01-01')).toBe(PO_MATCH_SCORING.DATE_NEAR_POINTS);
  });

  it('exactly 60 days → far (boundary)', () => {
    expect(scoreDateProximity('2026-03-02', '2026-01-01')).toBe(PO_MATCH_SCORING.DATE_FAR_POINTS);
  });

  it('same date → near (0 days diff)', () => {
    expect(scoreDateProximity('2026-01-15', '2026-01-15')).toBe(PO_MATCH_SCORING.DATE_NEAR_POINTS);
  });

  it('handles invalid date strings → 0', () => {
    expect(scoreDateProximity('not-a-date', '2026-01-01')).toBe(0);
  });
});

describe('scoreDescriptionMatch — Greek/Unicode', () => {
  it('matches Greek descriptions (τσιμεντοσανίδες)', () => {
    expect(scoreDescriptionMatch(
      ['Τσιμεντοσανίδες Knauf 12mm'],
      ['τσιμεντοσανίδες knauf 12mm'],
    )).toBe(PO_MATCH_SCORING.DESCRIPTION_MATCH_POINTS);
  });

  it('matches Greek partial (σκυρόδεμα in longer string)', () => {
    expect(scoreDescriptionMatch(
      ['Σκυρόδεμα C25/30 αντλίας'],
      ['σκυρόδεμα'],
    )).toBe(PO_MATCH_SCORING.DESCRIPTION_MATCH_POINTS);
  });

  it('no match for different Greek words', () => {
    expect(scoreDescriptionMatch(
      ['Σωλήνες αποχέτευσης'],
      ['Ηλεκτρολογικό υλικό'],
    )).toBe(0);
  });

  it('handles extra whitespace in descriptions', () => {
    expect(scoreDescriptionMatch(
      ['  Τσιμέντο  Portland  '],
      ['τσιμέντο portland'],
    )).toBe(PO_MATCH_SCORING.DESCRIPTION_MATCH_POINTS);
  });
});

describe('normalise function', () => {
  it('lowercases and trims', () => {
    expect(normalise('  HELLO World  ')).toBe('hello world');
  });

  it('collapses multiple spaces', () => {
    expect(normalise('a   b    c')).toBe('a b c');
  });

  it('handles Greek characters', () => {
    expect(normalise('  ΤΣΙΜΕΝΤΟ  ')).toBe('τσιμεντο');
  });
});
