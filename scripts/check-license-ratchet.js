#!/usr/bin/env node
/**
 * ADR-598 G13 — License Compliance Ratchet (full-tree, CLAUDE.md N.5)
 *
 * Hardens the pre-commit CHECK 12, which only ran `license-checker --direct`
 * (production DIRECT deps) and silently skipped when license-checker was not
 * installed (unpinned `npx`). GPL/LGPL/AGPL almost always enter TRANSITIVELY, so
 * a --direct scan is blind to the real risk. This gate scans the FULL dependency
 * tree and blocks any package whose SPDX license is neither on the permissive
 * allowlist nor an explicitly-vetted named exception.
 *
 * SPDX semantics: a compound "(A OR B)" passes if ANY operand is allowed (the
 * consumer may pick the permissive one) — so "(GPL-2.0-only OR MIT)" is fine.
 * A single license or an "A AND B" expression passes only if ALL operands are
 * allowed. Pure copyleft with no permissive alternative therefore fails
 * naturally, with no special-case regex.
 *
 * Two entry points, mirroring the jscpd ratchet (CHECK 3.28, ADR-584):
 *
 *   (default / --check)  Scan the full tree, block on any non-allowlisted,
 *                        non-excepted license. Authoritative gate (CI + opt-in
 *                        local). license-checker reads node_modules, so deps
 *                        must be installed.
 *
 *   --write-baseline     Refresh the named-exception list with every currently-
 *                        installed package whose license is off the allowlist —
 *                        EXCEPT pure copyleft (GPL/LGPL/AGPL with no permissive
 *                        alternative), which is refused and reported, never
 *                        silently baselined (that would defeat N.5).
 *
 * Config SSoT: `.license-allowlist.json` holds `allowedLicenses` (curated SPDX
 * list, edit by hand) + `allowedPackages` (vetted exceptions). The permissive
 * defaults below seed the list only when the file has none.
 *
 * CLI:
 *   node scripts/check-license-ratchet.js                  # check full tree
 *   node scripts/check-license-ratchet.js --write-baseline # refresh exceptions
 *
 * Env:
 *   LICENSE_ALLOWLIST_FILE=... — redirect allowlist (used by the Jest suite).
 *
 * Exit codes:
 *   0 — every package license is allowlisted or a vetted exception.
 *   1 — allowlist missing/invalid, license-checker failed, a non-permissive
 *       license appeared, or --write-baseline refused a pure-copyleft package.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_ALLOWLIST_FILE = path.join(PROJECT_ROOT, '.license-allowlist.json');

// Permissive SPDX ids allowed by CLAUDE.md N.5 (MIT/Apache/BSD) plus the
// universally-accepted public-domain-equivalent set. Curated — extend in the
// allowlist file, not here, unless a new license is genuinely permissive.
const DEFAULT_ALLOWED_LICENSES = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'CC0-1.0',
  'Unlicense',
  'BlueOak-1.0.0',
  'Python-2.0',
];

const COPYLEFT_RE = /\b(A?GPL|LGPL)\b/i;

function getAllowlistFile() {
  return process.env.LICENSE_ALLOWLIST_FILE
    ? path.resolve(process.env.LICENSE_ALLOWLIST_FILE)
    : DEFAULT_ALLOWLIST_FILE;
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
  console.log(`ADR-598 G13 — License Compliance Ratchet (full-tree, N.5)

Usage:
  node scripts/check-license-ratchet.js                  # check full tree
  node scripts/check-license-ratchet.js --write-baseline # refresh vetted exceptions

Allowlist file: ${path.relative(PROJECT_ROOT, getAllowlistFile())}
`);
}

// Run license-checker over the FULL tree (no --direct) and return its JSON map
// of "pkg@version" -> { licenses, repository, ... }. Fail closed on any error
// (a missing/broken license-checker must never silently pass — the old CHECK 12
// bug). Resolved via the pinned devDependency, run through the package manager.
function runLicenseChecker() {
  const result = spawnSync('pnpm', ['exec', 'license-checker', '--json', '--production'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  const stdout = (result.stdout || '').trim();
  if (!stdout) {
    const detail = (result.stderr || '').toString().slice(0, 500);
    throw new Error(`license-checker produced no output. Is it installed (pnpm install)? ${detail}`);
  }
  try {
    return JSON.parse(stdout);
  } catch (e) {
    throw new Error(`Could not parse license-checker JSON: ${e.message}`);
  }
}

// Flatten a license-checker `licenses` value (string | string[]) into SPDX
// operand tokens, tracking whether the expression is an OR (any-of) or a
// single/AND (all-of). Trailing "*" (license-checker's "guessed" marker) is
// stripped.
function tokenizeLicense(licenses) {
  const raw = Array.isArray(licenses) ? licenses.join(' AND ') : String(licenses || 'UNKNOWN');
  const cleaned = raw.replace(/[()]/g, ' ');
  const isOr = /\bOR\b/i.test(cleaned);
  const tokens = cleaned
    .split(/\s+(?:OR|AND)\s+/i)
    .map((t) => t.trim().replace(/\*+$/, ''))
    .filter(Boolean);
  return { tokens: tokens.length ? tokens : ['UNKNOWN'], isOr };
}

// A license expression is permissive if: OR → at least one operand allowed;
// single/AND → every operand allowed.
function isLicenseAllowed(licenses, allowedSet) {
  const { tokens, isOr } = tokenizeLicense(licenses);
  const allowed = (t) => allowedSet.has(t);
  return isOr ? tokens.some(allowed) : tokens.every(allowed);
}

function isPureCopyleft(licenses, allowedSet) {
  const { tokens } = tokenizeLicense(licenses);
  const hasCopyleft = tokens.some((t) => COPYLEFT_RE.test(t));
  const hasPermissiveAlternative = tokens.some((t) => allowedSet.has(t));
  return hasCopyleft && !hasPermissiveAlternative;
}

function loadAllowlist(filePath = getAllowlistFile()) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(parsed.allowedLicenses)) return { __invalid: 'missing "allowedLicenses" array' };
    if (!parsed.allowedPackages || typeof parsed.allowedPackages !== 'object') {
      return { __invalid: 'missing "allowedPackages" object' };
    }
    return parsed;
  } catch (e) {
    return { __invalid: `invalid JSON: ${e.message}` };
  }
}

// A package is exempt if its exact "name@version" OR its bare name is listed in
// allowedPackages.
function isExcepted(pkgKey, allowedPackages) {
  if (allowedPackages[pkgKey]) return true;
  const bareName = pkgKey.replace(/@[^@]+$/, '');
  return Boolean(allowedPackages[bareName]);
}

// Split the scan into offenders (block) given the current allowlist.
function findOffenders(report, allowlist) {
  const allowedSet = new Set(allowlist.allowedLicenses);
  const offenders = [];
  for (const [pkgKey, info] of Object.entries(report)) {
    if (isLicenseAllowed(info.licenses, allowedSet)) continue;
    if (isExcepted(pkgKey, allowlist.allowedPackages)) continue;
    offenders.push({ pkg: pkgKey, license: info.licenses, repo: info.repository || '' });
  }
  return offenders;
}

function writeBaseline(report, filePath = getAllowlistFile()) {
  const existing = loadAllowlist(filePath);
  const allowedLicenses =
    existing && !existing.__invalid && existing.allowedLicenses.length
      ? existing.allowedLicenses
      : DEFAULT_ALLOWED_LICENSES;
  const allowedSet = new Set(allowedLicenses);
  const prior = existing && !existing.__invalid ? existing.allowedPackages : {};

  const allowedPackages = {};
  const refused = [];
  for (const [pkgKey, info] of Object.entries(report)) {
    if (isLicenseAllowed(info.licenses, allowedSet)) continue;
    if (isPureCopyleft(info.licenses, allowedSet)) {
      refused.push({ pkg: pkgKey, license: info.licenses });
      continue;
    }
    allowedPackages[pkgKey] = prior[pkgKey] || {
      license: info.licenses,
      reason: 'Seeded — off-allowlist but non-copyleft; manually vetted permissive/dev-only',
      owner: 'giorgio',
    };
  }

  const payload = {
    description:
      'ADR-598 G13 — full-tree license allowlist (CLAUDE.md N.5). A package passes if its SPDX license is in allowedLicenses (OR-any / AND-all semantics) or it is a vetted exception in allowedPackages. GPL/LGPL/AGPL with no permissive alternative is never auto-baselined. Refresh via `pnpm run license:baseline`.',
    adr: 'ADR-598',
    generatedBy: 'scripts/check-license-ratchet.js --write-baseline',
    allowedLicenses,
    allowedPackages,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n');
  console.log(`✅ Wrote allowlist: ${path.relative(PROJECT_ROOT, filePath)}`);
  console.log(`   allowedLicenses: ${allowedLicenses.length} · vetted exceptions: ${Object.keys(allowedPackages).length}`);
  return refused;
}

function runCheck() {
  const allowlistFile = getAllowlistFile();
  const allowlist = loadAllowlist(allowlistFile);
  if (!allowlist || allowlist.__invalid) {
    console.error(`❌ License gate — allowlist ${allowlist ? allowlist.__invalid : 'missing'}: ${path.relative(PROJECT_ROOT, allowlistFile)}`);
    console.error(`   Run: pnpm run license:baseline`);
    process.exit(1);
  }

  let report;
  try {
    report = runLicenseChecker();
  } catch (e) {
    console.error(`❌ License gate — ${e.message}`);
    process.exit(1);
  }

  const offenders = findOffenders(report, allowlist);
  if (offenders.length === 0) {
    console.log(`✅ License gate OK — ${Object.keys(report).length} packages, all permissive or vetted.`);
    process.exit(0);
  }

  console.error(`❌ License gate FAIL — ${offenders.length} package(s) with a non-permissive, non-vetted license:`);
  for (const o of offenders.slice(0, 30)) {
    console.error(`   • ${o.pkg} — ${o.license}${o.repo ? '  ' + o.repo : ''}`);
  }
  if (offenders.length > 30) console.error(`   … and ${offenders.length - 30} more.`);
  console.error(``);
  console.error(`Remediation:`);
  console.error(`  1) GPL/LGPL/AGPL → remove/replace the dependency (N.5 — non-negotiable).`);
  console.error(`  2) Genuinely-permissive but off-list license → add the SPDX id to`);
  console.error(`     allowedLicenses, or vet the package into allowedPackages with a reason.`);
  console.error(`  3) After vetting, refresh: pnpm run license:baseline`);
  process.exit(1);
}

function runWriteBaseline() {
  let report;
  try {
    report = runLicenseChecker();
  } catch (e) {
    console.error(`❌ License baseline — ${e.message}`);
    process.exit(1);
  }
  const refused = writeBaseline(report);
  if (refused.length > 0) {
    console.error(``);
    console.error(`🚫 REFUSED to baseline ${refused.length} copyleft package(s) (CLAUDE.md N.5 — remove/replace, do not allowlist):`);
    for (const r of refused.slice(0, 30)) console.error(`   • ${r.pkg} — ${r.license}`);
    if (refused.length > 30) console.error(`   … and ${refused.length - 30} more.`);
    process.exit(1);
  }
  process.exit(0);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  if (args.writeBaseline) { runWriteBaseline(); return; }
  runCheck();
}

// Exported for a future Jest suite (mirrors check-jscpd-ratchet.js).
module.exports = {
  parseArgs,
  tokenizeLicense,
  isLicenseAllowed,
  isPureCopyleft,
  isExcepted,
  loadAllowlist,
  writeBaseline,
  findOffenders,
  runLicenseChecker,
  runCheck,
  printHelp,
  main,
  DEFAULT_ALLOWED_LICENSES,
  DEFAULT_ALLOWLIST_FILE,
  COPYLEFT_RE,
};

if (require.main === module) {
  main();
}
