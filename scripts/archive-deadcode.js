#!/usr/bin/env node
/**
 * archive-deadcode — copies a file to the external dead-code archive folder.
 * Used by the pre-commit hook (CHECK 3.22 Part A) when the user opts in.
 * No guards — the hook already validated the file is dead.
 *
 * Usage: node scripts/archive-deadcode.js <rel-path>
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARCHIVE_DIR = process.env.DEADCODE_ARCHIVE_DIR ?? 'C:\\Nestor_Pagonis_Dead_Files';

const relArg = process.argv[2];
if (!relArg) {
  console.error('Usage: node scripts/archive-deadcode.js <rel-path>');
  process.exit(1);
}

const absPath = path.resolve(ROOT, relArg);
if (!fs.existsSync(absPath)) {
  console.error(`File not found: ${relArg}`);
  process.exit(1);
}

function getDateFolder() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function getGitMeta() {
  const result = spawnSync(
    'git', ['log', '-1', '--format=%H|%s|%an|%aI', '--', relArg],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
  );
  const line = (result.stdout ?? '').trim();
  if (!line) return null;
  const [hash, subject, author, date] = line.split('|');
  return { hash, subject, author, date };
}

const dateFolder = getDateFolder();
const targetDir = path.join(ARCHIVE_DIR, dateFolder, path.dirname(relArg));
const baseName = path.basename(relArg);
const ext = path.extname(baseName);
const stem = path.basename(baseName, ext);

fs.mkdirSync(targetDir, { recursive: true });

let targetFile = path.join(targetDir, baseName);
let counter = 1;
while (fs.existsSync(targetFile)) {
  targetFile = path.join(targetDir, `${stem}.${counter}${ext}`);
  counter++;
}

fs.copyFileSync(absPath, targetFile);

const meta = {
  archived_at: new Date().toISOString(),
  original_path: relArg.replace(/\\/g, '/'),
  archive_path: targetFile.replace(/\\/g, '/'),
  git: getGitMeta(),
};
fs.writeFileSync(`${targetFile}.meta.json`, JSON.stringify(meta, null, 2) + '\n');

console.log(`  📦 ${relArg}`);
console.log(`     → ${targetFile}`);
