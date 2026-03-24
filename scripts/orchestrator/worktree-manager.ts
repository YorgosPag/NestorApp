/**
 * Multi-Agent Orchestrator — Worktree Manager (ADR-261)
 *
 * Git worktree lifecycle: create, merge, cleanup.
 * Provides filesystem isolation for parallel agent execution.
 */

import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { ORCHESTRATOR_CONFIG } from './config.js';
import type { AgentRole, SessionId, WorktreeInfo } from './types.js';
import type { OrchestratorLogger } from './logger.js';

// ─── Worktree Manager ────────────────────────────────────────

export class WorktreeManager {
  private readonly worktreeBaseDir: string;
  private readonly activeWorktrees: Map<string, WorktreeInfo> = new Map();

  constructor(
    private readonly projectRoot: string,
    private readonly sessionId: SessionId,
    private readonly logger: OrchestratorLogger,
  ) {
    this.worktreeBaseDir = join(projectRoot, ORCHESTRATOR_CONFIG.worktreeDir);
  }

  // ─── Create Worktree ───────────────────────────────────────

  /**
   * Create an isolated git worktree for an agent.
   * Each agent gets its own branch and directory.
   */
  create(role: AgentRole): WorktreeInfo {
    const branch = `agent/${role}-${this.sessionId}`;
    const worktreePath = resolve(join(this.worktreeBaseDir, role));

    this.logger.debug(`Creating worktree: ${branch} at ${worktreePath}`);

    // Clean up if path already exists (stale from previous run)
    if (existsSync(worktreePath)) {
      this.logger.warn(`Stale worktree found at ${worktreePath}, cleaning up...`);
      this.forceRemoveWorktree(worktreePath, branch);
    }

    // Create the worktree with a new branch from current HEAD
    this.git(`worktree add "${worktreePath}" -b "${branch}"`);

    const info: WorktreeInfo = {
      branch,
      path: worktreePath,
      agentRole: role,
      status: 'active',
    };

    this.activeWorktrees.set(branch, info);
    this.logger.agent(role, `Worktree created: ${branch}`);
    return info;
  }

  // ─── Merge Worktree ────────────────────────────────────────

  /**
   * Merge a worktree branch back into the current branch.
   * Uses --no-ff for clear merge history.
   */
  merge(worktree: WorktreeInfo): { success: boolean; conflicts: boolean } {
    this.logger.debug(`Merging worktree: ${worktree.branch}`);

    try {
      // Check if there are any commits on the agent branch
      const currentBranch = this.getCurrentBranch();
      const diffCount = this.git(
        `rev-list --count "${currentBranch}..${worktree.branch}"`,
      ).trim();

      if (diffCount === '0') {
        this.logger.agent(worktree.agentRole, 'No changes to merge');
        return { success: true, conflicts: false };
      }

      // Merge with no-ff for clear history
      this.git(`merge --no-ff "${worktree.branch}" -m "merge: ${worktree.agentRole} agent work [${this.sessionId}]"`);
      this.logger.agent(worktree.agentRole, `Merged ${diffCount} commit(s)`);

      return { success: true, conflicts: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('CONFLICT')) {
        this.logger.error(`Merge conflict in ${worktree.branch}`);
        // Abort the merge to keep clean state
        this.gitSafe('merge --abort');
        return { success: false, conflicts: true };
      }

      throw error;
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────

  /** Remove a single worktree and its branch */
  cleanup(worktree: WorktreeInfo): void {
    this.logger.debug(`Cleaning up worktree: ${worktree.branch}`);
    this.forceRemoveWorktree(worktree.path, worktree.branch);
    this.activeWorktrees.delete(worktree.branch);
    this.logger.agent(worktree.agentRole, 'Worktree cleaned up');
  }

  /** Remove ALL worktrees created by this session (cleanup guarantee) */
  async cleanupAll(): Promise<void> {
    this.logger.info('Cleaning up all session worktrees...');

    for (const [, worktree] of this.activeWorktrees) {
      try {
        this.forceRemoveWorktree(worktree.path, worktree.branch);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to cleanup ${worktree.branch}: ${message}`);
      }
    }

    this.activeWorktrees.clear();

    // Also clean up the worktree base directory if empty
    if (existsSync(this.worktreeBaseDir)) {
      try {
        rmSync(this.worktreeBaseDir, { recursive: true, force: true });
      } catch {
        // Best effort
      }
    }
  }

  // ─── Queries ───────────────────────────────────────────────

  /** Get all active worktrees */
  getActiveWorktrees(): readonly WorktreeInfo[] {
    return Array.from(this.activeWorktrees.values());
  }

  /** Get worktree by role */
  getWorktreeForRole(role: AgentRole): WorktreeInfo | undefined {
    return Array.from(this.activeWorktrees.values()).find(
      (w) => w.agentRole === role,
    );
  }

  /** Get current branch name */
  getCurrentBranch(): string {
    return this.git('rev-parse --abbrev-ref HEAD').trim();
  }

  // ─── Private Helpers ───────────────────────────────────────

  /** Execute git command in project root */
  private git(args: string): string {
    return execSync(`git ${args}`, {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  /** Execute git command, return null on failure instead of throwing */
  private gitSafe(args: string): string | null {
    try {
      return this.git(args);
    } catch {
      return null;
    }
  }

  /** Force remove a worktree and its branch */
  private forceRemoveWorktree(worktreePath: string, branch: string): void {
    // Remove the worktree directory
    if (existsSync(worktreePath)) {
      this.gitSafe(`worktree remove "${worktreePath}" --force`);

      // Fallback: direct removal if git worktree remove fails
      if (existsSync(worktreePath)) {
        rmSync(worktreePath, { recursive: true, force: true });
      }
    }

    // Prune stale worktree references
    this.gitSafe('worktree prune');

    // Delete the branch
    this.gitSafe(`branch -D "${branch}"`);
  }
}
