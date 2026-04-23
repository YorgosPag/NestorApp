#!/usr/bin/env node
/**
 * deadcode:delete — Safe dead-code file deletion with quadruple guard.
 *
 * Usage:
 *   node scripts/delete-deadcode.js <file> [file2 ...] [--dry-run]
 *   npm run deadcode:delete -- src/path/to/file.ts
 *
 * Guards:
 *   1. File must exist in .deadcode-baseline.json
 *   2. Static grep across ENTIRE REPO (not just src/) finds zero references
 *   3. Dynamic import scan warns if template-literal imports mention the stem
 *   4. git rm removes the file; baseline regenerated atomically after all deletions
 *
 * Escape hatch:
 *   SKIP_DEADCODE_CHECK=1 node scripts/delete-deadcode.js <file>
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(ROOT, '.deadcode-baseline.json');

// Dirs excluded from grep (never contain app imports)
const GREP_EXCLUDE_DIRS = [
  'node_modules', '.git', '.next', 'dist', 'build', '.turbo', 'coverage',
];
// Extensions to scan — all files that can import TS modules
const GREP_INCLUDE_EXTS = ['*.ts', '*.tsx', '*.js', '*.mjs', '*.cjs'];

// ─── CLI parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_CHECK = process.env.SKIP_DEADCODE_CHECK === '1';
const files = args.filter(a => !a.startsWith('--'));

if (files.length === 0) {
  console.error('Usage: npm run deadcode:delete -- <file> [file2 ...] [--dry-run]');
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeToRepoPath(rawPath) {
  const abs = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
  return abs.replace(/\\/g, '/');
}

function repoRelative(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, '/');
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.error('❌ .deadcode-baseline.json not found. Run: npm run deadcode:baseline');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  return new Set((raw.files ?? []).map(f => f.replace(/\\/g, '/')));
}

function checkInBaseline(relPath, baselineSet) {
  if (baselineSet.has(relPath)) return;
  console.error(`❌ NOT in baseline: ${relPath}`);
  console.error('   File is not marked as unused. Run deadcode:audit to verify.');
  process.exit(1);
}

function buildGrepArgs(stem) {
  const excludes = GREP_EXCLUDE_DIRS.flatMap(d => ['--exclude-dir', d]);
  const includes = GREP_INCLUDE_EXTS.flatMap(e => ['--include', e]);
  return ['-rl', ...excludes, ...includes, stem, ROOT];
}

// Guard 2A — static references across entire repo (scripts/, tools/, config files, etc.)
function findStaticReferences(absPath) {
  const stem = path.basename(absPath, path.extname(absPath));
  const result = spawnSync('grep', buildGrepArgs(stem), {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return (result.stdout ?? '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/\\/g, '/'))
    .filter(l => l !== absPath.replace(/\\/g, '/'));
}

// Guard 2B — dynamic import risk: files that use import(`...`) AND mention the stem.
// These are warnings, not hard blocks (template expressions can't be statically resolved).
function findDynamicImportRisk(absPath) {
  const stem = path.basename(absPath, path.extname(absPath));
  const dynamicResult = spawnSync('grep', buildGrepArgs('import(`'), {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const filesWithDynamic = (dynamicResult.stdout ?? '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  return filesWithDynamic.filter(f => {
    try {
      return fs.readFileSync(f, 'utf8').includes(stem);
    } catch {
      return false;
    }
  });
}

function checkNoImports(absPath) {
  const name = path.basename(absPath);

  const staticRefs = findStaticReferences(absPath);
  if (staticRefs.length > 0) {
    console.error(`\n❌ STATIC REFERENCE FOUND — ${name} is still imported:\n`);
    staticRefs.forEach(m => console.error(`   ${repoRelative(m)}`));
    console.error('\nAbort. Remove imports first, then retry.\n');
    process.exit(1);
  }

  const dynamicRisk = findDynamicImportRisk(absPath);
  if (dynamicRisk.length > 0) {
    console.warn(`\n⚠️  DYNAMIC IMPORT WARNING — ${name} stem found in template-literal imports:`);
    dynamicRisk.forEach(f => console.warn(`   ${repoRelative(f)}`));
    console.warn('   Verify manually — dynamic resolution cannot be statically guaranteed.\n');
    // Not a hard block — knip already confirmed unused, this is belt-and-suspenders hint.
  }
}

function gitRm(absPath) {
  const rel = repoRelative(absPath);
  const result = spawnSync('git', ['rm', '--force', rel], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    console.error(`❌ git rm failed for ${rel}:`);
    console.error(result.stderr ?? result.stdout);
    process.exit(1);
  }
}

function regenerateBaseline() {
  console.log('\n🔄 Regenerating baseline...');
  const result = spawnSync('node', ['scripts/generate-deadcode-baseline.js'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    console.error('❌ Baseline regeneration failed.');
    process.exit(1);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (DRY_RUN) console.log('🔍 DRY RUN — no files will be deleted\n');

  const baselineSet = SKIP_CHECK ? new Set() : loadBaseline();
  const deleted = [];

  for (const rawArg of files) {
    const absPath = normalizeToRepoPath(rawArg);
    const relPath = repoRelative(absPath);

    console.log(`\n📄 ${relPath}`);

    if (!fs.existsSync(absPath)) {
      console.log(`   ⚠️  Already deleted — skipping`);
      continue;
    }

    if (!SKIP_CHECK) {
      checkInBaseline(relPath, baselineSet);
      console.log('   ✅ In baseline');

      checkNoImports(absPath);
      console.log('   ✅ Zero static references (entire repo scanned)');
    }

    if (DRY_RUN) {
      console.log('   🔍 [dry-run] Would git rm this file');
      continue;
    }

    gitRm(absPath);
    console.log('   🗑️  git rm done');
    deleted.push(relPath);
  }

  if (deleted.length === 0) {
    console.log(DRY_RUN ? '\nDry run complete. No files changed.' : '\nNothing deleted.');
    return;
  }

  console.log(`\n✅ Deleted ${deleted.length} file(s).`);
  regenerateBaseline();
  console.log('\n🎯 Done. Baseline updated. Ready to commit with: git commit');
}

main();
