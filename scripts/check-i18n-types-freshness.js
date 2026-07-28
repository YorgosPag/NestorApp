#!/usr/bin/env node
'use strict';
/**
 * CHECK 3.33 — i18n generated-types freshness gate (ADR-727)
 *
 * `src/types/i18n.ts` is a GENERATED file (scripts/generate-i18n-types.js). It
 * is the type backbone of every `t('ns.key')` call in the app, and it went four
 * months stale — 2026-04-03 → 2026-07-29, a +39.924/−16.377 line drift — while
 * every one of the 30+ pre-commit CHECKs reported green. Nothing in the repo
 * asked the one question that matters: "does this generated file still match
 * the files it was generated from?"
 *
 * This gate asks exactly that, and nothing else.
 *
 * NOT A RATCHET (deliberately)
 * ----------------------------
 * Freshness is binary — a file is regenerated or it is not. There is no
 * baseline file, no tolerated count, no gradual descent. If you ever find
 * yourself writing `.i18n-types-baseline.json`, you have taken a wrong turn.
 *
 * TWO STRUCTURAL TRAPS THIS SCRIPT EXISTS TO SURVIVE
 * --------------------------------------------------
 * 1. NON-DETERMINISM (fixed at the source by ADR-727). The generator used to
 *    embed `new Date().toISOString()` in its header, so "regenerate and compare"
 *    could never pass — every run produced a different file even with zero real
 *    drift. The header is now a sha256 of the generator's inputs, so the output
 *    is reproducible and a plain comparison is meaningful.
 * 2. LINE ENDINGS. This repo runs `core.autocrlf=true` with NO `.gitattributes`,
 *    so the working-tree copy of the generated file carries CRLF while the
 *    generator writes LF. A byte comparison against the working tree would fail
 *    on every Windows machine — permanently, regardless of freshness. Both
 *    sides are normalized before comparison (see `normalize`).
 *
 * WHY NOT `mtime`: the stale file's mtime was *today* (checkout / EOL
 * normalization touch it) while its content was from April. File timestamps are
 * not a freshness signal here. Only content comparison works.
 *
 * WHY NO `--smoke` MODE: the sibling ratchets (3.28/3.29/3.30) have one because
 * their real scan spawns a multi-second child process. This check is pure
 * in-memory Node — 100 small JSON reads plus a string build, measured at ~137ms
 * — so a "cheap" mode would be a distinction without a difference. It always
 * does the real work.
 *
 * CLI:
 *   node scripts/check-i18n-types-freshness.js            # check (default)
 *   node scripts/check-i18n-types-freshness.js --check
 *   node scripts/check-i18n-types-freshness.js --help
 *
 * Env:
 *   SKIP_I18N_TYPES=1          — bypass the gate (justify to Giorgio).
 *   I18N_TYPES_LOCALE_DIR=...  — override the input locale dir (Jest suite).
 *   I18N_TYPES_OUTPUT_FILE=... — override the generated file (Jest suite).
 *
 * Exit codes:
 *   0 — generated file matches the locales on disk
 *   1 — stale, hand-edited, missing, or the locales could not be read
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  collectTranslationData,
  generateTypeDefinitions,
  fingerprintTranslationData,
  DEFAULT_LOCALE_DIR,
  TYPES_OUTPUT_FILE,
} = require('./generate-i18n-types');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REGENERATE_COMMAND = 'npm run generate:i18n-types';
const FINGERPRINT_PATTERN = /^ \* Generated from: sha256:([0-9a-f]{64})$/m;

function getLocaleDir() {
  return process.env.I18N_TYPES_LOCALE_DIR
    ? path.resolve(process.env.I18N_TYPES_LOCALE_DIR)
    : DEFAULT_LOCALE_DIR;
}

function getTypesFile() {
  return process.env.I18N_TYPES_OUTPUT_FILE
    ? path.resolve(process.env.I18N_TYPES_OUTPUT_FILE)
    : TYPES_OUTPUT_FILE;
}

function rel(filePath) {
  return path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
}

// CRLF↔LF, BOM and trailing-blank-line differences are checkout artefacts, not
// staleness. Normalizing BOTH sides is what keeps this gate from being red on
// every Windows working tree. See the header note on core.autocrlf.
function normalize(text) {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\s*$/, '\n');
}

function readFingerprint(text) {
  const match = normalize(text).match(FINGERPRINT_PATTERN);
  return match ? match[1] : null;
}

function firstDifference(expected, actual) {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const limit = Math.max(expectedLines.length, actualLines.length);

  for (let i = 0; i < limit; i += 1) {
    if (expectedLines[i] !== actualLines[i]) {
      return {
        line: i + 1,
        expected: expectedLines[i] ?? '(end of file)',
        actual: actualLines[i] ?? '(end of file)',
        expectedLineCount: expectedLines.length,
        actualLineCount: actualLines.length,
      };
    }
  }

  return null;
}

/**
 * Verdicts, and why they are worth separating:
 *   fresh         — content matches.
 *   missing       — the generated file is not there at all.
 *   legacy-header — built by the pre-ADR-727 generator (timestamp header).
 *   stale-inputs  — header fingerprint ≠ current inputs ⇒ locales moved on and
 *                   nobody re-ran the generator. This is the four-month bug.
 *   hand-edited   — header fingerprint matches the inputs but the body does
 *                   not ⇒ somebody edited a "Do not edit manually" file.
 * The fingerprint is what makes the last two distinguishable; a bare
 * "files differ" would leave the reader guessing which one they are in.
 */
function classify(expectedText, actualText, expectedFingerprint) {
  if (actualText === null) {
    return { verdict: 'missing' };
  }

  const expected = normalize(expectedText);
  const actual = normalize(actualText);

  if (expected === actual) {
    return { verdict: 'fresh' };
  }

  const diff = firstDifference(expected, actual);
  const actualFingerprint = readFingerprint(actual);

  if (actualFingerprint === null) {
    return { verdict: 'legacy-header', diff };
  }

  if (actualFingerprint !== expectedFingerprint) {
    return { verdict: 'stale-inputs', diff, actualFingerprint };
  }

  return { verdict: 'hand-edited', diff };
}

const VERDICT_MESSAGES = {
  missing: 'the generated file does not exist.',
  'legacy-header':
    'the generated file carries the pre-ADR-727 timestamp header — it predates deterministic codegen.',
  'stale-inputs':
    'the locale files changed and the generator was never re-run (the types describe an older set of keys).',
  'hand-edited':
    'the header fingerprint matches the locales, but the body does not — this generated file was edited by hand.',
};

function reportDiff(diff) {
  if (!diff) {
    return;
  }

  console.error(`   First difference at line ${diff.line}:`);
  console.error(`     expected: ${diff.expected.slice(0, 160)}`);
  console.error(`     on disk:  ${diff.actual.slice(0, 160)}`);
  console.error(`   Line count: expected ${diff.expectedLineCount}, on disk ${diff.actualLineCount}`);
}

function reportFailure(result, context) {
  console.error(`❌ CHECK 3.33 FAIL — ${rel(context.typesFile)} is not in sync with the locale files.`);
  console.error(`   Reason: ${VERDICT_MESSAGES[result.verdict]}`);
  console.error(`   Inputs: ${context.fileCount} JSON file(s) in ${rel(context.localeDir)}`);
  console.error(`   Expected fingerprint: sha256:${context.expectedFingerprint}`);

  if (result.actualFingerprint) {
    console.error(`   On-disk fingerprint:  sha256:${result.actualFingerprint}`);
  }

  reportDiff(result.diff);
  console.error('');
  console.error('Remediation:');
  console.error(`  1) Regenerate: ${REGENERATE_COMMAND}`);
  console.error(`  2) Stage the result together with your locale change: git add ${rel(context.typesFile)}`);
  console.error('  3) Never hand-edit that file — it is machine output (ADR-727).');
  console.error('');
  console.error('Emergency skip (justify to Giorgio): SKIP_I18N_TYPES=1 git commit ...');
}

function runCheck() {
  const localeDir = getLocaleDir();
  const typesFile = getTypesFile();

  if (!fs.existsSync(localeDir)) {
    console.error(`❌ CHECK 3.33 — locale directory not found: ${rel(localeDir)}`);
    process.exit(1);
  }

  const { data, failures, fileCount } = collectTranslationData(localeDir);

  if (failures.length > 0) {
    console.error(`❌ CHECK 3.33 — could not parse ${failures.length} locale file(s): ${failures.join(', ')}`);
    console.error('   Fix the malformed JSON first; freshness cannot be judged without it.');
    process.exit(1);
  }

  const expectedText = generateTypeDefinitions(data);
  const expectedFingerprint = fingerprintTranslationData(data);
  const actualText = fs.existsSync(typesFile) ? fs.readFileSync(typesFile, 'utf8') : null;
  const result = classify(expectedText, actualText, expectedFingerprint);

  if (result.verdict === 'fresh') {
    console.log(
      `✅ CHECK 3.33 OK — ${rel(typesFile)} matches ${fileCount} locale file(s) ` +
      `(sha256:${expectedFingerprint.slice(0, 12)}…)`
    );
    process.exit(0);
  }

  reportFailure(result, { typesFile, localeDir, fileCount, expectedFingerprint });
  process.exit(1);
}

function parseArgs(argv) {
  const out = { check: false, help: false };

  for (const arg of argv.slice(2)) {
    if (arg === '--check') out.check = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return out;
}

function printHelp() {
  console.log(`CHECK 3.33 — i18n generated-types freshness gate (ADR-727)

Usage:
  node scripts/check-i18n-types-freshness.js            # check (default)
  node scripts/check-i18n-types-freshness.js --check
  node scripts/check-i18n-types-freshness.js --help

Verifies that ${rel(TYPES_OUTPUT_FILE)} is what the generator would produce
right now from ${rel(DEFAULT_LOCALE_DIR)}. Zero tolerance, no baseline file.

Fix a failure with: ${REGENERATE_COMMAND}
Skip (justify to Giorgio): SKIP_I18N_TYPES=1
`);
}

function main() {
  let args;

  try {
    args = parseArgs(process.argv);
  } catch (error) {
    console.error(`❌ CHECK 3.33 — ${error.message}`);
    printHelp();
    process.exit(1);
    return;
  }

  if (args.help) {
    printHelp();
    process.exit(0);
    return;
  }

  runCheck();
}

// Exported for scripts/__tests__/check-i18n-types-freshness.test.js.
module.exports = {
  normalize,
  readFingerprint,
  firstDifference,
  classify,
  reportFailure,
  runCheck,
  parseArgs,
  printHelp,
  main,
  getLocaleDir,
  getTypesFile,
  FINGERPRINT_PATTERN,
  VERDICT_MESSAGES,
  REGENERATE_COMMAND,
};

if (require.main === module) {
  main();
}
