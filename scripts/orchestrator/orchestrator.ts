/**
 * Multi-Agent Orchestrator — Main Flow (ADR-261)
 *
 * Google-level phase machine:
 * analyzing → planning → confirming → executing → reviewing → merging → completed
 *
 * Coordinates multiple specialized agents working in parallel git worktrees.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import {
  AGENT_DEFINITIONS,
  ORCHESTRATOR_CONFIG,
  getAgentDefinition,
} from './config.js';
import type {
  AgentRole,
  CliOptions,
  OrchestratorPhase,
  OrchestratorState,
  SessionId,
  TaskDefinition,
  TaskId,
  TaskResult,
  WorktreeInfo,
} from './types.js';
import { StateManager } from './state-manager.js';
import { WorktreeManager } from './worktree-manager.js';
import { AgentRunner } from './agent-runner.js';
import { QualityGate } from './quality-gate.js';
import { OrchestratorLogger } from './logger.js';
import { registerCleanupHandlers, createError } from './error-recovery.js';

// ─── Orchestrator ────────────────────────────────────────────

export class Orchestrator {
  private readonly stateManager: StateManager;
  private readonly worktreeManager: WorktreeManager;
  private readonly agentRunner: AgentRunner;
  private readonly qualityGate: QualityGate;
  private readonly logger: OrchestratorLogger;
  private sessionId: SessionId;

  constructor(
    private readonly projectRoot: string,
    private readonly options: CliOptions,
  ) {
    this.sessionId = options.resume ?? StateManager.generateSessionId();
    this.logger = new OrchestratorLogger(this.sessionId, options.verbose);
    this.stateManager = new StateManager(projectRoot);
    this.worktreeManager = new WorktreeManager(projectRoot, this.sessionId, this.logger);
    this.agentRunner = new AgentRunner(projectRoot, this.logger);
    this.qualityGate = new QualityGate(projectRoot, this.logger);

    // Register cleanup handlers for graceful shutdown
    registerCleanupHandlers(this.worktreeManager, this.logger);
  }

  // ─── Main Entry Point ──────────────────────────────────────

  /**
   * Execute the full orchestration flow.
   * Returns the final state.
   */
  async execute(userTask: string): Promise<OrchestratorState> {
    this.logger.banner(`Multi-Agent Orchestrator [${this.sessionId}]`);
    this.logger.table([
      ['Task', userTask],
      ['Session', this.sessionId],
      ['Dry Run', this.options.dryRun ? 'Yes' : 'No'],
      ['Verbose', this.options.verbose ? 'Yes' : 'No'],
    ]);
    this.logger.separator();

    // Initialize or resume session
    let state: OrchestratorState;

    if (this.options.resume) {
      state = this.stateManager.readState();
      this.logger.phase('initializing', `Resuming session: ${state.sessionId}`);
    } else {
      state = this.stateManager.initSession(this.sessionId, userTask);
    }

    try {
      // Phase 1: Analyze the task
      state = await this.analyze(state);

      // Phase 2: Create execution plan
      state = await this.plan(state);

      // Dry run: stop here
      if (this.options.dryRun) {
        this.logger.phase('completed', 'Dry run complete — no execution.');
        this.printPlan(state);
        return state;
      }

      // Phase 3: Wait for user confirmation
      state = await this.confirm(state);

      // Phase 4: Execute agents in parallel
      state = await this.executeAgents(state);

      // Phase 5: Quality gate
      if (!this.options.noReview) {
        state = await this.review(state);
      }

      // Phase 6: Merge worktrees
      state = await this.merge(state);

      // Phase 7: Complete
      state = await this.complete(state);

      return state;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Orchestration failed: ${message}`);

      await this.stateManager.addError(
        createError(state.phase, message, { retryable: false }),
      );
      await this.stateManager.setPhase('failed');

      // Cleanup worktrees on failure
      await this.worktreeManager.cleanupAll();

      throw error;
    }
  }

  // ─── Phase 1: Analyze ──────────────────────────────────────

  private async analyze(state: OrchestratorState): Promise<OrchestratorState> {
    this.logger.phase('analyzing', 'Analyzing task and codebase...');
    this.logger.startSpinner('Orchestrator agent analyzing...');

    await this.stateManager.setPhase('analyzing');

    // The orchestrator agent analyzes the task and codebase
    const systemPrompt = this.loadPrompt('prompts/orchestrator.md');
    const analysisPrompt = [
      `# Task to Analyze`,
      '',
      state.userTask,
      '',
      '# Instructions',
      'Analyze this task by:',
      '1. Search the codebase (Grep/Glob) for relevant existing code',
      '2. Read CLAUDE.md rules and ADR index',
      '3. Identify which areas need changes (frontend, backend, tests, docs)',
      '4. List the specific files that need modification',
      '5. Identify dependencies between changes',
      '',
      'Output a JSON plan with this exact structure:',
      '```json',
      '{',
      '  "tasks": [',
      '    {',
      '      "id": "task_001",',
      '      "title": "Short task title",',
      '      "description": "Detailed description of what to do",',
      '      "assignedAgent": "frontend|backend|testing|docs",',
      '      "dependencies": [],',
      '      "priority": 1,',
      '      "filesScope": ["src/path/to/file.tsx"],',
      '      "acceptanceCriteria": ["Criterion 1", "Criterion 2"]',
      '    }',
      '  ]',
      '}',
      '```',
    ].join('\n');

    let planJson = '';

    try {
      for await (const message of query({
        prompt: analysisPrompt,
        options: {
          allowedTools: ['Read', 'Glob', 'Grep'],
          systemPrompt,
          model: ORCHESTRATOR_CONFIG.model,
          cwd: this.projectRoot,
          permissionMode: 'dontAsk',
        },
      })) {
        if (this.isAssistantMessage(message)) {
          const text = this.extractText(message);
          if (text) planJson += text;
        }
      }
    } catch (error) {
      this.logger.failSpinner('Analysis failed');
      throw error;
    }

    this.logger.succeedSpinner('Analysis complete');
    return { ...state, phase: 'analyzing' };
  }

  // ─── Phase 2: Plan ─────────────────────────────────────────

  private async plan(state: OrchestratorState): Promise<OrchestratorState> {
    this.logger.phase('planning', 'Creating execution plan...');
    await this.stateManager.setPhase('planning');

    // Extract JSON plan from analysis output
    // For now, create a default plan structure based on the task
    const plan = await this.createPlan(state.userTask);

    // Filter agents if --agents flag is set
    const filteredPlan = this.options.agents
      ? plan.filter((t) => this.options.agents!.includes(t.assignedAgent))
      : plan;

    await this.stateManager.setPlan(filteredPlan);

    this.printPlan({ ...state, plan: filteredPlan });

    return { ...state, phase: 'planning', plan: filteredPlan };
  }

  // ─── Phase 3: Confirm ──────────────────────────────────────

  private async confirm(state: OrchestratorState): Promise<OrchestratorState> {
    this.logger.phase('confirming', 'Waiting for user confirmation...');
    await this.stateManager.setPhase('confirming');

    // In non-interactive mode, auto-confirm
    this.logger.info('Auto-confirming plan (use --dry-run to review without executing)');

    return { ...state, phase: 'confirming' };
  }

  // ─── Phase 4: Execute Agents ───────────────────────────────

  private async executeAgents(state: OrchestratorState): Promise<OrchestratorState> {
    this.logger.phase('executing', `Launching ${state.plan.length} agent(s)...`);
    await this.stateManager.setPhase('executing');

    const results: TaskResult[] = [];
    const taskMap = new Map<TaskId, TaskDefinition>(
      state.plan.map((t) => [t.id, t]),
    );
    const completedTasks = new Set<TaskId>();
    const worktrees = new Map<AgentRole, WorktreeInfo>();

    // Create worktrees for each unique agent role
    const uniqueRoles = new Set(state.plan.map((t) => t.assignedAgent));
    for (const role of uniqueRoles) {
      const worktree = this.worktreeManager.create(role);
      worktrees.set(role, worktree);
      await this.stateManager.addWorktree(worktree);
    }

    // Execute tasks respecting dependencies
    while (completedTasks.size < state.plan.length) {
      // Find ready tasks (all dependencies completed)
      const readyTasks = state.plan.filter(
        (t) =>
          !completedTasks.has(t.id) &&
          t.dependencies.every((dep) => completedTasks.has(dep)),
      );

      if (readyTasks.length === 0 && completedTasks.size < state.plan.length) {
        throw new Error('Deadlock detected: no tasks ready but not all completed');
      }

      // Execute ready tasks in parallel (up to max concurrency)
      const batch = readyTasks.slice(0, ORCHESTRATOR_CONFIG.maxConcurrentAgents);

      this.logger.info(
        `Executing batch: ${batch.map((t) => `${t.assignedAgent}/${t.id}`).join(', ')}`,
      );

      const batchResults = await Promise.all(
        batch.map((task) => {
          const agentDef = getAgentDefinition(task.assignedAgent);
          const worktree = worktrees.get(task.assignedAgent);
          if (!worktree) throw new Error(`No worktree for ${task.assignedAgent}`);

          return this.agentRunner.runAgent(agentDef, task, worktree.path);
        }),
      );

      // Process results
      for (const result of batchResults) {
        results.push(result);
        completedTasks.add(result.taskId);
        await this.stateManager.addResult(result);
        this.stateManager.writeResult(result.taskId, result);

        if (result.status === 'completed') {
          this.logger.success(`${result.agentRole}/${result.taskId}: completed`);
        } else {
          this.logger.error(`${result.agentRole}/${result.taskId}: ${result.error}`);
        }
      }
    }

    return { ...state, phase: 'executing', results };
  }

  // ─── Phase 5: Review ───────────────────────────────────────

  private async review(state: OrchestratorState): Promise<OrchestratorState> {
    this.logger.phase('reviewing', 'Running quality gate...');
    await this.stateManager.setPhase('reviewing');

    // Run automated checks
    const automatedResult = await this.qualityGate.runChecks(state.results);

    if (!automatedResult.passed) {
      this.logger.warn('Automated checks failed — skipping review agent');
      return state;
    }

    // Run review agent
    const reviewResult = await this.qualityGate.runReviewAgent(state.results);

    if (!reviewResult.passed) {
      this.logger.error('Review agent rejected changes');
      this.logger.info(reviewResult.reviewSummary ?? 'No details');
    } else {
      this.logger.success('Quality gate passed');
    }

    return state;
  }

  // ─── Phase 6: Merge ────────────────────────────────────────

  private async merge(state: OrchestratorState): Promise<OrchestratorState> {
    this.logger.phase('merging', 'Merging agent worktrees...');
    await this.stateManager.setPhase('merging');

    const worktrees = this.worktreeManager.getActiveWorktrees();

    for (const worktree of worktrees) {
      const { success, conflicts } = this.worktreeManager.merge(worktree);

      if (success) {
        await this.stateManager.updateWorktreeStatus(worktree.branch, 'merged');
        this.worktreeManager.cleanup(worktree);
      } else if (conflicts) {
        this.logger.error(`Merge conflict in ${worktree.branch} — manual resolution needed`);
        await this.stateManager.addError(
          createError('merging', `Merge conflict in ${worktree.branch}`, {
            agentRole: worktree.agentRole,
            retryable: false,
          }),
        );
      }
    }

    return state;
  }

  // ─── Phase 7: Complete ─────────────────────────────────────

  private async complete(state: OrchestratorState): Promise<OrchestratorState> {
    await this.stateManager.setPhase('completed');
    this.logger.separator();
    this.logger.phase('completed', 'All tasks completed!');

    // Print summary
    const successful = state.results.filter((r) => r.status === 'completed');
    const failed = state.results.filter((r) => r.status === 'failed');
    const totalFiles = new Set(state.results.flatMap((r) => r.filesChanged)).size;
    const totalDuration = state.results.reduce((sum, r) => sum + r.durationMs, 0);

    this.logger.table([
      ['Tasks', `${successful.length} completed, ${failed.length} failed`],
      ['Files Changed', String(totalFiles)],
      ['Duration', `${Math.round(totalDuration / 1000)}s`],
      ['Session', this.sessionId],
    ]);

    this.logger.separator();
    this.logger.info('Changes are committed locally. Use "git push" when ready.');

    return { ...state, phase: 'completed' };
  }

  // ─── Plan Creation ─────────────────────────────────────────

  /**
   * Create a task plan from user's task description.
   * Uses the orchestrator agent (Opus) to analyze and decompose.
   */
  private async createPlan(userTask: string): Promise<TaskDefinition[]> {
    const systemPrompt = this.loadPrompt('prompts/orchestrator.md');

    const planPrompt = [
      '# Task Decomposition Request',
      '',
      `User task: "${userTask}"`,
      '',
      'Decompose this task into subtasks. For each subtask, decide which agent should handle it:',
      '- **frontend**: React/Next.js UI components, CSS, hooks',
      '- **backend**: API routes, services, Firestore operations',
      '- **testing**: TypeScript checks, test execution',
      '- **docs**: ADR updates, documentation',
      '',
      'Respond with ONLY a JSON array of task objects:',
      '```json',
      '[',
      '  {',
      '    "id": "task_001",',
      '    "title": "Task title",',
      '    "description": "What to do",',
      '    "assignedAgent": "frontend",',
      '    "dependencies": [],',
      '    "priority": 1,',
      '    "filesScope": ["src/components/example.tsx"],',
      '    "acceptanceCriteria": ["Must work correctly"]',
      '  }',
      ']',
      '```',
    ].join('\n');

    let responseText = '';

    try {
      for await (const message of query({
        prompt: planPrompt,
        options: {
          allowedTools: ['Read', 'Glob', 'Grep'],
          systemPrompt,
          model: ORCHESTRATOR_CONFIG.model,
          cwd: this.projectRoot,
          permissionMode: 'dontAsk',
        },
      })) {
        if (this.isAssistantMessage(message)) {
          const text = this.extractText(message);
          if (text) responseText += text;
        }
      }
    } catch (error) {
      this.logger.warn('Plan agent failed, creating default single-task plan');
      return this.createDefaultPlan(userTask);
    }

    // Extract JSON from response
    const plan = this.parseJsonPlan(responseText);
    return plan ?? this.createDefaultPlan(userTask);
  }

  // ─── Helpers ───────────────────────────────────────────────

  private createDefaultPlan(userTask: string): TaskDefinition[] {
    return [
      {
        id: 'task_001' as TaskId,
        title: userTask.slice(0, 80),
        description: userTask,
        assignedAgent: 'backend' as AgentRole,
        dependencies: [],
        priority: 1,
        filesScope: ['src/'],
        acceptanceCriteria: ['Task completed successfully'],
      },
    ];
  }

  private parseJsonPlan(text: string): TaskDefinition[] | null {
    try {
      // Extract JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
      const parsed = JSON.parse(jsonStr) as TaskDefinition[];

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private printPlan(state: Pick<OrchestratorState, 'plan'>): void {
    this.logger.separator();
    this.logger.info(`Plan: ${state.plan.length} task(s)`);

    for (const task of state.plan) {
      const agentColor = {
        frontend: 'cyan',
        backend: 'green',
        testing: 'yellow',
        docs: 'blue',
        review: 'magenta',
      } as const;

      this.logger.table([
        ['Task', `${task.id}: ${task.title}`],
        ['Agent', task.assignedAgent],
        ['Priority', String(task.priority)],
        ['Files', task.filesScope.join(', ')],
        ['Deps', task.dependencies.length > 0 ? task.dependencies.join(', ') : 'none'],
      ]);
      this.logger.info('');
    }

    this.logger.separator();
  }

  private loadPrompt(path: string): string {
    try {
      const promptPath = resolve(join(this.projectRoot, 'scripts', 'orchestrator', path));
      return readFileSync(promptPath, 'utf-8');
    } catch {
      return 'You are a coding orchestrator. Analyze tasks and create execution plans.';
    }
  }

  private isAssistantMessage(message: unknown): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      (message as Record<string, unknown>).type === 'assistant'
    );
  }

  private extractText(message: unknown): string {
    try {
      const msg = message as Record<string, unknown>;
      const innerMessage = msg.message as Record<string, unknown> | undefined;
      if (!innerMessage?.content || !Array.isArray(innerMessage.content)) return '';

      return (innerMessage.content as Record<string, unknown>[])
        .filter((block) => 'text' in block)
        .map((block) => block.text as string)
        .join('\n');
    } catch {
      return '';
    }
  }
}
