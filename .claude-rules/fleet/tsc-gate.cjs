'use strict';
/**
 * PreToolUse hook for Bash. Enforces N.17: only ONE tsc / typecheck at a time
 * across ALL terminals (Giorgio's machine freezes with 2+ concurrent tsc).
 *
 * Two lines of defence:
 *   (a) LIVE process scan  -> ground truth: is a real tsc node process running?
 *   (b) lock file w/ TTL   -> covers the startup race window before the process
 *                             becomes visible to the scan.
 *
 * Only tsc-shaped commands pay the cost of the scan; everything else exits in
 * microseconds. exit 2 = block, exit 0 = allow.
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

function isTscCommand(cmd) {
  if (!cmd) return false;
  return TSC_PATTERNS.some((re) => re.test(cmd));
}

/**
 * Count live `tsc` node processes, excluding our own fleet scripts. Mirrors the
 * N.17 PowerShell probe. Fail-open (returns 0) if the probe itself errors, so a
 * broken probe never wedges every Bash call.
 */
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
  if (!isTscCommand(cmd)) process.exit(0);

  const sessionId = input.session_id || 'unknown';

  const decision = store.withLock(() => {
    const s = store.readState();
    store.cleanStale(s);
    const myLabel = store.touchSession(s, sessionId, input.cwd);

    // (b) Another session holds a fresh tsc lock?
    if (s.tsc && s.tsc.owner !== sessionId) {
      store.writeState(s);
      return { ok: false, who: s.tsc.label, since: s.tsc.since };
    }

    // (a) A real tsc process is already running (started by anyone)?
    if (liveTscCount() > 0 && !(s.tsc && s.tsc.owner === sessionId)) {
      store.writeState(s);
      return { ok: false, who: 'άγνωστο', since: store.now() };
    }

    // Free -> claim the tsc slot.
    s.tsc = { owner: sessionId, label: myLabel, since: store.now() };
    store.writeState(s);
    return { ok: true };
  });

  if (decision && decision.ok === false) {
    process.stderr.write(
      `🚦 TSC GATE (N.17) — τρέχει ΗΔΗ tsc/typecheck από τον πράκτορα ${decision.who} ` +
        `(εδώ και ${store.fmtAgo(decision.since)}).\n` +
        `ΕΝΑΣ tsc τη φορά — ο υπολογιστής γονατίζει με 2+. ΠΕΡΙΜΕΝΕ να τελειώσει και ξαναπροσπάθησε.\n` +
        `Κατάσταση: node .claude-rules/fleet/fleet.cjs status\n`,
    );
    process.exit(2);
  }
  process.exit(0);
}

main();
