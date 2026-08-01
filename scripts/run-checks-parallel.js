#!/usr/bin/env node
'use strict';
/**
 * Phase 1 parallel check orchestrator for the pre-commit hook.
 *
 * Architecture:
 *   - JS checks  → worker_threads (zero spawn overhead, shared OS file cache,
 *                  single Node.js heap instead of 15 separate ones)
 *   - .sh checks → child_process.spawn (bash; cannot run in a thread)
 *
 * The bash hook sets STAGED_* environment variables and then calls this script.
 * All conditional logic lives here so the bash hook stays minimal.
 *
 * Environment inputs (set by pre-commit hook):
 *   STAGED_TS_FILES                staged .ts/.tsx (excl. .d.ts, node_modules)
 *   STAGED_LOCALE_FILES            staged src/i18n/locales/**\/*.json
 *   STAGED_QUERY_FILES             TS files containing query() + where()
 *   STAGED_SRC_TS_FILES            staged .ts/.tsx under src/
 *   STAGED_ALL_FILES               all staged files
 *   STAGED_NAV_TRIGGER_FILES       navigation factory / nav locale changes
 *   STAGED_RULES_COVERAGE_TRIGGERS firestore.rules or tests/firestore-rules changes
 *   STAGED_STORAGE_COVERAGE_TRIGGERS storage.rules changes
 *   STAGED_NOTIF_LOCALE_TRIGGERS   notification-key locale changes
 *   STAGED_AUDIT_CATALOGS_TRIGGER  audit-value-catalog changes
 *   SSOT_DISCOVER_FULL             '1' = run full ssot-discover scan
 *   SKIP_NATIVE_TOOLTIP / SKIP_TABS_IMPORT / SKIP_NO_FLASH  bypass specific checks
 *   SKIP_I18N_TYPES                '1' = bypass CHECK 3.33 (generated-types freshness)
 *   SKIP_I18N_SHELL_SLICE          '1' = bypass CHECK 3.34 (i18n shell-slice freshness)
 *   CHECK_WORKER_TIMEOUT_MS        per-worker timeout ms (default 60000)
 *
 * Exit: 0 = all pass, 1 = any fail.
 */

const { Worker }   = require('worker_threads');
const { spawn }    = require('child_process');
const fs           = require('fs');
const path         = require('path');

const RED    = '\x1b[0;31m';
const GREEN  = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC     = '\x1b[0m';

const cwd            = process.cwd();
const RUNNER         = path.join(__dirname, 'worker-check-runner.js');
const TIMEOUT_MS     = Number(process.env.CHECK_WORKER_TIMEOUT_MS) || 120_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseList(envVal) {
  if (!envVal) return [];
  return envVal.split('\n').map(s => s.trim()).filter(Boolean);
}

function has(rel) {
  return fs.existsSync(path.join(cwd, rel));
}

// ─── Environment inputs ───────────────────────────────────────────────────────

const tsFiles             = parseList(process.env.STAGED_TS_FILES);
const localeFiles         = parseList(process.env.STAGED_LOCALE_FILES);
const queryFiles          = parseList(process.env.STAGED_QUERY_FILES);
const srcTsFiles          = parseList(process.env.STAGED_SRC_TS_FILES);
const allFiles            = parseList(process.env.STAGED_ALL_FILES);
const navTriggers         = parseList(process.env.STAGED_NAV_TRIGGER_FILES);
const rulesCovTriggers    = parseList(process.env.STAGED_RULES_COVERAGE_TRIGGERS);
const storageCovTriggers  = parseList(process.env.STAGED_STORAGE_COVERAGE_TRIGGERS);
const notifLocaleTriggers = parseList(process.env.STAGED_NOTIF_LOCALE_TRIGGERS);
const auditCatalogsTrigger = parseList(process.env.STAGED_AUDIT_CATALOGS_TRIGGER);

const ssotFull    = process.env.SSOT_DISCOVER_FULL === '1';
const skipTenantScope = !!process.env.SKIP_FIRESTORE_TENANT_SCOPE;
const skipI18nTypes = !!process.env.SKIP_I18N_TYPES;
const skipShellSlice = !!process.env.SKIP_I18N_SHELL_SLICE;
const skipTooltip = !!process.env.SKIP_NATIVE_TOOLTIP;
const skipTabs    = !!process.env.SKIP_TABS_IMPORT;
const skipFlash   = !!process.env.SKIP_NO_FLASH;

// ─── Build check lists ────────────────────────────────────────────────────────

/** @type {{ id:string, name:string, script:string, args:string[] }[]} */
const threads = [];

/** @type {{ id:string, name:string, cmd:string, args:string[] }[]} */
const processes = [];

function addThread(id, name, script, args = []) {
  if (!has(script)) return;
  threads.push({ id, name, script, args });
}

function addBash(id, name, shScript, args = []) {
  if (!has(shScript)) return;
  processes.push({ id, name, cmd: 'bash', args: [shScript, ...args] });
}

if (tsFiles.length > 0) {
  // 3.5 + 3.6 run in Phase 0.5 (sync bash) — spawn deadlocks alongside worker threads
  addThread('3.7',  'SSoT imports',             'scripts/check-ssot-imports.js',               tsFiles);
  addThread('3.8',  'i18n missing keys',        'scripts/check-i18n-missing-keys.js',          tsFiles);
  addThread('3.12', 'Option i18n keys',         'scripts/check-option-i18n-keys.js',           tsFiles);
  addThread('3.13', 'i18n resolver',            'scripts/check-i18n-resolver-reachability.js', tsFiles);
  if (!skipTooltip)
    addThread('3.23', 'Native tooltip',         'scripts/check-native-tooltip.js',             tsFiles);
  if (!skipTabs)
    addThread('3.24', 'Tabs import ratchet',    'scripts/check-tabs-import-ratchet.js',        tsFiles);
  if (!skipFlash)
    addThread('3.25', 'No-flash ratchet',       'scripts/check-no-flash-ratchet.js',           tsFiles);
  addThread('4',    'File sizes',               'scripts/check-file-sizes.js',                 tsFiles);
}

if (localeFiles.length > 0)
  addBash('3.9', 'ICU interpolation', 'scripts/check-icu-interpolation.sh', localeFiles);

// CHECK 3.33 (ADR-727) — src/types/i18n.ts is generated from the locale JSONs.
// Trigger on either side of that dependency: a locale change that forgot the
// regeneration, or an edit to the generated file itself. Pure in-memory Node
// (no spawn), so it belongs here in Phase 1 rather than a sequential 0.x phase.
if (!skipI18nTypes && (localeFiles.length > 0 || allFiles.includes('src/types/i18n.ts')))
  addThread('3.33', 'i18n types freshness', 'scripts/check-i18n-types-freshness.js');

// CHECK 3.34 (ADR-744) — the synchronous i18n bootstrap is generated from the
// shell's import closure. Three things can invalidate it, so all three are
// triggers: a locale edit (the sliced VALUES move), any staged .ts/.tsx (it may
// BE a shell module, or may newly resolve a specifier the walk could not), and
// an edit to the generated output or its config. Layer 1 never builds the
// module graph — measured 0,7s against the manifest — so it belongs in Phase 1
// beside 3.33; the full graph rebuild is Layer 2, in CI.
const shellSliceTriggers = [
  ...localeFiles,
  ...tsFiles,
  ...allFiles.filter(f => f.startsWith('src/i18n/generated/') || f === '.i18n-shell-slice.json'),
];
if (!skipShellSlice && shellSliceTriggers.length > 0)
  addThread('3.34', 'i18n shell slice', 'scripts/check-i18n-shell-slice.js', tsFiles);

if (queryFiles.length > 0)
  addBash('3.10', 'Firestore companyId', 'scripts/check-firestore-companyid.sh', queryFiles);

// CHECK 3.35 — tenant scope (ADR-747). Ο διάδοχος του 3.10, με AST αντί για grep
// γραμμών: πιάνει και το client spread idiom (στο οποίο το 3.10 είναι ΔΟΜΙΚΑ
// τυφλό) και τις αλυσίδες του Admin SDK (τις οποίες δεν κοιτά καθόλου).
// Layer 1 = μόνο τα staged· Layer 2 (`--all`, ~2 λεπτά) τρέχει στο CI.
if (!skipTenantScope && srcTsFiles.length > 0)
  addThread('3.35', 'Firestore tenant scope', 'scripts/check-firestore-tenant-scope.js', srcTsFiles);

if (navTriggers.length > 0)
  addThread('3.11', 'Navigation labels', 'scripts/check-navigation-labels.js');

if (auditCatalogsTrigger.length > 0)
  addThread('3.14', 'Audit value catalogs', 'scripts/check-audit-value-catalogs.js');

if (srcTsFiles.length > 0) {
  addThread('3.15', 'Firestore index coverage',  'scripts/check-firestore-index-coverage.js',    srcTsFiles);
  addThread('3.17', 'Entity audit coverage',     'scripts/check-entity-audit-coverage.js',       srcTsFiles);
  addThread('3.18', 'SSoT discover',             'scripts/check-ssot-discover-ratchet.js',       ssotFull ? ['--full'] : []);
  addThread('3.20', 'Notification keys ratchet', 'scripts/check-notification-keys-ratchet.js',   srcTsFiles);
  addThread('3.26', 'Tailwind palette ratchet',  'scripts/check-tailwind-palette-ratchet.js',    srcTsFiles);
  addThread('3.27', 'DXF timing ratchet',        'scripts/check-dxf-timing-ratchet.js',          srcTsFiles);
}

if (rulesCovTriggers.length > 0)
  addThread('3.16', 'Firestore rules coverage',  'scripts/check-firestore-rules-test-coverage.js', rulesCovTriggers);

if (storageCovTriggers.length > 0)
  addThread('3.19', 'Storage rules coverage',    'scripts/check-storage-rules-test-coverage.js',   storageCovTriggers);

if (notifLocaleTriggers.length > 0)
  addThread('3.21', 'Notification keys locale',  'scripts/check-notification-keys-locale.js');

if (allFiles.length > 0)
  addThread('10', 'Secret scan', 'scripts/check-secret-scan.js', allFiles);

// ─── Runners ──────────────────────────────────────────────────────────────────

function runThread(check) {
  return new Promise(resolve => {
    const worker = new Worker(RUNNER, {
      workerData: { scriptPath: check.script, args: check.args, cwd },
      stdout: true,
      stderr: true,
    });

    let output = '';
    worker.stdout.on('data', chunk => { output += chunk; });
    worker.stderr.on('data', chunk => { output += chunk; });

    const timer = setTimeout(() => {
      worker.terminate();
      output += `\n${RED}  ⏰ CHECK ${check.id} timed out after ${TIMEOUT_MS / 1000}s${NC}\n`;
      resolve({ ...check, exitCode: 1, output });
    }, TIMEOUT_MS);

    worker.on('error', err => {
      clearTimeout(timer);
      output += `\n${RED}  ❌ Worker error [${check.id}]: ${err.message}${NC}\n`;
      resolve({ ...check, exitCode: 1, output });
    });

    worker.on('exit', code => {
      clearTimeout(timer);
      resolve({ ...check, exitCode: code ?? 0, output });
    });
  });
}

function runProcess(check) {
  return new Promise(resolve => {
    const proc = spawn(check.cmd, check.args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let output = '';
    proc.stdout.on('data', chunk => { output += chunk; });
    proc.stderr.on('data', chunk => { output += chunk; });

    const timer = setTimeout(() => {
      proc.kill();
      output += `\n${RED}  ⏰ CHECK ${check.id} timed out after ${TIMEOUT_MS / 1000}s${NC}\n`;
      resolve({ ...check, exitCode: 1, output });
    }, TIMEOUT_MS);

    proc.on('error', err => {
      clearTimeout(timer);
      output += `\n${RED}  ❌ Spawn error [${check.id}]: ${err.message}${NC}\n`;
      resolve({ ...check, exitCode: 1, output });
    });

    proc.on('close', code => {
      clearTimeout(timer);
      resolve({ ...check, exitCode: code ?? 0, output });
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const total = threads.length + processes.length;

  if (total === 0) {
    console.log(`${GREEN}  ✅ No Phase 1 checks triggered${NC}`);
    process.exit(0);
  }

  console.log(
    `${YELLOW}⚡ ${total} checks running in parallel` +
    ` (${threads.length} threads + ${processes.length} processes)...${NC}`
  );

  const results = await Promise.all([
    ...threads.map(runThread),
    ...processes.map(runProcess),
  ]);

  let failed = false;
  for (const r of results) {
    const out = r.output;
    if (out && out.trim()) {
      process.stdout.write(out.endsWith('\n') ? out : out + '\n');
    }
    if (r.exitCode !== 0) {
      failed = true;
      process.stdout.write(`${RED}  ⛔ CHECK ${r.id} (${r.name}) exited ${r.exitCode}${NC}\n`);
    }
  }

  if (failed) {
    process.exit(1);
  } else {
    console.log(`${GREEN}  ✅ All ${total} parallel checks passed${NC}`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(`${RED}Orchestrator fatal error: ${err.message}${NC}`);
  process.exit(1);
});
