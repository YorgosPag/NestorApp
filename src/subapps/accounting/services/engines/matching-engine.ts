/**
 * @fileoverview Matching Engine — SAP/Midday Weighted Scoring + N:M Matching
 * @description Enterprise bank reconciliation engine with weighted scoring algorithm
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 2.1.0
 * @see DECISIONS-PHASE-2.md Q1 (weighted scoring), Q2 (thresholds), Q3 (N:M), Q5 (rule learning)
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
import {
  calculateMatchScore,
  classifyTier,
} from './matching-scoring';
import {
  type RawCandidate,
  transactionToScoringInput,
  invoiceToRawCandidate,
  journalToRawCandidate,
  efkaToRawCandidate,
  taxToRawCandidate,
  emptyMatchResult,
} from './matching-adapters';
import {
  findMatchingCombinations,
  preFilterCandidates,
  type CombinationCandidate,
} from './matching-combination';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import { generateMatchGroupId } from '@/services/enterprise-id.service';
import type { RuleLearningEngine } from './rule-learning-engine';

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

  constructor(
    private readonly repository: IAccountingRepository,
    private readonly ruleLearning?: RuleLearningEngine
  ) {}

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

      // Apply learned rule bonus (Phase 2b)
      let finalScore = result.totalScore;
      const reasons = [...result.reasons];

      if (this.ruleLearning) {
        const bonus = await this.ruleLearning.getRuleBonus(transaction, raw.entityType);
        if (bonus > 0) {
          finalScore = Math.min(finalScore + bonus, 100);
          reasons.push(`Μαθημένος κανόνας (+${bonus})`);
        }
      }

      const tier = classifyTier(finalScore, config.thresholds);
      if (tier === 'no_match') continue;

      candidates.push({
        entityId: raw.entityId,
        entityType: raw.entityType,
        displayLabel: raw.displayLabel,
        amount: raw.scoring.amount,
        date: raw.scoring.date,
        confidence: finalScore,
        matchReasons: reasons,
        tier,
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

    // Record learned rule from manual matches (Phase 2b)
    if (this.ruleLearning && entityType) {
      await this.ruleLearning.recordMatch(transaction, entityId, entityType).catch(() => {
        // Rule recording is non-critical — don't block the match
      });
    }

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

