'use strict';
/**
 * SessionEnd hook. The terminal/session is really closing (exit, /clear, etc.),
 * so release every file lock, folder lane and tsc slot this session held — no
 * waiting for the TTL. Side-effect only; always exits 0.
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

function main() {
  const input = readInput();
  const sessionId = input.session_id || 'unknown';

  store.withLock(() => {
    const s = store.readState();
    store.releaseSession(s, sessionId);
    store.cleanStale(s);
    store.writeState(s);
  });

  process.exit(0);
}

main();
