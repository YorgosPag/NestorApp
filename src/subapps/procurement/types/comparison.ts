import type { BidLevelingResult } from './bid-leveling';

// ============================================================================
// COMPARISON WEIGHTS & TEMPLATES — ADR-327 §17 Q11
// ============================================================================

export interface ComparisonWeights {
  price: number;
  supplier: number;
  terms: number;
  delivery: number;
}

export const COMPARISON_TEMPLATES: Record<string, { labelEl: string; labelEn: string; weights: ComparisonWeights }> = {
  standard:  { labelEl: 'Τυπικό',        labelEn: 'Standard',   weights: { price: 0.50, supplier: 0.25, terms: 0.15, delivery: 0.10 } },
  commodity: { labelEl: 'Εμπορεύματα',  labelEn: 'Commodity',  weights: { price: 0.70, supplier: 0.15, terms: 0.10, delivery: 0.05 } },
  specialty: { labelEl: 'Ειδικότητα',   labelEn: 'Specialty',  weights: { price: 0.35, supplier: 0.35, terms: 0.15, delivery: 0.15 } },
  urgent:    { labelEl: 'Επείγον',      labelEn: 'Urgent',     weights: { price: 0.35, supplier: 0.25, terms: 0.05, delivery: 0.35 } },
} as const;

export const DEFAULT_COMPARISON_TEMPLATE_ID = 'standard';

// ============================================================================
// TCO NORMALIZATION — ADR-331
// ============================================================================

export interface TcoNormalization {
  normalizedTotal: number;
  vatDelta: number;
  laborFlag: boolean;
  deliveryFlag: boolean;
  warrantyText: string | null;
  vatIncluded: boolean | null;
  laborIncluded: boolean | null;
  /**
   * ADR-327 §8.5 — εξισορρόπηση γραμμών (με ΦΠΑ): εξισορροπημένο − υποβληθέν καθαρό, επί (1 + ΦΠΑ).
   * Θετικό = η προσφορά άφησε κενά (καλύφθηκαν με ορατό ποσό) ή τιμολόγησε μικρότερη ποσότητα από το RFQ.
   * Ήδη μέσα στο `normalizedTotal`.
   */
  levelingDelta: number;
}

// ============================================================================
// COMPARISON RESULT — ADR-327 §8.4
// ============================================================================

export interface QuoteScoreBreakdown {
  price: number;
  supplier: number;
  terms: number;
  delivery: number;
}

export interface QuoteComparisonEntry {
  quoteId: string;
  vendorName: string;
  vendorContactId: string;
  total: number;
  tco: TcoNormalization;
  score: number;
  breakdown: QuoteScoreBreakdown;
  rank: number;
  flags: Array<'cheapest' | 'most_reliable' | 'fastest_delivery' | 'best_terms' | 'risk_low_score'>;
  supplierScore: number | null;
  hasRiskFlags: boolean;
}

export interface ComparisonRecommendation {
  quoteId: string;
  reason: string;
  confidence: number;
  deltaFromSecond: number;
}

export interface QuoteComparisonResult {
  rfqId: string | null;
  adhocGroupKey: string | null;
  quoteCount: number;
  quotes: QuoteComparisonEntry[];
  recommendation: ComparisonRecommendation | null;
  weights: ComparisonWeights;
  templateId: string;
  computedAt: string;
  /** ADR-327 §8.5 — ο πίνακας γραμμή RFQ × προσφορά (κενός όταν το RFQ δεν έχει γραμμές). */
  leveling: BidLevelingResult;
}

// ============================================================================
// PER-LINE COMPARISON (cherry_pick mode) — ADR-327 §17 Q12
// ============================================================================

export interface LineWinner {
  rfqLineId: string;
  lineDescription: string;
  categoryCode: string | null;
  winnerQuoteId: string;
  winnerVendorName: string;
  winnerUnitPrice: number;
  /** Η συγκρίσιμη αξία της γραμμής (τιμή μονάδας × ποσότητα RFQ). */
  winnerAmount: number;
  savings: number;
  savingsPercent: number;
}

export interface CherryPickResult {
  lineWinners: LineWinner[];
  /** Γραμμές RFQ χωρίς καμία συγκρίσιμη τιμή — εκτός του `totalIfCherryPick`. */
  uncoveredLines: number;
  totalIfCherryPick: number;
  totalIfWholePackage: number;
  savingsFromSplit: number;
  savingsPercent: number;
}
