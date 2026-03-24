/**
 * Multi-Agent Orchestrator — Core Type Definitions (ADR-261)
 *
 * Zero `any` usage. Full discriminated unions.
 * Enterprise-grade type safety for multi-agent coordination.
 */

// ─── Branded Types ───────────────────────────────────────────

/** Unique session identifier */
export type SessionId = `orch_${string}`;

/** Task identifier */
export type TaskId = `task_${string}`;

// ─── Agent System ────────────────────────────────────────────

/** Agent role identifiers */
export type AgentRole = 'frontend' | 'backend' | 'testing' | 'docs' | 'review';

/** Claude model tiers — cost-optimized per role */
export type ModelTier = 'opus' | 'sonnet' | 'haiku';

/** SDK permission modes */
export type PermissionMode = 'acceptEdits' | 'dontAsk' | 'bypassPermissions';

/** Agent definition — immutable configuration per role */
export interface AgentDefinition {
  readonly role: AgentRole;
  readonly description: string;
  readonly systemPromptFile: string;
  readonly allowedTools: readonly string[];
  readonly model: ModelTier;
  readonly permissionMode: PermissionMode;
  readonly maxDurationMs: number;
  readonly worktreeBranchPrefix: string;
}

// ─── Task System ─────────────────────────────────────────────

/** Task priority: 1 = highest, 3 = lowest */
export type TaskPriority = 1 | 2 | 3;

/** Task lifecycle states */
export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'review_pending'
  | 'review_passed'
  | 'review_rejected';

/** Task definition — created by orchestrator during planning */
export interface TaskDefinition {
  readonly id: TaskId;
  readonly title: string;
  readonly description: string;
  readonly assignedAgent: AgentRole;
  readonly dependencies: readonly TaskId[];
  readonly priority: TaskPriority;
  readonly filesScope: readonly string[];
  readonly acceptanceCriteria: readonly string[];
}

/** Result produced by an agent after task execution */
export interface TaskResult {
  readonly taskId: TaskId;
  readonly agentRole: AgentRole;
  readonly status: 'completed' | 'failed';
  readonly filesChanged: readonly string[];
  readonly summary: string;
  readonly durationMs: number;
  readonly worktreeBranch: string;
  readonly error?: string;
}

// ─── Orchestrator State Machine ──────────────────────────────

/** Orchestrator lifecycle phases */
export type OrchestratorPhase =
  | 'initializing'
  | 'analyzing'
  | 'planning'
  | 'confirming'
  | 'executing'
  | 'reviewing'
  | 'merging'
  | 'completed'
  | 'failed';

/** Git worktree tracking info */
export interface WorktreeInfo {
  readonly branch: string;
  readonly path: string;
  readonly agentRole: AgentRole;
  readonly status: 'active' | 'merged' | 'cleaned';
}

/** Error tracking for recovery */
export interface OrchestratorError {
  readonly phase: OrchestratorPhase;
  readonly agentRole?: AgentRole;
  readonly taskId?: TaskId;
  readonly message: string;
  readonly timestamp: string;
  readonly retryable: boolean;
}

/** Full orchestrator state — persisted to .agents/state.json */
export interface OrchestratorState {
  readonly sessionId: SessionId;
  readonly phase: OrchestratorPhase;
  readonly userTask: string;
  readonly plan: readonly TaskDefinition[];
  readonly results: readonly TaskResult[];
  readonly worktrees: readonly WorktreeInfo[];
  readonly errors: readonly OrchestratorError[];
  readonly startedAt: string;
  readonly updatedAt: string;
}

// ─── Quality Gate ────────────────────────────────────────────

/** Individual quality check result */
export interface QualityCheck {
  readonly name: string;
  readonly status: 'pass' | 'fail' | 'warn';
  readonly details: string;
}

/** Aggregate quality gate result */
export interface QualityGateResult {
  readonly passed: boolean;
  readonly checks: readonly QualityCheck[];
  readonly reviewSummary?: string;
}

// ─── CLI Options ─────────────────────────────────────────────

/** CLI command options */
export interface CliOptions {
  readonly dryRun: boolean;
  readonly agents?: readonly AgentRole[];
  readonly resume?: SessionId;
  readonly verbose: boolean;
  readonly noReview: boolean;
}

// ─── Retry / Recovery ────────────────────────────────────────

/** Retry policy configuration */
export interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffMs: number;
  readonly retryableErrors: readonly string[];
}

// ─── SDK Message Types ───────────────────────────────────────

/** Simplified SDK message for internal processing */
export interface AgentMessage {
  readonly type: 'text' | 'tool_use' | 'tool_result' | 'system' | 'result';
  readonly content: string;
  readonly timestamp: string;
}

/** Agent execution summary — collected from SDK stream */
export interface AgentExecutionSummary {
  readonly agentRole: AgentRole;
  readonly taskId: TaskId;
  readonly messages: readonly AgentMessage[];
  readonly filesChanged: readonly string[];
  readonly durationMs: number;
  readonly success: boolean;
  readonly error?: string;
}
