/**
 * Multi-Agent Orchestrator — Agent Configuration (ADR-261)
 *
 * Defines all agent roles, their capabilities, and cost optimization strategy.
 * Model selection: Opus for critical thinking, Sonnet for execution, Haiku for simple tasks.
 */

import type { AgentDefinition, AgentRole, RetryPolicy } from './types.js';

// ─── Agent Definitions ───────────────────────────────────────

export const AGENT_DEFINITIONS: Record<AgentRole, AgentDefinition> = {
  frontend: {
    role: 'frontend',
    description: 'React/Next.js components, UI, CSS modules, hooks, Radix UI, semantic HTML',
    systemPromptFile: 'prompts/frontend-agent.md',
    allowedTools: ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash'],
    model: 'sonnet',
    permissionMode: 'acceptEdits',
    maxDurationMs: 300_000, // 5 min
    worktreeBranchPrefix: 'agent/frontend',
  },

  backend: {
    role: 'backend',
    description: 'API routes, services, Firestore operations, server actions, enterprise IDs',
    systemPromptFile: 'prompts/backend-agent.md',
    allowedTools: ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash'],
    model: 'sonnet',
    permissionMode: 'acceptEdits',
    maxDurationMs: 300_000, // 5 min
    worktreeBranchPrefix: 'agent/backend',
  },

  testing: {
    role: 'testing',
    description: 'TypeScript compilation, test execution, quality validation, lint checks',
    systemPromptFile: 'prompts/testing-agent.md',
    allowedTools: ['Read', 'Glob', 'Grep', 'Bash'], // No Edit — read-only + run
    model: 'haiku',
    permissionMode: 'dontAsk',
    maxDurationMs: 180_000, // 3 min
    worktreeBranchPrefix: 'agent/testing',
  },

  docs: {
    role: 'docs',
    description: 'ADR updates, documentation, centralized-systems docs, adr-index.md',
    systemPromptFile: 'prompts/docs-agent.md',
    allowedTools: ['Read', 'Edit', 'Write', 'Glob', 'Grep'],
    model: 'haiku',
    permissionMode: 'acceptEdits',
    maxDurationMs: 120_000, // 2 min
    worktreeBranchPrefix: 'agent/docs',
  },

  review: {
    role: 'review',
    description: 'Code review, quality gate, CLAUDE.md compliance, architecture validation',
    systemPromptFile: 'prompts/review-agent.md',
    allowedTools: ['Read', 'Glob', 'Grep', 'Bash'], // Read-only
    model: 'opus',
    permissionMode: 'dontAsk',
    maxDurationMs: 300_000, // 5 min
    worktreeBranchPrefix: 'agent/review',
  },
} as const;

// ─── Retry Configuration ─────────────────────────────────────

export const AGENT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  backoffMs: 5_000, // Exponential: 5s → 10s → 20s
  retryableErrors: ['TIMEOUT', 'SDK_ERROR', 'WORKTREE_CONFLICT', 'ECONNRESET'],
};

// ─── Orchestrator Configuration ──────────────────────────────

export const ORCHESTRATOR_CONFIG = {
  /** Model for the orchestrator agent (task decomposition) */
  model: 'opus' as const,

  /** Max tasks the orchestrator can create per session */
  maxTasks: 20,

  /** Max concurrent agents executing in parallel */
  maxConcurrentAgents: 4,

  /** Polling interval for checking agent completion (ms) */
  pollIntervalMs: 3_000,

  /** Total session timeout (ms) — 30 minutes */
  sessionTimeoutMs: 30 * 60 * 1_000,

  /** State directory path (relative to project root) */
  stateDir: '.agents',

  /** Worktrees directory (relative to project root) */
  worktreeDir: '.agents/worktrees',

  /** Results directory (relative to project root) */
  resultsDir: '.agents/results',

  /** Logs directory (relative to project root) */
  logsDir: '.agents/logs',
} as const;

// ─── Quality Gate Checks ─────────────────────────────────────

export const QUALITY_CHECKS = [
  'typescript_compilation',
  'no_any_usage',
  'no_ts_ignore',
  'no_inline_styles',
  'enterprise_ids',
  'adr_updated',
  'no_div_soup',
  'semantic_html',
] as const;

export type QualityCheckName = (typeof QUALITY_CHECKS)[number];

// ─── Helper Functions ────────────────────────────────────────

/** Get all agent roles as array */
export function getAllAgentRoles(): readonly AgentRole[] {
  return Object.keys(AGENT_DEFINITIONS) as AgentRole[];
}

/** Get agent definition by role — type-safe */
export function getAgentDefinition(role: AgentRole): AgentDefinition {
  return AGENT_DEFINITIONS[role];
}

/** Check if a role is valid */
export function isValidAgentRole(role: string): role is AgentRole {
  return role in AGENT_DEFINITIONS;
}
