#!/usr/bin/env node
/**
 * SSoT for spawning `tsc` from a quality gate — ADR-598 G14 / ADR-663 / ADR-027.
 *
 * WHY THIS EXISTS (measured 2026-08-05, ADR-757 ΦΑΣΗ Β):
 * Three gates spawn the TypeScript compiler, each with its own idea of what a
 * failed compiler run means — and all three were wrong in a different way:
 *
 *   check-type-complexity-ratchet.js  threw "no Instantiations line" and DROPPED
 *                                     tsc's stdout+stderr on the floor. The gate
 *                                     was red for 9 days (13 consecutive runs)
 *                                     and nobody could say why, because the
 *                                     evidence was never printed.
 *   check-dxf-tsc-ratchet.js          did fail closed with an 800-char detail —
 *                                     the only one that got it roughly right —
 *                                     but carried its own private heap ceiling.
 *   enterprise-ts-gate.js             counted "error TS" lines inside a catch:
 *                                     a compiler that CRASHES emits none, so a
 *                                     crash was indistinguishable from "0 errors,
 *                                     you fixed 3005!" — a structural false green.
 *
 * The lesson is the house rule from ADR-598 §7 / ADR-757: **a gate that fails for
 * the wrong reason hides the right one**, and its sibling, "0 = nobody looked".
 * A gate may not report a number it did not measure, and it may not stay silent
 * about why it could not measure.
 *
 * ── THE MODEL: measurement failure ≠ measurement says bad ────────────────────
 * Borrowed from the Monitoring Plugins / Nagios four-state contract, which has
 * governed exactly this distinction for two decades: CRITICAL means "the check
 * ran and the thing is bad"; UNKNOWN means "the check itself could not run".
 * Both must fail closed — but they are NOT the same message, and conflating them
 * is what cost the 9 days. So every failure here is named, and the caller can
 * say UNKNOWN out loud instead of implying a regression that was never measured.
 *
 * ── HEAP: derived, never a magic number in a workflow ────────────────────────
 * `--max-old-space-size` is a CEILING, not a reservation, so it must be sized to
 * the MACHINE, not copy-pasted. It had drifted into four unrelated numbers
 * (6144 in one workflow env, 8192 hardcoded in another gate, 8192 in a third,
 * 12288 in the production build) while a comment claimed they "mirror" each
 * other. ADR-598 (2026-08-04) records the cost of trusting such a claim: the
 * production build ran at 8192 for four weeks while the workflow said 12288.
 * Here the ceiling is DERIVED from the host and echoed on every run, so the log
 * always states the ceiling that was actually in force.
 */

'use strict';

const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/**
 * The explicit outcomes. Anything that is not RAN is an UNKNOWN in the
 * monitoring sense: the gate has no measurement and must say so.
 *
 * NO_DIAGNOSTICS is assigned by the CALLER, not by classifyTscResult(): only the
 * caller knows which payload it needed (counters, error lines, …). It lives in
 * this enum so all three gates speak one vocabulary.
 */
const TSC_OUTCOME = Object.freeze({
  RAN: 'ran',
  SPAWN_FAILED: 'spawn-failed',
  OUT_OF_MEMORY: 'out-of-memory',
  KILLED: 'killed',
  OUTPUT_TRUNCATED: 'output-truncated',
  NO_DIAGNOSTICS: 'no-diagnostics',
});

/**
 * V8's own wording when the JS heap is exhausted. Node prints these and then
 * ABORTS — so the process carries a signal (SIGABRT/SIGILL) too. That is exactly
 * why the OOM test must run BEFORE the signal test in classifyTscResult(): check
 * the signal first and every OOM is mislabelled "killed", which is the same
 * class of bug this module exists to kill.
 */
const OOM_SIGNATURES = [
  'JavaScript heap out of memory',
  'Reached heap limit Allocation failed',
  'Ineffective mark-compacts near heap limit',
  'FATAL ERROR: Reached heap limit',
];

/** Proven on ubuntu-latest (16 GB) by docker-build.yml + bundle-ratchet.yml. */
const CI_TSC_HEAP_MB = 12288;
/** Below this tsc cannot check this project at all (ADR-598: OOM at ~4 GB). */
const MIN_TSC_HEAP_MB = 4096;
/** Leave headroom for the OS and for tsc's non-heap (native) memory. */
const HOST_HEAP_FRACTION = 0.75;

/**
 * Size the heap ceiling to the host. On a 16 GB CI runner this yields the proven
 * 12288; on Giorgio's weaker PC it yields a ceiling that produces a CLEAN JS OOM
 * instead of dragging the machine into swap and getting SIGKILLed by the OS
 * (ADR-598 explicitly refused to make the local build ask for 12 GB).
 * `TSC_HEAP_MB` overrides for one-off investigations.
 */
function resolveHeapMb(env = process.env, totalMemBytes = os.totalmem()) {
  const override = Number(env.TSC_HEAP_MB);
  if (Number.isFinite(override) && override > 0) return Math.floor(override);
  const totalMb = Math.floor(totalMemBytes / (1024 * 1024));
  const derived = Math.floor(totalMb * HOST_HEAP_FRACTION);
  return Math.max(MIN_TSC_HEAP_MB, Math.min(CI_TSC_HEAP_MB, derived));
}

function combineOutput(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function looksLikeOom(text) {
  return OOM_SIGNATURES.some((sig) => text.includes(sig));
}

/**
 * Pure classifier over a spawnSync-shaped result — the whole point of keeping it
 * separate from runTsc() is that every branch is unit-testable without spending
 * five minutes of CI to reproduce a compiler crash.
 *
 * Order is load-bearing (see OOM_SIGNATURES): truncation and spawn failure are
 * decided by `error`, then OOM by TEXT, then any remaining signal, then RAN.
 * A non-zero exit status alone is NOT a failure here: `tsc` exits non-zero
 * whenever it finds type errors, which is the normal case for these gates.
 */
function classifyTscResult(result) {
  if (result.error && result.error.code === 'ENOBUFS') {
    return { outcome: TSC_OUTCOME.OUTPUT_TRUNCATED, detail: 'stdout exceeded maxBuffer — output is incomplete, parsing it would undercount' };
  }
  if (result.error) {
    return { outcome: TSC_OUTCOME.SPAWN_FAILED, detail: String(result.error.message || result.error) };
  }
  const combined = combineOutput(result);
  if (looksLikeOom(combined)) {
    return { outcome: TSC_OUTCOME.OUT_OF_MEMORY, detail: 'V8 exhausted the JS heap — raise the ceiling or reduce type work' };
  }
  if (result.signal) {
    return { outcome: TSC_OUTCOME.KILLED, detail: `terminated by ${result.signal} (no V8 heap message — likely the OS OOM-killer or a job timeout)` };
  }
  return { outcome: TSC_OUTCOME.RAN, detail: null };
}

/** Last N characters of tsc's own output — the evidence that used to be lost. */
function outputTail(text, limit = 2000) {
  const trimmed = String(text || '').trim();
  if (trimmed.length <= limit) return trimmed;
  return `…(truncated, last ${limit} chars)…\n${trimmed.slice(-limit)}`;
}

/**
 * The message a gate prints when it has NO measurement. Explicitly labelled
 * UNKNOWN so nobody reads it as "the metric regressed" — and it always carries
 * the ceiling that was in force plus tsc's own last words.
 */
function formatTscFailure({ outcome, detail, command, heapMb, status, signal, output, combined }) {
  // `combined` is what runTsc() returns; `output` is the explicit form. Accept
  // BOTH — reading only one of them is how this function would have gone on
  // printing "no output at all" while holding the evidence in the other field,
  // i.e. the exact defect it exists to prevent (caught 2026-08-05 before commit).
  const evidence = output === undefined ? combined : output;
  const lines = [
    `⚠️  UNKNOWN — the measurement did not happen (state: ${outcome}).`,
    `   This is NOT a regression: nothing was measured. Fix the run, then read the number.`,
    `   why:     ${detail || 'no further detail'}`,
    `   command: ${command}`,
    `   heap:    --max-old-space-size=${heapMb} MB${process.env.TSC_HEAP_MB ? ' (from TSC_HEAP_MB)' : ' (derived from host RAM)'}`,
    `   exit:    status=${status === undefined ? 'n/a' : status} signal=${signal || 'none'}`,
    `   ── tsc output (tail) ─────────────────────────────────────────────`,
    outputTail(evidence) || '   (tsc produced no output at all)',
  ];
  return lines.join('\n');
}

/**
 * Spawn `tsc` and classify. NEVER throws on a compiler failure — it returns the
 * outcome so the caller decides how to report it. Heavy (a full type-check);
 * CI only per CLAUDE.md N.17.
 */
function runTsc({ args, cwd = PROJECT_ROOT, heapMb = resolveHeapMb(), maxBufferMb = 128 }) {
  const result = spawnSync('npx', ['tsc', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: maxBufferMb * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env, NODE_OPTIONS: `--max-old-space-size=${heapMb}` },
  });
  const { outcome, detail } = classifyTscResult(result);
  return {
    outcome,
    detail,
    heapMb,
    command: `npx tsc ${args.join(' ')}`,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    combined: combineOutput(result),
  };
}

/**
 * ── ΤΟ ΠΕΡΙΒΑΛΛΟΝ ΤΗΣ ΜΕΤΡΗΣΗΣ ──────────────────────────────────────────────
 * Μια baseline είναι σύγκριση **δύο μετρήσεων**, και μια σύγκριση δύο μετρήσεων
 * σε **διαφορετικά περιβάλλοντα** δεν μετρά τον κώδικα — μετρά τη διαφορά των
 * περιβαλλόντων. Ο μεταγλωττιστής είναι ο κριτής· αν αλλάξει έκδοση ή λειτουργικό,
 * ο ίδιος κώδικας δίνει άλλον αριθμό:
 *   · **έκδοση TypeScript** — κάθε minor προσθέτει ελέγχους (νέα σφάλματα σε
 *     αμετάβλητο κώδικα είναι το ΚΑΝΟΝΙΚΟ, όχι το εξαιρετικό)·
 *   · **λειτουργικό** — το Linux έχει **διάκριση πεζών/κεφαλαίων** στα μονοπάτια·
 *     ένα `import './Foo'` για αρχείο `foo.ts` περνά στα Windows και σκάει με
 *     TS2307 στο ubuntu, σε **όσα αρχεία** το κάνουν, ανεξάρτητα μεταξύ τους.
 *
 * Γι' αυτό το περιβάλλον **γράφεται μέσα στη baseline**. Χωρίς αυτό, ο μόνος
 * τρόπος να ξεχωρίσει κανείς το «χειροτέρεψε ο κώδικας» από το «άλλαξε ο κριτής»
 * είναι η μνήμη ενός ανθρώπου — και ακριβώς αυτή η μνήμη έλειπε επί 3,5 εβδομάδες.
 */
function describeEnvironment(env = process.env) {
  let typescript = null;
  try {
    typescript = require('typescript/package.json').version;
  } catch {
    typescript = null; // δεν εγκαταστάθηκε — αξίζει να φαίνεται, όχι να μαντεύεται
  }
  return {
    typescript,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    ci: Boolean(env.CI),
  };
}

/** Τα ΟΝΟΜΑΤΙΣΜΕΝΑ πεδία που, αν διαφέρουν, καθιστούν τη σύγκριση αναξιόπιστη. */
const COMPARABLE_KEYS = Object.freeze(['typescript', 'platform']);

/**
 * @returns {{comparable: boolean|null, drift: {key:string,baseline:unknown,current:unknown}[]}}
 * `comparable: null` σημαίνει «η baseline δεν κατέγραψε περιβάλλον» — **άγνωστο**,
 * που δεν επιτρέπεται να διαβαστεί ως «ίδιο».
 */
function environmentDrift(baselineEnv, currentEnv = describeEnvironment()) {
  if (!baselineEnv) return { comparable: null, drift: [] };
  const drift = COMPARABLE_KEYS
    .filter((k) => baselineEnv[k] !== currentEnv[k])
    .map((k) => ({ key: k, baseline: baselineEnv[k], current: currentEnv[k] }));
  return { comparable: drift.length === 0, drift };
}

module.exports = {
  PROJECT_ROOT,
  TSC_OUTCOME,
  COMPARABLE_KEYS,
  describeEnvironment,
  environmentDrift,
  OOM_SIGNATURES,
  CI_TSC_HEAP_MB,
  MIN_TSC_HEAP_MB,
  HOST_HEAP_FRACTION,
  resolveHeapMb,
  classifyTscResult,
  formatTscFailure,
  outputTail,
  runTsc,
};
