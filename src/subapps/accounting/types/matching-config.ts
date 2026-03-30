/**
 * @fileoverview Matching Engine Configuration Types
 * @description Weighted scoring config + configurable thresholds (SAP/Midday pattern)
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-30
 * @version 2.0.0
 * @see DECISIONS-PHASE-2.md Q1, Q2, Q3
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

// ============================================================================
// SCORING WEIGHTS
// ============================================================================

/**
 * Weight distribution for scoring factors
 *
 * Based on Midday.ai open-source pattern:
 * - Description (50%): strongest signal — bank descriptions often contain invoice refs
 * - Amount (35%): second strongest — amount matching is reliable but not unique
 * - Currency (10%): prevents cross-currency false positives
 * - Date (5%): weakest signal — payment dates often differ from invoice dates
 *
 * Weights MUST sum to 1.0
 */
export interface MatchingScoringWeights {
  /** Weight for amount matching (default 0.35) */
  readonly amount: number;
  /** Weight for description/keyword matching (default 0.50) */
  readonly description: number;
  /** Weight for currency matching (default 0.10) */
  readonly currency: number;
  /** Weight for date proximity matching (default 0.05) */
  readonly date: number;
}

// ============================================================================
// CONFIDENCE THRESHOLDS
// ============================================================================

/**
 * Configurable confidence thresholds (Q2 decision)
 *
 * Stored in Firestore `accounting_settings/matching_config`
 * All values 0-100. UI sliders in Settings page (Phase 2d).
 *
 * IMPORTANT: Even auto-matched items require manual approval (Q2 decision).
 * "auto_match" means pre-selected in the UI, NOT auto-cleared.
 */
export interface MatchingThresholds {
  /** Score ≥ this → pre-selected for batch approval (default 95) */
  readonly autoMatchThreshold: number;
  /** Score ≥ this → suggested to user (default 85) */
  readonly suggestThreshold: number;
  /** Score ≥ this → shown as possible match (default 70) */
  readonly manualThreshold: number;
}

// ============================================================================
// FULL MATCHING CONFIG
// ============================================================================

/** Complete matching engine configuration */
export interface MatchingConfig {
  /** Scoring factor weights */
  readonly weights: MatchingScoringWeights;
  /** Confidence tier thresholds */
  readonly thresholds: MatchingThresholds;
  /** Amount tolerance percentage for scoring (default 5) */
  readonly amountTolerancePercent: number;
  /** Date proximity tolerance in days (default 7) */
  readonly dateProximityDays: number;
  /** Maximum candidates per transaction (default 10) */
  readonly maxCandidates: number;
  /** Maximum entities in a single N:M combination (default 5) */
  readonly maxCombinationSize: number;
  /** Maximum entities to consider for N:M combinations (default 8) */
  readonly maxCombinationEntities: number;
}

// ============================================================================
// DEFAULTS — SAP/Midday industry standard
// ============================================================================

/** Default matching config — used when no Firestore override exists */
export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  weights: {
    amount: 0.35,
    description: 0.50,
    currency: 0.10,
    date: 0.05,
  },
  thresholds: {
    autoMatchThreshold: 95,
    suggestThreshold: 85,
    manualThreshold: 70,
  },
  amountTolerancePercent: 5,
  dateProximityDays: 7,
  maxCandidates: 10,
  maxCombinationSize: 5,
  maxCombinationEntities: 8,
} as const;
