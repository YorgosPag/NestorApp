'use strict';
/**
 * Fleet coordination — shared store (CommonJS, .cjs so it runs regardless of
 * package.json "type": "module").
 *
 * One state file on disk (locks.json) is the single source of truth shared by
 * ALL Claude Code terminals working on this repo (same filesystem path).
 * Hooks are separate short-lived processes, so each require()s this module.
 *
 * Concurrency: read-modify-write is guarded by an mkdir-based mutex (atomic on
 * every OS). Writes are atomic (temp file + rename on the same volume).
 *
 * NOTE: lifecycle is keyed on SESSIONS, not individual responses. A file lock
 * lives as long as its owning session keeps being active (heartbeat on every
 * hook). A crashed terminal frees its locks via SESSION_TTL.
 */

const fs = require('fs');
const path = require('path');

const FLEET_DIR = __dirname;
const ROOT = path.resolve(__dirname, '..', '..'); // <root>/.claude-rules/fleet -> <root>
const STATE = path.join(FLEET_DIR, 'locks.json');
const MUTEX = path.join(FLEET_DIR, '.mutex');
const BOARD = path.join(FLEET_DIR, 'fleet-board.md');

// A session is considered dead (and its locks reclaimable) after this much
// inactivity. Long enough to survive a coffee break / long single task, short
// enough that a closed terminal doesn't hold files hostage for a full day.
const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // 3h
// A tsc lock is just a small race-window guard; the real check is the live
// process scan. If a lock outlives this, it is stale (tsc never runs this long).
const TSC_TTL_MS = 6 * 60 * 1000; // 6min

function now() {
  return Date.now();
}

function sleep(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      /* spin fallback */
    }
  }
}

function emptyState() {
  return { sessions: {}, files: {}, lanes: [], tsc: null };
}

function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    return {
      sessions: s.sessions || {},
      files: s.files || {},
      lanes: s.lanes || [],
      tsc: s.tsc || null,
    };
  } catch {
    return emptyState();
  }
}

function writeState(s) {
  const tmp = `${STATE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
  fs.renameSync(tmp, STATE);
}

/** mkdir-based mutex with bounded wait + stale-mutex recovery (fail-open). */
function withLock(fn) {
  const deadline = Date.now() + 3000;
  let held = false;
  while (!held) {
    try {
      fs.mkdirSync(MUTEX);
      held = true;
    } catch {
      if (Date.now() > deadline) {
        // Assume a crashed holder left the mutex behind; reclaim once.
        try {
          fs.rmdirSync(MUTEX);
          fs.mkdirSync(MUTEX);
          held = true;
        } catch {
          return fn(); // fail-open: never block work on a stuck mutex
        }
      } else {
        sleep(20);
      }
    }
  }
  try {
    return fn();
  } finally {
    try {
      fs.rmdirSync(MUTEX);
    } catch {
      /* ignore */
    }
  }
}

/** Normalize any path to a repo-relative, forward-slash, lowercased key. */
function relPath(p) {
  if (!p) return null;
  const abs = path.isAbsolute(p) ? p : path.resolve(ROOT, p);
  const rel = path.relative(ROOT, abs);
  return rel.split(path.sep).join('/').toLowerCase();
}

/** Register/refresh a session, assigning a short human label on first sight. */
function touchSession(s, sessionId, cwd) {
  if (!sessionId) return 'A?';
  let sess = s.sessions[sessionId];
  if (!sess) {
    const taken = new Set(Object.values(s.sessions).map((x) => x.label));
    let n = 1;
    while (taken.has(`A${n}`)) n += 1;
    sess = { label: `A${n}`, since: now(), cwd: cwd || null };
    s.sessions[sessionId] = sess;
  }
  sess.lastSeen = now();
  if (cwd) sess.cwd = cwd;
  return sess.label;
}

function labelOf(s, sessionId) {
  return (s.sessions[sessionId] && s.sessions[sessionId].label) || sessionId?.slice(0, 6) || '??';
}

/** Drop dead sessions and everything they own. Mutates + returns state. */
function cleanStale(s) {
  const t = now();
  for (const [id, sess] of Object.entries(s.sessions)) {
    if (t - (sess.lastSeen || sess.since || 0) > SESSION_TTL_MS) {
      delete s.sessions[id];
    }
  }
  const alive = (id) => !!s.sessions[id];
  for (const [file, lk] of Object.entries(s.files)) {
    if (!alive(lk.owner)) delete s.files[file];
  }
  s.lanes = s.lanes.filter((l) => alive(l.owner));
  if (s.tsc && (!alive(s.tsc.owner) || t - s.tsc.since > TSC_TTL_MS)) {
    s.tsc = null;
  }
  return s;
}

/** Release every lock/lane/tsc held by a session (used on SessionEnd). */
function releaseSession(s, sessionId) {
  for (const [file, lk] of Object.entries(s.files)) {
    if (lk.owner === sessionId) delete s.files[file];
  }
  s.lanes = s.lanes.filter((l) => l.owner !== sessionId);
  if (s.tsc && s.tsc.owner === sessionId) s.tsc = null;
  delete s.sessions[sessionId];
  return s;
}

function fmtAgo(ms) {
  const sec = Math.max(0, Math.round((now() - ms) / 1000));
  if (sec < 90) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 90) return `${min}min`;
  return `${Math.round(min / 60)}h`;
}

/** Find a lane that blocks `rel` for someone other than `sessionId`. */
function blockingLane(s, rel, sessionId) {
  if (!rel) return null;
  return s.lanes.find((l) => l.owner !== sessionId && rel.startsWith(l.prefix.toLowerCase())) || null;
}

module.exports = {
  ROOT,
  FLEET_DIR,
  STATE,
  BOARD,
  SESSION_TTL_MS,
  TSC_TTL_MS,
  now,
  sleep,
  readState,
  writeState,
  withLock,
  relPath,
  touchSession,
  labelOf,
  cleanStale,
  releaseSession,
  blockingLane,
  fmtAgo,
};
