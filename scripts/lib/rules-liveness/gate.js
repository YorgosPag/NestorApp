/**
 * CHECK 3.96 — η σάρωση: τα δύο αρχεία κανόνων ⇒ λογιστική + ευρήματα.
 *
 * Κριτήρια:
 *   Κ1 `uncovered-allow` — `allow` που δεν απαιτεί το `signInIsLive()` (και δεν είναι `if false`/δηλωμένο δημόσιο).
 *   Κ2 `missing-predicate` / `claim-mismatch` — το κατηγόρημα λείπει, ή ρωτά ΑΛΛΟ claim από τη σταθερά του πυρήνα.
 *       Χωρίς αυτό, το ευκολότερο πράσινο θα ήταν ένα `signInIsLive()` που επιστρέφει `true`.
 *   Κ3 `undeclared-public` / `orphan-public` / `reasonless-public` — το κλειστό σύνολο των `if true`.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  BLOCKING, CLAIM_CONSTANT, CLAIM_SOURCE_FILE, GATE_STATES, LIVENESS_PREDICATE, MIN_REASON_LENGTH, PUBLIC_READS, RULES_FILES,
} = require('./contract.js');
const { readRulesStructure } = require('./rules-structure.js');
const { guardedFunctions, judgeAllow } = require('./liveness.js');

/** Το όνομα του claim από την ΠΗΓΗ (`export const REVOKED_SIGN_INS_CLAIM = '…'`). */
function claimNameFrom(root) {
  const source = fs.readFileSync(path.join(root, CLAIM_SOURCE_FILE), 'utf8');
  const match = new RegExp(`export const ${CLAIM_CONSTANT}\\s*=\\s*'([^']+)'`).exec(source);
  return match ? match[1] : null;
}

const publicKey = (file, allow) => `${file} :: ${allow.matchPath} :: ${allow.ops}`;

/** Κ2: υπάρχει το κατηγόρημα, και ρωτά `auth_time` μέσα στο claim της πηγής; */
function predicateViolations(file, functions, claimName) {
  const predicate = functions.find((fn) => fn.name === LIVENESS_PREDICATE);
  if (!predicate) return [{ state: GATE_STATES.MISSING_PREDICATE, file, line: 0, detail: `${LIVENESS_PREDICATE}()` }];
  const asksClaim = claimName && predicate.expr.includes(`'${claimName}'`) && predicate.expr.includes("'auth_time'");
  return asksClaim ? [] : [{
    state: GATE_STATES.CLAIM_MISMATCH, file, line: predicate.line, detail: `αναμενόταν '${claimName}' + 'auth_time'`,
  }];
}

/** Κ1 + Κ3 για ένα αρχείο. */
function judgeFile(file, source, claimName, seenPublic) {
  const { functions, allows } = readRulesStructure(source);
  const guarded = guardedFunctions(functions, LIVENESS_PREDICATE);
  const violations = predicateViolations(file, functions, claimName);
  const tally = { [GATE_STATES.COVERED]: 0, [GATE_STATES.DENIED]: 0, [GATE_STATES.PUBLIC]: 0 };
  for (const allow of allows) {
    const verdict = judgeAllow(allow, LIVENESS_PREDICATE, guarded);
    if (verdict === 'uncovered') {
      violations.push({ state: GATE_STATES.UNCOVERED_ALLOW, file, line: allow.line, detail: `allow ${allow.ops}: if ${allow.expr}` });
      continue;
    }
    tally[verdict] += 1;
    if (verdict !== 'public') continue;
    const key = publicKey(file, allow);
    seenPublic.add(key);
    if (!(key in PUBLIC_READS)) violations.push({ state: GATE_STATES.UNDECLARED_PUBLIC, file, line: allow.line, detail: key });
  }
  return { violations, tally, allows: allows.length, functions: functions.length };
}

/** Κ3: ορφανές ή χωρίς λόγο δηλώσεις δημόσιας ανάγνωσης. */
function publicSetViolations(seenPublic) {
  return Object.entries(PUBLIC_READS).flatMap(([key, reason]) => {
    if (!seenPublic.has(key)) return [{ state: GATE_STATES.ORPHAN_PUBLIC, file: key.split(' :: ')[0], line: 0, detail: key }];
    return reason.trim().length < MIN_REASON_LENGTH
      ? [{ state: GATE_STATES.REASONLESS_PUBLIC, file: key.split(' :: ')[0], line: 0, detail: key }]
      : [];
  });
}

function emptyTally() {
  return Object.fromEntries(Object.values(GATE_STATES).map((state) => [state, 0]));
}

/** Η σάρωση — `read(file)` αντικαθίσταται στα tests (μεταλλάξεις χωρίς αρχεία στον δίσκο). */
function sweep(root, read = (file) => fs.readFileSync(path.join(root, file), 'utf8')) {
  const claimName = claimNameFrom(root);
  const seenPublic = new Set();
  const tally = emptyTally();
  const perFile = [];
  const violations = [];
  for (const file of RULES_FILES) {
    const result = judgeFile(file, read(file), claimName, seenPublic);
    perFile.push({ file, allows: result.allows, functions: result.functions });
    violations.push(...result.violations);
    for (const [state, count] of Object.entries(result.tally)) tally[state] += count;
  }
  violations.push(...publicSetViolations(seenPublic));
  for (const violation of violations) tally[violation.state] += 1;
  return { tally, perFile, violations, claimName };
}

module.exports = { BLOCKING, sweep };
