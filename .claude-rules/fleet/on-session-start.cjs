'use strict';
/**
 * SessionStart hook. Registers this terminal as a fleet session, purges dead
 * sessions, and injects a live snapshot of who-owns-what into the agent's
 * context so it knows which files/lanes to avoid and whether tsc is busy.
 *
 * Emits the snapshot as additionalContext (JSON on stdout). Always exits 0.
 */

const store = require('./fleet-store.cjs');

function readInput() {
  const fs = require('fs');
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function buildSnapshot(s, myLabel) {
  const lines = [];
  lines.push('🤝 FLEET COORDINATION — είσαι ο πράκτορας **' + myLabel + '** σε αυτό το terminal.');
  lines.push('Συνεργάζεσαι με άλλα terminals στο ίδιο repo. Κανόνες:');
  lines.push('• Πριν γράψεις αρχείο, ο fleet-hook το κλειδώνει αυτόματα στο όνομά σου.');
  lines.push('• Αν ένα αρχείο/φάκελος ανήκει σε άλλον πράκτορα, το Edit/Write ΜΠΛΟΚΑΡΕΤΑΙ — πιάσε άλλη περιοχή.');
  lines.push('• tsc/typecheck: ΕΝΑΣ τη φορά (N.17). Αν τρέχει άλλος, περίμενε — ο hook το επιβάλλει.');
  lines.push('• Δες/άλλαξε κατάσταση: `node .claude-rules/fleet/fleet.cjs status`');
  lines.push('• Κλείδωσε ολόκληρο φάκελο ως δική σου λωρίδα: `node .claude-rules/fleet/fleet.cjs claim-lane "<prefix>"`');

  const sessions = Object.entries(s.sessions);
  if (sessions.length > 1) {
    lines.push('');
    lines.push('Ενεργοί πράκτορες αυτή τη στιγμή:');
    for (const [, sess] of sessions) {
      lines.push(`  - ${sess.label} (τελευταία δραστηριότητα ${store.fmtAgo(sess.lastSeen || sess.since)})`);
    }
  }

  const lanes = s.lanes || [];
  if (lanes.length) {
    lines.push('');
    lines.push('Κλειδωμένες λωρίδες (φάκελοι):');
    for (const l of lanes) lines.push(`  - ${l.prefix} → ${l.label}`);
  }

  const files = Object.entries(s.files);
  if (files.length) {
    lines.push('');
    lines.push(`Κλειδωμένα αρχεία (${files.length}):`);
    for (const [f, lk] of files.slice(0, 40)) lines.push(`  - ${f} → ${lk.label}`);
    if (files.length > 40) lines.push(`  … +${files.length - 40} ακόμη`);
  }

  if (s.tsc) {
    lines.push('');
    lines.push(`🚦 tsc/typecheck τρέχει τώρα: ${s.tsc.label} (εδώ και ${store.fmtAgo(s.tsc.since)}) — ΜΗΝ ξεκινήσεις δεύτερο.`);
  }

  return lines.join('\n');
}

function main() {
  const input = readInput();
  const sessionId = input.session_id || 'unknown';

  const snapshot = store.withLock(() => {
    const s = store.readState();
    store.cleanStale(s);
    const myLabel = store.touchSession(s, sessionId, input.cwd);
    store.writeState(s);
    return buildSnapshot(s, myLabel);
  });

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: snapshot,
      },
    }),
  );
  process.exit(0);
}

main();
