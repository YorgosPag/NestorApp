#!/usr/bin/env node
/**
 * ENTERPRISE: SSoT Violations Baseline Engine (Google-grade ratchet generator)
 *
 * Single-process Node engine with worker_threads + content-hash incremental cache.
 *
 * Replaces the legacy bash implementation (302 modules × 6000 files = 60+ grep
 * walks of src/) with one in-memory pass:
 *
 *   - All patterns precompiled once per worker.
 *   - All src/ files read once, all modules checked per file.
 *   - Per-file content hash + registry hash → cache hit reuses previous counts.
 *   - Registry change (any pattern/allowlist edit) invalidates the entire cache.
 *
 * Output is byte-equivalent to the legacy script (same baseline shape, same
 * totals) — only the runtime differs.
 *
 * @module scripts/ssot-baseline-engine
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const ROOT = process.cwd();
const REGISTRY_FILE = path.join(ROOT, '.ssot-registry.json');
const CANONICAL_BASELINE = path.join(ROOT, '.ssot-violations-baseline.json');
const DRY_BASELINE = path.join(ROOT, '.ssot-violations-baseline.dry.json');
const CACHE_FILE = path.join(ROOT, '.ssot-baseline-cache.json');

const WRITE_CANONICAL = process.argv.includes('--write');
const BASELINE_FILE = WRITE_CANONICAL ? CANONICAL_BASELINE : DRY_BASELINE;

const COMMENT_RE = /^\s*(\/\/|\*|#)/;

// POSIX ERE → JS regex character classes (grep ERE compat layer)
const POSIX_CLASS_MAP = {
  '[[:space:]]': '\\s',
  '[[:alpha:]]': '[A-Za-z]',
  '[[:alnum:]]': '[A-Za-z0-9]',
  '[[:digit:]]': '\\d',
  '[[:lower:]]': '[a-z]',
  '[[:upper:]]': '[A-Z]',
  '[[:punct:]]': "[!-/:-@\\[-`{-~]",
  '[[:blank:]]': '[ \\t]',
  '[[:cntrl:]]': '[\\x00-\\x1F\\x7F]',
  '[[:graph:]]': '[\\x21-\\x7E]',
  '[[:print:]]': '[\\x20-\\x7E]',
  '[[:xdigit:]]': '[0-9A-Fa-f]',
};

function posixToJsPattern(src) {
  let out = src;
  for (const [posix, js] of Object.entries(POSIX_CLASS_MAP)) {
    out = out.split(posix).join(js);
  }
  return out;
}

function isAllowlisted(file, allowlist) {
  for (const a of allowlist) {
    if (file === a) return true;
    if (file.startsWith(a.endsWith('/') ? a : a + '/')) return true;
    if (a.endsWith('.ts') || a.endsWith('.tsx')) continue;
    if (file.startsWith(a)) return true;
  }
  return false;
}

// ─── Worker mode ──────────────────────────────────────────────────────────────

if (!isMainThread) {
  const { files, modules, cachedFiles } = workerData;
  const compiledModules = modules.map(m => ({
    name: m.name,
    regexes: m.regexes.map(src => new RegExp(posixToJsPattern(src))),
    allowlist: m.allowlist,
  }));

  const out = {};

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    } catch {
      continue;
    }

    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const cached = cachedFiles[file];
    if (cached && cached.hash === hash) {
      out[file] = { hash, total: cached.total };
      continue;
    }

    const lines = content.split('\n');
    const nonCommentLines = lines.filter(l => !COMMENT_RE.test(l));
    let total = 0;

    for (const mod of compiledModules) {
      if (isAllowlisted(file, mod.allowlist)) continue;
      for (const re of mod.regexes) {
        for (const line of nonCommentLines) {
          if (re.test(line)) total++;
        }
      }
    }

    out[file] = { hash, total };
  }

  parentPort.postMessage(out);
  return;
}

// ─── Main mode ────────────────────────────────────────────────────────────────

function listSrcFiles(exemptRe) {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fp);
      } else if (/\.tsx?$/.test(entry.name)) {
        const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
        if (!exemptRe.test(rel)) out.push(rel);
      }
    }
  }
  walk(path.join(ROOT, 'src'));
  return out;
}

function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return { registryHash: null, files: {} };
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return { registryHash: null, files: {} };
  }
}

async function main() {
  const t0 = Date.now();

  if (!fs.existsSync(REGISTRY_FILE)) {
    console.error(`❌ Registry not found: ${REGISTRY_FILE}`);
    process.exit(1);
  }

  console.log('🔧 Parsing SSoT registry...');
  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  const exemptRe = new RegExp(registry.exemptPatterns);

  const modules = Object.entries(registry.modules).map(([name, m]) => ({
    name,
    regexes: (m.forbiddenPatterns || []),
    allowlist: m.allowlist || [],
  }));

  const registryHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ exemptPatterns: registry.exemptPatterns, modules: registry.modules }))
    .digest('hex');

  const cache = loadCache();
  const cacheValid = cache.registryHash === registryHash;
  const cachedFiles = cacheValid ? cache.files : {};

  console.log(`  ✅ Modules: ${modules.length}  Cache: ${cacheValid ? 'valid (incremental)' : 'invalidated (registry changed → full scan)'}`);
  console.log('');
  console.log('🔍 Scanning src/ for SSoT violations...');

  const allFiles = listSrcFiles(exemptRe);
  const numWorkers = Math.min(os.cpus().length, 8);
  const batchSize = Math.max(1, Math.ceil(allFiles.length / numWorkers));
  const batches = [];
  for (let i = 0; i < allFiles.length; i += batchSize) {
    batches.push(allFiles.slice(i, i + batchSize));
  }

  const workerPromises = batches.map(files => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: {
        files,
        modules: modules.map(m => ({ name: m.name, regexes: m.regexes, allowlist: m.allowlist })),
        cachedFiles,
      },
    });
    worker.on('message', resolve);
    worker.on('error', reject);
  }));

  const results = await Promise.all(workerPromises);

  const filesOut = {};
  const newCacheFiles = {};
  let totalViolations = 0;

  for (const batch of results) {
    for (const [file, { hash, total }] of Object.entries(batch)) {
      newCacheFiles[file] = { hash, total };
      if (total > 0) {
        filesOut[file] = total;
        totalViolations += total;
      }
    }
  }

  const totalFiles = Object.keys(filesOut).length;
  console.log(`  Files with violations: ${totalFiles}`);
  console.log(`  Total violations:      ${totalViolations}`);

  const baseline = {
    _meta: {
      description: 'SSoT centralized-module violations baseline (ratchet pattern)',
      generated: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      totalViolations,
      totalFiles,
      rule: 'Counts can only decrease. New files = zero tolerance.',
      registry: '.ssot-registry.json',
    },
    files: filesOut,
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n');

  fs.writeFileSync(CACHE_FILE, JSON.stringify({ registryHash, files: newCacheFiles }));

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('');
  console.log(`✅ Baseline written: ${BASELINE_FILE}  (${elapsed}s, ${numWorkers} workers)`);
  if (!WRITE_CANONICAL) {
    console.log('   (dry-run — canonical file untouched. Use --write to overwrite .ssot-violations-baseline.json)');
  }
  console.log('   Run: npm run ssot:audit (to see full report)');
}

main().catch(err => {
  console.error('❌ Engine error:', err);
  process.exit(1);
});
