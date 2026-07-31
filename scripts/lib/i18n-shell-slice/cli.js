#!/usr/bin/env node
/**
 * ADR-744 §6 — the CLI preamble both entry points need, owned once.
 *
 * The generator and the gate open the same way: parse argv, honour `--help`,
 * load `.i18n-shell-slice.json`, and die with a useful message when either
 * fails. Written twice it measured as a real clone (CHECK 3.28 / ADR-584,
 * 10 lines / 61 tokens) — the textbook sibling-clone shape where the second
 * script is authored by copying the first. They differ only in HOW they report
 * a failure, so that is the one thing injected.
 */

'use strict';

const { loadConfig } = require('./config');

/**
 * @param {{argv: string[],
 *          parseArgs: (argv: string[]) => object,
 *          printHelp: () => void,
 *          projectRoot: string,
 *          reportError: (message: string, phase: 'args'|'config') => void,
 *          exit: (code: number) => void}} options
 * @returns {?{args: object, config: object}} null when the process is exiting
 */
function bootstrap({ argv, parseArgs, printHelp, projectRoot, reportError, exit }) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    reportError(error.message, 'args');
    printHelp();
    exit(1);
    return null;
  }

  if (args.help) {
    printHelp();
    exit(0);
    return null;
  }

  let config;
  try {
    config = loadConfig(projectRoot);
  } catch (error) {
    reportError(error.message, 'config');
    exit(1);
    return null;
  }

  return { args, config };
}

module.exports = { bootstrap };
