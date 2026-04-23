#!/usr/bin/env node
/**
 * deadcode:delete — Safe dead-code file deletion with seven-layer guard + archive.
 *
 * Usage:
 *   node scripts/delete-deadcode.js <file> [file2 ...] [flags]
 *   npm run deadcode:delete -- src/path/to/file.ts
 *
 * Guards (in order):
 *   1. File must exist in .deadcode-baseline.json              (hard block)
 *   2. Fresh knip scan confirms file STILL unused now          (hard block)
 *   3. Git staleness — warn if file modified in last N months  (soft warn)
 *   4. Barrel detection — warn if file has `export * from`     (soft warn)
 *   5. Static grep across ENTIRE REPO finds zero references    (hard block)
 *   6. Dynamic import scan — warn on template-literal imports  (soft warn)
 *   7. Secrets scan — warn if file contains API_KEY/SECRET/etc (soft warn)
 *   8. Archive to external folder with git metadata            (safety net)
 *   9. git rm + atomic baseline regeneration
 *
 * Flags:
 *   --dry-run            Simulate without changing files
 *   --skip-fresh-check   Skip Guard 2 (knip live scan, ~30s)
 *   --skip-warnings      Silence soft warnings (Guards 3, 4, 6, 7)
 *   --no-archive         Skip Step 8 archive (pure git rm only)
 *   --archive-dir=<path> Custom archive location
 *
 * Env vars:
 *   SKIP_DEADCODE_CHECK=1          Bypass ALL guards (emergency)
 *   DEADCODE_STALENESS_MONTHS=24   Git staleness window (default: 12)
 *   DEADCODE_ARCHIVE_DIR=<path>    Archive root (default: C:\Nestor_Pagonis_Dead_Files)
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

// Archive default location (outside repo → no build impact)
const ARCHIVE_DIR_DEFAULT = 'C:\\Nestor_Pagonis_Dead_Files';

// Heuristic patterns that suggest the file may leak secrets if archived as-is
const SECRET_PATTERNS = [
  { name: 'API_KEY', re: /\b(?:API[_-]?KEY|APIKEY)\b/i },
  { name: 'SECRET', re: /\bSECRET\b/i },
  { name: 'PASSWORD', re: /\bPASSWORD\b/i },
  { name: 'TOKEN', re: /\b(?:ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN|BEARER)\b/i },
  { name: 'PRIVATE_KEY', re: /\bPRIVATE[_-]?KEY\b/i },
];

// ─── CLI parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_FRESH = args.includes('--skip-fresh-check');
const SKIP_WARN = args.includes('--skip-warnings');
const NO_ARCHIVE = args.includes('--no-archive');
const SKIP_CHECK = process.env.SKIP_DEADCODE_CHECK === '1';
const STALENESS_MONTHS = parseInt(process.env.DEADCODE_STALENESS_MONTHS ?? '12', 10);

function parseArchiveDir() {
  const flag = args.find(a => a.startsWith('--archive-dir='));
  if (flag) return flag.slice('--archive-dir='.length);
  return process.env.DEADCODE_ARCHIVE_DIR ?? ARCHIVE_DIR_DEFAULT;
}
const ARCHIVE_DIR = parseArchiveDir();

const files = args.filter(a => !a.startsWith('--'));

if (files.length === 0) {
  console.error('Usage: npm run deadcode:delete -- <file> [file2 ...] [flags]');
  console.error('Flags: --dry-run, --skip-fresh-check, --skip-warnings,');
  console.error('       --no-archive, --archive-dir=<path>');
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

// Guard 2 — freshness re-check: rerun knip NOW to confirm still unused.
// Called ONCE per batch (knip takes ~30s). Returns Set of currently-unused files.
function getFreshUnusedSet() {
  console.log('\n🔎 Running fresh knip scan to verify current state (~30s)...');
  const result = spawnSync('npx', ['knip', '--reporter', 'json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: true,
  });
  let report;
  try {
    report = JSON.parse(result.stdout ?? '');
  } catch {
    console.error('❌ Fresh knip scan failed to parse. Use --skip-fresh-check to bypass.');
    process.exit(1);
  }
  const currentlyUnused = (report.issues ?? [])
    .filter(i => Array.isArray(i.files) && i.files.length > 0)
    .map(i => i.file.replace(/\\/g, '/'));
  return new Set(currentlyUnused);
}

function verifyStillUnused(relPath, freshSet) {
  if (freshSet.has(relPath)) return;
  console.error(`\n❌ STALE BASELINE — ${relPath} is NO LONGER unused.`);
  console.error('   Someone imported it after the baseline was generated.');
  console.error('   Run: npm run deadcode:baseline — then retry, or abandon deletion.\n');
  process.exit(1);
}

// Guard 3 — git staleness: file modified recently = higher risk (WIP integration).
function checkGitStaleness(absPath) {
  if (SKIP_WARN) return;
  const rel = repoRelative(absPath);
  const since = `${STALENESS_MONTHS}.months.ago`;
  const result = spawnSync(
    'git',
    ['log', '--oneline', `--since=${since}`, '--', rel],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
  );
  const lines = (result.stdout ?? '').split('\n').filter(Boolean);
  if (lines.length === 0) return;
  console.warn(`   ⚠️  RECENT ACTIVITY — ${lines.length} commit(s) in last ${STALENESS_MONTHS} months:`);
  lines.slice(0, 3).forEach(l => console.warn(`      ${l}`));
  if (lines.length > 3) console.warn(`      ... and ${lines.length - 3} more`);
  console.warn(`      File may be WIP (not yet imported). Verify manually.\n`);
}

// Guard 4 — barrel file detection: warn if file has `export * from` or `export { } from`.
// Any file can be a barrel (not just index.*). Deletion silently breaks downstream re-exports.
function detectBarrel(absPath) {
  if (SKIP_WARN) return;
  let content;
  try {
    content = fs.readFileSync(absPath, 'utf8');
  } catch {
    return;
  }
  const reExports = content.match(/^\s*export\s+(?:\*|\{[^}]*\})\s+from\s+['"][^'"]+['"]/gm);
  if (!reExports || reExports.length === 0) return;
  console.warn(`   ⚠️  BARREL FILE — ${reExports.length} re-export(s) detected:`);
  reExports.slice(0, 5).forEach(r => console.warn(`      ${r.trim()}`));
  if (reExports.length > 5) console.warn(`      ... and ${reExports.length - 5} more`);
  console.warn(`      Downstream imports may break silently if they use parent paths.\n`);
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

// ─── Archive helpers (Step 8) ─────────────────────────────────────────────────

function getDateFolder() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getGitMeta(absPath) {
  const rel = repoRelative(absPath);
  const result = spawnSync(
    'git',
    ['log', '-1', '--format=%H|%s|%an|%aI', '--', rel],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
  );
  const line = (result.stdout ?? '').trim();
  if (!line) return null;
  const [hash, subject, author, date] = line.split('|');
  return { hash, subject, author, date };
}

// Guard 7 — secrets scan: warn if file contains patterns that might leak.
function checkSecrets(absPath) {
  if (SKIP_WARN) return;
  let content;
  try {
    content = fs.readFileSync(absPath, 'utf8');
  } catch {
    return;
  }
  const hits = SECRET_PATTERNS.filter(p => p.re.test(content));
  if (hits.length === 0) return;
  console.warn(`   ⚠️  SECRETS PATTERN — file mentions: ${hits.map(h => h.name).join(', ')}`);
  console.warn(`      Archive will contain these strings. Use --no-archive if sensitive.\n`);
}

// Step 8 — archive the file outside the repo with full metadata before git rm.
function archiveBeforeDelete(absPath) {
  const rel = repoRelative(absPath);
  const dateFolder = getDateFolder();
  const targetDir = path.join(ARCHIVE_DIR, dateFolder, path.dirname(rel));
  const baseName = path.basename(rel);

  fs.mkdirSync(targetDir, { recursive: true });

  // Collision handling: same file deleted twice in one day → append counter
  let targetFile = path.join(targetDir, baseName);
  let counter = 1;
  const ext = path.extname(baseName);
  const stem = path.basename(baseName, ext);
  while (fs.existsSync(targetFile)) {
    targetFile = path.join(targetDir, `${stem}.${counter}${ext}`);
    counter++;
  }

  fs.copyFileSync(absPath, targetFile);

  const meta = {
    deleted_at: new Date().toISOString(),
    original_path: rel,
    archive_path: targetFile.replace(/\\/g, '/'),
    git: getGitMeta(absPath),
  };
  fs.writeFileSync(`${targetFile}.meta.json`, JSON.stringify(meta, null, 2) + '\n');

  return targetFile;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (DRY_RUN) console.log('🔍 DRY RUN — no files will be deleted\n');

  const baselineSet = SKIP_CHECK ? new Set() : loadBaseline();
  const freshSet = !SKIP_CHECK && !SKIP_FRESH ? getFreshUnusedSet() : null;
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

      if (freshSet) {
        verifyStillUnused(relPath, freshSet);
        console.log('   ✅ Fresh knip scan confirms still unused');
      }

      checkGitStaleness(absPath);
      detectBarrel(absPath);

      checkNoImports(absPath);
      console.log('   ✅ Zero static references (entire repo scanned)');

      if (!NO_ARCHIVE) checkSecrets(absPath);
    }

    if (DRY_RUN) {
      if (!NO_ARCHIVE) {
        const dateFolder = getDateFolder();
        const previewPath = path.join(ARCHIVE_DIR, dateFolder, relPath);
        console.log(`   🔍 [dry-run] Would archive to: ${previewPath}`);
      }
      console.log('   🔍 [dry-run] Would git rm this file');
      continue;
    }

    if (!NO_ARCHIVE) {
      const archived = archiveBeforeDelete(absPath);
      console.log(`   📦 Archived → ${archived}`);
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
