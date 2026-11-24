#!/usr/bin/env node
/**
 * Git Hooks Installer — Layer 1 of Defense in Depth (ADR-279)
 *
 * Points git at the repo-tracked hooks directory (`core.hooksPath`) so every
 * clone / fresh checkout picks up the canonical pre-commit pipeline without
 * manual steps. Runs from package.json `prepare` (pnpm lifecycle).
 *
 * Why Node and not bash: `prepare` runs in whatever shell launched
 * `pnpm install`. From PowerShell / cmd on Windows `bash` is not on PATH, so
 * the previous `bash scripts/install-hooks.sh` failed the whole install with
 * exit code 1 (2026-11-24). Node is always present where pnpm is.
 *
 * Why core.hooksPath and not copy-into-.git/hooks:
 *   - Single source of truth (the tracked file IS the hook)
 *   - No divergence between committed version and installed version
 */
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const HOOKS_DIR = 'scripts/git-hooks';

function resolveRepoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/** Executable bit on every hook — needed on Unix, no-op on Windows. */
function markHooksExecutable(hooksPath) {
  for (const name of fs.readdirSync(hooksPath)) {
    try {
      fs.chmodSync(path.join(hooksPath, name), 0o755);
    } catch {
      // best effort, same as the former `chmod +x … || true`
    }
  }
}

function main() {
  const repoRoot = resolveRepoRoot();
  if (!repoRoot) {
    console.log('⚠️  install-hooks.js: not inside a git work tree, skipping');
    return;
  }

  const hooksPath = path.join(repoRoot, HOOKS_DIR);
  if (!fs.existsSync(hooksPath)) {
    console.log(`⚠️  install-hooks.js: ${HOOKS_DIR} not found, skipping`);
    return;
  }

  execFileSync('git', ['-C', repoRoot, 'config', 'core.hooksPath', HOOKS_DIR], {
    stdio: 'inherit',
  });
  markHooksExecutable(hooksPath);

  console.log(`✅ Git hooks activated via core.hooksPath=${HOOKS_DIR}`);
}

main();
