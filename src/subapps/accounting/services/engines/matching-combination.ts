/**
 * @fileoverview N:M Combination Engine — Subset-Sum Matching
 * @description Bounded DFS algorithm for finding entity/transaction combinations
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-30
 * @version 2.0.0
 * @see DECISIONS-PHASE-2.md Q3 — N:M Matching (SAP pattern)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { MatchableEntityType } from '../../types/bank';
import type { MatchingConfig } from '../../types/matching-config';

// ============================================================================
// TYPES
// ============================================================================

/** A candidate entity for combination matching */
export interface CombinationCandidate {
  readonly entityId: string;
  readonly entityType: MatchableEntityType;
  readonly amount: number;
}

/** A valid combination result */
export interface CombinationResult {
  /** Entities in this combination */
  readonly entities: CombinationCandidate[];
  /** Sum of entity amounts */
  readonly totalAmount: number;
  /** Absolute difference from target |totalAmount - targetAmount| */
  readonly residual: number;
}

/** Input parameters for combination search */
export interface CombinationInput {
  /** Target amount to match (sum of transaction amounts) */
  readonly targetAmount: number;
  /** Pool of candidate entities */
  readonly candidates: CombinationCandidate[];
  /** Amount tolerance percentage (default 5%) */
  readonly tolerancePercent: number;
  /** Maximum entities in a single combination (default 5) */
  readonly maxCombinationSize: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum results to return (avoid combinatorial explosion) */
const MAX_RESULTS = 20;

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Find all subsets of candidates whose amounts sum to targetAmount (±tolerance)
 *
 * Algorithm: Bounded DFS with pruning
 * - Sort candidates by amount descending (enables early pruning)
 * - Prune if current sum exceeds upper bound
 * - Prune if remaining candidates' sum + current sum < lower bound
 * - Prune if depth > maxCombinationSize
 * - Stop after MAX_RESULTS valid combinations
 *
 * Performance: For sole proprietor volumes (max 8 candidates, combo size 5),
 * worst case is C(8,5) = 56 iterations — trivially fast.
 */
export function findMatchingCombinations(
  input: CombinationInput
): CombinationResult[] {
  const { targetAmount, candidates, tolerancePercent, maxCombinationSize } = input;

  if (candidates.length === 0 || targetAmount <= 0) return [];

  const tolerance = targetAmount * (tolerancePercent / 100);
  const lowerBound = targetAmount - tolerance;
  const upperBound = targetAmount + tolerance;

  // Sort by amount descending for better pruning
  const sorted = [...candidates].sort((a, b) => b.amount - a.amount);

  // Pre-compute suffix sums for "remaining sum" pruning
  const suffixSums = new Array<number>(sorted.length + 1);
  suffixSums[sorted.length] = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    suffixSums[i] = (suffixSums[i + 1] ?? 0) + (sorted[i]?.amount ?? 0);
  }

  const results: CombinationResult[] = [];
  const stack: CombinationCandidate[] = [];

  dfs(0, 0);

  // Sort by residual ascending (closest match first)
  results.sort((a, b) => a.residual - b.residual);
  return results;

  function dfs(startIdx: number, currentSum: number): void {
    // Stop if enough results found
    if (results.length >= MAX_RESULTS) return;

    // Check if current combination is valid
    if (stack.length > 0 && currentSum >= lowerBound && currentSum <= upperBound) {
      results.push({
        entities: [...stack],
        totalAmount: currentSum,
        residual: Math.abs(currentSum - targetAmount),
      });
    }

    // Pruning: max depth reached
    if (stack.length >= maxCombinationSize) return;

    for (let i = startIdx; i < sorted.length; i++) {
      const candidate = sorted[i];
      if (!candidate) continue;

      const newSum = currentSum + candidate.amount;

      // Pruning: sum exceeds upper bound
      if (newSum > upperBound) continue;

      // Pruning: even if we add all remaining, can't reach lower bound
      const remainingSum = suffixSums[i + 1] ?? 0;
      if (newSum + remainingSum < lowerBound) break; // All further branches also fail

      stack.push(candidate);
      dfs(i + 1, newSum);
      stack.pop();

      // Stop early if enough results
      if (results.length >= MAX_RESULTS) return;
    }
  }
}


/**
 * Pre-filter candidates to a manageable size for combination search
 *
 * If there are more than maxEntities candidates, keep only the ones
 * whose amounts are most likely to participate in a valid combination.
 * Strategy: keep candidates with amounts closest to targetAmount / avgComboSize.
 */
export function preFilterCandidates(
  candidates: CombinationCandidate[],
  targetAmount: number,
  maxEntities: number,
  avgComboSize = 3
): CombinationCandidate[] {
  if (candidates.length <= maxEntities) return candidates;

  const idealAmount = targetAmount / avgComboSize;

  return [...candidates]
    .sort((a, b) =>
      Math.abs(a.amount - idealAmount) - Math.abs(b.amount - idealAmount)
    )
    .slice(0, maxEntities);
}
