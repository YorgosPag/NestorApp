/**
 * Multi-Agent Orchestrator — State Manager (ADR-261)
 *
 * File-based state with filesystem locking.
 * CRITICAL: Only orchestrator writes to state.json.
 * Agents write result files to .agents/results/{taskId}.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import lockfile from 'proper-lockfile';
import { ORCHESTRATOR_CONFIG } from './config.js';
import type {
  OrchestratorState,
  SessionId,
  TaskResult,
  TaskId,
  OrchestratorPhase,
  TaskDefinition,
  WorktreeInfo,
  OrchestratorError,
} from './types.js';

// ─── State Manager ───────────────────────────────────────────

export class StateManager {
  private readonly stateDir: string;
  private readonly stateFile: string;
  private readonly resultsDir: string;

  constructor(private readonly projectRoot: string) {
    this.stateDir = join(projectRoot, ORCHESTRATOR_CONFIG.stateDir);
    this.stateFile = join(this.stateDir, 'state.json');
    this.resultsDir = join(projectRoot, ORCHESTRATOR_CONFIG.resultsDir);
  }

  // ─── Initialization ────────────────────────────────────────

  /** Initialize directories and state file for a new session */
  initSession(sessionId: SessionId, userTask: string): OrchestratorState {
    mkdirSync(this.stateDir, { recursive: true });
    mkdirSync(this.resultsDir, { recursive: true });

    const now = new Date().toISOString();
    const state: OrchestratorState = {
      sessionId,
      phase: 'initializing',
      userTask,
      plan: [],
      results: [],
      worktrees: [],
      errors: [],
      startedAt: now,
      updatedAt: now,
    };

    this.writeState(state);
    return state;
  }

  // ─── State Read/Write ──────────────────────────────────────

  /** Read current state — throws if no state file */
  readState(): OrchestratorState {
    if (!existsSync(this.stateFile)) {
      throw new Error(`No state file found at ${this.stateFile}. Start a new session first.`);
    }
    const raw = readFileSync(this.stateFile, 'utf-8');
    return JSON.parse(raw) as OrchestratorState;
  }

  /** Read state if exists, return null otherwise */
  readStateIfExists(): OrchestratorState | null {
    if (!existsSync(this.stateFile)) return null;
    try {
      const raw = readFileSync(this.stateFile, 'utf-8');
      return JSON.parse(raw) as OrchestratorState;
    } catch {
      return null;
    }
  }

  /** Write state atomically with file locking */
  private writeState(state: OrchestratorState): void {
    const updatedState: OrchestratorState = {
      ...state,
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(this.stateFile, JSON.stringify(updatedState, null, 2), 'utf-8');
  }

  /** Update state with locking for concurrent safety */
  async updateState(
    updater: (current: OrchestratorState) => OrchestratorState,
  ): Promise<OrchestratorState> {
    // Ensure state dir exists for lockfile
    mkdirSync(this.stateDir, { recursive: true });

    let release: (() => Promise<void>) | undefined;
    try {
      release = await lockfile.lock(this.stateFile, {
        stale: 10_000, // Consider lock stale after 10s
        retries: { retries: 5, minTimeout: 200, maxTimeout: 1_000 },
      });

      const current = this.readState();
      const updated = updater(current);
      this.writeState(updated);
      return updated;
    } finally {
      if (release) {
        await release();
      }
    }
  }

  // ─── Convenience Updaters ──────────────────────────────────

  /** Update phase */
  async setPhase(phase: OrchestratorPhase): Promise<OrchestratorState> {
    return this.updateState((s) => ({ ...s, phase }));
  }

  /** Set the plan (task definitions) */
  async setPlan(plan: readonly TaskDefinition[]): Promise<OrchestratorState> {
    return this.updateState((s) => ({ ...s, plan }));
  }

  /** Add a worktree entry */
  async addWorktree(worktree: WorktreeInfo): Promise<OrchestratorState> {
    return this.updateState((s) => ({
      ...s,
      worktrees: [...s.worktrees, worktree],
    }));
  }

  /** Update worktree status */
  async updateWorktreeStatus(
    branch: string,
    status: WorktreeInfo['status'],
  ): Promise<OrchestratorState> {
    return this.updateState((s) => ({
      ...s,
      worktrees: s.worktrees.map((w) =>
        w.branch === branch ? { ...w, status } : w,
      ),
    }));
  }

  /** Add a task result */
  async addResult(result: TaskResult): Promise<OrchestratorState> {
    return this.updateState((s) => ({
      ...s,
      results: [...s.results, result],
    }));
  }

  /** Record an error */
  async addError(error: OrchestratorError): Promise<OrchestratorState> {
    return this.updateState((s) => ({
      ...s,
      errors: [...s.errors, error],
    }));
  }

  // ─── Result Files ──────────────────────────────────────────

  /** Write a result file (called by agent runner, not directly by agents) */
  writeResult(taskId: TaskId, result: TaskResult): void {
    const resultFile = join(this.resultsDir, `${taskId}.json`);
    writeFileSync(resultFile, JSON.stringify(result, null, 2), 'utf-8');
  }

  /** Read a result file */
  readResult(taskId: TaskId): TaskResult | null {
    const resultFile = join(this.resultsDir, `${taskId}.json`);
    if (!existsSync(resultFile)) return null;
    try {
      const raw = readFileSync(resultFile, 'utf-8');
      return JSON.parse(raw) as TaskResult;
    } catch {
      return null;
    }
  }

  /** Check if a result exists for a task */
  hasResult(taskId: TaskId): boolean {
    return existsSync(join(this.resultsDir, `${taskId}.json`));
  }

  // ─── Session Discovery ─────────────────────────────────────

  /** Check if a resumable session exists */
  hasSession(): boolean {
    return existsSync(this.stateFile);
  }

  /** Generate a new session ID */
  static generateSessionId(): SessionId {
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const random = Math.random().toString(36).slice(2, 8);
    return `orch_${timestamp}_${random}`;
  }
}
