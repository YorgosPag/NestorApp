/**
 * @fileoverview Matching Rules Types — Learned Rule Patterns
 * @description Types for rule learning engine (SAP/Midday pattern)
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-30
 * @version 1.0.0
 * @see DECISIONS-PHASE-2.md Q5 — Advanced Learning
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { MatchableEntityType } from './bank';
import type { AccountCategory } from './common';

// ============================================================================
// RULE STATUS
// ============================================================================

/** Status of a learned matching rule */
export type RuleStatus = 'active' | 'disabled';

// ============================================================================
// RULE PATTERN — What triggers the rule
// ============================================================================

/**
 * Pattern extracted from bank transaction descriptions
 *
 * A rule matches when the transaction's normalized merchant name
 * contains the pattern's merchantName, amount falls within range,
 * and at least one keyword matches.
 */
export interface RulePattern {
  /** Normalized merchant/counterparty name (lowercase, no accents) */
  merchantName: string;
  /** Amount range: minimum (inclusive) */
  amountMin: number;
  /** Amount range: maximum (inclusive) */
  amountMax: number;
  /** Description keywords (normalized, top 3 significant tokens) */
  descriptionKeywords: string[];
}

// ============================================================================
// RULE TARGET — What the rule maps to
// ============================================================================

/** The target entity that matched transactions should be linked to */
export interface RuleTarget {
  /** Entity type to match against */
  entityType: MatchableEntityType;
  /** Accounting category (null = any category) */
  category: AccountCategory | null;
  /** Specific entity ID (null = match any entity of this type) */
  specificEntityId: string | null;
}

// ============================================================================
// LEARNED RULE — Full document
// ============================================================================

/**
 * A learned matching rule stored in Firestore
 *
 * Created automatically when a user manually matches a bank transaction.
 * Confidence increases with confirmations (+5%), decreases with rejections (-15%).
 * Rules below 50% confidence are automatically disabled.
 * 90-day rolling calibration window — unused rules decay.
 *
 * Firestore path: `accounting_matching_rules/{ruleId}`
 */
export interface LearnedRule {
  /** Unique ID (Firestore doc ID, prefix: mrule_) */
  ruleId: string;
  /** Pattern that triggers this rule */
  pattern: RulePattern;
  /** Target entity mapping */
  target: RuleTarget;
  /** Confidence score (0-100), starts at 60 */
  confidence: number;
  /** Number of times user confirmed this rule */
  confirmations: number;
  /** Number of times user rejected this rule */
  rejections: number;
  /** Active or disabled */
  status: RuleStatus;
  /** Timestamp created (ISO 8601) */
  createdAt: string;
  /** Last time user confirmed a match using this rule (ISO 8601) */
  lastConfirmedAt: string | null;
  /** Last time this rule was used in scoring (ISO 8601) */
  lastUsedAt: string | null;
  /** Timestamp last updated (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// INPUT TYPE
// ============================================================================

/** Input for creating a new learned rule */
export type CreateLearnedRuleInput = Omit<
  LearnedRule,
  'ruleId' | 'confirmations' | 'rejections' | 'createdAt' | 'lastConfirmedAt' | 'lastUsedAt' | 'updatedAt'
>;
