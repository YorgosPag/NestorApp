#!/usr/bin/env node
/**
 * ADR-598 G2 — Dependency-CVE Audit Ratchet (pnpm audit)
 *
 * Gates newly-introduced HIGH / CRITICAL advisories from `pnpm audit`. Unlike a
 * raw-count ratchet, new CVEs get published against dependencies that never
 * changed in our tree — so counting would produce false regressions on an
 * untouched lockfile. Instead this is an ALLOWLIST ratchet keyed by the stable
 * GitHub advisory id (GHSA): every HIGH/CRITICAL advisory pnpm reports must be
 * present in `.pnpm-audit-baseline.json`. A HIGH/CRITICAL advisory that is NOT
 * allowlisted → BLOCK. Fixing/removing a vulnerable dependency simply drops its
 * advisory from `pnpm audit`; the stale allowlist entry is then reported as
 * prunable (never a hard failure).
 *
 * Two entry points, mirroring the jscpd ratchet (CHECK 3.28, ADR-584):
 *
 *   (default / --check)  Run `pnpm audit --audit-level high --json`, diff the
 *                        reported HIGH/CRITICAL advisories against the allowlist.
 *                        Any advisory outside the allowlist → exit 1. This is the
 *                        authoritative CI gate. Network-bound + slow → CI only,
 *                        never pre-commit.
 *
 *   --write-baseline     Seed/refresh the allowlist with every currently-reported
 *                        HIGH/CRITICAL advisory (pre-existing debt, tracked for
 *                        remediation). Mirror of `jscpd:baseline`.
 *
 * Config SSoT: severities gated here (high + critical) and the allowlist file.
 * Do NOT add a second parallel audit runner — extend this one.
 *
 * CLI:
 *   node scripts/check-dependency-audit-ratchet.js                  # check
 *   node scripts/check-dependency-audit-ratchet.js --write-baseline # seed allowlist
 *
 * Env:
 *   PNPM_AUDIT_BASELINE_FILE=... — redirect baseline (used by the Jest suite).
 *
 * Exit codes:
 *   0 — no un-allowlisted HIGH/CRITICAL advisories.
 *   1 — baseline missing/invalid, audit tooling failed, or a new
 *       HIGH/CRITICAL advisory appeared outside the allowlist.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_BASELINE_FILE = path.join(PROJECT_ROOT, '.pnpm-audit-baseline.json');

// Only these severities gate. moderate/low are tracked by pnpm's metadata but
// never block (they move with unrelated registry churn).
const GATED_SEVERITIES = ['high', 'critical'];

function getBaselineFile() {
  return process.env.PNPM_AUDIT_BASELINE_FILE
    ? path.resolve(process.env.PNPM_AUDIT_BASELINE_FILE)
    : DEFAULT_BASELINE_FILE;
}

function parseArgs(argv) {
  const out = { writeBaseline: false, check: false, help: false };
  for (const a of argv.slice(2)) {
    if (a === '--write-baseline') out.writeBaseline = true;
    else if (a === '--check') out.check = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function printHelp() {
  console.log(`ADR-598 G2 — Dependency-CVE Audit Ratchet (pnpm audit)

Usage:
  node scripts/check-dependency-audit-ratchet.js                  # check vs allowlist
  node scripts/check-dependency-audit-ratchet.js --write-baseline # seed/refresh allowlist

Baseline (allowlist): ${path.relative(PROJECT_ROOT, getBaselineFile())}
Gated severities:     ${GATED_SEVERITIES.join(', ')}
`);
}

// Stable, human-recognisable key for an advisory. GHSA ids are portable across
// registries; fall back to the numeric registry id only when GHSA is absent.
function advisoryKey(a) {
  return a.github_advisory_id || `NPM-${a.id}`;
}

// Spawn `pnpm audit --json` and return the parsed report. pnpm exits non-zero
// when advisories exist — that is NOT a tooling failure, so we parse stdout
// regardless of exit code. A missing/invalid JSON body IS a failure (fail closed
// so an offline/registry error can never silently pass the gate).
function runAudit() {
  const result = spawnSync('pnpm', ['audit', '--audit-level', 'high', '--json'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  const stdout = (result.stdout || '').trim();
  if (!stdout) {
    const detail = (result.stderr || '').toString().slice(0, 500);
    throw new Error(`pnpm audit produced no JSON output. ${detail}`);
  }
  try {
    return JSON.parse(stdout);
  } catch (e) {
    throw new Error(`Could not parse pnpm audit JSON: ${e.message}`);
  }
}

// Reduce the raw report to the HIGH/CRITICAL advisories we gate on, keyed by
// their stable advisory key.
function extractGatedAdvisories(report) {
  const advisories = (report && report.advisories) || {};
  const out = {};
  for (const raw of Object.values(advisories)) {
    if (!GATED_SEVERITIES.includes(raw.severity)) continue;
    out[advisoryKey(raw)] = {
      id: raw.id,
      ghsa: raw.github_advisory_id || null,
      severity: raw.severity,
      module: raw.module_name,
      title: raw.title,
      cves: Array.isArray(raw.cves) ? raw.cves : [],
      url: raw.url,
    };
  }
  return out;
}

function loadBaseline(filePath = getBaselineFile()) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed.allowed || typeof parsed.allowed !== 'object') {
      return { __invalid: 'missing "allowed" object' };
    }
    return parsed;
  } catch (e) {
    return { __invalid: `invalid JSON: ${e.message}` };
  }
}

function writeBaseline(gated, filePath = getBaselineFile()) {
  const allowed = {};
  for (const [key, a] of Object.entries(gated)) {
    allowed[key] = {
      id: a.id,
      severity: a.severity,
      module: a.module,
      title: a.title,
      cves: a.cves,
      url: a.url,
      reason: 'Seeded — pre-existing transitive advisory; tracked for remediation',
      owner: 'giorgio',
    };
  }
  const payload = {
    description:
      'ADR-598 G2 — pnpm audit CVE allowlist. Every HIGH/CRITICAL advisory pnpm reports must appear here (keyed by GHSA id). A HIGH/CRITICAL advisory outside this list blocks the PR. Ratchet: to accept a new advisory add it here with a reason/owner; to lock progress after a fix, prune the stale entry and refresh via `pnpm run deps-audit:baseline`.',
    adr: 'ADR-598',
    gatedSeverities: GATED_SEVERITIES,
    generatedBy: 'scripts/check-dependency-audit-ratchet.js --write-baseline',
    allowed,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n');
  const counts = Object.values(allowed).reduce((acc, a) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1;
    return acc;
  }, {});
  console.log(`✅ Wrote allowlist: ${path.relative(PROJECT_ROOT, filePath)}`);
  console.log(`   allowlisted advisories: ${Object.keys(allowed).length} (${JSON.stringify(counts)})`);
}

// Split current gated advisories into un-allowlisted (block) and stale allowlist
// entries no longer reported (prunable — informational only).
function diff(baseline, gated) {
  const allowed = baseline.allowed || {};
  const violations = Object.entries(gated)
    .filter(([key]) => !allowed[key])
    .map(([, a]) => a);
  const stale = Object.keys(allowed).filter((key) => !gated[key]);
  return { violations, stale };
}

function runCheck() {
  const baselineFile = getBaselineFile();
  const baseline = loadBaseline(baselineFile);
  if (!baseline || baseline.__invalid) {
    console.error(`❌ Dependency-CVE gate — baseline ${baseline ? baseline.__invalid : 'missing'}: ${path.relative(PROJECT_ROOT, baselineFile)}`);
    console.error(`   Run: pnpm run deps-audit:baseline`);
    process.exit(1);
  }

  let report;
  try {
    report = runAudit();
  } catch (e) {
    console.error(`❌ Dependency-CVE gate — pnpm audit failed: ${e.message}`);
    process.exit(1);
  }

  const gated = extractGatedAdvisories(report);
  const { violations, stale } = diff(baseline, gated);

  if (stale.length > 0) {
    console.log(`ℹ️  ${stale.length} allowlisted advisory/ies no longer reported (prunable via deps-audit:baseline): ${stale.slice(0, 10).join(', ')}${stale.length > 10 ? ' …' : ''}`);
  }

  if (violations.length === 0) {
    console.log(`✅ Dependency-CVE gate OK — ${Object.keys(gated).length} HIGH/CRITICAL advisory/ies, all allowlisted.`);
    process.exit(0);
  }

  console.error(`❌ Dependency-CVE gate FAIL — ${violations.length} new HIGH/CRITICAL advisory/ies outside the allowlist:`);
  for (const v of violations.slice(0, 20)) {
    console.error(`   • [${v.severity}] ${v.module} — ${v.title}`);
    console.error(`       ${advisoryKey(v)}  ${v.cves.length ? v.cves.join(', ') + '  ' : ''}${v.url}`);
  }
  if (violations.length > 20) console.error(`   … and ${violations.length - 20} more.`);
  console.error(``);
  console.error(`Remediation:`);
  console.error(`  1) Upgrade/replace the vulnerable dependency (preferred): pnpm audit --fix / pnpm update.`);
  console.error(`  2) If unavoidable transitive debt, allowlist it with a reason/owner:`);
  console.error(`     add the GHSA to .pnpm-audit-baseline.json, or refresh via pnpm run deps-audit:baseline.`);
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  if (args.writeBaseline) {
    writeBaseline(extractGatedAdvisories(runAudit()));
    process.exit(0);
  }
  runCheck();
}

// Exported for a future Jest suite (mirrors check-jscpd-ratchet.js).
module.exports = {
  parseArgs,
  advisoryKey,
  extractGatedAdvisories,
  loadBaseline,
  writeBaseline,
  diff,
  runAudit,
  runCheck,
  printHelp,
  main,
  GATED_SEVERITIES,
  DEFAULT_BASELINE_FILE,
};

if (require.main === module) {
  main();
}
