#!/usr/bin/env node
/**
 * deadcode:delete — Safe dead-code file deletion with triple guard.
 *
 * Usage:
 *   node scripts/delete-deadcode.js <file> [file2 ...] [--dry-run]
 *   npm run deadcode:delete -- src/path/to/file.ts
 *
 * Guards:
 *   1. File must exist in .deadcode-baseline.json
 *   2. grep confirms zero imports in src/
 *   3. git rm removes the file
 *   4. Baseline regenerated atomically after all deletions
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

function checkNoImports(absPath) {
  const stem = path.basename(absPath, path.extname(absPath));
  const srcDir = path.join(ROOT, 'src');

  const result = spawnSync(
    'grep',
    ['-rl', '--include=*.ts', '--include=*.tsx', stem, srcDir],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const matches = (result.stdout ?? '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => l.replace(/\\/g, '/') !== absPath.replace(/\\/g, '/'));

  if (matches.length === 0) return;

  console.error(`\n❌ IMPORT FOUND — ${path.basename(absPath)} is still referenced:\n`);
  matches.forEach(m => console.error(`   ${repoRelative(m)}`));
  console.error('\nAbort. Fix imports first, then retry.\n');
  process.exit(1);
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
      console.log('   ✅ Zero imports found');
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
