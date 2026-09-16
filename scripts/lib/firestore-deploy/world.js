/**
 * ADR-865 — Ο «ΚΟΣΜΟΣ» ΠΟΥ ΚΡΙΝΕΙ Η ΠΥΛΗ: δίσκος + git, σε ένα σημείο.
 *
 * Το `judge.js` είναι καθαρό· εδώ ζουν **μόνο** οι αναγνώσεις.
 *
 * ⚠️ **Βάση σύγκρισης του Κ3** = `HEAD` (pre-commit / pre-push). Στο CI η βάση ορίζεται με
 * `FIRESTORE_DEPLOY_BASE_REF` (π.χ. `origin/main`)· χωρίς αυτήν, στο CI ο Κ3 συγκρίνει το commit
 * με τον εαυτό του — **δηλωμένο όριο**, όχι σιωπηλό πράσινο (ίδιο σχήμα με CHECK 3.85).
 *
 * @module scripts/lib/firestore-deploy/world
 */

'use strict';

const { execFileSync } = require('node:child_process');

const M = require('./model');

/** Έξοδος git ή `null` — ποτέ εξαίρεση προς τα έξω: απουσία ιστορικού δεν είναι σφάλμα πύλης. */
function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: M.paths.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function readHeadLedger() {
  const ref = process.env.FIRESTORE_DEPLOY_BASE_REF || 'HEAD';
  const text = git(['show', `${ref}:${M.rel(M.paths.ledger)}`]);
  if (text === null) return null; // δεν υπήρχε στη βάση — τίποτα καταγεγραμμένο να φυλαχτεί
  try {
    const parsed = JSON.parse(text);
    return { deployments: Array.isArray(parsed.deployments) ? parsed.deployments : [] };
  } catch {
    return null;
  }
}

/**
 * **Πόσα commits πέρασαν** από την τελευταία αλλαγή ενός αρχείου — `null` όταν δεν το ξέρει το git.
 *
 * ⚠️ Commits, **ποτέ μέρες**: ρολόι σε κρίση πύλης σημαίνει ότι η ίδια είσοδος δίνει άλλη
 * ετυμηγορία αύριο (μάθημα CHECK 3.33).
 */
function ageInCommits(relative) {
  const sha = git(['log', '-1', '--format=%H', '--', relative]);
  if (!sha) return null;
  const count = git(['rev-list', '--count', `${sha}..HEAD`]);
  return count === null ? null : Number(count);
}

/** Οι στόχοι με το αρχείο τους και το **τρέχον** αποτύπωμα (`digest: null` ⇒ λείπει το αρχείο). */
function resolveTargets(firebaseJson) {
  const targets = [];
  const sourceByTarget = {};
  for (const target of Object.keys(M.DEPLOY_TARGETS)) {
    const source = M.sourceOf(firebaseJson, target);
    if (source === null) continue; // δεν δηλώνεται καθόλου — ο Κ1 κρίνει την πληρότητα
    sourceByTarget[target] = source;
    const bytes = M.readSource(source);
    targets.push({ target, source, digest: bytes === null ? null : M.digestOf(bytes) });
  }
  return { targets, sourceByTarget };
}

function loadWorld() {
  const firebaseJson = M.loadFirebaseJson();
  const { targets, sourceByTarget } = resolveTargets(firebaseJson);
  return {
    firebaseJson,
    ledger: M.loadLedger(),
    headLedger: readHeadLedger(),
    targets,
    sourceByTarget,
    ageOf: ageInCommits,
  };
}

module.exports = { loadWorld, readHeadLedger, ageInCommits, resolveTargets, git };
