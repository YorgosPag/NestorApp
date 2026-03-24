/**
 * Multi-Agent Orchestrator — Agent Runner (ADR-261)
 *
 * Wraps the Claude Agent SDK query() function.
 * Runs a single agent in an isolated worktree with timeout + result collection.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import type {
  AgentDefinition,
  AgentRole,
  TaskDefinition,
  TaskResult,
  AgentExecutionSummary,
  AgentMessage,
} from './types.js';
import { AGENT_RETRY_POLICY } from './config.js';
import { withRetry } from './error-recovery.js';
import type { OrchestratorLogger } from './logger.js';

// ─── Agent Runner ────────────────────────────────────────────

export class AgentRunner {
  constructor(
    private readonly projectRoot: string,
    private readonly logger: OrchestratorLogger,
  ) {}

  /**
   * Run a single agent against a task in the specified working directory.
   * Returns a TaskResult with execution summary.
   */
  async runAgent(
    agentDef: AgentDefinition,
    task: TaskDefinition,
    workingDir: string,
  ): Promise<TaskResult> {
    const startTime = Date.now();

    this.logger.agent(agentDef.role, `Starting task: ${task.title}`);
    this.logger.debug(`Working directory: ${workingDir}`);

    try {
      const summary = await withRetry(
        () => this.executeAgent(agentDef, task, workingDir),
        AGENT_RETRY_POLICY,
        this.logger,
        `Agent ${agentDef.role} / ${task.id}`,
      );

      const result: TaskResult = {
        taskId: task.id,
        agentRole: agentDef.role,
        status: summary.success ? 'completed' : 'failed',
        filesChanged: summary.filesChanged,
        summary: this.extractSummary(summary),
        durationMs: Date.now() - startTime,
        worktreeBranch: `agent/${agentDef.role}`,
        error: summary.error,
      };

      if (result.status === 'completed') {
        this.logger.agent(agentDef.role, `Completed: ${task.title} (${result.durationMs}ms)`);
      } else {
        this.logger.agent(agentDef.role, `Failed: ${task.title} — ${result.error}`);
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        taskId: task.id,
        agentRole: agentDef.role,
        status: 'failed',
        filesChanged: [],
        summary: `Agent crashed: ${message}`,
        durationMs: Date.now() - startTime,
        worktreeBranch: `agent/${agentDef.role}`,
        error: message,
      };
    }
  }

  // ─── Private: Execute Agent via SDK ────────────────────────

  private async executeAgent(
    agentDef: AgentDefinition,
    task: TaskDefinition,
    workingDir: string,
  ): Promise<AgentExecutionSummary> {
    const systemPrompt = this.loadSystemPrompt(agentDef.systemPromptFile);
    const taskPrompt = this.buildTaskPrompt(task);
    const messages: AgentMessage[] = [];
    const filesChanged = new Set<string>();

    const timeoutMs = agentDef.maxDurationMs;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      for await (const message of query({
        prompt: taskPrompt,
        options: {
          allowedTools: [...agentDef.allowedTools],
          systemPrompt,
          model: agentDef.model,
          cwd: workingDir,
          permissionMode: agentDef.permissionMode,
        },
      })) {
        // Process different message types
        if (this.isAssistantMessage(message)) {
          const content = this.extractTextContent(message);
          if (content) {
            messages.push({
              type: 'text',
              content,
              timestamp: new Date().toISOString(),
            });
            this.logger.debug(`[${agentDef.role}] ${content.slice(0, 100)}...`);
          }

          // Track file changes from tool uses
          const changedFiles = this.extractFileChanges(message);
          for (const file of changedFiles) {
            filesChanged.add(file);
          }
        }

        if (this.isResultMessage(message)) {
          messages.push({
            type: 'result',
            content: this.extractResultContent(message),
            timestamp: new Date().toISOString(),
          });
        }
      }

      return {
        agentRole: agentDef.role,
        taskId: task.id,
        messages,
        filesChanged: Array.from(filesChanged),
        durationMs: 0, // Calculated by caller
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        agentRole: agentDef.role,
        taskId: task.id,
        messages,
        filesChanged: Array.from(filesChanged),
        durationMs: 0,
        success: false,
        error: errorMessage,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Prompt Building ───────────────────────────────────────

  private loadSystemPrompt(promptFile: string): string {
    const promptPath = resolve(join(this.projectRoot, 'scripts', 'orchestrator', promptFile));
    try {
      return readFileSync(promptPath, 'utf-8');
    } catch {
      this.logger.warn(`System prompt not found: ${promptPath}. Using default.`);
      return 'You are a specialized coding agent. Complete the task thoroughly and correctly.';
    }
  }

  private buildTaskPrompt(task: TaskDefinition): string {
    const parts = [
      `# Task: ${task.title}`,
      '',
      task.description,
      '',
      '## File Scope',
      `You should primarily work within these files/directories:`,
      ...task.filesScope.map((f) => `- ${f}`),
      '',
      '## Acceptance Criteria',
      ...task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`),
      '',
      '## Rules',
      '- Do NOT use `any`, `as any`, or `@ts-ignore`',
      '- Do NOT use inline styles',
      '- Use semantic HTML (no div soup)',
      '- Use enterprise IDs from enterprise-id.service.ts for Firestore documents',
      '- Follow existing patterns in the codebase',
    ];
    return parts.join('\n');
  }

  // ─── Message Parsing Helpers ───────────────────────────────

  /** Type guard for assistant messages */
  private isAssistantMessage(message: unknown): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      (message as Record<string, unknown>).type === 'assistant'
    );
  }

  /** Type guard for result messages */
  private isResultMessage(message: unknown): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      (message as Record<string, unknown>).type === 'result'
    );
  }

  /** Extract text content from an assistant message */
  private extractTextContent(message: unknown): string {
    try {
      const msg = message as Record<string, unknown>;
      const innerMessage = msg.message as Record<string, unknown> | undefined;
      if (!innerMessage?.content) return '';

      const content = innerMessage.content;
      if (!Array.isArray(content)) return '';

      return content
        .filter((block: Record<string, unknown>) => 'text' in block)
        .map((block: Record<string, unknown>) => block.text as string)
        .join('\n');
    } catch {
      return '';
    }
  }

  /** Extract file paths from Edit/Write tool uses */
  private extractFileChanges(message: unknown): string[] {
    try {
      const msg = message as Record<string, unknown>;
      const innerMessage = msg.message as Record<string, unknown> | undefined;
      if (!innerMessage?.content) return [];

      const content = innerMessage.content;
      if (!Array.isArray(content)) return [];

      return content
        .filter(
          (block: Record<string, unknown>) =>
            block.type === 'tool_use' &&
            (block.name === 'Edit' || block.name === 'Write'),
        )
        .map((block: Record<string, unknown>) => {
          const input = block.input as Record<string, unknown> | undefined;
          return (input?.file_path as string) ?? '';
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  /** Extract result content */
  private extractResultContent(message: unknown): string {
    try {
      const msg = message as Record<string, unknown>;
      return (msg.result as string) ?? (msg.subtype as string) ?? 'completed';
    } catch {
      return 'completed';
    }
  }

  /** Build a human-readable summary from execution */
  private extractSummary(summary: AgentExecutionSummary): string {
    const lastTextMessage = [...summary.messages]
      .reverse()
      .find((m) => m.type === 'text');

    if (lastTextMessage) {
      return lastTextMessage.content.slice(0, 500);
    }

    return `Agent ${summary.agentRole} completed with ${summary.filesChanged.length} file(s) changed.`;
  }
}
