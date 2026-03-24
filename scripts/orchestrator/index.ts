#!/usr/bin/env tsx
/**
 * Multi-Agent Orchestrator — CLI Entrypoint (ADR-261)
 *
 * Usage:
 *   npx tsx scripts/orchestrator/index.ts "Add payment badges to unit cards"
 *   npx tsx scripts/orchestrator/index.ts --dry-run "Refactor auth module"
 *   npx tsx scripts/orchestrator/index.ts --resume orch_20260324_abc123
 *   npx tsx scripts/orchestrator/index.ts --agents frontend,backend "Add new feature"
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'path';
import { Orchestrator } from './orchestrator.js';
import { isValidAgentRole } from './config.js';
import type { AgentRole, CliOptions, SessionId } from './types.js';

// ─── CLI Setup ───────────────────────────────────────────────

const program = new Command();

program
  .name('orchestrator')
  .description('Multi-Agent Orchestrator — Google-level task coordination with Claude Agent SDK')
  .version('1.0.0')
  .argument('[task]', 'Task description for the agents to execute')
  .option('-d, --dry-run', 'Show plan without executing', false)
  .option('-r, --resume <sessionId>', 'Resume a previous session')
  .option(
    '-a, --agents <roles>',
    'Comma-separated agent roles to use (e.g., frontend,backend)',
  )
  .option('-v, --verbose', 'Show detailed agent output', false)
  .option('--no-review', 'Skip the review agent quality gate')
  .action(async (task: string | undefined, rawOptions: Record<string, unknown>) => {
    try {
      // Validate inputs
      if (!task && !rawOptions.resume) {
        console.log(chalk.red('Error: Please provide a task or use --resume'));
        console.log('');
        console.log(chalk.dim('Examples:'));
        console.log(chalk.dim('  npx tsx scripts/orchestrator/index.ts "Add payment badges"'));
        console.log(chalk.dim('  npx tsx scripts/orchestrator/index.ts --dry-run "Refactor auth"'));
        console.log(chalk.dim('  npx tsx scripts/orchestrator/index.ts --resume orch_20260324_abc'));
        process.exit(1);
      }

      // Parse agent roles
      let agents: AgentRole[] | undefined;
      if (typeof rawOptions.agents === 'string') {
        agents = rawOptions.agents.split(',').map((r: string) => r.trim()) as AgentRole[];
        for (const role of agents) {
          if (!isValidAgentRole(role)) {
            console.log(chalk.red(`Invalid agent role: ${role}`));
            console.log(chalk.dim('Valid roles: frontend, backend, testing, docs, review'));
            process.exit(1);
          }
        }
      }

      // Build options
      const options: CliOptions = {
        dryRun: rawOptions.dryRun === true,
        resume: rawOptions.resume as SessionId | undefined,
        agents,
        verbose: rawOptions.verbose === true,
        noReview: rawOptions.review === false,
      };

      // Resolve project root
      const projectRoot = resolve(process.cwd());

      // Print banner
      console.log('');
      console.log(chalk.bold.cyan('  🤖 Multi-Agent Orchestrator v1.0.0'));
      console.log(chalk.dim('  Powered by Claude Agent SDK'));
      console.log('');

      // Run orchestrator
      const orchestrator = new Orchestrator(projectRoot, options);
      const finalState = await orchestrator.execute(task ?? 'Resume previous task');

      // Exit code based on result
      if (finalState.phase === 'completed') {
        process.exit(0);
      } else {
        process.exit(1);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\nFatal error: ${message}`));

      if (rawOptions.verbose) {
        console.error(error);
      }

      process.exit(1);
    }
  });

// ─── Run CLI ─────────────────────────────────────────────────

program.parse();
