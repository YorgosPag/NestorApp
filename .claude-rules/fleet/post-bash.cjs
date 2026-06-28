'use strict';
/**
 * PostToolUse hook for Bash. When a foreground tsc/typecheck command finishes,
 * release this session's tsc slot immediately so the next agent can proceed
 * without waiting for the TTL.
 *
 * Background tsc (run_in_background) returns instantly, so we DON'T release if a
 * real tsc process is still alive — the live-process scan in tsc-gate + the TTL
 * handle that case. Side-effect only; always exits 0.
 */

const { execSync } = require('child_process');
const store = require('./fleet-store.cjs');

const TSC_PATTERNS = [/\btsc\b/i, /\bvue-tsc\b/i, /\btype-?check\b/i];

function readInput() {
  const fs = require('fs');
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function liveTscCount() {
  try {
    const ps =
      "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | " +
      "Where-Object { $_.CommandLine -like '*tsc*' -and $_.CommandLine -notlike '*fleet*' } | " +
      'Measure-Object | Select-Object -ExpandProperty Count';
    const out = execSync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, {
      encoding: 'utf8',
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const n = parseInt(String(out).trim(), 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function main() {
  const input = readInput();
  const cmd = (input.tool_input && input.tool_input.command) || '';
  if (!TSC_PATTERNS.some((re) => re.test(cmd))) process.exit(0);

  const sessionId = input.session_id || 'unknown';

  store.withLock(() => {
    const s = store.readState();
    store.touchSession(s, sessionId, input.cwd);
    // Only release my own slot, and only if no tsc is still running.
    if (s.tsc && s.tsc.owner === sessionId && liveTscCount() === 0) {
      s.tsc = null;
    }
    store.writeState(s);
  });

  process.exit(0);
}

main();
