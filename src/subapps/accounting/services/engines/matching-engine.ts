/**
 * @fileoverview Matching Engine — Bank Transaction Reconciliation
 * @description Αυτόματη αντιστοίχιση τραπεζικών κινήσεων ↔ εγγραφές
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-008 Bank Reconciliation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { IMatchingEngine, IAccountingRepository } from '../../types/interfaces';
import type {
  BankTransaction,
  MatchCandidate,
  MatchResult,
  MatchStatus,
} from '../../types/bank';

// ============================================================================
// MATCHING ENGINE CONFIGURATION
// ============================================================================

/** Matching parameters */
const MATCHING_CONFIG = {
  /** Ανοχή ποσού: ±5% */
  AMOUNT_TOLERANCE_PERCENT: 5,
  /** Ανοχή ημερομηνίας: ±7 ημέρες */
  DATE_PROXIMITY_DAYS: 7,
  /** Ελάχιστο confidence για auto-match */
  AUTO_MATCH_THRESHOLD: 85,
  /** Μέγιστοι υποψήφιοι ανά συναλλαγή */
  MAX_CANDIDATES: 10,
} as const;

// ============================================================================
// MATCHING ENGINE IMPLEMENTATION
// ============================================================================

/**
 * Matching Engine — Αντιστοίχιση Τραπεζικών Κινήσεων
 *
 * Αλγόριθμος scoring:
 * - Exact amount match: +40 points
 * - Near amount (±5%): +25 points
 * - Exact date match: +30 points
 * - Near date (±7 days): +15 points
 * - Counterparty match: +20 points
 * - Reference match: +10 points
 */
export class MatchingEngine implements IMatchingEngine {
  constructor(private readonly repository: IAccountingRepository) {}

  /**
   * Εύρεση υποψήφιων αντιστοιχίσεων για μία συναλλαγή
   */
  async findCandidates(transaction: BankTransaction): Promise<MatchCandidate[]> {
    const candidates: MatchCandidate[] = [];

    // 1. Search invoices
    if (transaction.direction === 'credit') {
      const invoices = await this.repository.listInvoices({
        paymentStatus: 'unpaid',
      });

      for (const inv of invoices.items) {
        const score = this.scoreInvoiceMatch(transaction, inv);
        if (score.confidence > 0) {
          candidates.push({
            entityId: inv.invoiceId,
            entityType: 'invoice',
            displayLabel: `Τιμολόγιο ${inv.series}-${inv.number} — ${inv.customer.name}`,
            amount: inv.totalGrossAmount,
            date: inv.issueDate,
            confidence: score.confidence,
            matchReasons: score.reasons,
          });
        }
      }
    }

    // 2. Search EFKA payments
    const year = parseInt(transaction.transactionDate.substring(0, 4), 10);
    const efkaPayments = await this.repository.getEFKAPayments(year);
    for (const efka of efkaPayments) {
      if (efka.status === 'paid') continue;
      const score = this.scoreEfkaMatch(transaction, efka);
      if (score.confidence > 0) {
        candidates.push({
          entityId: efka.paymentId,
          entityType: 'efka_payment',
          displayLabel: `ΕΦΚΑ ${efka.month}/${efka.year}`,
          amount: efka.amount,
          date: efka.dueDate,
          confidence: score.confidence,
          matchReasons: score.reasons,
        });
      }
    }

    // Sort by confidence descending, limit
    return candidates
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MATCHING_CONFIG.MAX_CANDIDATES);
  }

  /**
   * Εφαρμογή αντιστοίχισης
   */
  async matchTransaction(
    transactionId: string,
    entityId: string,
    entityType: MatchResult['matchedEntityType']
  ): Promise<MatchResult> {
    // Fetch candidates to get confidence
    const transaction = await this.repository.getBankTransaction(transactionId);
    if (!transaction) {
      return {
        transactionId,
        status: 'unmatched',
        matchedEntityId: null,
        matchedEntityType: null,
        confidence: null,
      };
    }

    const candidates = await this.findCandidates(transaction);
    const matchedCandidate = candidates.find(
      (c) => c.entityId === entityId && c.entityType === entityType
    );

    const status: MatchStatus = matchedCandidate && matchedCandidate.confidence >= MATCHING_CONFIG.AUTO_MATCH_THRESHOLD
      ? 'auto_matched'
      : 'manual_matched';

    await this.repository.updateBankTransaction(transactionId, {
      matchStatus: status,
      matchedEntityId: entityId,
      matchedEntityType: entityType,
      matchConfidence: matchedCandidate?.confidence ?? null,
    });

    return {
      transactionId,
      status,
      matchedEntityId: entityId,
      matchedEntityType: entityType,
      confidence: matchedCandidate?.confidence ?? null,
    };
  }

  /**
   * Μαζική αυτόματη αντιστοίχιση
   */
  async matchBatch(transactionIds: string[]): Promise<MatchResult[]> {
    const results: MatchResult[] = [];

    for (const txnId of transactionIds) {
      const transaction = await this.repository.getBankTransaction(txnId);
      if (!transaction || transaction.matchStatus !== 'unmatched') {
        results.push({
          transactionId: txnId,
          status: transaction?.matchStatus ?? 'unmatched',
          matchedEntityId: transaction?.matchedEntityId ?? null,
          matchedEntityType: transaction?.matchedEntityType ?? null,
          confidence: transaction?.matchConfidence ?? null,
        });
        continue;
      }

      const candidates = await this.findCandidates(transaction);
      const bestMatch = candidates[0];

      if (bestMatch && bestMatch.confidence >= MATCHING_CONFIG.AUTO_MATCH_THRESHOLD) {
        const result = await this.matchTransaction(
          txnId,
          bestMatch.entityId,
          bestMatch.entityType
        );
        results.push(result);
      } else {
        results.push({
          transactionId: txnId,
          status: 'unmatched',
          matchedEntityId: null,
          matchedEntityType: null,
          confidence: bestMatch?.confidence ?? null,
        });
      }
    }

    return results;
  }

  /**
   * Αναίρεση αντιστοίχισης
   */
  async unmatchTransaction(transactionId: string): Promise<void> {
    await this.repository.updateBankTransaction(transactionId, {
      matchStatus: 'unmatched',
      matchedEntityId: null,
      matchedEntityType: null,
      matchConfidence: null,
    });
  }

  // ── Scoring Helpers ───────────────────────────────────────────────────────

  private scoreInvoiceMatch(
    transaction: BankTransaction,
    invoice: { totalGrossAmount: number; issueDate: string; customer: { name: string } }
  ): { confidence: number; reasons: string[] } {
    let confidence = 0;
    const reasons: string[] = [];

    // Amount matching
    const amountDiff = Math.abs(transaction.amount - invoice.totalGrossAmount);
    const tolerance = invoice.totalGrossAmount * (MATCHING_CONFIG.AMOUNT_TOLERANCE_PERCENT / 100);

    if (amountDiff === 0) {
      confidence += 40;
      reasons.push('Ακριβές ποσό');
    } else if (amountDiff <= tolerance) {
      confidence += 25;
      reasons.push(`Κοντινό ποσό (±${MATCHING_CONFIG.AMOUNT_TOLERANCE_PERCENT}%)`);
    }

    // Date proximity
    const daysDiff = Math.abs(dateDiffDays(transaction.transactionDate, invoice.issueDate));
    if (daysDiff === 0) {
      confidence += 30;
      reasons.push('Ίδια ημερομηνία');
    } else if (daysDiff <= MATCHING_CONFIG.DATE_PROXIMITY_DAYS) {
      confidence += 15;
      reasons.push(`Κοντινή ημερομηνία (${daysDiff} ημ.)`);
    }

    // Counterparty matching (partial string match)
    if (transaction.counterparty && invoice.customer.name) {
      const normalizedCounterparty = transaction.counterparty.toLowerCase();
      const normalizedName = invoice.customer.name.toLowerCase();
      if (normalizedCounterparty.includes(normalizedName) || normalizedName.includes(normalizedCounterparty)) {
        confidence += 20;
        reasons.push('Αντιστοίχιση ονόματος');
      }
    }

    return { confidence: Math.min(confidence, 100), reasons };
  }

  private scoreEfkaMatch(
    transaction: BankTransaction,
    efka: { amount: number; dueDate: string }
  ): { confidence: number; reasons: string[] } {
    let confidence = 0;
    const reasons: string[] = [];

    // Amount matching
    const amountDiff = Math.abs(transaction.amount - efka.amount);
    const tolerance = efka.amount * (MATCHING_CONFIG.AMOUNT_TOLERANCE_PERCENT / 100);

    if (amountDiff === 0) {
      confidence += 40;
      reasons.push('Ακριβές ποσό ΕΦΚΑ');
    } else if (amountDiff <= tolerance) {
      confidence += 25;
      reasons.push('Κοντινό ποσό ΕΦΚΑ');
    }

    // Date proximity
    const daysDiff = Math.abs(dateDiffDays(transaction.transactionDate, efka.dueDate));
    if (daysDiff <= 5) {
      confidence += 30;
      reasons.push('Κοντά στην προθεσμία ΕΦΚΑ');
    } else if (daysDiff <= MATCHING_CONFIG.DATE_PROXIMITY_DAYS) {
      confidence += 15;
      reasons.push('Εντός εβδομάδας');
    }

    // Description contains EFKA keywords
    const desc = transaction.bankDescription.toLowerCase();
    if (desc.includes('εφκα') || desc.includes('efka') || desc.includes('ασφαλ')) {
      confidence += 20;
      reasons.push('Αιτιολογία ΕΦΚΑ');
    }

    return { confidence: Math.min(confidence, 100), reasons };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Difference in days between two ISO date strings
 */
function dateDiffDays(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}
