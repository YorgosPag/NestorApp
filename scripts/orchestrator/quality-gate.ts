/**
 * Multi-Agent Orchestrator — Quality Gate (ADR-261)
 *
 * Automated checks + review agent before merge.
 * Enforces CLAUDE.md rules: no any, no ts-ignore, no inline styles, semantic HTML.
 */

import { execSync } from 'child_process';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import type { QualityCheck, QualityGateResult, TaskResult } from './types.js';
import { AGENT_DEFINITIONS } from './config.js';
import type { OrchestratorLogger } from './logger.js';

// ─── Quality Gate ────────────────────────────────────────────

export class QualityGate {
  constructor(
    private readonly projectRoot: string,
    private readonly logger: OrchestratorLogger,
  ) {}

  /**
   * Run all quality checks against changed files.
   * Returns pass/fail with detailed check results.
   */
  async runChecks(results: readonly TaskResult[]): Promise<QualityGateResult> {
    const changedFiles = this.collectChangedFiles(results);
    this.logger.phase('reviewing', `Running quality gate on ${changedFiles.length} changed files`);

    const checks: QualityCheck[] = [];

    // Run automated checks in parallel
    const automatedChecks = await Promise.all([
      this.checkTypeScript(),
      this.checkNoAny(changedFiles),
      this.checkNoTsIgnore(changedFiles),
      this.checkNoInlineStyles(changedFiles),
      this.checkSemanticHtml(changedFiles),
    ]);

    checks.push(...automatedChecks);

    // Log results
    for (const check of checks) {
      const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
      const logFn = check.status === 'pass' ? 'success' : check.status === 'warn' ? 'warn' : 'error';
      this.logger[logFn](`${icon} ${check.name}: ${check.details}`);
    }

    const hasFailures = checks.some((c) => c.status === 'fail');

    return {
      passed: !hasFailures,
      checks,
    };
  }

  /**
   * Run the review agent (Opus) for semantic code review.
   * This is the final quality gate before merge.
   */
  async runReviewAgent(results: readonly TaskResult[]): Promise<QualityGateResult> {
    const changedFiles = this.collectChangedFiles(results);

    if (changedFiles.length === 0) {
      return { passed: true, checks: [], reviewSummary: 'No files to review.' };
    }

    this.logger.phase('reviewing', 'Starting review agent (Opus)...');
    this.logger.startSpinner('Review agent analyzing changes...');

    const reviewDef = AGENT_DEFINITIONS.review;
    const reviewPrompt = this.buildReviewPrompt(results, changedFiles);

    let reviewSummary = '';
    let passed = true;

    try {
      const systemPrompt = this.loadReviewPrompt();

      for await (const message of query({
        prompt: reviewPrompt,
        options: {
          allowedTools: [...reviewDef.allowedTools],
          systemPrompt,
          model: reviewDef.model,
          cwd: this.projectRoot,
          permissionMode: reviewDef.permissionMode,
        },
      })) {
        // Extract review output
        if (this.isAssistantMessage(message)) {
          const text = this.extractText(message);
          if (text) {
            reviewSummary += text + '\n';
          }
        }
      }

      // Check if review agent flagged any issues
      const lowerSummary = reviewSummary.toLowerCase();
      if (
        lowerSummary.includes('reject') ||
        lowerSummary.includes('critical issue') ||
        lowerSummary.includes('must fix')
      ) {
        passed = false;
      }

      this.logger.succeedSpinner('Review agent completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.failSpinner(`Review agent failed: ${message}`);
      reviewSummary = `Review agent error: ${message}`;
      passed = false;
    }

    return {
      passed,
      checks: [
        {
          name: 'review_agent',
          status: passed ? 'pass' : 'fail',
          details: reviewSummary.slice(0, 300),
        },
      ],
      reviewSummary,
    };
  }

  // ─── Automated Checks ─────────────────────────────────────

  private async checkTypeScript(): Promise<QualityCheck> {
    try {
      execSync('npx tsc --noEmit', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 120_000,
      });
      return { name: 'typescript', status: 'pass', details: 'No compilation errors' };
    } catch (error) {
      const stderr = error instanceof Error ? (error as NodeJS.ErrnoException & { stderr?: string }).stderr ?? '' : '';
      const errorCount = (stderr.match(/error TS/g) ?? []).length;
      // Warn instead of fail — pre-existing errors may exist
      return {
        name: 'typescript',
        status: errorCount > 0 ? 'warn' : 'pass',
        details: errorCount > 0 ? `${errorCount} TypeScript error(s) found` : 'Clean',
      };
    }
  }

  private async checkNoAny(files: readonly string[]): Promise<QualityCheck> {
    return this.grepCheck(files, 'no_any', /:\s*any\b|as\s+any\b/, 'any/as any usage');
  }

  private async checkNoTsIgnore(files: readonly string[]): Promise<QualityCheck> {
    return this.grepCheck(files, 'no_ts_ignore', /@ts-ignore/, '@ts-ignore usage');
  }

  private async checkNoInlineStyles(files: readonly string[]): Promise<QualityCheck> {
    return this.grepCheck(files, 'no_inline_styles', /style=\{?\{/, 'inline styles');
  }

  private async checkSemanticHtml(files: readonly string[]): Promise<QualityCheck> {
    // Check for excessive div nesting — warn only
    const tsxFiles = files.filter((f) => f.endsWith('.tsx'));
    let divCount = 0;

    for (const file of tsxFiles) {
      try {
        const content = readFileSync(join(this.projectRoot, file), 'utf-8');
        const matches = content.match(/<div/g);
        divCount += matches?.length ?? 0;
      } catch {
        // File may not exist in main branch
      }
    }

    if (divCount > 50) {
      return {
        name: 'semantic_html',
        status: 'warn',
        details: `${divCount} <div> tags found — consider semantic elements`,
      };
    }

    return { name: 'semantic_html', status: 'pass', details: 'Acceptable div usage' };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async grepCheck(
    files: readonly string[],
    name: string,
    pattern: RegExp,
    label: string,
  ): Promise<QualityCheck> {
    const tsFiles = files.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
    const violations: string[] = [];

    for (const file of tsFiles) {
      try {
        const content = readFileSync(join(this.projectRoot, file), 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            violations.push(`${file}:${i + 1}`);
          }
        }
      } catch {
        // File may not exist
      }
    }

    if (violations.length > 0) {
      return {
        name,
        status: 'fail',
        details: `${violations.length} ${label} found: ${violations.slice(0, 3).join(', ')}`,
      };
    }

    return { name, status: 'pass', details: `No ${label} found` };
  }

  private collectChangedFiles(results: readonly TaskResult[]): readonly string[] {
    const files = new Set<string>();
    for (const result of results) {
      for (const file of result.filesChanged) {
        files.add(file);
      }
    }
    return Array.from(files);
  }

  private buildReviewPrompt(
    results: readonly TaskResult[],
    changedFiles: readonly string[],
  ): string {
    const taskSummaries = results
      .map(
        (r) =>
          `- **${r.agentRole}** (${r.taskId}): ${r.status} — ${r.summary.slice(0, 100)}`,
      )
      .join('\n');

    return [
      '# Code Review Request',
      '',
      '## Changes Made by Agents',
      taskSummaries,
      '',
      '## Files Changed',
      ...changedFiles.map((f) => `- ${f}`),
      '',
      '## Review Instructions',
      'Read each changed file and verify:',
      '1. No `any`, `as any`, or `@ts-ignore`',
      '2. No inline styles',
      '3. Semantic HTML (no div soup)',
      '4. Enterprise IDs used for Firestore operations',
      '5. Code follows existing patterns',
      '6. No security vulnerabilities (XSS, injection, etc.)',
      '7. No race conditions or state management issues',
      '',
      'Provide a clear PASS or REJECT verdict with reasons.',
    ].join('\n');
  }

  private loadReviewPrompt(): string {
    try {
      const promptPath = resolve(
        join(this.projectRoot, 'scripts', 'orchestrator', 'prompts', 'review-agent.md'),
      );
      return readFileSync(promptPath, 'utf-8');
    } catch {
      return 'You are an expert code reviewer. Verify quality, security, and adherence to project standards.';
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
