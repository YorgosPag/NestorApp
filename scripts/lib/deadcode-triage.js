#!/usr/bin/env node
/**
 * ADR-700 §3 — Provenance triage for the dead-code family.
 *
 * WHY THIS EXISTS
 * ---------------
 * CHECK 3.30 answers "is this reachable?". It does NOT answer the question that
 * actually decides what to do about it: **"is this dead, or is it not finished
 * yet?"** Both look identical to a reachability graph.
 *
 * That distinction is not academic. Incident 2026-04-24: 13 scaffolding files /
 * 2,338 lines of ADR-321 were deleted by a batch that trusted the tool. And
 * measured on the current baseline, 39 of the 332 dead files come from ADR-344,
 * whose status line reads "FULLY APPROVED — Ready for Phase 0 kickoff". They are
 * unwired work in progress, complete with their own tests. Deleting them would
 * destroy work, not clean up.
 *
 * The signal that separates the two is PROVENANCE: when was the file born, and
 * what was being built at the time. `git log --diff-filter=A` knows the first;
 * the commit subject plus the referenced ADR's own status line knows the second.
 *
 * THREE BUCKETS, and what each one means:
 *   notouch — born under an ADR that is still open ⇒ unfinished, NOT dead.
 *             Ask the human. Never a deletion candidate.
 *   look    — recent, or the ADR's status could not be read confidently.
 *             Manual judgement, one file at a time.
 *   legacy  — old, and either predates ADRs entirely or belongs to a closed one
 *             ⇒ the only bucket where "candidate for deletion" is even sayable.
 *
 * A BUCKET IS STILL NOT A LICENCE. `legacy` means "this is where to look first",
 * not "delete these". The per-file protocol in ADR-364 §10.7 stands unchanged.
 *
 * This module reads the FROZEN baseline, not a fresh scan: the baseline is the
 * agreed evidence list, and skipping the ~30s graph build makes triage usable
 * inside one session. Re-run the ratchet if you need the list itself refreshed.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

/** A file born on or after this counts as "recent" even under a closed ADR. */
const RECENT_SINCE = '2026-05-01';

const ADR_IN_SUBJECT = /ADR[-\s]?(\d{3})/i;
const INITIAL_IMPORT = /^Initial commit/i;

/** Status verdicts. Anything not confidently closed is treated as still open. */
const OPEN = 'OPEN';
const CLOSED = 'CLOSED';
const UNCLEAR = 'UNCLEAR';
const MISSING = 'NO_ADR_FILE';

const CLOSED_WORDS = /\b(COMPLETE|COMPLETED|DONE|SHIPPED|CLOSED|SUPERSEDED|OBSOLETE)\b/i;
const OPEN_WORDS = /\b(APPROVED|IN PROGRESS|ACTIVE|PHASE|DRAFT|READY|PROPOSED|PENDING)\b/i;

/**
 * One `git log` over the whole scope instead of one per file: the per-file form
 * costs ~0.4s each on Windows, which is 2+ minutes for 332 files.
 *
 * git log walks newest → oldest, so a file re-added after a delete is seen in
 * that order too; writing unconditionally leaves the OLDEST add in the map,
 * which is the birth we want.
 */
function readAddHistory({ root, scope, git = 'git' }) {
  const result = spawnSync(
    git,
    ['log', '--diff-filter=A', '--format=C|%ad|%s', '--date=short', '--name-only', '--', scope],
    { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
  );
  if (result.error) throw new Error(`git log failed: ${result.error.message}`);
  return parseAddHistory(result.stdout || '');
}

/** Split out from the spawn so the parsing is unit-testable without a repo. */
function parseAddHistory(stdout) {
  const born = new Map();
  let date = null;
  let subject = null;
  for (const raw of String(stdout).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('C|')) {
      const parts = line.split('|');
      date = parts[1];
      subject = parts.slice(2).join('|');
      continue;
    }
    if (date) born.set(line, { date, subject });
  }
  return born;
}

/**
 * Read an ADR's own status line. Deliberately fails OPEN, not closed: mistaking
 * live work for finished work is the expensive direction of this error.
 */
function readAdrStatus(adrDir, num) {
  let entries;
  try {
    entries = fs.readdirSync(adrDir);
  } catch {
    return MISSING;
  }
  const file = entries.find(f => f.startsWith(`ADR-${num}-`) && f.endsWith('.md'));
  if (!file) return MISSING;
  let head;
  try {
    head = fs.readFileSync(path.join(adrDir, file), 'utf8').slice(0, 4000);
  } catch {
    return MISSING;
  }
  const match = head.match(/\*\*Status:?\*\*:?\s*([^\n]{0,80})/i) || head.match(/^-?\s*Status:?\s*([^\n]{0,80})/im);
  const line = match ? match[1].trim() : '';
  if (!line) return UNCLEAR;
  if (CLOSED_WORDS.test(line)) return CLOSED;
  if (OPEN_WORDS.test(line)) return OPEN;
  return UNCLEAR;
}

/** Pure classifier — every input injected, so the buckets are testable offline. */
function triage(deadFiles, { history, statusOf, recentSince = RECENT_SINCE }) {
  const buckets = { notouch: [], look: [], legacy: [] };
  const reasons = new Map();
  const bump = r => reasons.set(r, (reasons.get(r) || 0) + 1);

  for (const file of deadFiles) {
    const born = history.get(file);
    if (!born) {
      buckets.look.push({ file, reason: 'birth commit not found — inspect by hand' });
      bump('birth commit not found');
      continue;
    }
    const recent = born.date >= recentSince;
    const adr = (born.subject.match(ADR_IN_SUBJECT) || [])[1];
    let bucket;
    let reason;

    if (adr) {
      const status = statusOf(adr);
      if (status === OPEN) {
        bucket = 'notouch';
        reason = `ADR-${adr} still open — unfinished, not dead`;
      } else if (status === CLOSED) {
        bucket = recent ? 'look' : 'legacy';
        reason = `ADR-${adr} closed${recent ? ', but born recently' : ''}`;
      } else {
        bucket = 'look';
        reason = `ADR-${adr} status ${status} — cannot judge`;
      }
    } else if (INITIAL_IMPORT.test(born.subject)) {
      bucket = 'legacy';
      reason = 'from the original 2025 import — predates ADRs';
    } else if (recent) {
      bucket = 'look';
      reason = 'born recently, no ADR in the commit subject';
    } else {
      bucket = 'legacy';
      reason = 'old, no ADR in the commit subject';
    }

    buckets[bucket].push({ file, reason, born: born.date, adr: adr || null });
    bump(reason);
  }

  return {
    ...buckets,
    total: deadFiles.length,
    reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })),
  };
}

module.exports = {
  RECENT_SINCE,
  OPEN,
  CLOSED,
  UNCLEAR,
  MISSING,
  readAddHistory,
  parseAddHistory,
  readAdrStatus,
  triage,
};
