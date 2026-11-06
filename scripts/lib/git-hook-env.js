'use strict';
/**
 * Το περιβάλλον git που ΔΙΑΡΡΕΕΙ από hook σε παιδιά-διεργασίες — ΕΝΑΣ ορισμός (SSoT).
 *
 * Όταν το git τρέχει hook, εξάγει `GIT_DIR` / `GIT_INDEX_FILE` (και, κατά περίπτωση, τα
 * υπόλοιπα της λίστας). Κάθε `git` που ξεκινά από εκεί και κάτω τα κληρονομεί και
 * χτυπά το repo **του hook**, όχι εκείνο του `cwd` ή του `-C`.
 *
 * 🔴 ΠΕΡΙΣΤΑΤΙΚΟ 2026-11-06: commit στο worktree `accounting-competitive-parity`. Ο hook
 * έτρεξε τη σουίτα jest· τα self-tests πυλών (`gate-input`, `git-changed-lines`,
 * `i18n-lazy-route-namespaces`, …) κάνουν `git init` / `git commit -m base` σε προσωρινό
 * φάκελο **χωρίς** καθαρό περιβάλλον ⇒ το `git init` ξαναρχικοποίησε το ΠΡΑΓΜΑΤΙΚΟ repo
 * (`GIT_DIR` χωρίς `GIT_WORK_TREE` ⇒ `core.bare=true` στο κοινό config) και 14 commits
 * «base» μπήκαν στο κλαδί του πράκτορα.
 */

const LEAKED_GIT_ENV = Object.freeze([
  'GIT_DIR',
  'GIT_INDEX_FILE',
  'GIT_WORK_TREE',
  'GIT_PREFIX',
  'GIT_OBJECT_DIRECTORY',
]);

/** Αντίγραφο του `env` χωρίς τις μεταβλητές του hook — για `spawn`/`execFile({ env })`. */
function cleanGitEnv(env = process.env) {
  const clean = { ...env };
  LEAKED_GIT_ENV.forEach((key) => delete clean[key]);
  return clean;
}

/** Αφαιρεί επί τόπου τις μεταβλητές του hook — για το περιβάλλον μιας ολόκληρης διεργασίας. */
function scrubGitEnv(env = process.env) {
  LEAKED_GIT_ENV.forEach((key) => delete env[key]);
}

module.exports = { LEAKED_GIT_ENV, cleanGitEnv, scrubGitEnv };
