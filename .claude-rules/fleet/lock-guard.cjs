'use strict';
/**
 * PreToolUse hook for Edit | Write | MultiEdit | NotebookEdit.
 *
 * Auto-claims the target file for the current session. If another LIVE session
 * already owns that file (or a folder lane covering it), the edit is BLOCKED
 * (exit 2) so two terminals never write the same file in parallel.
 *
 * exit 0  -> allow (claim recorded as a side effect)
 * exit 2  -> deny  (stderr is shown to the agent)
 */

const store = require('./fleet-store.cjs');

function readInput() {
  try {
    return JSON.parse(fs_readStdin());
  } catch {
    return {};
  }
}
function fs_readStdin() {
  const fs = require('fs');
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function targetPath(input) {
  const ti = input.tool_input || {};
  return ti.file_path || ti.notebook_path || ti.path || null;
}

function main() {
  const input = readInput();
  const sessionId = input.session_id || 'unknown';
  const rel = store.relPath(targetPath(input));
  if (!rel) process.exit(0); // nothing to guard

  const decision = store.withLock(() => {
    const s = store.readState();
    store.cleanStale(s);
    const myLabel = store.touchSession(s, sessionId, input.cwd);

    // 1) Folder lane owned by someone else?
    const lane = store.blockingLane(s, rel, sessionId);
    if (lane) {
      store.writeState(s);
      return {
        ok: false,
        msg:
          `🔒 FLEET LANE LOCK — ο φάκελος "${lane.prefix}" ανήκει στον πράκτορα ` +
          `${lane.label} (εδώ και ${store.fmtAgo(lane.since)}).\n` +
          `Το αρχείο ${rel} πέφτει μέσα στη λωρίδα του. ΜΗΝ το αγγίξεις — δούλεψε σε άλλη περιοχή.\n` +
          `(N.8 fleet coordination. Ελευθέρωση από τον κάτοχο: ` +
          `node .claude-rules/fleet/fleet.cjs unclaim-lane "${lane.prefix}")`,
      };
    }

    // 2) File owned by another live session?
    const fl = s.files[rel];
    if (fl && fl.owner !== sessionId) {
      store.writeState(s);
      return {
        ok: false,
        msg:
          `🔒 FLEET FILE LOCK — το αρχείο ${rel} το επεξεργάζεται ο πράκτορας ` +
          `${fl.label} (εδώ και ${store.fmtAgo(fl.since)}).\n` +
          `Δύο terminals ΔΕΝ γράφουν το ίδιο αρχείο παράλληλα (git-conflict risk).\n` +
          `Πιάσε άλλο αρχείο, ή ζήτα από τον Giorgio/κάτοχο: ` +
          `node .claude-rules/fleet/fleet.cjs release "${rel}"`,
      };
    }

    // 3) Free (or already mine) -> claim / refresh.
    s.files[rel] = { owner: sessionId, label: myLabel, since: fl ? fl.since : store.now() };
    store.writeState(s);
    return { ok: true };
  });

  if (decision && decision.ok === false) {
    process.stderr.write(decision.msg + '\n');
    process.exit(2);
  }
  process.exit(0);
}

main();
