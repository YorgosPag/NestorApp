/**
 * @fileoverview Matching Engine — SAP/Midday Weighted Scoring + N:M Matching
 * @description Enterprise bank reconciliation engine with weighted scoring algorithm
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 2.0.0
 * @see DECISIONS-PHASE-2.md Q1 (weighted scoring), Q2 (thresholds), Q3 (N:M)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { IMatchingEngine, IAccountingRepository } from '../../types/interfaces';
import type {
  BankTransaction,
  MatchCandidate,
  MatchCandidateGroup,
  MatchResult,
  MatchedEntityRef,
  MatchableEntityType,
} from '../../types/bank';
import type { MatchingConfig } from '../../types/matching-config';
import { DEFAULT_MATCHING_CONFIG } from '../../types/matching-config';
import type { Invoice } from '../../types/invoice';
import type { JournalEntry } from '../../types/journal';
import type { EFKAPayment } from '../../types/efka';
import type { TaxInstallment } from '../../types/tax';
import {
  calculateMatchScore,
  classifyTier,
  type ScoringCandidateInput,
  type ScoringTransactionInput,
} from './matching-scoring';
import {
  findMatchingCombinations,
  preFilterCandidates,
  type CombinationCandidate,
} from './matching-combination';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import { generateMatchGroupId } from '@/services/enterprise-id.service';

// ============================================================================
// FIRESTORE CONFIG LOADER
// ============================================================================

async function loadMatchingConfig(): Promise<MatchingConfig | null> {
  try {
    const { getFirestore } = await import('firebase/firestore');
    const { doc, getDoc } = await import('firebase/firestore');
    const { getApp } = await import('firebase/app');
    const db = getFirestore(getApp());
    const docRef = doc(db, COLLECTIONS.ACCOUNTING_SETTINGS, SYSTEM_DOCS.ACCT_MATCHING_CONFIG);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as MatchingConfig;
  } catch {
    return null;
  }
}

// ============================================================================
// MATCHING ENGINE
// ============================================================================

export class MatchingEngine implements IMatchingEngine {
  private configCache: MatchingConfig | null = null;

  constructor(private readonly repository: IAccountingRepository) {}

  // ── Config ────────────────────────────────────────────────────────────────

  async getConfig(): Promise<MatchingConfig> {
    if (this.configCache) return this.configCache;
    const stored = await loadMatchingConfig();
    this.configCache = stored ?? DEFAULT_MATCHING_CONFIG;
    return this.configCache;
  }

  // ── 1:1 Candidate Search ─────────────────────────────────────────────────

  async findCandidates(transaction: BankTransaction): Promise<MatchCandidate[]> {
    const config = await this.getConfig();
    const txnInput = transactionToScoringInput(transaction);
    const candidates: MatchCandidate[] = [];

    const rawCandidates = await this.gatherAllCandidates(transaction);

    for (const raw of rawCandidates) {
      const result = calculateMatchScore(txnInput, raw.scoring, config);
      if (result.tier === 'no_match') continue;

      candidates.push({
        entityId: raw.entityId,
        entityType: raw.entityType,
        displayLabel: raw.displayLabel,
        amount: raw.scoring.amount,
        date: raw.scoring.date,
        confidence: result.totalScore,
        matchReasons: result.reasons,
        tier: result.tier,
      });
    }

    return candidates
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, config.maxCandidates);
  }

  // ── N:M Candidate Groups ─────────────────────────────────────────────────

  async findCandidateGroups(
    transactions: BankTransaction[]
  ): Promise<MatchCandidateGroup[]> {
    if (transactions.length === 0) return [];

    const config = await this.getConfig();
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

    // Gather all possible candidates from the first transaction's context
    const firstTxn = transactions[0]!;
    const rawCandidates = await this.gatherAllCandidates(firstTxn);

    // Pre-filter for combination search
    const comboCandidates: CombinationCandidate[] = rawCandidates.map((c) => ({
      entityId: c.entityId,
      entityType: c.entityType,
      amount: c.scoring.amount,
    }));

    const filtered = preFilterCandidates(
      comboCandidates,
      totalAmount,
      config.maxCombinationEntities
    );

    const combinations = findMatchingCombinations({
      targetAmount: totalAmount,
      candidates: filtered,
      tolerancePercent: config.amountTolerancePercent,
      maxCombinationSize: config.maxCombinationSize,
    });

    // Score each combination
    const txnInput = transactionToScoringInput(firstTxn);
    const groups: MatchCandidateGroup[] = [];

    for (const combo of combinations) {
      const candidateDetails: MatchCandidate[] = [];
      let totalScore = 0;
      const allReasons: string[] = [];

      for (const entity of combo.entities) {
        const raw = rawCandidates.find((r) => r.entityId === entity.entityId);
        if (!raw) continue;

        const result = calculateMatchScore(txnInput, raw.scoring, config);
        totalScore += result.totalScore;
        allReasons.push(...result.reasons);

        candidateDetails.push({
          entityId: raw.entityId,
          entityType: raw.entityType,
          displayLabel: raw.displayLabel,
          amount: raw.scoring.amount,
          date: raw.scoring.date,
          confidence: result.totalScore,
          matchReasons: result.reasons,
          tier: result.tier,
        });
      }

      const avgScore = combo.entities.length > 0
        ? Math.round(totalScore / combo.entities.length)
        : 0;

      // Boost score if total amount matches closely
      const amountBonus = combo.residual === 0 ? 5 : 0;
      const finalScore = Math.min(avgScore + amountBonus, 100);
      const tier = classifyTier(finalScore, config.thresholds);

      if (tier === 'no_match') continue;

      groups.push({
        groupId: generateMatchGroupId(),
        candidates: candidateDetails,
        totalAmount: combo.totalAmount,
        confidence: finalScore,
        displayLabel: `Ομάδα ${combo.entities.length} εγγραφών (€${combo.totalAmount.toFixed(2)})`,
        matchReasons: [...new Set(allReasons)],
        tier,
      });
    }

    return groups.sort((a, b) => b.confidence - a.confidence);
  }

  // ── 1:1 Match Execution ──────────────────────────────────────────────────

  async matchTransaction(
    transactionId: string,
    entityId: string,
    entityType: MatchableEntityType | null
  ): Promise<MatchResult> {
    const transaction = await this.repository.getBankTransaction(transactionId);
    if (!transaction) {
      return emptyMatchResult(transactionId);
    }

    const candidates = await this.findCandidates(transaction);
    const matched = candidates.find(
      (c) => c.entityId === entityId && c.entityType === entityType
    );

    const config = await this.getConfig();
    const confidence = matched?.confidence ?? null;
    const status = confidence !== null && confidence >= config.thresholds.autoMatchThreshold
      ? 'auto_matched' as const
      : 'manual_matched' as const;

    await this.repository.updateBankTransaction(transactionId, {
      matchStatus: status,
      matchedEntityId: entityId,
      matchedEntityType: entityType,
      matchConfidence: confidence,
    });

    return {
      transactionId,
      status,
      matchedEntityId: entityId,
      matchedEntityType: entityType,
      confidence,
    };
  }

  // ── N:M Match Execution ──────────────────────────────────────────────────

  async matchGroup(
    transactionIds: string[],
    entityRefs: MatchedEntityRef[]
  ): Promise<MatchResult[]> {
    const matchGroupId = generateMatchGroupId();
    const results: MatchResult[] = [];

    for (const txnId of transactionIds) {
      await this.repository.updateBankTransaction(txnId, {
        matchStatus: 'manual_matched',
        matchedEntityId: matchGroupId,
        matchedEntityType: entityRefs[0]?.entityType ?? null,
        matchConfidence: null,
        matchGroupId,
        matchedEntities: entityRefs,
      });

      results.push({
        transactionId: txnId,
        status: 'manual_matched',
        matchedEntityId: matchGroupId,
        matchedEntityType: entityRefs[0]?.entityType ?? null,
        confidence: null,
        matchGroupId,
        transactionIds,
        matchedEntities: entityRefs,
      });
    }

    return results;
  }

  // ── Batch Matching ───────────────────────────────────────────────────────

  async matchBatch(transactionIds: string[]): Promise<MatchResult[]> {
    const config = await this.getConfig();
    const results: MatchResult[] = [];

    // 1st pass: 1:1 matching
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
      const best = candidates[0];

      if (best && best.confidence >= config.thresholds.autoMatchThreshold) {
        const result = await this.matchTransaction(
          txnId,
          best.entityId,
          best.entityType
        );
        results.push(result);
      } else {
        results.push({
          transactionId: txnId,
          status: 'unmatched',
          matchedEntityId: null,
          matchedEntityType: null,
          confidence: best?.confidence ?? null,
        });
      }
    }

    return results;
  }

  // ── Unmatch ──────────────────────────────────────────────────────────────

  async unmatchTransaction(transactionId: string): Promise<void> {
    await this.repository.updateBankTransaction(transactionId, {
      matchStatus: 'unmatched',
      matchedEntityId: null,
      matchedEntityType: null,
      matchConfidence: null,
      matchGroupId: null,
      matchedEntities: null,
    });
  }

  async unmatchGroup(matchGroupId: string): Promise<void> {
    const { items } = await this.repository.listBankTransactions(
      { matchGroupId },
      100
    );

    for (const txn of items) {
      await this.unmatchTransaction(txn.transactionId);
    }
  }

  // ── Candidate Gathering ──────────────────────────────────────────────────

  private async gatherAllCandidates(
    transaction: BankTransaction
  ): Promise<RawCandidate[]> {
    const year = parseInt(transaction.transactionDate.substring(0, 4), 10);
    const candidates: RawCandidate[] = [];

    // 1. Invoices (unpaid/partial) — for credit transactions
    if (transaction.direction === 'credit') {
      const [unpaid, partial] = await Promise.all([
        this.repository.listInvoices({ paymentStatus: 'unpaid' }, 100),
        this.repository.listInvoices({ paymentStatus: 'partial' }, 100),
      ]);

      for (const inv of [...unpaid.items, ...partial.items]) {
        candidates.push(invoiceToRawCandidate(inv));
      }
    }

    // 2. Journal entries (active, same fiscal year)
    const journals = await this.repository.listJournalEntries(
      { fiscalYear: year },
      100
    );
    for (const je of journals.items) {
      if (je.status !== 'ACTIVE') continue;
      candidates.push(journalToRawCandidate(je));
    }

    // 3. EFKA payments (unpaid)
    const efkaPayments = await this.repository.getEFKAPayments(year);
    for (const efka of efkaPayments) {
      if (efka.status === 'paid') continue;
      candidates.push(efkaToRawCandidate(efka));
    }

    // 4. Tax installments (unpaid)
    const taxInstallments = await this.repository.getTaxInstallments(year);
    for (const tax of taxInstallments) {
      if (tax.status === 'paid') continue;
      candidates.push(taxToRawCandidate(tax));
    }

    return candidates;
  }
}

// ============================================================================
// RAW CANDIDATE TYPE & ADAPTERS
// ============================================================================

interface RawCandidate {
  entityId: string;
  entityType: MatchableEntityType;
  displayLabel: string;
  scoring: ScoringCandidateInput;
}

function transactionToScoringInput(txn: BankTransaction): ScoringTransactionInput {
  return {
    amount: txn.amount,
    currency: txn.currency,
    bankDescription: txn.bankDescription,
    counterparty: txn.counterparty,
    paymentReference: txn.paymentReference,
    transactionDate: txn.transactionDate,
  };
}

function invoiceToRawCandidate(inv: Invoice): RawCandidate {
  return {
    entityId: inv.invoiceId,
    entityType: 'invoice',
    displayLabel: `Τιμολόγιο ${inv.series}-${inv.number} — ${inv.customer.name}`,
    scoring: {
      amount: inv.balanceDue > 0 ? inv.balanceDue : inv.totalGrossAmount,
      currency: inv.currency,
      description: `${inv.series}-${inv.number} ${inv.customer.name}`,
      date: inv.issueDate,
      counterpartyName: inv.customer.name,
      reference: `${inv.series}-${inv.number}`,
    },
  };
}

function journalToRawCandidate(je: JournalEntry): RawCandidate {
  return {
    entityId: je.entryId,
    entityType: 'journal_entry',
    displayLabel: `Εγγραφή ${je.entryId.substring(0, 8)} — ${je.description}`,
    scoring: {
      amount: je.grossAmount,
      currency: 'EUR',
      description: je.description,
      date: je.date,
      counterpartyName: je.contactName,
      reference: je.invoiceId,
    },
  };
}

function efkaToRawCandidate(efka: EFKAPayment): RawCandidate {
  return {
    entityId: efka.paymentId,
    entityType: 'efka_payment',
    displayLabel: `ΕΦΚΑ ${efka.month}/${efka.year}`,
    scoring: {
      amount: efka.amount,
      currency: 'EUR',
      description: `ΕΦΚΑ ασφαλιστικές εισφορές ${efka.month}/${efka.year}`,
      date: efka.dueDate,
      counterpartyName: 'ΕΦΚΑ',
      reference: null,
    },
  };
}

function taxToRawCandidate(tax: TaxInstallment): RawCandidate {
  return {
    entityId: `tax_${tax.installmentNumber}`,
    entityType: 'tax_payment',
    displayLabel: `Φόρος δόση ${tax.installmentNumber}`,
    scoring: {
      amount: tax.amount,
      currency: 'EUR',
      description: `Φόρος εισοδήματος δόση ${tax.installmentNumber}`,
      date: tax.dueDate,
      counterpartyName: 'ΑΑΔΕ',
      reference: null,
    },
  };
}

function emptyMatchResult(transactionId: string): MatchResult {
  return {
    transactionId,
    status: 'unmatched',
    matchedEntityId: null,
    matchedEntityType: null,
    confidence: null,
  };
}
