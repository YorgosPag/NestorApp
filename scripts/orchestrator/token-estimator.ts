/**
 * Multi-Agent Orchestrator — Token Budget Estimator (ADR-261)
 *
 * Estimates token consumption BEFORE execution starts.
 * Shows cost comparison vs single-agent approach.
 */

import type { TaskDefinition, AgentRole, ModelTier } from './types.js';
import { AGENT_DEFINITIONS, ORCHESTRATOR_CONFIG } from './config.js';
import type { OrchestratorLogger } from './logger.js';

// ─── Token Cost Per Model (estimates based on typical usage) ─

/** Average tokens per agent execution by model tier */
const TOKENS_PER_MODEL: Record<ModelTier, { input: number; output: number }> = {
  opus: { input: 40_000, output: 15_000 },
  sonnet: { input: 35_000, output: 12_000 },
  haiku: { input: 15_000, output: 5_000 },
};

/** Orchestrator overhead (analysis + planning phase) */
const ORCHESTRATOR_OVERHEAD: { input: number; output: number } = {
  input: 50_000,
  output: 20_000,
};

/** Single-agent baseline for comparison (one Opus doing everything) */
const SINGLE_AGENT_BASELINE: { input: number; output: number } = {
  input: 80_000,
  output: 30_000,
};

// ─── Estimation Types ────────────────────────────────────────

export interface TokenEstimate {
  /** Total estimated tokens (input + output) */
  readonly totalTokens: number;
  /** Breakdown by phase */
  readonly breakdown: readonly PhaseEstimate[];
  /** Single-agent baseline for comparison */
  readonly singleAgentBaseline: number;
  /** Multiplier vs single agent */
  readonly multiplier: number;
  /** Percentage of Max plan daily budget (rough estimate) */
  readonly dailyBudgetPercent: number;
}

interface PhaseEstimate {
  readonly phase: string;
  readonly agent: string;
  readonly model: ModelTier;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

// ─── Estimator ───────────────────────────────────────────────

/**
 * Estimate token consumption for a planned orchestration.
 * Call this BEFORE execution to show the user what to expect.
 */
export function estimateTokens(plan: readonly TaskDefinition[]): TokenEstimate {
  const breakdown: PhaseEstimate[] = [];

  // 1. Orchestrator phase (analysis + planning)
  breakdown.push({
    phase: 'Analysis & Planning',
    agent: 'orchestrator',
    model: ORCHESTRATOR_CONFIG.model,
    inputTokens: ORCHESTRATOR_OVERHEAD.input,
    outputTokens: ORCHESTRATOR_OVERHEAD.output,
    totalTokens: ORCHESTRATOR_OVERHEAD.input + ORCHESTRATOR_OVERHEAD.output,
  });

  // 2. Agent execution phases
  for (const task of plan) {
    const agentDef = AGENT_DEFINITIONS[task.assignedAgent];
    const modelCost = TOKENS_PER_MODEL[agentDef.model];

    // Scale by task complexity (estimated from filesScope + description length)
    const complexityMultiplier = estimateComplexity(task);

    const inputTokens = Math.round(modelCost.input * complexityMultiplier);
    const outputTokens = Math.round(modelCost.output * complexityMultiplier);

    breakdown.push({
      phase: `Task: ${task.title}`,
      agent: task.assignedAgent,
      model: agentDef.model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    });
  }

  // 3. Quality gate (review agent)
  const reviewCost = TOKENS_PER_MODEL.opus;
  breakdown.push({
    phase: 'Quality Gate (Review)',
    agent: 'review',
    model: 'opus',
    inputTokens: reviewCost.input,
    outputTokens: reviewCost.output,
    totalTokens: reviewCost.input + reviewCost.output,
  });

  // Calculate totals
  const totalTokens = breakdown.reduce((sum, b) => sum + b.totalTokens, 0);
  const singleAgentBaseline = SINGLE_AGENT_BASELINE.input + SINGLE_AGENT_BASELINE.output;
  const multiplier = Math.round((totalTokens / singleAgentBaseline) * 10) / 10;

  // Max plan ~5M tokens/day (rough estimate)
  const ESTIMATED_DAILY_BUDGET = 5_000_000;
  const dailyBudgetPercent = Math.round((totalTokens / ESTIMATED_DAILY_BUDGET) * 100 * 10) / 10;

  return {
    totalTokens,
    breakdown,
    singleAgentBaseline,
    multiplier,
    dailyBudgetPercent,
  };
}

/**
 * Print the token estimate in a user-friendly format.
 */
export function printEstimate(estimate: TokenEstimate, logger: OrchestratorLogger): void {
  logger.separator();
  logger.info('TOKEN BUDGET ESTIMATE');
  logger.separator();

  // Breakdown table
  for (const phase of estimate.breakdown) {
    const model = phase.model.toUpperCase().padEnd(6);
    const tokens = formatTokens(phase.totalTokens).padStart(8);
    logger.table([
      [phase.agent.padEnd(14), `${model}  ${tokens}  ${phase.phase}`],
    ]);
  }

  logger.separator();

  // Summary
  logger.table([
    ['Total estimate', formatTokens(estimate.totalTokens)],
    ['Single agent', formatTokens(estimate.singleAgentBaseline)],
    ['Multiplier', `${estimate.multiplier}x`],
    ['Daily budget', `~${estimate.dailyBudgetPercent}%`],
  ]);

  logger.separator();

  // Recommendation
  if (estimate.multiplier <= 1.5) {
    logger.success('Low overhead — orchestrator efficient for this task');
  } else if (estimate.multiplier <= 3.0) {
    logger.info(`Moderate overhead (${estimate.multiplier}x) — worthwhile for parallel speed`);
  } else {
    logger.warn(
      `High overhead (${estimate.multiplier}x) — consider using single agent for simple tasks`,
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────

/** Estimate task complexity (0.5 = simple, 1.0 = normal, 2.0 = complex) */
function estimateComplexity(task: TaskDefinition): number {
  let score = 1.0;

  // More files = more complex
  if (task.filesScope.length > 5) score += 0.5;
  if (task.filesScope.length > 10) score += 0.5;

  // Longer description = more complex
  if (task.description.length > 500) score += 0.3;
  if (task.description.length > 1000) score += 0.3;

  // More acceptance criteria = more complex
  if (task.acceptanceCriteria.length > 3) score += 0.2;
  if (task.acceptanceCriteria.length > 6) score += 0.3;

  // Priority 1 tasks tend to be more involved
  if (task.priority === 1) score += 0.2;

  return Math.min(score, 2.5); // Cap at 2.5x
}

/** Format token number for display (e.g., 150000 → "150K") */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}K`;
  }
  return String(tokens);
}
