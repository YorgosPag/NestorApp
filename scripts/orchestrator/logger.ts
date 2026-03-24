/**
 * Multi-Agent Orchestrator — Structured Logger (ADR-261)
 *
 * Colored console output + file logging for agent sessions.
 */

import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { ORCHESTRATOR_CONFIG } from './config.js';
import type { AgentRole, OrchestratorPhase, SessionId, TaskId } from './types.js';

// ─── Phase Colors ────────────────────────────────────────────

const PHASE_COLORS: Record<OrchestratorPhase, typeof chalk.blue> = {
  initializing: chalk.gray,
  analyzing: chalk.cyan,
  planning: chalk.blue,
  confirming: chalk.yellow,
  executing: chalk.green,
  reviewing: chalk.magenta,
  merging: chalk.yellow,
  completed: chalk.greenBright,
  failed: chalk.redBright,
};

const AGENT_COLORS: Record<AgentRole, typeof chalk.blue> = {
  frontend: chalk.cyan,
  backend: chalk.green,
  testing: chalk.yellow,
  docs: chalk.blue,
  review: chalk.magenta,
};

// ─── Logger Class ────────────────────────────────────────────

export class OrchestratorLogger {
  private readonly logDir: string;
  private readonly logFile: string;
  private spinner: Ora | null = null;
  private readonly verbose: boolean;

  constructor(sessionId: SessionId, verbose = false) {
    this.logDir = join(process.cwd(), ORCHESTRATOR_CONFIG.logsDir, sessionId);
    this.logFile = join(this.logDir, 'orchestrator.log');
    this.verbose = verbose;

    mkdirSync(this.logDir, { recursive: true });
  }

  // ─── Phase Logging ─────────────────────────────────────────

  phase(phase: OrchestratorPhase, message: string): void {
    const color = PHASE_COLORS[phase];
    const prefix = color(`[${phase.toUpperCase()}]`);
    const line = `${prefix} ${message}`;
    console.log(line);
    this.writeToFile(`[${phase}] ${message}`);
  }

  // ─── Agent Logging ─────────────────────────────────────────

  agent(role: AgentRole, message: string): void {
    const color = AGENT_COLORS[role];
    const prefix = color(`  [${role}]`);
    const line = `${prefix} ${message}`;
    console.log(line);
    this.writeToFile(`  [${role}] ${message}`);
  }

  // ─── Task Logging ──────────────────────────────────────────

  task(taskId: TaskId, message: string): void {
    const line = `    ${chalk.dim(taskId)} ${message}`;
    console.log(line);
    this.writeToFile(`    ${taskId} ${message}`);
  }

  // ─── Spinner Control ───────────────────────────────────────

  startSpinner(text: string): void {
    this.stopSpinner();
    this.spinner = ora({ text, color: 'cyan' }).start();
  }

  updateSpinner(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  succeedSpinner(text: string): void {
    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = null;
    }
  }

  failSpinner(text: string): void {
    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = null;
    }
  }

  stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  // ─── General Logging ───────────────────────────────────────

  info(message: string): void {
    console.log(chalk.dim(`  ${message}`));
    this.writeToFile(`  [info] ${message}`);
  }

  success(message: string): void {
    console.log(chalk.green(`  ✓ ${message}`));
    this.writeToFile(`  [success] ${message}`);
  }

  warn(message: string): void {
    console.log(chalk.yellow(`  ⚠ ${message}`));
    this.writeToFile(`  [warn] ${message}`);
  }

  error(message: string): void {
    console.log(chalk.red(`  ✗ ${message}`));
    this.writeToFile(`  [error] ${message}`);
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray(`    ${message}`));
    }
    this.writeToFile(`  [debug] ${message}`);
  }

  // ─── Formatted Output ─────────────────────────────────────

  separator(): void {
    const line = chalk.dim('─'.repeat(60));
    console.log(line);
  }

  banner(title: string): void {
    this.separator();
    console.log(chalk.bold.white(`  ${title}`));
    this.separator();
  }

  table(rows: readonly (readonly [string, string])[]): void {
    const maxKeyLen = Math.max(...rows.map(([key]) => key.length));
    for (const [key, value] of rows) {
      const paddedKey = key.padEnd(maxKeyLen);
      console.log(`  ${chalk.dim(paddedKey)}  ${value}`);
    }
  }

  // ─── File Logging ──────────────────────────────────────────

  private writeToFile(message: string): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    try {
      appendFileSync(this.logFile, line, 'utf-8');
    } catch {
      // Silently fail — file logging is best-effort
    }
  }
}
