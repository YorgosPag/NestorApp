/**
 * @fileoverview Rule Learning Engine — Pattern Recording & Calibration
 * @description Learns from manual matches, tracks confidence, 90-day decay
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-30
 * @version 1.0.0
 * @see DECISIONS-PHASE-2.md Q5 — Advanced Learning (SAP/Midday pattern)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { BankTransaction, MatchableEntityType } from '../../types/bank';
import type { AccountCategory } from '../../types/common';
import type { LearnedRule, RulePattern, RuleTarget } from '../../types/matching-rules';
import { normalizeGreek, tokenize } from './matching-scoring';
import {
  createMatchingRule,
  findRuleByPattern,
  findRuleByMerchant,
  updateMatchingRule,
  disableStaleRules,
} from '../repository/matching-rules-repo';
import { isoNow } from '../repository/firestore-helpers';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Initial confidence for new rules */
const INITIAL_CONFIDENCE = 60;

/** Confidence boost per confirmation */
const CONFIRM_BONUS = 5;

/** Confidence penalty per rejection */
const REJECT_PENALTY = 15;

/** Minimum confidence before auto-disable */
const MIN_CONFIDENCE = 50;

/** Maximum confidence (cap) */
const MAX_CONFIDENCE = 100;

/** Calibration window in days */
const CALIBRATION_WINDOW_DAYS = 90;

/** Amount range tolerance: ±20% around the recorded amount */
const AMOUNT_RANGE_TOLERANCE = 0.20;

/** Maximum bonus points a learned rule can add to scoring */
const MAX_RULE_BONUS = 15;

/** Minimum rule confidence to apply bonus */
const MIN_BONUS_CONFIDENCE = 60;

// ============================================================================
// RULE LEARNING ENGINE
// ============================================================================

export class RuleLearningEngine {

  // ── Record a Manual Match ────────────────────────────────────────────────

  /**
   * Record a pattern from a manual match
   *
   * Extracts merchant name, amount range, and keywords from the transaction.
   * If a matching rule already exists (same merchant + entity type), updates it
   * instead of creating a duplicate.
   */
  async recordMatch(
    transaction: BankTransaction,
    entityId: string,
    entityType: MatchableEntityType,
    category: AccountCategory | null = null
  ): Promise<LearnedRule> {
    const merchantName = extractMerchantPattern(transaction);
    if (!merchantName) {
      // Cannot create a rule without a merchant pattern
      return this.createNewRule(transaction, entityId, entityType, category, '');
    }

    // Check for existing rule (same merchant + entity type)
    const existing = await findRuleByPattern(merchantName, entityType);

    if (existing) {
      // Update existing: confirm + refresh
      const newConfidence = Math.min(existing.confidence + CONFIRM_BONUS, MAX_CONFIDENCE);
      const now = isoNow();

      await updateMatchingRule(existing.ruleId, {
        confidence: newConfidence,
        confirmations: existing.confirmations + 1,
        lastConfirmedAt: now,
        lastUsedAt: now,
        status: 'active',
        target: {
          entityType,
          category: category ?? existing.target.category,
          specificEntityId: entityId,
        },
      });

      return {
        ...existing,
        confidence: newConfidence,
        confirmations: existing.confirmations + 1,
        lastConfirmedAt: now,
        lastUsedAt: now,
        updatedAt: now,
      };
    }

    return this.createNewRule(transaction, entityId, entityType, category, merchantName);
  }

  // ── Confirm / Reject ─────────────────────────────────────────────────────

  /**
   * Confirm a rule — user accepted a match suggested by this rule
   * +5% confidence
   */
  async confirmRule(ruleId: string): Promise<void> {
    const rule = await this.getRule(ruleId);
    if (!rule) return;

    const newConfidence = Math.min(rule.confidence + CONFIRM_BONUS, MAX_CONFIDENCE);
    const now = isoNow();

    await updateMatchingRule(ruleId, {
      confidence: newConfidence,
      confirmations: rule.confirmations + 1,
      lastConfirmedAt: now,
      lastUsedAt: now,
    });
  }

  /**
   * Reject a rule — user dismissed a match suggested by this rule
   * -15% confidence, auto-disable if below 50%
   */
  async rejectRule(ruleId: string): Promise<void> {
    const rule = await this.getRule(ruleId);
    if (!rule) return;

    const newConfidence = Math.max(rule.confidence - REJECT_PENALTY, 0);
    const now = isoNow();

    await updateMatchingRule(ruleId, {
      confidence: newConfidence,
      rejections: rule.rejections + 1,
      lastUsedAt: now,
      status: newConfidence < MIN_CONFIDENCE ? 'disabled' : 'active',
    });
  }

  // ── Rule Lookup ──────────────────────────────────────────────────────────

  /**
   * Find a matching rule for a transaction
   *
   * Looks up by normalized merchant name. Returns the highest-confidence
   * active rule, or null if none found.
   */
  async findMatchingRule(
    transaction: BankTransaction
  ): Promise<LearnedRule | null> {
    const merchantName = extractMerchantPattern(transaction);
    if (!merchantName) return null;

    const rule = await findRuleByMerchant(merchantName);
    if (!rule) return null;

    // Check amount range
    if (
      transaction.amount < rule.pattern.amountMin ||
      transaction.amount > rule.pattern.amountMax
    ) {
      return null;
    }

    return rule;
  }

  /**
   * Get bonus scoring points for a transaction based on learned rules
   *
   * Returns 0-15 points based on rule confidence:
   * - Rule confidence 60-70: +5 points
   * - Rule confidence 70-85: +10 points
   * - Rule confidence 85+: +15 points
   * - Matching entity type gets full bonus, different type gets half
   */
  async getRuleBonus(
    transaction: BankTransaction,
    candidateEntityType: MatchableEntityType
  ): Promise<number> {
    const rule = await this.findMatchingRule(transaction);
    if (!rule || rule.confidence < MIN_BONUS_CONFIDENCE) return 0;

    // Update lastUsedAt
    await updateMatchingRule(rule.ruleId, { lastUsedAt: isoNow() });

    let bonus: number;
    if (rule.confidence >= 85) {
      bonus = MAX_RULE_BONUS;
    } else if (rule.confidence >= 70) {
      bonus = 10;
    } else {
      bonus = 5;
    }

    // Half bonus if entity type doesn't match the learned pattern
    if (rule.target.entityType !== candidateEntityType) {
      bonus = Math.round(bonus / 2);
    }

    return bonus;
  }

  // ── Calibration ──────────────────────────────────────────────────────────

  /**
   * Run 90-day calibration — disable stale rules
   *
   * Disables rules that:
   * 1. Have confidence below 50%
   * 2. Haven't been confirmed in the last 90 days
   */
  async calibrate(): Promise<{ disabled: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CALIBRATION_WINDOW_DAYS);
    const cutoffIso = cutoffDate.toISOString();

    const disabled = await disableStaleRules(cutoffIso);
    return { disabled };
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  private async getRule(ruleId: string): Promise<LearnedRule | null> {
    const { getMatchingRule } = await import('../repository/matching-rules-repo');
    return getMatchingRule(ruleId);
  }

  private async createNewRule(
    transaction: BankTransaction,
    entityId: string,
    entityType: MatchableEntityType,
    category: AccountCategory | null,
    merchantName: string
  ): Promise<LearnedRule> {
    const pattern = buildPattern(transaction, merchantName);
    const target: RuleTarget = {
      entityType,
      category,
      specificEntityId: entityId,
    };

    const { id } = await createMatchingRule({
      pattern,
      target,
      confidence: INITIAL_CONFIDENCE,
      status: 'active',
    });

    const now = isoNow();
    return {
      ruleId: id,
      pattern,
      target,
      confidence: INITIAL_CONFIDENCE,
      confirmations: 0,
      rejections: 0,
      status: 'active',
      createdAt: now,
      lastConfirmedAt: null,
      lastUsedAt: null,
      updatedAt: now,
    };
  }
}

// ============================================================================
// PATTERN EXTRACTION HELPERS
// ============================================================================

/**
 * Extract a normalized merchant pattern from a bank transaction
 *
 * Priority: counterparty > first 3 significant tokens of description
 */
function extractMerchantPattern(transaction: BankTransaction): string {
  if (transaction.counterparty) {
    return normalizeGreek(transaction.counterparty);
  }

  const tokens = tokenize(transaction.bankDescription);
  if (tokens.length === 0) return '';

  // Use first 3 significant tokens as merchant identifier
  return tokens.slice(0, 3).join(' ');
}

/**
 * Build a full pattern from a transaction
 */
function buildPattern(
  transaction: BankTransaction,
  merchantName: string
): RulePattern {
  const amountRange = extractAmountRange(transaction.amount);
  const keywords = extractDescriptionKeywords(transaction.bankDescription);

  return {
    merchantName: merchantName || extractMerchantPattern(transaction),
    amountMin: amountRange.min,
    amountMax: amountRange.max,
    descriptionKeywords: keywords,
  };
}

/**
 * Calculate ±20% amount range around a value
 */
function extractAmountRange(amount: number): { min: number; max: number } {
  const tolerance = amount * AMOUNT_RANGE_TOLERANCE;
  return {
    min: Math.max(0, Math.round((amount - tolerance) * 100) / 100),
    max: Math.round((amount + tolerance) * 100) / 100,
  };
}

/**
 * Extract top 3 significant keywords from description
 *
 * Filters out common Greek stop words and short tokens.
 */
function extractDescriptionKeywords(description: string): string[] {
  const stopWords = new Set([
    'και', 'στο', 'στη', 'στον', 'στην', 'απο', 'για', 'με', 'σε',
    'του', 'της', 'των', 'τον', 'την', 'το', 'τα', 'τις', 'τους',
    'ενα', 'μια', 'εις', 'δυο', 'the', 'and', 'for', 'from', 'with',
  ]);

  const tokens = tokenize(description);
  const significant = tokens.filter(
    (t) => t.length >= 3 && !stopWords.has(t) && !/^\d+$/.test(t)
  );

  return significant.slice(0, 3);
}
