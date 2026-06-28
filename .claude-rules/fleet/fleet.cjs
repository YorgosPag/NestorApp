'use strict';
/**
 * Fleet CLI — manual coordination control for agents and for Giorgio.
 *
 *   node .claude-rules/fleet/fleet.cjs status
 *   node .claude-rules/fleet/fleet.cjs claim-lane "src/subapps/dxf-viewer/grips/" [label]
 *   node .claude-rules/fleet/fleet.cjs unclaim-lane "src/subapps/dxf-viewer/grips/"
 *   node .claude-rules/fleet/fleet.cjs release "<file>"      # free one file lock
 *   node .claude-rules/fleet/fleet.cjs free-tsc              # force-clear tsc slot
 *   node .claude-rules/fleet/fleet.cjs reset                 # wipe ALL fleet state
 *
 * Lanes/labels claimed from the CLI use the label you pass (or "CLI"), since the
 * CLI has no Claude session id.
 */

const store = require('./fleet-store.cjs');

function out(...a) {
  process.stdout.write(a.join(' ') + '\n');
}

function status() {
  const s = store.withLock(() => {
    const st = store.readState();
    store.cleanStale(st);
    store.writeState(st);
    return st;
  });

  out('🤝 FLEET STATUS');
  const sessions = Object.entries(s.sessions);
  out(`\nΕνεργοί πράκτορες (${sessions.length}):`);
  if (!sessions.length) out('  (κανένας)');
  for (const [id, sess] of sessions) {
    out(`  - ${sess.label}  [${id.slice(0, 8)}]  τελευταία: ${store.fmtAgo(sess.lastSeen || sess.since)}`);
  }

  out(`\nΛωρίδες/φάκελοι (${s.lanes.length}):`);
  if (!s.lanes.length) out('  (καμία)');
  for (const l of s.lanes) out(`  - ${l.prefix} → ${l.label} (${store.fmtAgo(l.since)})`);

  const files = Object.entries(s.files);
  out(`\nΚλειδωμένα αρχεία (${files.length}):`);
  for (const [f, lk] of files) out(`  - ${f} → ${lk.label} (${store.fmtAgo(lk.since)})`);

  out('\ntsc/typecheck:');
  out(s.tsc ? `  🚦 ${s.tsc.label} (${store.fmtAgo(s.tsc.since)})` : '  ✅ ελεύθερο');
}

function claimLane(prefix, label) {
  if (!prefix) return out('❌ Δώσε prefix, π.χ. "src/subapps/dxf-viewer/grips/"');
  const norm = store.relPath(prefix);
  store.withLock(() => {
    const s = store.readState();
    store.cleanStale(s);
    s.lanes = s.lanes.filter((l) => l.prefix.toLowerCase() !== norm);
    s.lanes.push({ prefix: norm, owner: `cli:${label || 'CLI'}`, label: label || 'CLI', since: store.now() });
    store.writeState(s);
  });
  out(`✅ Λωρίδα κλειδώθηκε: ${norm} → ${label || 'CLI'}`);
}

function unclaimLane(prefix) {
  const norm = store.relPath(prefix);
  store.withLock(() => {
    const s = store.readState();
    s.lanes = s.lanes.filter((l) => l.prefix.toLowerCase() !== norm);
    store.writeState(s);
  });
  out(`✅ Λωρίδα ελευθερώθηκε: ${norm}`);
}

function release(file) {
  const norm = store.relPath(file);
  store.withLock(() => {
    const s = store.readState();
    delete s.files[norm];
    store.writeState(s);
  });
  out(`✅ Αρχείο ελευθερώθηκε: ${norm}`);
}

function freeTsc() {
  store.withLock(() => {
    const s = store.readState();
    s.tsc = null;
    store.writeState(s);
  });
  out('✅ tsc slot ελευθερώθηκε');
}

function reset() {
  store.withLock(() => {
    store.writeState({ sessions: {}, files: {}, lanes: [], tsc: null });
  });
  out('✅ Όλη η κατάσταση fleet μηδενίστηκε');
}

function main() {
  const [cmd, a, b] = process.argv.slice(2);
  switch (cmd) {
    case 'status':
    case undefined:
      return status();
    case 'claim-lane':
      return claimLane(a, b);
    case 'unclaim-lane':
      return unclaimLane(a);
    case 'release':
      return release(a);
    case 'free-tsc':
      return freeTsc();
    case 'reset':
      return reset();
    default:
      out(`Άγνωστη εντολή: ${cmd}`);
      out('Διαθέσιμες: status | claim-lane | unclaim-lane | release | free-tsc | reset');
  }
}

main();
